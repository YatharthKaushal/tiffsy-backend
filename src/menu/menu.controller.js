import MenuItem from "../../schema/menuItem.schema.js";
import Addon from "../../schema/addon.schema.js";
import Kitchen from "../../schema/kitchen.schema.js";
import { sendResponse } from "../../utils/response.utils.js";
import { safeAuditLog } from "../../utils/audit.utils.js";

/**
 * Menu Controller
 * Handles menu item CRUD operations
 */

// Cutoff times for meal windows (HH:MM format in IST)
const CUTOFF_TIMES = {
  LUNCH: "11:00",
  DINNER: "21:00",
};

/**
 * Helper: Validate addon IDs belong to kitchen
 * @param {Array<ObjectId>} addonIds - Addon IDs to validate
 * @param {ObjectId} kitchenId - Kitchen ID
 * @returns {Promise<Object>} { valid: Boolean, addons: Array, invalid: Array }
 */
const validateAddonIds = async (addonIds, kitchenId) => {
  if (!addonIds || addonIds.length === 0) {
    return { valid: true, addons: [], invalid: [] };
  }

  const addons = await Addon.find({
    _id: { $in: addonIds },
    kitchenId,
    status: "ACTIVE",
  });

  const foundIds = addons.map((a) => a._id.toString());
  const invalid = addonIds.filter((id) => !foundIds.includes(id.toString()));

  return {
    valid: invalid.length === 0,
    addons,
    invalid,
  };
};

/**
 * Helper: Check if meal window already has an item
 * @param {ObjectId} kitchenId - Kitchen ID
 * @param {String} mealWindow - LUNCH or DINNER
 * @param {ObjectId} excludeItemId - Item ID to exclude from check
 * @returns {Promise<Object>} { hasItem: Boolean, item: Object | null }
 */
const checkMealWindowAvailability = async (
  kitchenId,
  mealWindow,
  excludeItemId = null
) => {
  const query = {
    kitchenId,
    menuType: "MEAL_MENU",
    mealWindow,
    status: "ACTIVE",
  };

  if (excludeItemId) {
    query._id = { $ne: excludeItemId };
  }

  const existingItem = await MenuItem.findOne(query).select("_id name");
  return {
    hasItem: !!existingItem,
    item: existingItem,
  };
};

/**
 * Helper: Check if current time is past cutoff for meal window
 * @param {String} mealWindow - LUNCH or DINNER
 * @returns {Object} { isPastCutoff: Boolean, cutoffTime: String }
 */
const checkCutoffTime = (mealWindow) => {
  const now = new Date();
  const cutoffTime = CUTOFF_TIMES[mealWindow];
  const [cutoffHour, cutoffMin] = cutoffTime.split(":").map(Number);

  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffHour, cutoffMin, 0, 0);

  return {
    isPastCutoff: now >= cutoffDate,
    cutoffTime,
  };
};

/**
 * Create a new menu item
 *
 * POST /api/menu
 */
export const createMenuItem = async (req, res) => {
  try {
    const {
      kitchenId: bodyKitchenId,
      name,
      description,
      category,
      menuType,
      mealWindow,
      price,
      discountedPrice,
      portionSize,
      preparationTime,
      dietaryType,
      isJainFriendly,
      spiceLevel,
      images,
      thumbnailImage,
      addonIds,
      includes,
      isAvailable,
      displayOrder,
      isFeatured,
    } = req.body;

    // Determine kitchen ID
    let kitchenId;
    if (req.user.role === "KITCHEN_STAFF") {
      kitchenId = req.user.kitchenId;
      if (!kitchenId) {
        return sendResponse(res, 400, "No kitchen assigned to your account");
      }
    } else {
      // Admin must provide kitchenId
      if (!bodyKitchenId) {
        return sendResponse(res, 400, "Kitchen ID is required");
      }
      kitchenId = bodyKitchenId;
    }

    // Verify kitchen exists and is active
    const kitchen = await Kitchen.findById(kitchenId);
    if (!kitchen) {
      return sendResponse(res, 404, "Kitchen not found");
    }
    if (kitchen.status !== "ACTIVE") {
      return sendResponse(res, 400, "Kitchen is not active");
    }

    // For MEAL_MENU, check if meal window already has an item
    if (menuType === "MEAL_MENU") {
      const { hasItem, item: existingItem } = await checkMealWindowAvailability(
        kitchenId,
        mealWindow
      );
      if (hasItem) {
        return sendResponse(
          res,
          400,
          `Kitchen already has a ${mealWindow} menu item: ${existingItem.name}. Delete or update the existing item.`
        );
      }
    }

    // Validate addon IDs if provided
    if (addonIds && addonIds.length > 0) {
      const { valid, invalid } = await validateAddonIds(addonIds, kitchenId);
      if (!valid) {
        return sendResponse(
          res,
          400,
          `Invalid or inactive addon IDs: ${invalid.join(", ")}`
        );
      }
    }

    const menuItem = new MenuItem({
      kitchenId,
      name,
      description,
      category: category || "MAIN_COURSE",
      menuType,
      mealWindow: menuType === "MEAL_MENU" ? mealWindow : undefined,
      price,
      discountedPrice,
      portionSize,
      preparationTime,
      dietaryType,
      isJainFriendly: isJainFriendly || false,
      spiceLevel,
      images: images || [],
      thumbnailImage,
      addonIds: addonIds || [],
      includes: includes || [],
      isAvailable: isAvailable !== undefined ? isAvailable : true,
      displayOrder,
      isFeatured: isFeatured || false,
      status: "ACTIVE",
      createdBy: req.user._id,
    });

    await menuItem.save();

    // Populate addons for response
    await menuItem.populate("addonIds");

    console.log(`> Menu item created: ${name} (${menuType})`);

    return sendResponse(res, 201, "Menu item created successfully", {
      menuItem,
    });
  } catch (error) {
    console.log("> Create menu item error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get menu items with filters
 *
 * GET /api/menu
 */
export const getMenuItems = async (req, res) => {
  try {
    const {
      kitchenId: queryKitchenId,
      menuType,
      mealWindow,
      category,
      dietaryType,
      isAvailable,
      status,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    // Determine kitchen ID
    let kitchenId;
    if (req.user?.role === "KITCHEN_STAFF") {
      kitchenId = req.user.kitchenId;
    } else if (queryKitchenId) {
      kitchenId = queryKitchenId;
    }

    // Build query
    const query = {};

    if (kitchenId) query.kitchenId = kitchenId;
    if (menuType) query.menuType = menuType;
    if (mealWindow) query.mealWindow = mealWindow;
    if (category) query.category = category;
    if (dietaryType) query.dietaryType = dietaryType;
    if (isAvailable !== undefined) query.isAvailable = isAvailable === "true";

    // Status filtering based on role
    if (req.user?.role === "ADMIN" && status) {
      query.status = status;
    } else if (!req.user || req.user.role === "CUSTOMER") {
      query.status = "ACTIVE";
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [menuItems, total] = await Promise.all([
      MenuItem.find(query)
        .populate("addonIds", "name price isAvailable")
        .sort({ menuType: 1, mealWindow: 1, displayOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      MenuItem.countDocuments(query),
    ]);

    // Group into structured response
    const mealMenu = { lunch: null, dinner: null };
    const onDemandMenu = [];

    for (const item of menuItems) {
      if (item.menuType === "MEAL_MENU") {
        if (item.mealWindow === "LUNCH") {
          mealMenu.lunch = item;
        } else if (item.mealWindow === "DINNER") {
          mealMenu.dinner = item;
        }
      } else {
        onDemandMenu.push(item);
      }
    }

    return sendResponse(res, 200, "Menu items retrieved", {
      menuItems,
      mealMenu,
      onDemandMenu,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.log("> Get menu items error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get menu item by ID
 *
 * GET /api/menu/:id
 */
export const getMenuItemById = async (req, res) => {
  try {
    const { id } = req.params;

    const menuItem = await MenuItem.findById(id)
      .populate("addonIds")
      .populate("kitchenId", "_id name type logo");

    if (!menuItem) {
      return sendResponse(res, 404, "Menu item not found");
    }

    // For public access, only show active items
    if (!req.user || req.user.role === "CUSTOMER") {
      if (menuItem.status !== "ACTIVE") {
        return sendResponse(res, 404, "Menu item not available");
      }
    }

    return sendResponse(res, 200, "Menu item details", {
      menuItem,
      addons: menuItem.addonIds,
      kitchen: menuItem.kitchenId,
    });
  } catch (error) {
    console.log("> Get menu item by ID error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Update menu item
 *
 * PUT /api/menu/:id
 */
export const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const menuItem = await MenuItem.findById(id);
    if (!menuItem) {
      return sendResponse(res, 404, "Menu item not found");
    }

    // Verify ownership for kitchen staff
    if (
      req.user.role === "KITCHEN_STAFF" &&
      menuItem.kitchenId.toString() !== req.user.kitchenId?.toString()
    ) {
      return sendResponse(res, 403, "Access denied to this menu item");
    }

    // Validate addon IDs if changed
    if (updates.addonIds) {
      const { valid, invalid } = await validateAddonIds(
        updates.addonIds,
        menuItem.kitchenId
      );
      if (!valid) {
        return sendResponse(
          res,
          400,
          `Invalid or inactive addon IDs: ${invalid.join(", ")}`
        );
      }
    }

    // Update allowed fields
    const allowedFields = [
      "name",
      "description",
      "price",
      "discountedPrice",
      "portionSize",
      "preparationTime",
      "dietaryType",
      "isJainFriendly",
      "spiceLevel",
      "images",
      "thumbnailImage",
      "addonIds",
      "includes",
      "displayOrder",
      "isFeatured",
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        menuItem[field] = updates[field];
      }
    }

    await menuItem.save();
    await menuItem.populate("addonIds", "name price isAvailable");

    return sendResponse(res, 200, "Menu item updated", { menuItem });
  } catch (error) {
    console.log("> Update menu item error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Toggle menu item availability
 *
 * PATCH /api/menu/:id/availability
 */
export const toggleAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;

    const menuItem = await MenuItem.findById(id);
    if (!menuItem) {
      return sendResponse(res, 404, "Menu item not found");
    }

    // Verify ownership for kitchen staff
    if (
      req.user.role === "KITCHEN_STAFF" &&
      menuItem.kitchenId.toString() !== req.user.kitchenId?.toString()
    ) {
      return sendResponse(res, 403, "Access denied to this menu item");
    }

    menuItem.isAvailable = isAvailable;
    await menuItem.save();

    return sendResponse(res, 200, "Availability updated", {
      isAvailable: menuItem.isAvailable,
    });
  } catch (error) {
    console.log("> Toggle availability error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Update menu item add-ons
 *
 * PATCH /api/menu/:id/addons
 */
export const updateAddons = async (req, res) => {
  try {
    const { id } = req.params;
    const { addonIds } = req.body;

    const menuItem = await MenuItem.findById(id);
    if (!menuItem) {
      return sendResponse(res, 404, "Menu item not found");
    }

    // Verify ownership for kitchen staff
    if (
      req.user.role === "KITCHEN_STAFF" &&
      menuItem.kitchenId.toString() !== req.user.kitchenId?.toString()
    ) {
      return sendResponse(res, 403, "Access denied to this menu item");
    }

    // Validate addon IDs
    const { valid, invalid, addons } = await validateAddonIds(
      addonIds,
      menuItem.kitchenId
    );
    if (!valid) {
      return sendResponse(
        res,
        400,
        `Invalid or inactive addon IDs: ${invalid.join(", ")}`
      );
    }

    menuItem.addonIds = addonIds;
    await menuItem.save();

    return sendResponse(res, 200, "Add-ons updated", {
      menuItem,
      addons,
    });
  } catch (error) {
    console.log("> Update addons error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Delete menu item (soft delete)
 *
 * DELETE /api/menu/:id
 */
export const deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;

    const menuItem = await MenuItem.findById(id);
    if (!menuItem) {
      return sendResponse(res, 404, "Menu item not found");
    }

    // Verify ownership for kitchen staff
    if (
      req.user.role === "KITCHEN_STAFF" &&
      menuItem.kitchenId.toString() !== req.user.kitchenId?.toString()
    ) {
      return sendResponse(res, 403, "Access denied to this menu item");
    }

    menuItem.status = "INACTIVE";
    await menuItem.save();

    return sendResponse(res, 200, "Menu item deleted");
  } catch (error) {
    console.log("> Delete menu item error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Disable menu item for policy violation (Admin only)
 *
 * PATCH /api/menu/:id/disable
 */
export const disableMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const menuItem = await MenuItem.findById(id);
    if (!menuItem) {
      return sendResponse(res, 404, "Menu item not found");
    }

    const oldStatus = menuItem.status;
    menuItem.status = "DISABLED_BY_ADMIN";
    menuItem.disabledReason = reason;
    menuItem.disabledBy = req.user._id;
    await menuItem.save();

    // Log audit entry
    safeAuditLog(req, {
      action: "UPDATE",
      entityType: "MENU_ITEM",
      entityId: menuItem._id,
      oldValue: { status: oldStatus },
      newValue: { status: "DISABLED_BY_ADMIN", reason },
      description: `Disabled menu item: ${menuItem.name}. Reason: ${reason}`,
    });

    console.log(`> Menu item disabled: ${menuItem.name}`);

    return sendResponse(res, 200, "Menu item disabled", { menuItem });
  } catch (error) {
    console.log("> Disable menu item error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Enable menu item (Admin only)
 *
 * PATCH /api/menu/:id/enable
 */
export const enableMenuItem = async (req, res) => {
  try {
    const { id } = req.params;

    const menuItem = await MenuItem.findById(id);
    if (!menuItem) {
      return sendResponse(res, 404, "Menu item not found");
    }

    const oldStatus = menuItem.status;
    menuItem.status = "ACTIVE";
    menuItem.disabledReason = undefined;
    menuItem.disabledBy = undefined;
    await menuItem.save();

    // Log audit entry
    safeAuditLog(req, {
      action: "UPDATE",
      entityType: "MENU_ITEM",
      entityId: menuItem._id,
      oldValue: { status: oldStatus },
      newValue: { status: "ACTIVE" },
      description: `Re-enabled menu item: ${menuItem.name}`,
    });

    console.log(`> Menu item enabled: ${menuItem.name}`);

    return sendResponse(res, 200, "Menu item enabled", { menuItem });
  } catch (error) {
    console.log("> Enable menu item error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get complete menu for a kitchen (Customer view)
 *
 * GET /api/menu/kitchen/:kitchenId
 */
export const getKitchenMenu = async (req, res) => {
  try {
    const { kitchenId } = req.params;
    const { menuType } = req.query;

    // Verify kitchen exists and is active
    const kitchen = await Kitchen.findById(kitchenId).select(
      "_id name type logo coverImage cuisineTypes averageRating status"
    );

    if (!kitchen) {
      return sendResponse(res, 404, "Kitchen not found");
    }

    if (kitchen.status !== "ACTIVE") {
      return sendResponse(res, 404, "Kitchen not available");
    }

    // Build query
    const query = {
      kitchenId,
      status: "ACTIVE",
      isAvailable: true,
    };

    if (menuType) {
      query.menuType = menuType;
    }

    const menuItems = await MenuItem.find(query)
      .populate("addonIds", "name price isAvailable")
      .sort({ displayOrder: 1, createdAt: -1 });

    // Group into meal menu and on-demand menu
    const mealMenu = { lunch: null, dinner: null };
    const onDemandMenu = [];

    for (const item of menuItems) {
      const itemObj = item.toObject();
      itemObj.addons = item.addonIds;

      if (item.menuType === "MEAL_MENU") {
        if (item.mealWindow === "LUNCH") {
          mealMenu.lunch = itemObj;
        } else if (item.mealWindow === "DINNER") {
          mealMenu.dinner = itemObj;
        }
      } else {
        onDemandMenu.push(itemObj);
      }
    }

    return sendResponse(res, 200, "Kitchen menu", {
      kitchen,
      mealMenu,
      onDemandMenu,
      isVoucherEligible: true, // Meal menu items are voucher-eligible
      isCouponEligible: true, // On-demand menu items are coupon-eligible
    });
  } catch (error) {
    console.log("> Get kitchen menu error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get meal menu item for specific window
 *
 * GET /api/menu/kitchen/:kitchenId/meal/:mealWindow
 */
export const getMealMenuForWindow = async (req, res) => {
  try {
    const { kitchenId, mealWindow } = req.params;

    // Validate meal window
    if (!["LUNCH", "DINNER"].includes(mealWindow.toUpperCase())) {
      return sendResponse(res, 400, "Invalid meal window");
    }

    const menuItem = await MenuItem.findOne({
      kitchenId,
      menuType: "MEAL_MENU",
      mealWindow: mealWindow.toUpperCase(),
      status: "ACTIVE",
    }).populate("addonIds", "name price isAvailable");

    if (!menuItem) {
      return sendResponse(res, 200, "No menu item for this meal window", {
        item: null,
        isAvailable: false,
        canUseVoucher: false,
        cutoffTime: CUTOFF_TIMES[mealWindow.toUpperCase()],
        isPastCutoff: false,
      });
    }

    const { isPastCutoff, cutoffTime } = checkCutoffTime(
      mealWindow.toUpperCase()
    );

    return sendResponse(res, 200, "Meal menu item", {
      item: menuItem,
      isAvailable: menuItem.isAvailable && !isPastCutoff,
      canUseVoucher: !isPastCutoff,
      cutoffTime,
      isPastCutoff,
    });
  } catch (error) {
    console.log("> Get meal menu for window error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

export default {
  createMenuItem,
  getMenuItems,
  getMenuItemById,
  updateMenuItem,
  toggleAvailability,
  updateAddons,
  deleteMenuItem,
  disableMenuItem,
  enableMenuItem,
  getKitchenMenu,
  getMealMenuForWindow,
};
