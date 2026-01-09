import User from "../../schema/user.schema.js";
import CustomerAddress from "../../schema/customerAddress.schema.js";
import Order from "../../schema/order.schema.js";
import Kitchen from "../../schema/kitchen.schema.js";
import MenuItem from "../../schema/menuItem.schema.js";
import Voucher from "../../schema/voucher.schema.js";
import Zone from "../../schema/zone.schema.js";
import { sendResponse } from "../../utils/response.utils.js";
import { checkCutoffTime, getCurrentMealWindow } from "../../services/config.service.js";
import { getAvailableVoucherCount } from "../../services/voucher.service.js";

/**
 * Customer Controller
 * Handles customer profile management
 */

const DIETARY_PREFERENCES = ["VEG", "NON_VEG", "VEGAN", "JAIN", "EGGETARIAN"];

/**
 * Helper: Check if profile is complete
 * @param {Object} user - User document
 * @returns {Object} Completeness status
 */
const isProfileComplete = (user) => {
  const missingFields = [];

  if (!user.name) missingFields.push("name");

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
};

/**
 * Check if customer profile is complete
 *
 * GET /api/customer/profile/status
 */
export const checkProfileCompleteness = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return sendResponse(res, 401, "User not found");
    }

    const status = isProfileComplete(user);

    return sendResponse(res, 200, "Profile status", {
      isComplete: status.isComplete,
      missingFields: status.missingFields,
      profile: status.isComplete ? user.toJSON() : undefined,
    });
  } catch (error) {
    console.log("> Check profile completeness error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Complete customer profile during onboarding
 *
 * POST /api/customer/profile/complete
 */
export const completeProfile = async (req, res) => {
  try {
    const { name, email, dietaryPreferences } = req.body;
    const user = req.user;

    if (!user) {
      return sendResponse(res, 401, "User not found");
    }

    // Update profile fields
    user.name = name.trim();
    if (email) user.email = email.trim();
    if (dietaryPreferences) user.dietaryPreferences = dietaryPreferences;

    await user.save();

    return sendResponse(res, 200, "Profile completed successfully", {
      user: user.toJSON(),
    });
  } catch (error) {
    console.log("> Complete profile error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get current customer profile
 *
 * GET /api/customer/profile
 */
export const getProfile = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return sendResponse(res, 401, "User not found");
    }

    return sendResponse(res, 200, "Profile retrieved", {
      user: user.toJSON(),
    });
  } catch (error) {
    console.log("> Get profile error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Update customer profile
 *
 * PUT /api/customer/profile
 */
export const updateProfile = async (req, res) => {
  try {
    const { name, email, dietaryPreferences, profileImage } = req.body;
    const user = req.user;

    if (!user) {
      return sendResponse(res, 401, "User not found");
    }

    // Update only provided fields
    if (name !== undefined) user.name = name.trim();
    if (email !== undefined) user.email = email?.trim() || undefined;
    if (dietaryPreferences !== undefined) user.dietaryPreferences = dietaryPreferences;
    if (profileImage !== undefined) user.profileImage = profileImage || undefined;

    await user.save();

    return sendResponse(res, 200, "Profile updated successfully", {
      user: user.toJSON(),
    });
  } catch (error) {
    console.log("> Update profile error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Update dietary preferences only
 *
 * PATCH /api/customer/profile/dietary-preferences
 */
export const updateDietaryPreferences = async (req, res) => {
  try {
    const { dietaryPreferences } = req.body;
    const user = req.user;

    if (!user) {
      return sendResponse(res, 401, "User not found");
    }

    user.dietaryPreferences = dietaryPreferences;
    await user.save();

    return sendResponse(res, 200, "Dietary preferences updated", {
      dietaryPreferences: user.dietaryPreferences,
    });
  } catch (error) {
    console.log("> Update dietary preferences error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Update profile image
 *
 * PATCH /api/customer/profile/image
 */
export const updateProfileImage = async (req, res) => {
  try {
    const { profileImage } = req.body;
    const user = req.user;

    if (!user) {
      return sendResponse(res, 401, "User not found");
    }

    user.profileImage = profileImage;
    await user.save();

    return sendResponse(res, 200, "Profile image updated", {
      profileImage: user.profileImage,
    });
  } catch (error) {
    console.log("> Update profile image error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Delete customer account (soft delete)
 *
 * DELETE /api/customer/profile
 */
export const deleteAccount = async (req, res) => {
  try {
    const { reason, confirmPhone } = req.body;
    const user = req.user;

    if (!user) {
      return sendResponse(res, 401, "User not found");
    }

    // Verify phone confirmation (last 4 digits)
    const last4Digits = user.phone.slice(-4);
    if (confirmPhone !== last4Digits) {
      return sendResponse(res, 400, "Phone confirmation does not match");
    }

    // Check for active orders
    const activeOrders = await Order.countDocuments({
      userId: user._id,
      status: {
        $in: [
          "PLACED",
          "CONFIRMED",
          "PREPARING",
          "READY_FOR_PICKUP",
          "OUT_FOR_DELIVERY",
        ],
      },
    });

    if (activeOrders > 0) {
      return sendResponse(
        res,
        400,
        "Cannot delete account with active orders. Please wait for orders to complete."
      );
    }

    // Soft delete user
    user.status = "DELETED";
    user.deletedAt = new Date();
    user.deletionReason = reason;
    await user.save();

    // Soft delete all addresses
    await CustomerAddress.updateMany(
      { userId: user._id },
      { $set: { isDeleted: true } }
    );

    console.log(`> Customer account deleted: ${user.phone}`);

    return sendResponse(res, 200, "Account scheduled for deletion");
  } catch (error) {
    console.log("> Delete account error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * ============================================================================
 * CONSUMER HOME & BROWSE FUNCTIONS
 * ============================================================================
 */

/**
 * Helper: Anonymize kitchen info for consumer view
 * Consumers should not see internal kitchen details, only fulfillment type
 * @param {Object} kitchen - Kitchen document
 * @returns {Object} Anonymized kitchen info
 */
const anonymizeKitchenForConsumer = (kitchen) => {
  if (!kitchen) return null;

  return {
    id: kitchen._id,
    // Consumer sees generic branding, not internal kitchen name
    displayName: kitchen.type === "TIFFSY" ? "Tiffsy Kitchen" : "Partner Kitchen",
    fulfilledBy: kitchen.type === "TIFFSY" ? "Fulfilled by Tiffsy" : "Fulfilled by Partner Kitchen",
    type: kitchen.type,
    // Only show flags that matter to consumer
    isPremium: kitchen.premiumFlag || false,
    isGourmet: kitchen.gourmetFlag || false,
    // Rating can be shown
    rating: kitchen.averageRating,
    totalRatings: kitchen.totalRatings,
    // Do NOT expose: name, address, owner details, contact info
  };
};

/**
 * Helper: Select primary kitchen from list
 * Priority: TIFFSY first, then by rating, then by order acceptance
 * @param {Array} kitchens - List of kitchen documents
 * @returns {Object} Primary kitchen
 */
const selectPrimaryKitchen = (kitchens) => {
  if (!kitchens || kitchens.length === 0) return null;
  if (kitchens.length === 1) return kitchens[0];

  // Sort: TIFFSY first, then by rating (descending)
  const sorted = [...kitchens].sort((a, b) => {
    // TIFFSY kitchens get priority
    if (a.type === "TIFFSY" && b.type !== "TIFFSY") return -1;
    if (b.type === "TIFFSY" && a.type !== "TIFFSY") return 1;
    // Then by rating
    return (b.averageRating || 0) - (a.averageRating || 0);
  });

  return sorted[0];
};

/**
 * Helper: Build menu items response for a kitchen
 * @param {string} kitchenId - Kitchen ID
 * @returns {Object} Menu structure { mealMenu, onDemandMenu }
 */
const buildMenuForKitchen = async (kitchenId) => {
  const menuItems = await MenuItem.find({
    kitchenId,
    status: "ACTIVE",
    isAvailable: true,
  })
    .populate("addonIds", "name price isAvailable category")
    .sort({ displayOrder: 1, createdAt: -1 });

  const mealMenu = { lunch: null, dinner: null };
  const onDemandMenu = [];

  for (const item of menuItems) {
    const itemResponse = {
      id: item._id,
      name: item.name,
      description: item.description,
      category: item.category,
      menuType: item.menuType,
      mealWindow: item.mealWindow,
      price: item.price,
      discountedPrice: item.discountedPrice,
      portionSize: item.portionSize,
      dietaryType: item.dietaryType,
      isJainFriendly: item.isJainFriendly,
      spiceLevel: item.spiceLevel,
      images: item.images,
      thumbnailImage: item.thumbnailImage,
      includes: item.includes,
      isFeatured: item.isFeatured,
      addons: item.addonIds.filter(a => a.isAvailable).map(addon => ({
        id: addon._id,
        name: addon.name,
        price: addon.price,
        category: addon.category,
      })),
    };

    if (item.menuType === "MEAL_MENU") {
      const cutoffInfo = checkCutoffTime(item.mealWindow);
      itemResponse.cutoffTime = cutoffInfo.cutoffTime;
      itemResponse.isPastCutoff = cutoffInfo.isPastCutoff;
      itemResponse.canUseVoucher = !cutoffInfo.isPastCutoff;
      itemResponse.cutoffMessage = cutoffInfo.message;

      if (item.mealWindow === "LUNCH") {
        mealMenu.lunch = itemResponse;
      } else if (item.mealWindow === "DINNER") {
        mealMenu.dinner = itemResponse;
      }
    } else {
      onDemandMenu.push(itemResponse);
    }
  }

  return { mealMenu, onDemandMenu };
};

/**
 * Get consumer home feed with menu for selected address
 * Auto-selects primary kitchen with option to switch to alternatives
 *
 * GET /api/customer/home
 * Query:
 *   - addressId (optional - uses default if not provided)
 *   - kitchenId (optional - switch to specific kitchen)
 */
export const getHomeFeed = async (req, res) => {
  try {
    const userId = req.user._id;
    const { addressId, kitchenId } = req.query;

    // Get user's address (specific or default)
    let address;
    if (addressId) {
      address = await CustomerAddress.findOne({
        _id: addressId,
        userId,
        isDeleted: false,
      }).populate("zoneId");
    } else {
      address = await CustomerAddress.findOne({
        userId,
        isDefault: true,
        isDeleted: false,
      }).populate("zoneId");
    }

    // If no address found, return setup required state
    if (!address) {
      return sendResponse(res, 200, true, "Add address to see available menu", {
        requiresAddressSetup: true,
        addresses: [],
        menu: null,
      });
    }

    // Check if address is serviceable
    if (!address.isServiceable || !address.zoneId) {
      return sendResponse(res, 200, true, "Address not serviceable", {
        isServiceable: false,
        address: {
          id: address._id,
          label: address.label,
          locality: address.locality,
          city: address.city,
        },
        message: "We don't deliver to this location yet. Try a different address.",
      });
    }

    // Find ALL active kitchens serving this zone
    const allKitchens = await Kitchen.find({
      zonesServed: address.zoneId._id,
      status: "ACTIVE",
      isAcceptingOrders: true,
    });

    if (!allKitchens || allKitchens.length === 0) {
      return sendResponse(res, 200, true, "No kitchen available", {
        isServiceable: true,
        kitchenAvailable: false,
        address: {
          id: address._id,
          label: address.label,
          locality: address.locality,
        },
        message: "No kitchen currently serving your area. Please check back later.",
      });
    }

    // Select kitchen: use specified kitchenId or auto-select primary
    let selectedKitchen;
    if (kitchenId) {
      selectedKitchen = allKitchens.find(k => k._id.toString() === kitchenId);
      if (!selectedKitchen) {
        // Fallback to primary if specified kitchen not found/not serving zone
        selectedKitchen = selectPrimaryKitchen(allKitchens);
      }
    } else {
      selectedKitchen = selectPrimaryKitchen(allKitchens);
    }

    // Build alternative kitchens list (excluding selected)
    const alternativeKitchens = allKitchens
      .filter(k => k._id.toString() !== selectedKitchen._id.toString())
      .map(k => anonymizeKitchenForConsumer(k));

    // Get current meal window info
    const mealWindowInfo = getCurrentMealWindow();

    // Build menu for selected kitchen
    const { mealMenu, onDemandMenu } = await buildMenuForKitchen(selectedKitchen._id);

    // Get user's voucher balance
    const lunchVouchers = await getAvailableVoucherCount(userId, "LUNCH");
    const dinnerVouchers = await getAvailableVoucherCount(userId, "DINNER");
    const anyVouchers = await getAvailableVoucherCount(userId, null);

    return sendResponse(res, 200, true, "Home feed", {
      address: {
        id: address._id,
        label: address.label,
        addressLine1: address.addressLine1,
        locality: address.locality,
        city: address.city,
      },
      // Anonymized kitchen info - consumer doesn't see internal kitchen name
      kitchen: anonymizeKitchenForConsumer(selectedKitchen),
      // Internal kitchen ID for ordering (not exposed in UI but needed for API)
      _kitchenId: selectedKitchen._id,
      // Alternative kitchens user can switch to
      alternativeKitchens,
      hasAlternatives: alternativeKitchens.length > 0,
      mealWindow: mealWindowInfo,
      menu: {
        mealMenu,
        onDemandMenu,
      },
      vouchers: {
        lunch: lunchVouchers,
        dinner: dinnerVouchers,
        total: anyVouchers,
      },
    });
  } catch (error) {
    console.log("> Get home feed error:", error);
    return sendResponse(res, 500, false, "Failed to load home feed");
  }
};

/**
 * Get detailed menu for a meal window (with full addon details)
 *
 * GET /api/customer/menu/:mealWindow
 * Params: mealWindow (LUNCH or DINNER)
 * Query:
 *   - addressId (optional - uses default if not provided)
 *   - kitchenId (optional - use specific kitchen)
 */
export const getMealMenu = async (req, res) => {
  try {
    const userId = req.user._id;
    const { mealWindow } = req.params;
    const { addressId, kitchenId } = req.query;

    if (!["LUNCH", "DINNER"].includes(mealWindow.toUpperCase())) {
      return sendResponse(res, 400, false, "Invalid meal window");
    }

    const normalizedMealWindow = mealWindow.toUpperCase();

    // Get user's address
    let address;
    if (addressId) {
      address = await CustomerAddress.findOne({
        _id: addressId,
        userId,
        isDeleted: false,
      });
    } else {
      address = await CustomerAddress.findOne({
        userId,
        isDefault: true,
        isDeleted: false,
      });
    }

    if (!address || !address.isServiceable || !address.zoneId) {
      return sendResponse(res, 400, false, "No serviceable address found");
    }

    // Find kitchen(s) for zone
    let kitchen;
    if (kitchenId) {
      // User specified a kitchen - verify it serves this zone
      kitchen = await Kitchen.findOne({
        _id: kitchenId,
        zonesServed: address.zoneId,
        status: "ACTIVE",
        isAcceptingOrders: true,
      });
    }

    if (!kitchen) {
      // No kitchen specified or specified one doesn't serve zone - use primary
      const allKitchens = await Kitchen.find({
        zonesServed: address.zoneId,
        status: "ACTIVE",
        isAcceptingOrders: true,
      });
      kitchen = selectPrimaryKitchen(allKitchens);
    }

    if (!kitchen) {
      return sendResponse(res, 404, false, "No kitchen available for your area");
    }

    // Get meal menu item
    const menuItem = await MenuItem.findOne({
      kitchenId: kitchen._id,
      menuType: "MEAL_MENU",
      mealWindow: normalizedMealWindow,
      status: "ACTIVE",
    }).populate("addonIds");

    if (!menuItem) {
      return sendResponse(res, 200, true, "No menu available", {
        available: false,
        mealWindow: normalizedMealWindow,
        message: `No ${normalizedMealWindow.toLowerCase()} menu available today`,
      });
    }

    // Get cutoff info
    const cutoffInfo = checkCutoffTime(normalizedMealWindow);

    // Get user's vouchers for this meal window
    const availableVouchers = await getAvailableVoucherCount(userId, normalizedMealWindow);

    return sendResponse(res, 200, true, "Meal menu", {
      available: true,
      mealWindow: normalizedMealWindow,
      kitchen: anonymizeKitchenForConsumer(kitchen),
      _kitchenId: kitchen._id,
      item: {
        id: menuItem._id,
        name: menuItem.name,
        description: menuItem.description,
        price: menuItem.price,
        discountedPrice: menuItem.discountedPrice,
        portionSize: menuItem.portionSize,
        dietaryType: menuItem.dietaryType,
        isJainFriendly: menuItem.isJainFriendly,
        spiceLevel: menuItem.spiceLevel,
        images: menuItem.images,
        thumbnailImage: menuItem.thumbnailImage,
        includes: menuItem.includes,
        addons: menuItem.addonIds
          .filter(a => a.isAvailable && a.status === "ACTIVE")
          .map(addon => ({
            id: addon._id,
            name: addon.name,
            description: addon.description,
            price: addon.price,
            category: addon.category,
            minQuantity: addon.minQuantity,
            maxQuantity: addon.maxQuantity,
          })),
      },
      cutoff: {
        time: cutoffInfo.cutoffTime,
        isPastCutoff: cutoffInfo.isPastCutoff,
        message: cutoffInfo.message,
      },
      vouchers: {
        available: availableVouchers,
        canUse: !cutoffInfo.isPastCutoff,
        message: cutoffInfo.isPastCutoff
          ? "Cutoff time passed - vouchers cannot be used"
          : `You have ${availableVouchers} voucher(s) available`,
      },
    });
  } catch (error) {
    console.log("> Get meal menu error:", error);
    return sendResponse(res, 500, false, "Failed to load meal menu");
  }
};

/**
 * Check serviceability for an address (Blinkit/Zepto style)
 * Returns simple yes/no for whether we deliver to a pincode
 *
 * POST /api/customer/check-serviceability
 * Body: { pincode } or { zoneId }
 */
export const checkServiceability = async (req, res) => {
  try {
    const { pincode, zoneId } = req.body;

    if (!pincode && !zoneId) {
      return sendResponse(res, 400, false, "Pincode or zoneId is required");
    }

    // Find zone by pincode or zoneId
    let zone;
    if (zoneId) {
      zone = await Zone.findOne({
        _id: zoneId,
        status: "ACTIVE",
        orderingEnabled: true,
      });
    } else if (pincode) {
      // Zone has single pincode field (1 pincode = 1 zone)
      zone = await Zone.findOne({
        pincode: pincode,
        status: "ACTIVE",
        orderingEnabled: true,
      });
    }

    if (!zone) {
      return sendResponse(res, 200, true, "Location check", {
        isServiceable: false,
        message: "We don't deliver to this location yet",
      });
    }

    // Check if any active kitchen serves this zone
    const kitchenExists = await Kitchen.exists({
      zonesServed: zone._id,
      status: "ACTIVE",
      isAcceptingOrders: true,
    });

    if (!kitchenExists) {
      return sendResponse(res, 200, true, "Location check", {
        isServiceable: false,
        message: "We don't deliver to this location yet",
      });
    }

    // Simple yes response - user asked for serviceability only
    return sendResponse(res, 200, true, "Location check", {
      isServiceable: true,
      message: "We deliver to this location!",
    });
  } catch (error) {
    console.log("> Check serviceability error:", error);
    return sendResponse(res, 500, false, "Failed to check serviceability");
  }
};

export default {
  checkProfileCompleteness,
  completeProfile,
  getProfile,
  updateProfile,
  updateDietaryPreferences,
  updateProfileImage,
  deleteAccount,
  // Consumer home & browse
  getHomeFeed,
  getMealMenu,
  checkServiceability,
};
