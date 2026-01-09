import Addon from "../../schema/addon.schema.js";
import MenuItem from "../../schema/menuItem.schema.js";
import Kitchen from "../../schema/kitchen.schema.js";
import { sendResponse } from "../utils/response.utils.js";

/**
 * Addon Controller
 * Handles addon library management per kitchen
 */

/**
 * Helper: Get addon usage count
 * @param {ObjectId} addonId - Addon ID
 * @returns {Promise<Number>} Count of menu items using this addon
 */
const getAddonUsageCount = async (addonId) => {
  return MenuItem.countDocuments({
    addonIds: addonId,
    status: "ACTIVE",
  });
};

/**
 * Create a new addon
 *
 * POST /api/addons
 */
export const createAddon = async (req, res) => {
  try {
    const {
      kitchenId: bodyKitchenId,
      name,
      description,
      price,
      dietaryType,
      image,
      minQuantity,
      maxQuantity,
      isAvailable,
      displayOrder,
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

    // Verify kitchen exists
    const kitchen = await Kitchen.findById(kitchenId);
    if (!kitchen) {
      return sendResponse(res, 404, "Kitchen not found");
    }

    // Validate minQuantity <= maxQuantity
    const min = minQuantity ?? 0;
    const max = maxQuantity ?? 10;
    if (min > max) {
      return sendResponse(
        res,
        400,
        "minQuantity cannot be greater than maxQuantity"
      );
    }

    const addon = new Addon({
      kitchenId,
      name,
      description,
      price,
      dietaryType,
      image,
      minQuantity: min,
      maxQuantity: max,
      isAvailable: isAvailable !== undefined ? isAvailable : true,
      displayOrder: displayOrder ?? 0,
      status: "ACTIVE",
      createdBy: req.user._id,
    });

    await addon.save();

    console.log(`> Addon created: ${name} for kitchen ${kitchen.name}`);

    return sendResponse(res, 201, "Add-on created successfully", { addon });
  } catch (error) {
    console.error("> Create addon error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get addons for a kitchen
 *
 * GET /api/addons
 */
export const getAddons = async (req, res) => {
  try {
    const {
      kitchenId: queryKitchenId,
      status,
      isAvailable,
      dietaryType,
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
    if (dietaryType) query.dietaryType = dietaryType;
    if (isAvailable !== undefined) query.isAvailable = isAvailable === "true";

    // Status filtering based on role
    if (req.user?.role === "ADMIN" && status) {
      query.status = status;
    } else if (!req.user || req.user.role === "CUSTOMER") {
      query.status = "ACTIVE";
    } else {
      // Kitchen staff sees their own active/inactive (not deleted)
      query.status = { $ne: "DELETED" };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [addons, total] = await Promise.all([
      Addon.find(query)
        .sort({ displayOrder: 1, name: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Addon.countDocuments(query),
    ]);

    return sendResponse(res, 200, "Add-ons retrieved", {
      addons,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("> Get addons error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get addon by ID
 *
 * GET /api/addons/:id
 */
export const getAddonById = async (req, res) => {
  try {
    const { id } = req.params;

    const addon = await Addon.findById(id);
    if (!addon) {
      return sendResponse(res, 404, "Add-on not found");
    }

    // For public access, only show active addons
    if (!req.user || req.user.role === "CUSTOMER") {
      if (addon.status !== "ACTIVE") {
        return sendResponse(res, 404, "Add-on not available");
      }
    }

    // Get kitchen info
    const kitchen = await Kitchen.findById(addon.kitchenId).select("_id name");

    // Count menu items using this addon
    const usedInMenuItems = await getAddonUsageCount(addon._id);

    return sendResponse(res, 200, "Add-on details", {
      addon,
      kitchen,
      usedInMenuItems,
    });
  } catch (error) {
    console.error("> Get addon by ID error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Update addon
 *
 * PUT /api/addons/:id
 */
export const updateAddon = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const addon = await Addon.findById(id);
    if (!addon) {
      return sendResponse(res, 404, "Add-on not found");
    }

    // Verify ownership for kitchen staff
    if (
      req.user.role === "KITCHEN_STAFF" &&
      addon.kitchenId.toString() !== req.user.kitchenId?.toString()
    ) {
      return sendResponse(res, 403, "Access denied to this add-on");
    }

    // Validate minQuantity <= maxQuantity if either changed
    const newMin =
      updates.minQuantity !== undefined
        ? updates.minQuantity
        : addon.minQuantity;
    const newMax =
      updates.maxQuantity !== undefined
        ? updates.maxQuantity
        : addon.maxQuantity;
    if (newMin > newMax) {
      return sendResponse(
        res,
        400,
        "minQuantity cannot be greater than maxQuantity"
      );
    }

    // Update allowed fields
    const allowedFields = [
      "name",
      "description",
      "price",
      "dietaryType",
      "image",
      "minQuantity",
      "maxQuantity",
      "displayOrder",
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        addon[field] = updates[field];
      }
    }

    await addon.save();

    return sendResponse(res, 200, "Add-on updated", { addon });
  } catch (error) {
    console.error("> Update addon error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Toggle addon availability
 *
 * PATCH /api/addons/:id/availability
 */
export const toggleAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;

    const addon = await Addon.findById(id);
    if (!addon) {
      return sendResponse(res, 404, "Add-on not found");
    }

    // Verify ownership for kitchen staff
    if (
      req.user.role === "KITCHEN_STAFF" &&
      addon.kitchenId.toString() !== req.user.kitchenId?.toString()
    ) {
      return sendResponse(res, 403, "Access denied to this add-on");
    }

    addon.isAvailable = isAvailable;
    await addon.save();

    return sendResponse(res, 200, "Availability updated", {
      isAvailable: addon.isAvailable,
    });
  } catch (error) {
    console.error("> Toggle addon availability error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Delete addon (soft delete)
 *
 * DELETE /api/addons/:id
 */
export const deleteAddon = async (req, res) => {
  try {
    const { id } = req.params;

    const addon = await Addon.findById(id);
    if (!addon) {
      return sendResponse(res, 404, "Add-on not found");
    }

    // Verify ownership for kitchen staff
    if (
      req.user.role === "KITCHEN_STAFF" &&
      addon.kitchenId.toString() !== req.user.kitchenId?.toString()
    ) {
      return sendResponse(res, 403, "Access denied to this add-on");
    }

    // Soft delete
    addon.status = "DELETED";
    await addon.save();

    // Remove addon from all menu items' addonIds
    await MenuItem.updateMany(
      { addonIds: id },
      { $pull: { addonIds: id } }
    );

    return sendResponse(res, 200, "Add-on deleted");
  } catch (error) {
    console.error("> Delete addon error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get available addons for a menu item (for attaching)
 *
 * GET /api/addons/for-menu-item/:menuItemId
 */
export const getAddonsForMenuItem = async (req, res) => {
  try {
    const { menuItemId } = req.params;

    // Fetch menu item
    const menuItem = await MenuItem.findById(menuItemId);
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

    // Get all active addons for this kitchen
    const allAddons = await Addon.find({
      kitchenId: menuItem.kitchenId,
      status: "ACTIVE",
    }).sort({ displayOrder: 1, name: 1 });

    // Separate into attached and available
    const attachedIds = menuItem.addonIds.map((id) => id.toString());
    const attached = [];
    const available = [];

    for (const addon of allAddons) {
      const addonObj = addon.toObject();
      if (attachedIds.includes(addon._id.toString())) {
        addonObj.isAttached = true;
        attached.push(addonObj);
      } else {
        addonObj.isAttached = false;
        available.push(addonObj);
      }
    }

    return sendResponse(res, 200, "Add-ons for menu item", {
      attached,
      available,
    });
  } catch (error) {
    console.error("> Get addons for menu item error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get complete addon library for a kitchen
 *
 * GET /api/addons/library/:kitchenId
 */
export const getKitchenAddonLibrary = async (req, res) => {
  try {
    const { kitchenId } = req.params;

    // Verify access for kitchen staff
    if (
      req.user.role === "KITCHEN_STAFF" &&
      kitchenId !== req.user.kitchenId?.toString()
    ) {
      return sendResponse(res, 403, "Access denied to this kitchen");
    }

    // Fetch all addons for kitchen (including inactive)
    const addons = await Addon.find({
      kitchenId,
      status: { $ne: "DELETED" },
    }).sort({ displayOrder: 1, name: 1 });

    // Add menu item count for each addon
    const addonsWithCount = await Promise.all(
      addons.map(async (addon) => {
        const addonObj = addon.toObject();
        addonObj.menuItemCount = await getAddonUsageCount(addon._id);
        return addonObj;
      })
    );

    const activeCount = addons.filter((a) => a.status === "ACTIVE").length;

    return sendResponse(res, 200, "Kitchen addon library", {
      addons: addonsWithCount,
      totalCount: addons.length,
      activeCount,
    });
  } catch (error) {
    console.error("> Get kitchen addon library error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get available addons for a menu item (customer view)
 *
 * GET /api/addons/menu-item/:menuItemId
 */
export const getAddonsForCustomer = async (req, res) => {
  try {
    const { menuItemId } = req.params;

    // Fetch menu item
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      return sendResponse(res, 404, "Menu item not found");
    }

    // Verify menu item is active
    if (menuItem.status !== "ACTIVE") {
      return sendResponse(res, 404, "Menu item not available");
    }

    // Get addons from menuItem.addonIds that are active and available
    const addons = await Addon.find({
      _id: { $in: menuItem.addonIds },
      status: "ACTIVE",
      isAvailable: true,
    })
      .select(
        "_id name description price dietaryType image minQuantity maxQuantity isAvailable"
      )
      .sort({ displayOrder: 1, name: 1 });

    return sendResponse(res, 200, "Add-ons for menu item", { addons });
  } catch (error) {
    console.error("> Get addons for customer error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

export default {
  createAddon,
  getAddons,
  getAddonById,
  updateAddon,
  toggleAvailability,
  deleteAddon,
  getAddonsForMenuItem,
  getKitchenAddonLibrary,
  getAddonsForCustomer,
};
