import SubscriptionPlan from "../../schema/subscriptionPlan.schema.js";
import Subscription from "../../schema/subscription.schema.js";
import Voucher from "../../schema/voucher.schema.js";
import { sendResponse } from "../../utils/response.utils.js";
import { safeAuditLog } from "../../utils/audit.utils.js";

/**
 * Subscription Controller
 * Handles subscription plans and customer subscriptions
 */

/**
 * Helper: Issue vouchers for a subscription
 * @param {ObjectId} userId - User ID
 * @param {ObjectId} subscriptionId - Subscription ID
 * @param {Number} count - Number of vouchers to issue
 * @param {Date} expiryDate - Expiry date for vouchers
 * @returns {Promise<Object>} { issued: Number, voucherIds: Array }
 */
const issueVouchers = async (userId, subscriptionId, count, expiryDate) => {
  const voucherIds = [];

  for (let i = 0; i < count; i++) {
    const voucherCode = await Voucher.generateVoucherCode();
    const voucher = new Voucher({
      voucherCode,
      userId,
      subscriptionId,
      issuedDate: new Date(),
      expiryDate,
      status: "AVAILABLE",
    });
    await voucher.save();
    voucherIds.push(voucher._id);
  }

  return { issued: count, voucherIds };
};

/**
 * Helper: Calculate refund eligibility
 * @param {Object} subscription - Subscription document
 * @returns {Object} { eligible: Boolean, amount: Number, reason: String }
 */
const calculateRefundEligibility = async (subscription) => {
  // Get voucher usage
  const vouchers = await Voucher.find({ subscriptionId: subscription._id });
  const totalVouchers = vouchers.length;
  const redeemedVouchers = vouchers.filter(
    (v) => v.status === "REDEEMED"
  ).length;
  const usagePercentage =
    totalVouchers > 0 ? (redeemedVouchers / totalVouchers) * 100 : 0;

  // Refund policy: eligible if less than 25% used
  if (usagePercentage <= 25) {
    const refundPercentage = 100 - usagePercentage * 2; // Progressive reduction
    const amount = Math.round(
      (subscription.amountPaid * refundPercentage) / 100
    );
    return {
      eligible: true,
      amount,
      reason: `${redeemedVouchers}/${totalVouchers} vouchers used (${usagePercentage.toFixed(
        1
      )}%)`,
    };
  }

  return {
    eligible: false,
    amount: 0,
    reason: `Too many vouchers used: ${redeemedVouchers}/${totalVouchers} (${usagePercentage.toFixed(
      1
    )}%)`,
  };
};

/**
 * Helper: Cancel unused vouchers
 * @param {ObjectId} subscriptionId - Subscription ID
 * @returns {Promise<Object>} { cancelled: Number }
 */
const cancelUnusedVouchers = async (subscriptionId) => {
  const result = await Voucher.updateMany(
    {
      subscriptionId,
      status: { $in: ["AVAILABLE", "RESTORED"] },
    },
    { $set: { status: "CANCELLED" } }
  );

  return { cancelled: result.modifiedCount };
};

// ============================================================================
// ADMIN - PLAN MANAGEMENT
// ============================================================================

/**
 * Create a new subscription plan
 *
 * POST /api/subscriptions/plans
 */
export const createPlan = async (req, res) => {
  try {
    const {
      name,
      description,
      durationDays,
      vouchersPerDay,
      voucherValidityDays,
      price,
      originalPrice,
      coverageRules,
      applicableZoneIds,
      displayOrder,
      badge,
      features,
      status,
      validFrom,
      validTill,
    } = req.body;

    // Compute total vouchers
    const totalVouchers = durationDays * (vouchersPerDay || 2);

    const plan = new SubscriptionPlan({
      name,
      description,
      durationDays,
      vouchersPerDay: vouchersPerDay || 2,
      totalVouchers,
      voucherValidityDays: voucherValidityDays || 90,
      price,
      originalPrice,
      coverageRules,
      applicableZoneIds: applicableZoneIds || [],
      displayOrder: displayOrder || 0,
      badge,
      features: features || [],
      status: status || "INACTIVE",
      validFrom,
      validTill,
      createdBy: req.user._id,
    });

    await plan.save();

    // Log audit entry
    safeAuditLog(req, {
      action: "CREATE",
      entityType: "SUBSCRIPTION_PLAN",
      entityId: plan._id,
      newValue: plan.toObject(),
      description: `Created subscription plan: ${name}`,
    });

    console.log(`> Subscription plan created: ${name}`);

    return sendResponse(res, 201, "Subscription plan created", {
      plan,
      totalVouchers,
    });
  } catch (error) {
    console.log("> Create plan error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get all subscription plans (admin view)
 *
 * GET /api/subscriptions/plans
 */
export const getPlans = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [plans, total] = await Promise.all([
      SubscriptionPlan.find(query)
        .sort({ displayOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      SubscriptionPlan.countDocuments(query),
    ]);

    // Add subscriber count for each plan
    const plansWithCount = await Promise.all(
      plans.map(async (plan) => {
        const planObj = plan.toObject();
        planObj.subscriberCount = await Subscription.countDocuments({
          planId: plan._id,
          status: { $in: ["ACTIVE", "EXPIRED"] },
        });
        return planObj;
      })
    );

    return sendResponse(res, 200, "Subscription plans", {
      plans: plansWithCount,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.log("> Get plans error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get plan by ID
 *
 * GET /api/subscriptions/plans/:id
 */
export const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      return sendResponse(res, 404, "Plan not found");
    }

    // For non-admin, only show active plans
    if (req.user?.role !== "ADMIN" && plan.status !== "ACTIVE") {
      return sendResponse(res, 404, "Plan not found");
    }

    return sendResponse(res, 200, "Plan details", { plan });
  } catch (error) {
    console.log("> Get plan by ID error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Update subscription plan
 *
 * PUT /api/subscriptions/plans/:id
 */
export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      return sendResponse(res, 404, "Plan not found");
    }

    // Check if plan has active subscribers
    const activeSubscribers = await Subscription.countDocuments({
      planId: id,
      status: "ACTIVE",
    });

    const oldValue = plan.toObject();

    // If has subscribers, only allow limited updates
    const allowedFields =
      activeSubscribers > 0
        ? ["name", "description", "badge", "features", "displayOrder"]
        : [
            "name",
            "description",
            "price",
            "originalPrice",
            "coverageRules",
            "applicableZoneIds",
            "displayOrder",
            "badge",
            "features",
            "validFrom",
            "validTill",
          ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        plan[field] = updates[field];
      }
    }

    await plan.save();

    // Log audit entry
    safeAuditLog(req, {
      action: "UPDATE",
      entityType: "SUBSCRIPTION_PLAN",
      entityId: plan._id,
      oldValue,
      newValue: plan.toObject(),
      description: `Updated subscription plan: ${plan.name}`,
    });

    return sendResponse(res, 200, "Plan updated", {
      plan,
      warning:
        activeSubscribers > 0
          ? `Plan has ${activeSubscribers} active subscribers. Some fields are locked.`
          : undefined,
    });
  } catch (error) {
    console.log("> Update plan error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Activate plan
 *
 * PATCH /api/subscriptions/plans/:id/activate
 */
export const activatePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      return sendResponse(res, 404, "Plan not found");
    }

    const oldStatus = plan.status;
    plan.status = "ACTIVE";
    await plan.save();

    // Log audit entry
    safeAuditLog(req, {
      action: "UPDATE",
      entityType: "SUBSCRIPTION_PLAN",
      entityId: plan._id,
      oldValue: { status: oldStatus },
      newValue: { status: "ACTIVE" },
      description: `Activated subscription plan: ${plan.name}`,
    });

    return sendResponse(res, 200, "Plan activated", { plan });
  } catch (error) {
    console.log("> Activate plan error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Deactivate plan
 *
 * PATCH /api/subscriptions/plans/:id/deactivate
 */
export const deactivatePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      return sendResponse(res, 404, "Plan not found");
    }

    const oldStatus = plan.status;
    plan.status = "INACTIVE";
    await plan.save();

    // Log audit entry
    safeAuditLog(req, {
      action: "UPDATE",
      entityType: "SUBSCRIPTION_PLAN",
      entityId: plan._id,
      oldValue: { status: oldStatus },
      newValue: { status: "INACTIVE" },
      description: `Deactivated subscription plan: ${plan.name}`,
    });

    return sendResponse(res, 200, "Plan deactivated", { plan });
  } catch (error) {
    console.log("> Deactivate plan error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Archive plan
 *
 * PATCH /api/subscriptions/plans/:id/archive
 */
export const archivePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      return sendResponse(res, 404, "Plan not found");
    }

    const oldStatus = plan.status;
    plan.status = "ARCHIVED";
    await plan.save();

    // Log audit entry
    safeAuditLog(req, {
      action: "UPDATE",
      entityType: "SUBSCRIPTION_PLAN",
      entityId: plan._id,
      oldValue: { status: oldStatus },
      newValue: { status: "ARCHIVED" },
      description: `Archived subscription plan: ${plan.name}`,
    });

    return sendResponse(res, 200, "Plan archived", { plan });
  } catch (error) {
    console.log("> Archive plan error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

// ============================================================================
// PUBLIC - PLAN BROWSING
// ============================================================================

/**
 * Get active plans for customer purchase
 *
 * GET /api/subscriptions/plans/active
 */
export const getActivePlans = async (req, res) => {
  try {
    const { zoneId } = req.query;
    const now = new Date();

    const query = {
      status: "ACTIVE",
      $or: [{ validFrom: null }, { validFrom: { $lte: now } }],
    };

    // Add validity period check
    const plans = await SubscriptionPlan.find(query)
      .select(
        "_id name description durationDays vouchersPerDay totalVouchers price originalPrice badge features displayOrder"
      )
      .sort({ displayOrder: 1 });

    // Filter by validity period and zone
    const filteredPlans = plans.filter((plan) => {
      // Check validTill
      if (plan.validTill && plan.validTill < now) {
        return false;
      }
      // Check zone applicability
      if (
        zoneId &&
        plan.applicableZoneIds &&
        plan.applicableZoneIds.length > 0
      ) {
        return plan.applicableZoneIds.includes(zoneId);
      }
      return true;
    });

    return sendResponse(res, 200, "Active subscription plans", {
      plans: filteredPlans,
    });
  } catch (error) {
    console.log("> Get active plans error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

// ============================================================================
// CUSTOMER - SUBSCRIPTION OPERATIONS
// ============================================================================

/**
 * Purchase subscription
 *
 * POST /api/subscriptions/purchase
 */
export const purchaseSubscription = async (req, res) => {
  try {
    const { planId, paymentId, paymentMethod } = req.body;
    const userId = req.user._id;
    const now = new Date();

    // Fetch plan
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return sendResponse(res, 404, "Plan not found");
    }

    // Verify plan is active and valid
    if (plan.status !== "ACTIVE") {
      return sendResponse(res, 400, "Plan is not available for purchase");
    }

    if (plan.validFrom && plan.validFrom > now) {
      return sendResponse(res, 400, "Plan is not yet available");
    }

    if (plan.validTill && plan.validTill < now) {
      return sendResponse(res, 400, "Plan has expired");
    }

    // Allow users to purchase multiple subscriptions (same or different plans)
    // Users can stack subscriptions and accumulate vouchers

    // Calculate dates
    const startDate = now;
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const voucherExpiryDate = new Date(now);
    voucherExpiryDate.setDate(
      voucherExpiryDate.getDate() + plan.voucherValidityDays
    );

    // Create subscription
    const subscription = new Subscription({
      userId,
      planId,
      planSnapshot: {
        name: plan.name,
        durationDays: plan.durationDays,
        vouchersPerDay: plan.vouchersPerDay,
        totalVouchers: plan.totalVouchers,
        price: plan.price,
      },
      purchaseDate: now,
      startDate,
      endDate,
      totalVouchersIssued: plan.totalVouchers,
      voucherExpiryDate,
      status: "ACTIVE",
      amountPaid: plan.price,
      paymentId,
      paymentMethod,
    });

    await subscription.save();

    // Issue vouchers
    const voucherResult = await issueVouchers(
      userId,
      subscription._id,
      plan.totalVouchers,
      voucherExpiryDate
    );

    console.log(
      `> Subscription purchased: ${plan.name} by user ${req.user.phone}`
    );

    return sendResponse(res, 201, "Subscription purchased successfully", {
      subscription,
      vouchersIssued: voucherResult.issued,
      voucherExpiryDate,
    });
  } catch (error) {
    console.log("> Purchase subscription error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get customer's subscriptions
 *
 * GET /api/subscriptions/my-subscriptions
 */
export const getMySubscriptions = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { userId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [subscriptions, total] = await Promise.all([
      Subscription.find(query)
        .populate("planId", "name durationDays badge")
        .sort({ purchaseDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Subscription.countDocuments(query),
    ]);

    // Compute additional info for each subscription
    const subscriptionsWithInfo = await Promise.all(
      subscriptions.map(async (sub) => {
        const subObj = sub.toObject();

        // Get voucher counts
        const [available, redeemed] = await Promise.all([
          Voucher.countDocuments({
            subscriptionId: sub._id,
            status: { $in: ["AVAILABLE", "RESTORED"] },
          }),
          Voucher.countDocuments({
            subscriptionId: sub._id,
            status: "REDEEMED",
          }),
        ]);

        subObj.vouchersRemaining = available;
        subObj.vouchersUsed = redeemed;
        subObj.daysRemaining =
          sub.status === "ACTIVE"
            ? Math.max(
                0,
                Math.ceil((sub.endDate - new Date()) / (1000 * 60 * 60 * 24))
              )
            : 0;

        return subObj;
      })
    );

    // Find active subscription
    const activeSubscription = subscriptionsWithInfo.find(
      (s) => s.status === "ACTIVE"
    );

    // Total available vouchers across all subscriptions
    const totalVouchersAvailable = await Voucher.countDocuments({
      userId,
      status: { $in: ["AVAILABLE", "RESTORED"] },
    });

    return sendResponse(res, 200, "My subscriptions", {
      subscriptions: subscriptionsWithInfo,
      activeSubscription: activeSubscription || null,
      totalVouchersAvailable,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.log("> Get my subscriptions error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get subscription by ID
 *
 * GET /api/subscriptions/:id
 */
export const getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const subscription = await Subscription.findById(id).populate(
      "planId",
      "name description durationDays badge features"
    );

    if (!subscription) {
      return sendResponse(res, 404, "Subscription not found");
    }

    // Verify ownership (customer can only view their own)
    if (
      req.user.role !== "ADMIN" &&
      subscription.userId.toString() !== userId.toString()
    ) {
      return sendResponse(res, 403, "Access denied");
    }

    // Get voucher stats
    const voucherStats = await Voucher.aggregate([
      { $match: { subscriptionId: subscription._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const vouchers = {
      total: subscription.totalVouchersIssued,
      available: 0,
      redeemed: 0,
      expired: 0,
      restored: 0,
      cancelled: 0,
    };

    for (const stat of voucherStats) {
      vouchers[stat._id.toLowerCase()] = stat.count;
    }
    vouchers.available += vouchers.restored; // Include restored in available count

    return sendResponse(res, 200, "Subscription details", {
      subscription,
      plan: subscription.planId,
      vouchers,
    });
  } catch (error) {
    console.log("> Get subscription by ID error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Cancel subscription (customer-initiated)
 *
 * POST /api/subscriptions/:id/cancel
 */
export const cancelSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return sendResponse(res, 404, "Subscription not found");
    }

    // Verify ownership
    if (subscription.userId.toString() !== userId.toString()) {
      return sendResponse(res, 403, "Access denied");
    }

    // Verify status is ACTIVE
    if (subscription.status !== "ACTIVE") {
      return sendResponse(
        res,
        400,
        `Cannot cancel subscription with status: ${subscription.status}`
      );
    }

    // Calculate refund eligibility
    const refundResult = await calculateRefundEligibility(subscription);

    // Update subscription
    subscription.status = "CANCELLED";
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = reason;
    await subscription.save();

    // Cancel unused vouchers
    const cancelledVouchers = await cancelUnusedVouchers(subscription._id);

    console.log(
      `> Subscription cancelled: ${subscription._id} by user ${req.user.phone}`
    );

    return sendResponse(res, 200, "Subscription cancelled", {
      subscription,
      vouchersCancelled: cancelledVouchers.cancelled,
      refundEligible: refundResult.eligible,
      refundAmount: refundResult.eligible ? refundResult.amount : null,
      refundReason: refundResult.reason,
    });
  } catch (error) {
    console.log("> Cancel subscription error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

// ============================================================================
// ADMIN - SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * Get all subscriptions (admin view)
 *
 * GET /api/subscriptions/admin/all
 */
export const getAllSubscriptions = async (req, res) => {
  try {
    const {
      userId,
      planId,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};
    if (userId) query.userId = userId;
    if (planId) query.planId = planId;
    if (status) query.status = status;
    if (dateFrom || dateTo) {
      query.purchaseDate = {};
      if (dateFrom) query.purchaseDate.$gte = new Date(dateFrom);
      if (dateTo) query.purchaseDate.$lte = new Date(dateTo);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [subscriptions, total] = await Promise.all([
      Subscription.find(query)
        .populate("userId", "name phone email")
        .populate("planId", "name durationDays price")
        .sort({ purchaseDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Subscription.countDocuments(query),
    ]);

    return sendResponse(res, 200, "All subscriptions", {
      subscriptions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.log("> Get all subscriptions error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Admin-initiated subscription cancellation
 *
 * POST /api/subscriptions/:id/admin-cancel
 */
export const adminCancelSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, issueRefund, refundAmount } = req.body;

    const subscription = await Subscription.findById(id).populate(
      "userId",
      "name phone"
    );

    if (!subscription) {
      return sendResponse(res, 404, "Subscription not found");
    }

    if (subscription.status !== "ACTIVE") {
      return sendResponse(
        res,
        400,
        `Cannot cancel subscription with status: ${subscription.status}`
      );
    }

    // Update subscription
    subscription.status = "CANCELLED";
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = `Admin: ${reason}`;
    subscription.cancelledBy = req.user._id;
    await subscription.save();

    // Cancel unused vouchers
    const cancelledVouchers = await cancelUnusedVouchers(subscription._id);

    // Log audit entry
    safeAuditLog(req, {
      action: "UPDATE",
      entityType: "SUBSCRIPTION",
      entityId: subscription._id,
      oldValue: { status: "ACTIVE" },
      newValue: { status: "CANCELLED", reason },
      description: `Admin cancelled subscription for user ${subscription.userId.phone}`,
    });

    console.log(`> Subscription admin-cancelled: ${subscription._id}`);

    return sendResponse(res, 200, "Subscription cancelled by admin", {
      subscription,
      vouchersCancelled: cancelledVouchers.cancelled,
      refundIssued: issueRefund || false,
      refundAmount: issueRefund ? refundAmount || subscription.amountPaid : 0,
    });
  } catch (error) {
    console.log("> Admin cancel subscription error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

export default {
  // Plan management
  createPlan,
  getPlans,
  getPlanById,
  updatePlan,
  activatePlan,
  deactivatePlan,
  archivePlan,
  getActivePlans,
  // Subscription operations
  purchaseSubscription,
  getMySubscriptions,
  getSubscriptionById,
  cancelSubscription,
  getAllSubscriptions,
  adminCancelSubscription,
};
