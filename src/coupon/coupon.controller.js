import Coupon from "../../schema/coupon.schema.js";
import Order from "../../schema/order.schema.js";
import AuditLog from "../../schema/auditLog.schema.js";
import { sendResponse } from "../utils/response.utils.js";

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Get user's coupon usage count
 * @param {string} couponId - Coupon ID
 * @param {string} userId - User ID
 * @returns {Promise<number>} Usage count
 */
async function getUserCouponUsage(couponId, userId) {
  const count = await Order.countDocuments({
    userId,
    "discount.couponId": couponId,
    status: { $nin: ["CANCELLED", "REJECTED"] },
  });
  return count;
}

/**
 * Check if user is a new user (no previous orders)
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
async function isNewUser(userId) {
  const orderCount = await Order.countDocuments({
    userId,
    status: { $nin: ["CANCELLED", "REJECTED"] },
  });
  return orderCount === 0;
}

/**
 * Check if this is user's first order
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
async function isFirstOrder(userId) {
  const orderCount = await Order.countDocuments({
    userId,
    status: { $in: ["DELIVERED"] },
  });
  return orderCount === 0;
}

/**
 * Validate coupon for user and order context
 * @param {Object} coupon - Coupon document
 * @param {string} userId - User ID
 * @param {Object} orderContext - Order context { kitchenId, zoneId, orderValue, itemCount, menuType }
 * @returns {Promise<{valid: boolean, reason: string|null}>}
 */
async function validateCouponForUser(coupon, userId, orderContext) {
  const { kitchenId, zoneId, orderValue, itemCount, menuType } = orderContext;
  const now = new Date();

  // Check status
  if (coupon.status !== "ACTIVE") {
    if (coupon.status === "EXPIRED") return { valid: false, reason: "EXPIRED" };
    if (coupon.status === "EXHAUSTED") return { valid: false, reason: "EXHAUSTED" };
    return { valid: false, reason: "INACTIVE" };
  }

  // Check validity period
  if (now < coupon.validFrom) {
    return { valid: false, reason: "NOT_STARTED" };
  }
  if (now > coupon.validTill) {
    return { valid: false, reason: "EXPIRED" };
  }

  // Check global usage limit
  if (coupon.totalUsageLimit && coupon.totalUsageCount >= coupon.totalUsageLimit) {
    return { valid: false, reason: "EXHAUSTED" };
  }

  // Check per-user limit
  const userUsageCount = await getUserCouponUsage(coupon._id, userId);
  if (userUsageCount >= coupon.perUserLimit) {
    return { valid: false, reason: "USER_LIMIT_EXCEEDED" };
  }

  // Check menu type (coupons only for ON_DEMAND_MENU)
  if (menuType && menuType !== "ON_DEMAND_MENU") {
    return { valid: false, reason: "WRONG_MENU_TYPE" };
  }

  // Check kitchen applicability
  if (!coupon.appliesToKitchen(kitchenId)) {
    return { valid: false, reason: "KITCHEN_NOT_APPLICABLE" };
  }

  // Check zone applicability
  if (!coupon.appliesToZone(zoneId)) {
    return { valid: false, reason: "ZONE_NOT_APPLICABLE" };
  }

  // Check minimum order value
  if (orderValue < coupon.minOrderValue) {
    return { valid: false, reason: "MIN_ORDER_NOT_MET" };
  }

  // Check minimum items
  if (itemCount < coupon.minItems) {
    return { valid: false, reason: "MIN_ITEMS_NOT_MET" };
  }

  // Check user type targeting
  if (coupon.targetUserType === "NEW_USERS") {
    const newUser = await isNewUser(userId);
    if (!newUser) {
      return { valid: false, reason: "NEW_USERS_ONLY" };
    }
  } else if (coupon.targetUserType === "EXISTING_USERS") {
    const newUser = await isNewUser(userId);
    if (newUser) {
      return { valid: false, reason: "EXISTING_USERS_ONLY" };
    }
  } else if (coupon.targetUserType === "SPECIFIC_USERS") {
    const isSpecificUser = coupon.specificUserIds.some(
      (id) => id.toString() === userId.toString()
    );
    if (!isSpecificUser) {
      return { valid: false, reason: "NOT_ELIGIBLE_USER" };
    }
  }

  // Check first order only
  if (coupon.isFirstOrderOnly) {
    const firstOrder = await isFirstOrder(userId);
    if (!firstOrder) {
      return { valid: false, reason: "FIRST_ORDER_ONLY" };
    }
  }

  return { valid: true, reason: null };
}

/**
 * Calculate discount amount
 * @param {Object} coupon - Coupon document
 * @param {number} orderValue - Order subtotal
 * @returns {number} Discount amount
 */
function calculateDiscount(coupon, orderValue) {
  return coupon.calculateDiscount(orderValue);
}

/**
 * Get usage stats for a coupon
 * @param {string} couponId - Coupon ID
 * @returns {Promise<Object>} Usage statistics
 */
async function getCouponUsageStats(couponId) {
  const orders = await Order.find({
    "discount.couponId": couponId,
    status: { $nin: ["CANCELLED", "REJECTED"] },
  }).select("userId discount.discountAmount");

  const uniqueUsers = new Set(orders.map((o) => o.userId.toString()));
  const totalDiscountGiven = orders.reduce(
    (sum, o) => sum + (o.discount?.discountAmount || 0),
    0
  );

  return {
    totalUsed: orders.length,
    uniqueUsers: uniqueUsers.size,
    totalDiscountGiven,
  };
}

/**
 * ============================================================================
 * ADMIN - COUPON MANAGEMENT
 * ============================================================================
 */

/**
 * Create a new coupon
 * @route POST /api/coupons
 * @access Admin
 */
export async function createCoupon(req, res) {
  try {
    const data = req.body;
    const adminId = req.user._id;

    // Normalize code to uppercase
    const code = data.code.toUpperCase();

    // Check if code already exists
    const existingCoupon = await Coupon.findOne({ code });
    if (existingCoupon) {
      return sendResponse(res, 400, false, "Coupon code already exists");
    }

    // Create coupon
    const coupon = new Coupon({
      ...data,
      code,
      applicableMenuTypes: ["ON_DEMAND_MENU"], // Always ON_DEMAND_MENU only
      createdBy: adminId,
    });

    await coupon.save();

    // Log audit
    await AuditLog.create({
      action: "CREATE",
      entityType: "COUPON",
      entityId: coupon._id,
      performedBy: adminId,
      details: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
    });

    return sendResponse(res, 201, true, "Coupon created successfully", {
      coupon,
    });
  } catch (error) {
    console.error("Create coupon error:", error);
    return sendResponse(res, 500, false, "Failed to create coupon");
  }
}

/**
 * Get all coupons (Admin view)
 * @route GET /api/coupons
 * @access Admin
 */
export async function getCoupons(req, res) {
  try {
    const { status, discountType, search, page = 1, limit = 20 } = req.query;

    const query = {};

    if (status) query.status = status;
    if (discountType) query.discountType = discountType;
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [coupons, total] = await Promise.all([
      Coupon.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Coupon.countDocuments(query),
    ]);

    // Add usage stats to each coupon
    const couponsWithStats = coupons.map((coupon) => ({
      ...coupon.toObject(),
      usageStats: {
        used: coupon.totalUsageCount,
        remaining: coupon.totalUsageLimit
          ? coupon.totalUsageLimit - coupon.totalUsageCount
          : "Unlimited",
      },
    }));

    return sendResponse(res, 200, true, "Coupons retrieved", {
      coupons: couponsWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get coupons error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve coupons");
  }
}

/**
 * Get coupon by ID
 * @route GET /api/coupons/:id
 * @access Admin
 */
export async function getCouponById(req, res) {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return sendResponse(res, 404, false, "Coupon not found");
    }

    // Get usage stats
    const usageStats = await getCouponUsageStats(id);
    usageStats.remainingUses = coupon.totalUsageLimit
      ? coupon.totalUsageLimit - coupon.totalUsageCount
      : "Unlimited";

    // Get recent usage
    const recentUsage = await Order.find({
      "discount.couponId": id,
      status: { $nin: ["CANCELLED", "REJECTED"] },
    })
      .select("userId discount.discountAmount placedAt")
      .populate("userId", "name phone")
      .sort({ placedAt: -1 })
      .limit(10);

    return sendResponse(res, 200, true, "Coupon retrieved", {
      coupon,
      usageStats,
      recentUsage: recentUsage.map((o) => ({
        user: o.userId,
        order: o._id,
        date: o.placedAt,
        discount: o.discount?.discountAmount,
      })),
    });
  } catch (error) {
    console.error("Get coupon by ID error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve coupon");
  }
}

/**
 * Update coupon
 * @route PUT /api/coupons/:id
 * @access Admin
 */
export async function updateCoupon(req, res) {
  try {
    const { id } = req.params;
    const data = req.body;
    const adminId = req.user._id;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return sendResponse(res, 404, false, "Coupon not found");
    }

    // Cannot change code if coupon has been used
    if (data.code && coupon.totalUsageCount > 0) {
      return sendResponse(
        res,
        400,
        false,
        "Cannot change code of a coupon that has been used"
      );
    }

    // Update fields
    const allowedFields = [
      "name",
      "description",
      "discountValue",
      "maxDiscountAmount",
      "minOrderValue",
      "minItems",
      "applicableKitchenIds",
      "applicableZoneIds",
      "excludedKitchenIds",
      "totalUsageLimit",
      "perUserLimit",
      "targetUserType",
      "specificUserIds",
      "isFirstOrderOnly",
      "validFrom",
      "validTill",
      "isVisible",
      "displayOrder",
      "bannerImage",
      "termsAndConditions",
    ];

    allowedFields.forEach((field) => {
      if (data[field] !== undefined) {
        coupon[field] = data[field];
      }
    });

    await coupon.save();

    // Log audit
    await AuditLog.create({
      action: "UPDATE",
      entityType: "COUPON",
      entityId: coupon._id,
      performedBy: adminId,
      details: { updatedFields: Object.keys(data) },
    });

    return sendResponse(res, 200, true, "Coupon updated successfully", {
      coupon,
    });
  } catch (error) {
    console.error("Update coupon error:", error);
    return sendResponse(res, 500, false, "Failed to update coupon");
  }
}

/**
 * Activate coupon
 * @route PATCH /api/coupons/:id/activate
 * @access Admin
 */
export async function activateCoupon(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return sendResponse(res, 404, false, "Coupon not found");
    }

    if (coupon.status === "ACTIVE") {
      return sendResponse(res, 400, false, "Coupon is already active");
    }

    if (coupon.status === "EXHAUSTED") {
      return sendResponse(res, 400, false, "Cannot activate exhausted coupon");
    }

    // Check if expired
    const now = new Date();
    if (now > coupon.validTill) {
      coupon.status = "EXPIRED";
      await coupon.save();
      return sendResponse(res, 400, false, "Coupon has expired");
    }

    coupon.status = "ACTIVE";
    await coupon.save();

    // Log audit
    await AuditLog.create({
      action: "ACTIVATE",
      entityType: "COUPON",
      entityId: coupon._id,
      performedBy: adminId,
    });

    return sendResponse(res, 200, true, "Coupon activated", { coupon });
  } catch (error) {
    console.error("Activate coupon error:", error);
    return sendResponse(res, 500, false, "Failed to activate coupon");
  }
}

/**
 * Deactivate coupon
 * @route PATCH /api/coupons/:id/deactivate
 * @access Admin
 */
export async function deactivateCoupon(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return sendResponse(res, 404, false, "Coupon not found");
    }

    if (coupon.status === "INACTIVE") {
      return sendResponse(res, 400, false, "Coupon is already inactive");
    }

    coupon.status = "INACTIVE";
    await coupon.save();

    // Log audit
    await AuditLog.create({
      action: "DEACTIVATE",
      entityType: "COUPON",
      entityId: coupon._id,
      performedBy: adminId,
    });

    return sendResponse(res, 200, true, "Coupon deactivated", { coupon });
  } catch (error) {
    console.error("Deactivate coupon error:", error);
    return sendResponse(res, 500, false, "Failed to deactivate coupon");
  }
}

/**
 * Delete coupon (only if never used)
 * @route DELETE /api/coupons/:id
 * @access Admin
 */
export async function deleteCoupon(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return sendResponse(res, 404, false, "Coupon not found");
    }

    if (coupon.totalUsageCount > 0) {
      return sendResponse(
        res,
        400,
        false,
        "Cannot delete a coupon that has been used"
      );
    }

    await coupon.deleteOne();

    // Log audit
    await AuditLog.create({
      action: "DELETE",
      entityType: "COUPON",
      entityId: id,
      performedBy: adminId,
      details: { code: coupon.code },
    });

    return sendResponse(res, 200, true, "Coupon deleted successfully");
  } catch (error) {
    console.error("Delete coupon error:", error);
    return sendResponse(res, 500, false, "Failed to delete coupon");
  }
}

/**
 * ============================================================================
 * CUSTOMER - COUPON USAGE
 * ============================================================================
 */

/**
 * Get available coupons for customer
 * @route GET /api/coupons/available
 * @access Authenticated Customer
 */
export async function getAvailableCoupons(req, res) {
  try {
    const userId = req.user._id;
    const { kitchenId, zoneId, orderValue } = req.query;
    const now = new Date();

    // Build base query
    const query = {
      status: "ACTIVE",
      isVisible: true,
      validFrom: { $lte: now },
      validTill: { $gte: now },
    };

    // Add order value filter
    if (orderValue) {
      query.minOrderValue = { $lte: parseFloat(orderValue) };
    }

    const coupons = await Coupon.find(query).sort({ displayOrder: 1 });

    // Filter coupons based on user eligibility and context
    const eligibleCoupons = [];

    for (const coupon of coupons) {
      // Check global usage limit
      if (
        coupon.totalUsageLimit &&
        coupon.totalUsageCount >= coupon.totalUsageLimit
      ) {
        continue;
      }

      // Check per-user limit
      const userUsage = await getUserCouponUsage(coupon._id, userId);
      if (userUsage >= coupon.perUserLimit) {
        continue;
      }

      // Check kitchen applicability if provided
      if (kitchenId && !coupon.appliesToKitchen(kitchenId)) {
        continue;
      }

      // Check zone applicability if provided
      if (zoneId && !coupon.appliesToZone(zoneId)) {
        continue;
      }

      // Check user type targeting
      if (coupon.targetUserType === "NEW_USERS") {
        const newUser = await isNewUser(userId);
        if (!newUser) continue;
      } else if (coupon.targetUserType === "EXISTING_USERS") {
        const newUser = await isNewUser(userId);
        if (newUser) continue;
      } else if (coupon.targetUserType === "SPECIFIC_USERS") {
        const isSpecificUser = coupon.specificUserIds.some(
          (id) => id.toString() === userId.toString()
        );
        if (!isSpecificUser) continue;
      }

      // Check first order only
      if (coupon.isFirstOrderOnly) {
        const firstOrder = await isFirstOrder(userId);
        if (!firstOrder) continue;
      }

      eligibleCoupons.push({
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscountAmount: coupon.maxDiscountAmount,
        minOrderValue: coupon.minOrderValue,
        termsAndConditions: coupon.termsAndConditions,
        validTill: coupon.validTill,
        usesRemaining: coupon.perUserLimit - userUsage,
        bannerImage: coupon.bannerImage,
      });
    }

    return sendResponse(res, 200, true, "Available coupons retrieved", {
      coupons: eligibleCoupons,
    });
  } catch (error) {
    console.error("Get available coupons error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve available coupons");
  }
}

/**
 * Validate coupon code for an order
 * @route POST /api/coupons/validate
 * @access Authenticated Customer
 */
export async function validateCoupon(req, res) {
  try {
    const userId = req.user._id;
    const { code, kitchenId, zoneId, orderValue, itemCount, menuType } = req.body;

    // Find coupon by code (case-insensitive)
    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
    });

    if (!coupon) {
      return sendResponse(res, 200, true, "Coupon validation result", {
        valid: false,
        coupon: null,
        discount: null,
        reason: "INVALID_CODE",
      });
    }

    // Validate coupon for user
    const validation = await validateCouponForUser(coupon, userId, {
      kitchenId,
      zoneId,
      orderValue,
      itemCount,
      menuType,
    });

    if (!validation.valid) {
      return sendResponse(res, 200, true, "Coupon validation result", {
        valid: false,
        coupon: {
          code: coupon.code,
          name: coupon.name,
        },
        discount: null,
        reason: validation.reason,
      });
    }

    // Calculate discount
    const discountAmount = calculateDiscount(coupon, orderValue);

    return sendResponse(res, 200, true, "Coupon validation result", {
      valid: true,
      coupon: {
        code: coupon.code,
        name: coupon.name,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
      discount: {
        type: coupon.discountType,
        value: coupon.discountValue,
        amount: discountAmount,
      },
      reason: null,
    });
  } catch (error) {
    console.error("Validate coupon error:", error);
    return sendResponse(res, 500, false, "Failed to validate coupon");
  }
}

/**
 * Apply coupon to order (Internal service call)
 * @route POST /api/coupons/apply
 * @access Internal
 */
export async function applyCoupon(req, res) {
  try {
    const { code, userId, orderId, orderValue, kitchenId, zoneId, itemCount } = req.body;

    // Find coupon
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) {
      return sendResponse(res, 400, false, "Invalid coupon code");
    }

    // Validate coupon
    const validation = await validateCouponForUser(coupon, userId, {
      kitchenId,
      zoneId,
      orderValue,
      itemCount,
      menuType: "ON_DEMAND_MENU",
    });

    if (!validation.valid) {
      return sendResponse(res, 400, false, `Coupon invalid: ${validation.reason}`);
    }

    // Calculate discount
    const discountAmount = calculateDiscount(coupon, orderValue);

    // Increment usage count
    await coupon.incrementUsage();

    return sendResponse(res, 200, true, "Coupon applied", {
      couponId: coupon._id,
      couponCode: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
    });
  } catch (error) {
    console.error("Apply coupon error:", error);
    return sendResponse(res, 500, false, "Failed to apply coupon");
  }
}

/**
 * Expire coupons (Cron job)
 * @route POST /api/coupons/expire (Internal/Cron)
 * @access System/Admin
 */
export async function expireCoupons(req, res) {
  try {
    const now = new Date();

    const result = await Coupon.updateMany(
      {
        status: "ACTIVE",
        validTill: { $lt: now },
      },
      {
        $set: { status: "EXPIRED" },
      }
    );

    return sendResponse(res, 200, true, "Coupons expired", {
      expiredCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Expire coupons error:", error);
    return sendResponse(res, 500, false, "Failed to expire coupons");
  }
}

export default {
  createCoupon,
  getCoupons,
  getCouponById,
  updateCoupon,
  activateCoupon,
  deactivateCoupon,
  deleteCoupon,
  getAvailableCoupons,
  validateCoupon,
  applyCoupon,
  expireCoupons,
};
