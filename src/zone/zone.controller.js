import Zone from "../../schema/zone.schema.js";
import Kitchen from "../../schema/kitchen.schema.js";
import CustomerAddress from "../../schema/customerAddress.schema.js";
import Order from "../../schema/order.schema.js";
import { sendResponse } from "../../utils/response.utils.js";
import { safeAuditLog } from "../../utils/audit.utils.js";

/**
 * Zone Controller
 * Handles zone and city management
 */

/**
 * Create a new zone
 *
 * POST /api/zones
 * Admin only
 */
export const createZone = async (req, res) => {
  try {
    const {
      pincode,
      name,
      city,
      state,
      timezone,
      status,
      orderingEnabled,
      displayOrder,
    } = req.body;

    // Check if pincode already exists
    const existingZone = await Zone.findOne({ pincode });
    if (existingZone) {
      return sendResponse(res, 400, "Zone with this pincode already exists");
    }

    const zone = new Zone({
      pincode,
      name: name.trim(),
      city: city.trim(),
      state: state?.trim(),
      timezone: timezone || "Asia/Kolkata",
      status: status || "INACTIVE",
      orderingEnabled: orderingEnabled !== false,
      displayOrder: displayOrder || 0,
      createdBy: req.user._id,
    });

    await zone.save();

    // Log audit entry
    safeAuditLog(req, {
      action: "CREATE",
      entityType: "ZONE",
      entityId: zone._id,
      entityName: `${zone.name} (${zone.pincode})`,
      newValue: zone.toJSON(),
    });

    console.log(`> Zone created: ${zone.pincode} - ${zone.name}`);

    return sendResponse(res, 201, "Zone created successfully", { zone });
  } catch (error) {
    console.log("> Create zone error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get all zones with filters
 *
 * GET /api/zones
 */
export const getZones = async (req, res) => {
  try {
    const { city, status, orderingEnabled, search, page = 1, limit = 50 } = req.query;

    // Build filter
    const filter = {};
    if (city) filter.city = new RegExp(city, "i");
    if (status) filter.status = status;
    if (orderingEnabled !== undefined) filter.orderingEnabled = orderingEnabled === "true";
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { pincode: new RegExp(search, "i") },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get zones with kitchen count
    const [zones, total] = await Promise.all([
      Zone.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: "kitchens",
            localField: "_id",
            foreignField: "zonesServed",
            as: "kitchens",
          },
        },
        {
          $addFields: {
            kitchenCount: { $size: "$kitchens" },
          },
        },
        { $project: { kitchens: 0 } },
        { $sort: { displayOrder: 1, city: 1, name: 1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
      ]),
      Zone.countDocuments(filter),
    ]);

    return sendResponse(res, 200, "Zones retrieved", {
      zones,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.log("> Get zones error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get zone by ID
 *
 * GET /api/zones/:id
 */
export const getZoneById = async (req, res) => {
  try {
    const { id } = req.params;

    const zone = await Zone.findById(id);
    if (!zone) {
      return sendResponse(res, 404, "Zone not found");
    }

    // Get kitchens serving this zone
    const kitchens = await Kitchen.find({
      zonesServed: id,
      status: "ACTIVE",
    }).select("name code type status");

    return sendResponse(res, 200, "Zone retrieved", {
      zone,
      kitchens,
    });
  } catch (error) {
    console.log("> Get zone by ID error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Update zone
 *
 * PUT /api/zones/:id
 * Admin only
 */
export const updateZone = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, city, state, timezone, displayOrder } = req.body;

    const zone = await Zone.findById(id);
    if (!zone) {
      return sendResponse(res, 404, "Zone not found");
    }

    const previousValue = zone.toJSON();

    // Update fields
    if (name !== undefined) zone.name = name.trim();
    if (city !== undefined) zone.city = city.trim();
    if (state !== undefined) zone.state = state?.trim();
    if (timezone !== undefined) zone.timezone = timezone;
    if (displayOrder !== undefined) zone.displayOrder = displayOrder;

    await zone.save();

    // Log audit entry
    safeAuditLog(req, {
      action: "UPDATE",
      entityType: "ZONE",
      entityId: zone._id,
      entityName: `${zone.name} (${zone.pincode})`,
      previousValue,
      newValue: zone.toJSON(),
      changedFields: Object.keys(req.body),
    });

    return sendResponse(res, 200, "Zone updated successfully", { zone });
  } catch (error) {
    console.log("> Update zone error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Activate zone
 *
 * PATCH /api/zones/:id/activate
 * Admin only
 */
export const activateZone = async (req, res) => {
  try {
    const { id } = req.params;

    const zone = await Zone.findById(id);
    if (!zone) {
      return sendResponse(res, 404, "Zone not found");
    }

    // Check if any kitchen serves this zone
    const kitchenCount = await Kitchen.countDocuments({
      zonesServed: id,
      status: "ACTIVE",
    });

    zone.status = "ACTIVE";
    await zone.save();

    // Log audit entry
    safeAuditLog(req, {
      action: "ACTIVATE",
      entityType: "ZONE",
      entityId: zone._id,
      entityName: `${zone.name} (${zone.pincode})`,
    });

    console.log(`> Zone activated: ${zone.pincode}`);

    return sendResponse(res, 200, "Zone activated successfully", {
      zone,
      warning: kitchenCount === 0 ? "No active kitchens serve this zone" : undefined,
    });
  } catch (error) {
    console.log("> Activate zone error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Deactivate zone
 *
 * PATCH /api/zones/:id/deactivate
 * Admin only
 */
export const deactivateZone = async (req, res) => {
  try {
    const { id } = req.params;

    const zone = await Zone.findById(id);
    if (!zone) {
      return sendResponse(res, 404, "Zone not found");
    }

    // Check for pending orders
    const pendingOrders = await Order.countDocuments({
      "deliveryAddress.zoneId": id,
      status: { $in: ["PLACED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP"] },
    });

    zone.status = "INACTIVE";
    await zone.save();

    // Log audit entry
    safeAuditLog(req, {
      action: "DEACTIVATE",
      entityType: "ZONE",
      entityId: zone._id,
      entityName: `${zone.name} (${zone.pincode})`,
    });

    console.log(`> Zone deactivated: ${zone.pincode}`);

    return sendResponse(res, 200, "Zone deactivated successfully", {
      zone,
      warning: pendingOrders > 0 ? `${pendingOrders} pending orders in this zone` : undefined,
    });
  } catch (error) {
    console.log("> Deactivate zone error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Toggle ordering for zone
 *
 * PATCH /api/zones/:id/ordering
 * Admin only
 */
export const toggleOrdering = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderingEnabled } = req.body;

    const zone = await Zone.findById(id);
    if (!zone) {
      return sendResponse(res, 404, "Zone not found");
    }

    zone.orderingEnabled = orderingEnabled;
    await zone.save();

    // Log audit entry
    safeAuditLog(req, {
      action: "UPDATE",
      entityType: "ZONE",
      entityId: zone._id,
      entityName: `${zone.name} (${zone.pincode})`,
      changedFields: ["orderingEnabled"],
      newValue: { orderingEnabled },
    });

    return sendResponse(res, 200, "Zone ordering updated", {
      orderingEnabled: zone.orderingEnabled,
    });
  } catch (error) {
    console.log("> Toggle ordering error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Delete zone
 *
 * DELETE /api/zones/:id
 * Admin only
 */
export const deleteZone = async (req, res) => {
  try {
    const { id } = req.params;

    const zone = await Zone.findById(id);
    if (!zone) {
      return sendResponse(res, 404, "Zone not found");
    }

    // Check for dependencies
    const [addressCount, orderCount, kitchenCount] = await Promise.all([
      CustomerAddress.countDocuments({ zoneId: id }),
      Order.countDocuments({ "deliveryAddress.zoneId": id }),
      Kitchen.countDocuments({ zonesServed: id }),
    ]);

    if (addressCount > 0 || orderCount > 0 || kitchenCount > 0) {
      return sendResponse(
        res,
        400,
        "Cannot delete zone with existing data. Deactivate instead.",
        null,
        `Zone has ${addressCount} addresses, ${orderCount} orders, ${kitchenCount} kitchens`
      );
    }

    await Zone.deleteOne({ _id: id });

    // Log audit entry
    safeAuditLog(req, {
      action: "DELETE",
      entityType: "ZONE",
      entityId: zone._id,
      entityName: `${zone.name} (${zone.pincode})`,
    });

    console.log(`> Zone deleted: ${zone.pincode}`);

    return sendResponse(res, 200, "Zone deleted successfully");
  } catch (error) {
    console.log("> Delete zone error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get list of cities
 *
 * GET /api/zones/cities
 */
export const getCities = async (req, res) => {
  try {
    const { status = "ACTIVE" } = req.query;

    const matchStage = {};
    if (status !== "ALL") {
      matchStage.status = status;
    }

    const cities = await Zone.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { city: "$city", state: "$state" },
          zoneCount: { $sum: 1 },
          activeZoneCount: {
            $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          city: "$_id.city",
          state: "$_id.state",
          zoneCount: 1,
          activeZoneCount: 1,
        },
      },
      { $sort: { city: 1 } },
    ]);

    return sendResponse(res, 200, "Cities retrieved", { cities });
  } catch (error) {
    console.log("> Get cities error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get zones by city
 *
 * GET /api/zones/city/:cityName
 */
export const getZonesByCity = async (req, res) => {
  try {
    const { cityName } = req.params;
    const { status = "ACTIVE" } = req.query;

    const filter = { city: new RegExp(`^${cityName}$`, "i") };
    if (status !== "ALL") {
      filter.status = status;
    }

    const zones = await Zone.find(filter)
      .select("pincode name city state status orderingEnabled")
      .sort({ displayOrder: 1, name: 1 });

    return sendResponse(res, 200, "Zones retrieved", {
      city: cityName,
      zones,
    });
  } catch (error) {
    console.log("> Get zones by city error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get active serviceable zones
 *
 * GET /api/zones/active
 * Public
 */
export const getActiveZones = async (req, res) => {
  try {
    const { city } = req.query;

    const filter = {
      status: "ACTIVE",
      orderingEnabled: true,
    };
    if (city) {
      filter.city = new RegExp(city, "i");
    }

    const zones = await Zone.find(filter)
      .select("pincode name city")
      .sort({ displayOrder: 1, name: 1 });

    return sendResponse(res, 200, "Active zones retrieved", { zones });
  } catch (error) {
    console.log("> Get active zones error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Look up zone by pincode
 *
 * GET /api/zones/lookup/:pincode
 * Public
 */
export const lookupZoneByPincode = async (req, res) => {
  try {
    const { pincode } = req.params;

    // Validate pincode format
    if (!/^\d{6}$/.test(pincode)) {
      return sendResponse(res, 400, "Invalid pincode format");
    }

    const zone = await Zone.findOne({ pincode }).select(
      "pincode name city status orderingEnabled"
    );

    if (!zone) {
      return sendResponse(res, 200, "Pincode lookup complete", {
        found: false,
        zone: null,
        isServiceable: false,
        message: "This pincode is not in our service area",
      });
    }

    const isServiceable = zone.status === "ACTIVE" && zone.orderingEnabled;

    return sendResponse(res, 200, "Pincode lookup complete", {
      found: true,
      zone: {
        _id: zone._id,
        pincode: zone.pincode,
        name: zone.name,
        city: zone.city,
      },
      isServiceable,
      message: isServiceable
        ? "This pincode is serviceable"
        : "Service temporarily unavailable in this area",
    });
  } catch (error) {
    console.log("> Lookup zone error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

export default {
  createZone,
  getZones,
  getZoneById,
  updateZone,
  activateZone,
  deactivateZone,
  toggleOrdering,
  deleteZone,
  getCities,
  getZonesByCity,
  getActiveZones,
  lookupZoneByPincode,
};
