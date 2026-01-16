import Voucher from "../../schema/voucher.schema.js";
import Subscription from "../../schema/subscription.schema.js";
import Kitchen from "../../schema/kitchen.schema.js";
import { sendResponse } from "../../utils/response.utils.js";
import { safeAuditLog } from "../../utils/audit.utils.js";
import {
  redeemVouchersWithTransaction,
  restoreVouchersForOrder,
} from "../../services/voucher.service.js";

/**
 * Voucher Controller
 * Handles voucher redemption, restoration, and management
 */

// Default cutoff times (HH:mm format in IST)
const DEFAULT_CUTOFF_TIMES = {
  LUNCH: "11:00",
  DINNER: "21:00",
};

// In-memory config (would be in DB in production)
let CUTOFF_CONFIG = { ...DEFAULT_CUTOFF_TIMES };

/**
 * Helper: Check if current time is past cutoff for meal window
 * @param {String} mealWindow - LUNCH or DINNER
 * @returns {Object} { isPastCutoff, cutoffTime, message }
 */
const checkCutoff = (mealWindow) => {
  const now = new Date();
  const cutoffTime =
    CUTOFF_CONFIG[mealWindow] || DEFAULT_CUTOFF_TIMES[mealWindow];
  const [cutoffHour, cutoffMin] = cutoffTime.split(":").map(Number);

  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffHour, cutoffMin, 0, 0);

  const isPastCutoff = now >= cutoffDate;

  return {
    isPastCutoff,
    cutoffTime,
    currentTime: now.toTimeString().slice(0, 5),
    message: isPastCutoff
      ? `${mealWindow} ordering closed. Cutoff was ${cutoffTime}.`
      : `${mealWindow} orders open until ${cutoffTime}`,
  };
};

/**
 * Helper: Get available vouchers for user (FIFO by expiry)
 * @param {ObjectId} userId - User ID
 * @param {Number} count - Optional limit
 * @returns {Promise<Array>} Vouchers
 */
const getAvailableVouchers = async (userId, count = null) => {
  const query = {
    userId,
    status: { $in: ["AVAILABLE", "RESTORED"] },
    expiryDate: { $gt: new Date() },
  };

  let vouchers = Voucher.find(query).sort({ expiryDate: 1 });

  if (count) {
    vouchers = vouchers.limit(count);
  }

  return vouchers;
};

/**
 * Helper: Calculate voucher balance
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Object>} Balance counts
 */
const calculateVoucherBalance = async (userId) => {
  const stats = await Voucher.aggregate([
    { $match: { userId } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const balance = {
    total: 0,
    available: 0,
    redeemed: 0,
    expired: 0,
    restored: 0,
    cancelled: 0,
  };

  for (const stat of stats) {
    balance[stat._id.toLowerCase()] = stat.count;
    balance.total += stat.count;
  }

  // Count restored as available for practical purposes
  balance.available += balance.restored;

  return balance;
};

// 
// CUSTOMER FUNCTIONS
// 

/**
 * Get voucher balance
 *
 * GET /api/vouchers/balance
 */
export const getVoucherBalance = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get balance
    const balance = await calculateVoucherBalance(userId);

    // Get soonest expiring vouchers
    const expiringVouchers = await Voucher.find({
      userId,
      status: { $in: ["AVAILABLE", "RESTORED"] },
      expiryDate: { $gt: new Date() },
    })
      .sort({ expiryDate: 1 })
      .limit(5);

    let expiringNext = null;
    if (expiringVouchers.length > 0) {
      const soonest = expiringVouchers[0];
      const daysRemaining = Math.ceil(
        (soonest.expiryDate - new Date()) / (1000 * 60 * 60 * 24)
      );
      expiringNext = {
        count: expiringVouchers.length,
        date: soonest.expiryDate,
        daysRemaining,
      };
    }

    // Check cutoff times
    const lunchCutoff = checkCutoff("LUNCH");
    const dinnerCutoff = checkCutoff("DINNER");

    // Determine next available window
    let nextCutoff;
    if (!lunchCutoff.isPastCutoff) {
      nextCutoff = { mealWindow: "LUNCH", ...lunchCutoff };
    } else if (!dinnerCutoff.isPastCutoff) {
      nextCutoff = { mealWindow: "DINNER", ...dinnerCutoff };
    } else {
      nextCutoff = {
        mealWindow: "TOMORROW_LUNCH",
        cutoffTime: CUTOFF_CONFIG.LUNCH,
        isPastCutoff: true,
        message: "Ordering opens tomorrow for lunch",
      };
    }

    return sendResponse(res, 200, "Voucher balance", {
      balance,
      expiringNext,
      canRedeemToday: balance.available > 0 && !nextCutoff.isPastCutoff,
      nextCutoff,
    });
  } catch (error) {
    console.log("> Get voucher balance error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get customer's vouchers
 *
 * GET /api/vouchers/my-vouchers
 */
export const getMyVouchers = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, subscriptionId, page = 1, limit = 20 } = req.query;

    const query = { userId };
    if (status) query.status = status;
    if (subscriptionId) query.subscriptionId = subscriptionId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Calculate complete summary from ALL user's vouchers (not just filtered/paginated results)
    // This ensures frontend gets accurate counts regardless of pagination
    const allVouchersSummary = await Voucher.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Transform aggregation results to frontend-friendly format
    const summary = {
      available: 0,
      redeemed: 0,
      expired: 0,
      restored: 0,
      cancelled: 0,
      total: 0,
    };

    for (const stat of allVouchersSummary) {
      const statusKey = stat._id.toLowerCase();
      summary[statusKey] = stat.count;
      summary.total += stat.count;
    }

    // Calculate usable vouchers (available + restored)
    summary.usable = summary.available + summary.restored;

    const [vouchers, total] = await Promise.all([
      Voucher.find(query)
        .populate("subscriptionId", "planSnapshot.name")
        .populate("redeemedKitchenId", "name")
        .sort({ expiryDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Voucher.countDocuments(query),
    ]);

    // Add days until expiry
    const vouchersWithInfo = vouchers.map((v) => {
      const vObj = v.toObject();
      vObj.daysUntilExpiry = Math.max(
        0,
        Math.ceil((v.expiryDate - new Date()) / (1000 * 60 * 60 * 24))
      );
      return vObj;
    });

    return sendResponse(res, 200, "My vouchers", {
      vouchers: vouchersWithInfo,
      summary, // Complete summary of ALL vouchers regardless of pagination/filters
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.log("> Get my vouchers error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get voucher by ID
 *
 * GET /api/vouchers/:id
 */
export const getVoucherById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const voucher = await Voucher.findById(id)
      .populate("subscriptionId", "planSnapshot purchaseDate")
      .populate("redeemedKitchenId", "name")
      .populate("redeemedOrderId", "orderNumber");

    if (!voucher) {
      return sendResponse(res, 404, "Voucher not found");
    }

    // Verify ownership (customer can only view their own)
    if (
      req.user.role !== "ADMIN" &&
      voucher.userId.toString() !== userId.toString()
    ) {
      return sendResponse(res, 403, "Access denied");
    }

    const redemptionDetails =
      voucher.status === "REDEEMED"
        ? {
            order: voucher.redeemedOrderId,
            kitchen: voucher.redeemedKitchenId,
            date: voucher.redeemedAt,
            mealWindow: voucher.redeemedMealWindow,
          }
        : null;

    const restorationDetails =
      voucher.status === "RESTORED"
        ? {
            date: voucher.restoredAt,
            reason: voucher.restorationReason,
          }
        : null;

    return sendResponse(res, 200, "Voucher details", {
      voucher,
      subscription: voucher.subscriptionId,
      redemptionDetails,
      restorationDetails,
    });
  } catch (error) {
    console.log("> Get voucher by ID error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Check voucher eligibility for an order
 *
 * POST /api/vouchers/check-eligibility
 */
export const checkVoucherEligibility = async (req, res) => {
  try {
    const {
      kitchenId,
      menuType,
      mealWindow,
      mainCourseQuantity = 1,
    } = req.body;
    const userId = req.user._id;

    // Vouchers only for MEAL_MENU
    if (menuType !== "MEAL_MENU") {
      return sendResponse(res, 200, "Voucher eligibility", {
        canUseVoucher: false,
        reason: "Vouchers can only be used for Meal Menu orders, not On-Demand",
        availableVouchers: 0,
        maxRedeemable: 0,
      });
    }

    // Verify kitchen exists and is active
    const kitchen = await Kitchen.findById(kitchenId);
    if (!kitchen || kitchen.status !== "ACTIVE") {
      return sendResponse(res, 400, "Kitchen not available");
    }

    // Check cutoff time
    const cutoffInfo = checkCutoff(mealWindow);

    if (cutoffInfo.isPastCutoff) {
      return sendResponse(res, 200, "Voucher eligibility", {
        canUseVoucher: false,
        reason: cutoffInfo.message,
        availableVouchers: 0,
        maxRedeemable: 0,
        cutoffInfo,
      });
    }

    // Count available vouchers
    const availableVouchers = await Voucher.countDocuments({
      userId,
      status: { $in: ["AVAILABLE", "RESTORED"] },
      expiryDate: { $gt: new Date() },
    });

    const maxRedeemable = Math.min(availableVouchers, mainCourseQuantity);

    return sendResponse(res, 200, "Voucher eligibility", {
      canUseVoucher: availableVouchers > 0,
      availableVouchers,
      maxRedeemable,
      cutoffInfo,
      reason: availableVouchers === 0 ? "No vouchers available" : null,
    });
  } catch (error) {
    console.log("> Check voucher eligibility error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Redeem vouchers (internal API for order service)
 * Uses voucher service for atomic transaction with subscription sync
 *
 * POST /api/vouchers/redeem
 * @body {ObjectId} userId - User ID
 * @body {ObjectId} orderId - Order ID
 * @body {ObjectId} kitchenId - Kitchen ID
 * @body {string} mealWindow - LUNCH or DINNER
 * @body {number} voucherCount - Number of vouchers to redeem
 * @returns {Object} { redeemedVouchers: ObjectId[], count: number }
 */
export const redeemVouchers = async (req, res) => {
  try {
    const { userId, orderId, kitchenId, mealWindow, voucherCount } = req.body;

    // Use service function for atomic redemption with subscription sync
    const result = await redeemVouchersWithTransaction(
      userId,
      voucherCount,
      mealWindow,
      orderId,
      kitchenId
    );

    if (!result.success) {
      return sendResponse(res, 400, false, result.error);
    }

    return sendResponse(res, 200, true, "Vouchers redeemed", {
      redeemedVouchers: result.vouchers,
      count: result.vouchers.length,
    });
  } catch (error) {
    console.log("> Redeem vouchers error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};

/**
 * Restore vouchers after order cancellation (internal API)
 * Uses voucher service for atomic transaction with subscription sync
 *
 * POST /api/vouchers/restore
 * @body {ObjectId} orderId - Order ID to restore vouchers for
 * @body {string} reason - Reason for restoration
 * @returns {Object} { restoredVouchers: ObjectId[], count: number }
 */
export const restoreVouchers = async (req, res) => {
  try {
    const { orderId, reason } = req.body;

    // Find voucher IDs for this order
    const vouchers = await Voucher.find({
      redeemedOrderId: orderId,
      status: "REDEEMED",
    }).select("_id");

    if (vouchers.length === 0) {
      return sendResponse(res, 200, true, "No vouchers to restore", {
        restoredVouchers: [],
        count: 0,
      });
    }

    const voucherIds = vouchers.map((v) => v._id);

    // Use service function for atomic restoration with subscription sync
    const result = await restoreVouchersForOrder(voucherIds, reason);

    if (!result.success) {
      return sendResponse(res, 500, false, result.error);
    }

    return sendResponse(res, 200, true, "Vouchers restored", {
      restoredVouchers: voucherIds,
      count: result.count,
    });
  } catch (error) {
    console.log("> Restore vouchers error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};

// 
// ADMIN FUNCTIONS
// 

/**
 * Get all vouchers (admin view)
 *
 * GET /api/vouchers/admin/all
 */
export const getAllVouchers = async (req, res) => {
  try {
    const {
      userId,
      subscriptionId,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 50,
    } = req.query;

    const query = {};
    if (userId) query.userId = userId;
    if (subscriptionId) query.subscriptionId = subscriptionId;
    if (status) query.status = status;
    if (dateFrom || dateTo) {
      query.issuedDate = {};
      if (dateFrom) query.issuedDate.$gte = new Date(dateFrom);
      if (dateTo) query.issuedDate.$lte = new Date(dateTo);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [vouchers, total] = await Promise.all([
      Voucher.find(query)
        .populate("userId", "name phone")
        .populate("subscriptionId", "planSnapshot.name")
        .populate("redeemedKitchenId", "name")
        .sort({ issuedDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Voucher.countDocuments(query),
    ]);

    return sendResponse(res, 200, "All vouchers", {
      vouchers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.log("> Get all vouchers error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get voucher statistics
 *
 * GET /api/vouchers/admin/stats
 */
export const getVoucherStats = async (req, res) => {
  try {
    // Aggregate stats
    const stats = await Voucher.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      totalIssued: 0,
      totalRedeemed: 0,
      totalExpired: 0,
      totalAvailable: 0,
      totalRestored: 0,
      totalCancelled: 0,
    };

    for (const stat of stats) {
      const key = `total${
        stat._id.charAt(0) + stat._id.slice(1).toLowerCase()
      }`;
      result[key] = stat.count;
      result.totalIssued += stat.count;
    }

    // Calculate rates
    result.redemptionRate =
      result.totalIssued > 0
        ? ((result.totalRedeemed / result.totalIssued) * 100).toFixed(1)
        : 0;
    result.expiryRate =
      result.totalIssued > 0
        ? ((result.totalExpired / result.totalIssued) * 100).toFixed(1)
        : 0;

    // Stats by meal window
    const byMealWindow = await Voucher.aggregate([
      { $match: { status: "REDEEMED" } },
      {
        $group: {
          _id: "$redeemedMealWindow",
          count: { $sum: 1 },
        },
      },
    ]);

    result.byMealWindow = {
      lunch: { redeemed: 0 },
      dinner: { redeemed: 0 },
    };

    for (const stat of byMealWindow) {
      if (stat._id === "LUNCH") {
        result.byMealWindow.lunch.redeemed = stat.count;
      } else if (stat._id === "DINNER") {
        result.byMealWindow.dinner.redeemed = stat.count;
      }
    }

    return sendResponse(res, 200, "Voucher statistics", result);
  } catch (error) {
    console.log("> Get voucher stats error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Expire vouchers (cron job)
 *
 * POST /api/vouchers/admin/expire
 */
export const expireVouchers = async (req, res) => {
  try {
    const now = new Date();

    const result = await Voucher.updateMany(
      {
        status: { $in: ["AVAILABLE", "RESTORED"] },
        expiryDate: { $lt: now },
      },
      { $set: { status: "EXPIRED" } }
    );

    console.log(`> Expired ${result.modifiedCount} vouchers`);

    return sendResponse(res, 200, "Vouchers expired", {
      expiredCount: result.modifiedCount,
    });
  } catch (error) {
    console.log("> Expire vouchers error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Admin-initiated voucher restoration
 * Uses forceRestore=true to restore even expired vouchers
 *
 * POST /api/vouchers/admin/restore
 * @body {ObjectId[]} voucherIds - Specific voucher IDs to restore (optional)
 * @body {ObjectId} orderId - Order ID to restore vouchers for (optional, alternative to voucherIds)
 * @body {string} reason - Reason for restoration
 * @returns {Object} { restoredVouchers: ObjectId[], count: number }
 */
export const adminRestoreVouchers = async (req, res) => {
  try {
    const { voucherIds, orderId, reason } = req.body;

    let targetVoucherIds;

    // Determine which vouchers to restore
    if (voucherIds && voucherIds.length > 0) {
      const vouchers = await Voucher.find({
        _id: { $in: voucherIds },
        status: "REDEEMED",
      }).select("_id");
      targetVoucherIds = vouchers.map((v) => v._id);
    } else if (orderId) {
      const vouchers = await Voucher.find({
        redeemedOrderId: orderId,
        status: "REDEEMED",
      }).select("_id");
      targetVoucherIds = vouchers.map((v) => v._id);
    }

    if (!targetVoucherIds || targetVoucherIds.length === 0) {
      return sendResponse(res, 404, false, "No redeemed vouchers found");
    }

    // Use service function with forceRestore=true (admin can restore expired vouchers)
    const result = await restoreVouchersForOrder(
      targetVoucherIds,
      `Admin: ${reason}`,
      true // forceRestore
    );

    if (!result.success) {
      return sendResponse(res, 500, false, result.error);
    }

    // Log audit entry
    safeAuditLog(req, {
      action: "UPDATE",
      entityType: "VOUCHER",
      entityId: targetVoucherIds[0],
      newValue: { status: "RESTORED", count: result.count },
      description: `Admin restored ${result.count} vouchers. Reason: ${reason}`,
    });

    return sendResponse(res, 200, true, "Vouchers restored by admin", {
      restoredVouchers: targetVoucherIds,
      count: result.count,
    });
  } catch (error) {
    console.log("> Admin restore vouchers error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};

// 
// CUTOFF TIME FUNCTIONS
// 

/**
 * Get cutoff times
 *
 * GET /api/vouchers/cutoff-times
 */
export const getCutoffTimes = async (req, res) => {
  try {
    const now = new Date();
    const lunchCutoff = checkCutoff("LUNCH");
    const dinnerCutoff = checkCutoff("DINNER");

    // Determine next available window
    let nextAvailableWindow;
    if (!lunchCutoff.isPastCutoff) {
      nextAvailableWindow = "LUNCH";
    } else if (!dinnerCutoff.isPastCutoff) {
      nextAvailableWindow = "DINNER";
    } else {
      nextAvailableWindow = "TOMORROW_LUNCH";
    }

    return sendResponse(res, 200, "Cutoff times", {
      lunch: {
        cutoffTime: CUTOFF_CONFIG.LUNCH,
        currentlyOpen: !lunchCutoff.isPastCutoff,
        closesAt: CUTOFF_CONFIG.LUNCH,
        timezone: "IST",
      },
      dinner: {
        cutoffTime: CUTOFF_CONFIG.DINNER,
        currentlyOpen: !dinnerCutoff.isPastCutoff,
        closesAt: CUTOFF_CONFIG.DINNER,
        timezone: "IST",
      },
      nextAvailableWindow,
      currentTime: now.toTimeString().slice(0, 5),
    });
  } catch (error) {
    console.log("> Get cutoff times error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Update cutoff times (admin)
 *
 * PUT /api/vouchers/cutoff-times
 */
export const updateCutoffTimes = async (req, res) => {
  try {
    const { lunch, dinner } = req.body;

    const oldConfig = { ...CUTOFF_CONFIG };

    if (lunch?.cutoffTime) {
      CUTOFF_CONFIG.LUNCH = lunch.cutoffTime;
    }
    if (dinner?.cutoffTime) {
      CUTOFF_CONFIG.DINNER = dinner.cutoffTime;
    }

    // Log audit entry
    safeAuditLog(req, {
      action: "UPDATE",
      entityType: "SYSTEM_CONFIG",
      entityId: null,
      oldValue: oldConfig,
      newValue: CUTOFF_CONFIG,
      description: "Updated cutoff times configuration",
    });

    console.log(`> Cutoff times updated: ${JSON.stringify(CUTOFF_CONFIG)}`);

    return sendResponse(res, 200, "Cutoff times updated", {
      lunch: CUTOFF_CONFIG.LUNCH,
      dinner: CUTOFF_CONFIG.DINNER,
    });
  } catch (error) {
    console.log("> Update cutoff times error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

export default {
  // Customer functions
  getVoucherBalance,
  getMyVouchers,
  getVoucherById,
  checkVoucherEligibility,
  // Internal functions
  redeemVouchers,
  restoreVouchers,
  // Admin functions
  getAllVouchers,
  getVoucherStats,
  expireVouchers,
  adminRestoreVouchers,
  // Cutoff functions
  getCutoffTimes,
  updateCutoffTimes,
};
