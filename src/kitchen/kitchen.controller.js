import Kitchen from "../../schema/kitchen.schema.js";
import Zone from "../../schema/zone.schema.js";
import User from "../../schema/user.schema.js";
import Order from "../../schema/order.schema.js";
import MenuItem from "../../schema/menuItem.schema.js";
import AuditLog from "../../schema/auditLog.schema.js";
import { sendResponse } from "../../utils/response.utils.js";

/**
 * Kitchen Controller
 * Handles kitchen CRUD and management operations
 */

/**
 * Helper: Check if zone already has a partner kitchen
 * @param {ObjectId} zoneId - Zone ID to check
 * @param {ObjectId} excludeKitchenId - Kitchen ID to exclude from check
 * @returns {Promise<Object>} { hasPartner: Boolean, kitchen: Object | null }
 */
const checkPartnerKitchenInZone = async (zoneId, excludeKitchenId = null) => {
  const query = {
    zonesServed: zoneId,
    type: "PARTNER",
    status: { $ne: "INACTIVE" },
  };

  if (excludeKitchenId) {
    query._id = { $ne: excludeKitchenId };
  }

  const existingPartner = await Kitchen.findOne(query).select("_id name");
  return {
    hasPartner: !!existingPartner,
    kitchen: existingPartner,
  };
};

/**
 * Helper: Build badge array based on kitchen flags
 * @param {Object} kitchen - Kitchen document
 * @returns {Array<String>} Badge labels
 */
const buildKitchenBadges = (kitchen) => {
  const badges = [];

  if (kitchen.type === "TIFFSY") {
    badges.push("By Tiffsy");
  }
  if (kitchen.premiumFlag) {
    badges.push("Premium");
  }
  if (kitchen.gourmetFlag) {
    badges.push("Gourmet");
  }
  if (kitchen.authorizedFlag) {
    badges.push("Authorized");
  }

  return badges;
};

/**
 * Create a new kitchen (Admin only)
 *
 * POST /api/kitchens
 */
export const createKitchen = async (req, res) => {
  try {
    const {
      name,
      type,
      authorizedFlag,
      premiumFlag,
      gourmetFlag,
      logo,
      coverImage,
      description,
      cuisineTypes,
      address,
      zonesServed,
      operatingHours,
      contactPhone,
      contactEmail,
      ownerName,
      ownerPhone,
    } = req.body;

    // Validate all zones exist
    const zones = await Zone.find({ _id: { $in: zonesServed } });
    if (zones.length !== zonesServed.length) {
      return sendResponse(res, 400, "One or more zones not found");
    }

    // Check all zones are active
    const inactiveZones = zones.filter((z) => z.status !== "ACTIVE");
    if (inactiveZones.length > 0) {
      return sendResponse(
        res,
        400,
        `Zone(s) not active: ${inactiveZones.map((z) => z.name).join(", ")}`
      );
    }

    // If PARTNER kitchen, check each zone doesn't already have a partner
    if (type === "PARTNER") {
      for (const zoneId of zonesServed) {
        const { hasPartner, kitchen: existingPartner } =
          await checkPartnerKitchenInZone(zoneId);
        if (hasPartner) {
          const zone = zones.find(
            (z) => z._id.toString() === zoneId.toString()
          );
          return sendResponse(
            res,
            400,
            `Zone "${zone.name}" already has a partner kitchen: ${existingPartner.name}`
          );
        }
      }
    }

    // Determine initial status based on type
    const status = type === "TIFFSY" ? "ACTIVE" : "PENDING_APPROVAL";

    // Generate kitchen code
    const code = await Kitchen.generateKitchenCode();

    const kitchen = new Kitchen({
      name,
      code,
      type,
      authorizedFlag: authorizedFlag || false,
      premiumFlag: premiumFlag || false,
      gourmetFlag: gourmetFlag || false,
      logo,
      coverImage,
      description,
      cuisineTypes: cuisineTypes || [],
      address,
      zonesServed,
      operatingHours,
      contactPhone,
      contactEmail,
      ownerName,
      ownerPhone,
      status,
      createdBy: req.user._id,
    });

    await kitchen.save();

    // Log audit entry
    await AuditLog.logFromRequest(req, {
      action: "CREATE",
      entityType: "KITCHEN",
      entityId: kitchen._id,
      newValue: kitchen.toObject(),
      description: `Created ${type} kitchen: ${name}`,
    });

    console.log(`> Kitchen created: ${name} (${code})`);

    return sendResponse(res, 201, "Kitchen created successfully", { kitchen });
  } catch (error) {
    console.log("> Create kitchen error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get all kitchens with filters
 *
 * GET /api/kitchens
 */
export const getKitchens = async (req, res) => {
  try {
    const { type, status, zoneId, search, page = 1, limit = 50 } = req.query;

    // Build query
    const query = {};

    // If Kitchen Staff, restrict to own kitchen
    if (req.user.role === "KITCHEN_STAFF") {
      query._id = req.user.kitchenId;
    } else {
      if (type) query.type = type;
      if (status) query.status = status;
      if (zoneId) query.zonesServed = zoneId;
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { code: { $regex: search, $options: "i" } },
        ];
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [kitchens, total] = await Promise.all([
      Kitchen.find(query)
        .populate("zonesServed", "name code city")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Kitchen.countDocuments(query),
    ]);

    return sendResponse(res, 200, "Kitchens retrieved", {
      kitchens,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.log("> Get kitchens error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get kitchen by ID with full details
 *
 * GET /api/kitchens/:id
 */
export const getKitchenById = async (req, res) => {
  try {
    const { id } = req.params;

    const kitchen = await Kitchen.findById(id).populate(
      "zonesServed",
      "name code city status"
    );

    if (!kitchen) {
      return sendResponse(res, 404, "Kitchen not found");
    }

    // If Kitchen Staff, verify they belong to this kitchen
    if (
      req.user.role === "KITCHEN_STAFF" &&
      req.user.kitchenId?.toString() !== id
    ) {
      return sendResponse(res, 403, "Access denied to this kitchen");
    }

    // Get staff members
    const staff = await User.find({
      kitchenId: id,
      role: "KITCHEN_STAFF",
      status: "ACTIVE",
    }).select("_id name phone");

    // Compute statistics
    const [totalOrders, activeOrders, totalMenuItems] = await Promise.all([
      Order.countDocuments({ kitchenId: id }),
      Order.countDocuments({
        kitchenId: id,
        status: {
          $in: ["PLACED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP"],
        },
      }),
      MenuItem.countDocuments({ kitchenId: id, status: "ACTIVE" }),
    ]);

    return sendResponse(res, 200, "Kitchen details", {
      kitchen,
      staff,
      statistics: {
        totalOrders,
        activeOrders,
        averageRating: kitchen.averageRating || 0,
        totalMenuItems,
      },
    });
  } catch (error) {
    console.log("> Get kitchen by ID error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Update kitchen details (Admin only)
 *
 * PUT /api/kitchens/:id
 */
export const updateKitchen = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const kitchen = await Kitchen.findById(id);
    if (!kitchen) {
      return sendResponse(res, 404, "Kitchen not found");
    }

    // Capture old values for audit
    const oldValue = kitchen.toObject();

    // Update allowed fields
    const allowedFields = [
      "name",
      "description",
      "cuisineTypes",
      "address",
      "operatingHours",
      "contactPhone",
      "contactEmail",
      "ownerName",
      "ownerPhone",
      "logo",
      "coverImage",
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        kitchen[field] = updates[field];
      }
    }

    await kitchen.save();

    // Log audit entry
    await AuditLog.logFromRequest(req, {
      action: "UPDATE",
      entityType: "KITCHEN",
      entityId: kitchen._id,
      oldValue,
      newValue: kitchen.toObject(),
      description: `Updated kitchen: ${kitchen.name}`,
    });

    return sendResponse(res, 200, "Kitchen updated successfully", { kitchen });
  } catch (error) {
    console.log("> Update kitchen error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Update kitchen type (Admin only)
 *
 * PATCH /api/kitchens/:id/type
 */
export const updateKitchenType = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;

    const kitchen = await Kitchen.findById(id);
    if (!kitchen) {
      return sendResponse(res, 404, "Kitchen not found");
    }

    // If changing to PARTNER, verify zones don't have existing partners
    if (type === "PARTNER" && kitchen.type !== "PARTNER") {
      for (const zoneId of kitchen.zonesServed) {
        const { hasPartner, kitchen: existingPartner } =
          await checkPartnerKitchenInZone(zoneId, kitchen._id);
        if (hasPartner) {
          const zone = await Zone.findById(zoneId).select("name");
          return sendResponse(
            res,
            400,
            `Zone "${zone.name}" already has a partner kitchen: ${existingPartner.name}`
          );
        }
      }
    }

    const oldType = kitchen.type;
    kitchen.type = type;
    await kitchen.save();

    // Log audit entry
    await AuditLog.logFromRequest(req, {
      action: "UPDATE",
      entityType: "KITCHEN",
      entityId: kitchen._id,
      oldValue: { type: oldType },
      newValue: { type },
      description: `Changed kitchen type from ${oldType} to ${type}`,
    });

    return sendResponse(res, 200, "Kitchen type updated", { kitchen });
  } catch (error) {
    console.log("> Update kitchen type error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Update kitchen flags (Admin only)
 *
 * PATCH /api/kitchens/:id/flags
 */
export const updateKitchenFlags = async (req, res) => {
  try {
    const { id } = req.params;
    const { authorizedFlag, premiumFlag, gourmetFlag } = req.body;

    const kitchen = await Kitchen.findById(id);
    if (!kitchen) {
      return sendResponse(res, 404, "Kitchen not found");
    }

    const oldFlags = {
      authorizedFlag: kitchen.authorizedFlag,
      premiumFlag: kitchen.premiumFlag,
      gourmetFlag: kitchen.gourmetFlag,
    };

    if (authorizedFlag !== undefined) kitchen.authorizedFlag = authorizedFlag;
    if (premiumFlag !== undefined) kitchen.premiumFlag = premiumFlag;
    if (gourmetFlag !== undefined) kitchen.gourmetFlag = gourmetFlag;

    await kitchen.save();

    // Log audit entry
    await AuditLog.logFromRequest(req, {
      action: "UPDATE",
      entityType: "KITCHEN",
      entityId: kitchen._id,
      oldValue: oldFlags,
      newValue: {
        authorizedFlag: kitchen.authorizedFlag,
        premiumFlag: kitchen.premiumFlag,
        gourmetFlag: kitchen.gourmetFlag,
      },
      description: `Updated kitchen flags for: ${kitchen.name}`,
    });

    return sendResponse(res, 200, "Kitchen flags updated", { kitchen });
  } catch (error) {
    console.log("> Update kitchen flags error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Update zones served (Admin only)
 *
 * PATCH /api/kitchens/:id/zones
 */
export const updateZonesServed = async (req, res) => {
  try {
    const { id } = req.params;
    const { zonesServed } = req.body;

    const kitchen = await Kitchen.findById(id);
    if (!kitchen) {
      return sendResponse(res, 404, "Kitchen not found");
    }

    // Validate all zones exist
    const zones = await Zone.find({ _id: { $in: zonesServed } });
    if (zones.length !== zonesServed.length) {
      return sendResponse(res, 400, "One or more zones not found");
    }

    // If PARTNER kitchen, check each new zone doesn't have existing partner
    if (kitchen.type === "PARTNER") {
      for (const zoneId of zonesServed) {
        // Skip zones already served by this kitchen
        if (kitchen.zonesServed.map((z) => z.toString()).includes(zoneId)) {
          continue;
        }
        const { hasPartner, kitchen: existingPartner } =
          await checkPartnerKitchenInZone(zoneId, kitchen._id);
        if (hasPartner) {
          const zone = zones.find((z) => z._id.toString() === zoneId);
          return sendResponse(
            res,
            400,
            `Zone "${zone.name}" already has a partner kitchen: ${existingPartner.name}`
          );
        }
      }
    }

    const oldZones = kitchen.zonesServed;
    kitchen.zonesServed = zonesServed;
    await kitchen.save();

    // Log audit entry
    await AuditLog.logFromRequest(req, {
      action: "UPDATE",
      entityType: "KITCHEN",
      entityId: kitchen._id,
      oldValue: { zonesServed: oldZones },
      newValue: { zonesServed },
      description: `Updated zones served for: ${kitchen.name}`,
    });

    await kitchen.populate("zonesServed", "name code city");

    return sendResponse(res, 200, "Zones updated", { kitchen });
  } catch (error) {
    console.log("> Update zones served error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Activate kitchen (Admin only)
 *
 * PATCH /api/kitchens/:id/activate
 */
export const activateKitchen = async (req, res) => {
  try {
    const { id } = req.params;

    const kitchen = await Kitchen.findById(id);
    if (!kitchen) {
      return sendResponse(res, 404, "Kitchen not found");
    }

    const oldStatus = kitchen.status;
    kitchen.status = "ACTIVE";

    // For partner kitchens moving from PENDING_APPROVAL
    if (oldStatus === "PENDING_APPROVAL") {
      kitchen.approvedBy = req.user._id;
      kitchen.approvedAt = new Date();
    }

    await kitchen.save();

    // Log audit entry
    await AuditLog.logFromRequest(req, {
      action: "UPDATE",
      entityType: "KITCHEN",
      entityId: kitchen._id,
      oldValue: { status: oldStatus },
      newValue: { status: "ACTIVE" },
      description: `Activated kitchen: ${kitchen.name}`,
    });

    console.log(`> Kitchen activated: ${kitchen.name}`);

    return sendResponse(res, 200, "Kitchen activated", { kitchen });
  } catch (error) {
    console.log("> Activate kitchen error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Deactivate kitchen (Admin only)
 *
 * PATCH /api/kitchens/:id/deactivate
 */
export const deactivateKitchen = async (req, res) => {
  try {
    const { id } = req.params;

    const kitchen = await Kitchen.findById(id);
    if (!kitchen) {
      return sendResponse(res, 404, "Kitchen not found");
    }

    // Check for pending orders
    const pendingOrders = await Order.countDocuments({
      kitchenId: id,
      status: { $in: ["PLACED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP"] },
    });

    const oldStatus = kitchen.status;
    kitchen.status = "INACTIVE";
    kitchen.isAcceptingOrders = false;
    await kitchen.save();

    // Log audit entry
    await AuditLog.logFromRequest(req, {
      action: "UPDATE",
      entityType: "KITCHEN",
      entityId: kitchen._id,
      oldValue: { status: oldStatus },
      newValue: { status: "INACTIVE" },
      description: `Deactivated kitchen: ${kitchen.name}`,
    });

    console.log(`> Kitchen deactivated: ${kitchen.name}`);

    return sendResponse(res, 200, "Kitchen deactivated", {
      kitchen,
      warning:
        pendingOrders > 0
          ? `Kitchen has ${pendingOrders} pending order(s)`
          : undefined,
    });
  } catch (error) {
    console.log("> Deactivate kitchen error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Suspend kitchen for policy violation (Admin only)
 *
 * PATCH /api/kitchens/:id/suspend
 */
export const suspendKitchen = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return sendResponse(res, 400, "Suspension reason is required");
    }

    const kitchen = await Kitchen.findById(id);
    if (!kitchen) {
      return sendResponse(res, 404, "Kitchen not found");
    }

    const oldStatus = kitchen.status;
    kitchen.status = "SUSPENDED";
    kitchen.isAcceptingOrders = false;
    await kitchen.save();

    // Log audit entry with reason
    await AuditLog.logFromRequest(req, {
      action: "UPDATE",
      entityType: "KITCHEN",
      entityId: kitchen._id,
      oldValue: { status: oldStatus },
      newValue: { status: "SUSPENDED", reason },
      description: `Suspended kitchen: ${kitchen.name}. Reason: ${reason}`,
    });

    console.log(`> Kitchen suspended: ${kitchen.name}`);

    return sendResponse(res, 200, "Kitchen suspended", { kitchen });
  } catch (error) {
    console.log("> Suspend kitchen error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Delete kitchen (soft delete) (Admin only)
 *
 * DELETE /api/kitchens/:id
 */
export const deleteKitchen = async (req, res) => {
  try {
    const { id } = req.params;

    const kitchen = await Kitchen.findById(id);
    if (!kitchen) {
      return sendResponse(res, 404, "Kitchen not found");
    }

    // Check if kitchen is already deleted
    if (kitchen.status === "DELETED") {
      return sendResponse(res, 400, "Kitchen is already deleted");
    }

    // Check for pending orders
    const pendingOrders = await Order.countDocuments({
      kitchenId: id,
      status: { $in: ["PLACED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP"] },
    });

    if (pendingOrders > 0) {
      return sendResponse(
        res,
        400,
        `Cannot delete kitchen with ${pendingOrders} pending order(s). Please complete or cancel all orders first.`
      );
    }

    const oldStatus = kitchen.status;
    kitchen.status = "DELETED";
    kitchen.isAcceptingOrders = false;
    await kitchen.save();

    // Deactivate all menu items for this kitchen
    await MenuItem.updateMany(
      { kitchenId: id },
      { status: "INACTIVE", isAvailable: false }
    );

    // Deactivate all staff associated with this kitchen
    await User.updateMany(
      { kitchenId: id, role: "KITCHEN_STAFF" },
      { status: "INACTIVE" }
    );

    // Log audit entry
    await AuditLog.logFromRequest(req, {
      action: "DELETE",
      entityType: "KITCHEN",
      entityId: kitchen._id,
      oldValue: { status: oldStatus },
      newValue: { status: "DELETED" },
      description: `Deleted kitchen: ${kitchen.name}`,
    });

    console.log(`> Kitchen deleted: ${kitchen.name}`);

    return sendResponse(res, 200, "Kitchen deleted successfully", { kitchen });
  } catch (error) {
    console.log("> Delete kitchen error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Toggle order acceptance (Admin or Kitchen Staff)
 *
 * PATCH /api/kitchens/:id/accepting-orders
 */
export const toggleOrderAcceptance = async (req, res) => {
  try {
    const { id } = req.params;
    const { isAcceptingOrders } = req.body;

    const kitchen = await Kitchen.findById(id);
    if (!kitchen) {
      return sendResponse(res, 404, "Kitchen not found");
    }

    // If Kitchen Staff, verify they belong to this kitchen
    if (
      req.user.role === "KITCHEN_STAFF" &&
      req.user.kitchenId?.toString() !== id
    ) {
      return sendResponse(res, 403, "Access denied to this kitchen");
    }

    // Cannot accept orders if kitchen is not active
    if (isAcceptingOrders && kitchen.status !== "ACTIVE") {
      return sendResponse(
        res,
        400,
        "Cannot accept orders while kitchen is not active"
      );
    }

    kitchen.isAcceptingOrders = isAcceptingOrders;
    await kitchen.save();

    return sendResponse(res, 200, "Order acceptance updated", {
      isAcceptingOrders: kitchen.isAcceptingOrders,
    });
  } catch (error) {
    console.log("> Toggle order acceptance error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get kitchens serving a specific zone (Customer view)
 *
 * GET /api/kitchens/zone/:zoneId
 */
export const getKitchensForZone = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { menuType } = req.query;

    // Verify zone exists
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return sendResponse(res, 404, "Zone not found");
    }

    // Find active kitchens serving this zone
    const kitchens = await Kitchen.find({
      zonesServed: zoneId,
      status: "ACTIVE",
      isAcceptingOrders: true,
    }).select(
      "_id name type logo coverImage cuisineTypes averageRating totalRatings premiumFlag gourmetFlag operatingHours isAcceptingOrders"
    );

    // Separate into Tiffsy and Partner kitchens
    const tiffsyKitchens = [];
    const partnerKitchens = [];

    for (const kitchen of kitchens) {
      const kitchenObj = kitchen.toObject();
      kitchenObj.isTiffsyKitchen = kitchen.type === "TIFFSY";
      kitchenObj.badges = buildKitchenBadges(kitchen);

      if (kitchen.type === "TIFFSY") {
        tiffsyKitchens.push(kitchenObj);
      } else {
        // Only include 1 partner kitchen per zone (FR-GEO-5)
        if (partnerKitchens.length === 0) {
          partnerKitchens.push(kitchenObj);
        }
      }
    }

    return sendResponse(res, 200, "Kitchens for zone", {
      kitchens: [...tiffsyKitchens, ...partnerKitchens],
      tiffsyKitchens,
      partnerKitchens,
    });
  } catch (error) {
    console.log("> Get kitchens for zone error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get public kitchen details (Customer view)
 *
 * GET /api/kitchens/:id/public
 */
export const getKitchenPublicDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const kitchen = await Kitchen.findById(id).select(
      "_id name type logo coverImage description cuisineTypes averageRating totalRatings premiumFlag gourmetFlag operatingHours isAcceptingOrders"
    );

    if (!kitchen) {
      return sendResponse(res, 404, "Kitchen not found");
    }

    if (kitchen.status !== "ACTIVE") {
      return sendResponse(res, 404, "Kitchen not available");
    }

    const kitchenObj = kitchen.toObject();
    kitchenObj.badges = buildKitchenBadges(kitchen);

    return sendResponse(res, 200, "Kitchen details", { kitchen: kitchenObj });
  } catch (error) {
    console.log("> Get kitchen public details error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get kitchen assigned to authenticated staff
 *
 * GET /api/kitchens/my-kitchen
 */
export const getMyKitchen = async (req, res) => {
  try {
    const user = req.user;

    if (!user.kitchenId) {
      return sendResponse(res, 404, "No kitchen assigned to your account");
    }

    const kitchen = await Kitchen.findById(user.kitchenId).populate(
      "zonesServed",
      "name code city"
    );

    if (!kitchen) {
      return sendResponse(res, 404, "Kitchen not found");
    }

    // Get order counts
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pendingOrders, todaysOrders] = await Promise.all([
      Order.countDocuments({
        kitchenId: kitchen._id,
        status: { $in: ["PLACED", "CONFIRMED"] },
      }),
      Order.countDocuments({
        kitchenId: kitchen._id,
        createdAt: { $gte: today },
      }),
    ]);

    return sendResponse(res, 200, "My kitchen", {
      kitchen,
      pendingOrders,
      todaysOrders,
    });
  } catch (error) {
    console.log("> Get my kitchen error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Update kitchen images (Kitchen Staff)
 *
 * PATCH /api/kitchens/my-kitchen/images
 */
export const updateMyKitchenImages = async (req, res) => {
  try {
    const user = req.user;
    const { logo, coverImage } = req.body;

    if (!user.kitchenId) {
      return sendResponse(res, 404, "No kitchen assigned to your account");
    }

    const kitchen = await Kitchen.findById(user.kitchenId);
    if (!kitchen) {
      return sendResponse(res, 404, "Kitchen not found");
    }

    if (logo !== undefined) kitchen.logo = logo;
    if (coverImage !== undefined) kitchen.coverImage = coverImage;

    await kitchen.save();

    return sendResponse(res, 200, "Kitchen images updated", {
      logo: kitchen.logo,
      coverImage: kitchen.coverImage,
    });
  } catch (error) {
    console.log("> Update kitchen images error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

export default {
  createKitchen,
  getKitchens,
  getKitchenById,
  updateKitchen,
  updateKitchenType,
  updateKitchenFlags,
  updateZonesServed,
  activateKitchen,
  deactivateKitchen,
  suspendKitchen,
  deleteKitchen,
  toggleOrderAcceptance,
  getKitchensForZone,
  getKitchenPublicDetails,
  getMyKitchen,
  updateMyKitchenImages,
};
