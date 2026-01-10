import mongoose from "mongoose";
import Voucher from "../schema/voucher.schema.js";
import Subscription from "../schema/subscription.schema.js";
import { checkCutoffTime } from "./config.service.js";

/**
 * Voucher Service
 * Handles voucher redemption and restoration with MongoDB transactions
 * Ensures atomic operations to prevent race conditions
 *
 * IMPORTANT: This service maintains sync between:
 * - Individual Voucher documents (status: AVAILABLE -> REDEEMED -> RESTORED)
 * - Subscription.vouchersUsed counter (incremented on redeem, decremented on restore)
 */

/**
 * Helper: Group vouchers by subscriptionId and count
 * @param {Array} vouchers - Array of voucher documents
 * @returns {Map<string, number>} Map of subscriptionId -> count
 */
function groupVouchersBySubscription(vouchers) {
  const subscriptionCounts = new Map();
  for (const voucher of vouchers) {
    const subId = voucher.subscriptionId.toString();
    subscriptionCounts.set(subId, (subscriptionCounts.get(subId) || 0) + 1);
  }
  return subscriptionCounts;
}

/**
 * Redeem vouchers for an order using MongoDB transactions
 * Uses FIFO order by expiry date to ensure soonest-expiring vouchers are used first
 *
 * @param {ObjectId} userId - User ID
 * @param {number} count - Number of vouchers to redeem
 * @param {string} mealWindow - LUNCH or DINNER
 * @param {ObjectId} orderId - Order ID for tracking
 * @param {ObjectId} kitchenId - Kitchen ID for tracking
 * @returns {Promise<{success: boolean, vouchers: Array, error: string|null}>}
 */
export async function redeemVouchersWithTransaction(userId, count, mealWindow, orderId, kitchenId) {
  if (count === 0) {
    return { success: true, vouchers: [], error: null };
  }

  // Check cutoff time before attempting redemption
  const cutoffInfo = checkCutoffTime(mealWindow);
  if (cutoffInfo.isPastCutoff) {
    return {
      success: false,
      vouchers: [],
      error: cutoffInfo.message,
    };
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const now = new Date();
    const redeemedVoucherIds = [];

    // Find available vouchers matching criteria (FIFO by expiry)
    const availableVouchers = await Voucher.find({
      userId,
      status: { $in: ["AVAILABLE", "RESTORED"] },
      expiryDate: { $gt: now },
      $or: [{ mealType: "ANY" }, { mealType: mealWindow }],
    })
      .sort({ expiryDate: 1 })
      .limit(count)
      .session(session);

    if (availableVouchers.length < count) {
      await session.abortTransaction();
      return {
        success: false,
        vouchers: [],
        error: `Only ${availableVouchers.length} vouchers available, ${count} requested`,
      };
    }

    // Get IDs for atomic update
    const voucherIds = availableVouchers.map((v) => v._id);

    // Atomically update all vouchers to REDEEMED status
    // Using updateMany with session ensures all-or-nothing operation
    const updateResult = await Voucher.updateMany(
      {
        _id: { $in: voucherIds },
        status: { $in: ["AVAILABLE", "RESTORED"] }, // Re-check status in case of concurrent modification
      },
      {
        $set: {
          status: "REDEEMED",
          redeemedAt: now,
          redeemedOrderId: orderId,
          redeemedKitchenId: kitchenId,
          redeemedMealWindow: mealWindow,
        },
      },
      { session }
    );

    // Verify all vouchers were updated (handles race condition)
    if (updateResult.modifiedCount !== count) {
      await session.abortTransaction();
      return {
        success: false,
        vouchers: [],
        error: `Voucher state changed during redemption. Only ${updateResult.modifiedCount} of ${count} vouchers were available.`,
      };
    }

    // Update subscription vouchersUsed counters (grouped by subscription)
    const subscriptionCounts = groupVouchersBySubscription(availableVouchers);
    for (const [subscriptionId, voucherCount] of subscriptionCounts) {
      await Subscription.updateOne(
        { _id: subscriptionId },
        { $inc: { vouchersUsed: voucherCount } },
        { session }
      );
    }

    await session.commitTransaction();

    console.log(`> VoucherService: Redeemed ${count} vouchers for order ${orderId}, updated ${subscriptionCounts.size} subscription(s)`);

    return {
      success: true,
      vouchers: voucherIds,
      error: null,
    };
  } catch (error) {
    await session.abortTransaction();
    console.log(`> VoucherService: Redemption failed - ${error.message}`);
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Restore vouchers for a cancelled/rejected order
 * Also decrements Subscription.vouchersUsed counter to maintain sync
 *
 * @param {Array<ObjectId>} voucherIds - Voucher IDs to restore
 * @param {string} reason - Restoration reason
 * @param {boolean} forceRestore - Force restore regardless of expiry (admin use)
 * @returns {Promise<{success: boolean, count: number, error: string|null}>}
 */
export async function restoreVouchersForOrder(voucherIds, reason, forceRestore = false) {
  if (!voucherIds || voucherIds.length === 0) {
    return { success: true, count: 0, error: null };
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Map reason string to valid enum value
    let restorationReason = "OTHER";
    if (reason.toLowerCase().includes("cancelled")) {
      restorationReason = "ORDER_CANCELLED";
    } else if (reason.toLowerCase().includes("rejected")) {
      restorationReason = "ORDER_REJECTED";
    } else if (reason.toLowerCase().includes("admin")) {
      restorationReason = "ADMIN_ACTION";
    }

    const now = new Date();

    // Build query - only restore vouchers that aren't expired (unless forced)
    const query = {
      _id: { $in: voucherIds },
      status: "REDEEMED",
    };

    if (!forceRestore) {
      query.expiryDate = { $gt: now };
    }

    // First, find vouchers to get their subscriptionIds before updating
    const vouchersToRestore = await Voucher.find(query)
      .select("_id subscriptionId")
      .session(session);

    if (vouchersToRestore.length === 0) {
      await session.commitTransaction();
      return { success: true, count: 0, error: null };
    }

    // Update voucher status to RESTORED
    const voucherIdsToUpdate = vouchersToRestore.map((v) => v._id);
    await Voucher.updateMany(
      { _id: { $in: voucherIdsToUpdate } },
      {
        $set: {
          status: "RESTORED",
          restoredAt: now,
          restorationReason,
        },
        $unset: {
          redeemedAt: 1,
          redeemedOrderId: 1,
          redeemedKitchenId: 1,
          redeemedMealWindow: 1,
        },
      },
      { session }
    );

    // Decrement subscription vouchersUsed counters (grouped by subscription)
    const subscriptionCounts = groupVouchersBySubscription(vouchersToRestore);
    for (const [subscriptionId, voucherCount] of subscriptionCounts) {
      await Subscription.updateOne(
        { _id: subscriptionId },
        { $inc: { vouchersUsed: -voucherCount } },
        { session }
      );
    }

    await session.commitTransaction();

    console.log(`> VoucherService: Restored ${vouchersToRestore.length} vouchers, updated ${subscriptionCounts.size} subscription(s) - ${reason}`);

    return {
      success: true,
      count: vouchersToRestore.length,
      error: null,
    };
  } catch (error) {
    await session.abortTransaction();
    console.log(`> VoucherService: Restoration failed - ${error.message}`);
    return {
      success: false,
      count: 0,
      error: error.message,
    };
  } finally {
    session.endSession();
  }
}

/**
 * Get available voucher count for a user and meal window
 *
 * @param {ObjectId} userId - User ID
 * @param {string} mealWindow - LUNCH, DINNER, or null for any
 * @returns {Promise<number>} Available voucher count
 */
export async function getAvailableVoucherCount(userId, mealWindow = null) {
  const query = {
    userId,
    status: { $in: ["AVAILABLE", "RESTORED"] },
    expiryDate: { $gt: new Date() },
  };

  if (mealWindow) {
    query.$or = [{ mealType: "ANY" }, { mealType: mealWindow }];
  }

  return Voucher.countDocuments(query);
}

/**
 * Check if user has enough vouchers for an order
 *
 * @param {ObjectId} userId - User ID
 * @param {number} count - Required voucher count
 * @param {string} mealWindow - LUNCH or DINNER
 * @returns {Promise<{hasEnough: boolean, available: number, requested: number}>}
 */
export async function checkVoucherAvailability(userId, count, mealWindow) {
  const available = await getAvailableVoucherCount(userId, mealWindow);
  return {
    hasEnough: available >= count,
    available,
    requested: count,
  };
}

/**
 * Get voucher balance summary for a user
 *
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Object>} Balance summary
 */
export async function getVoucherBalanceSummary(userId) {
  const [statusCounts, expiringVouchers] = await Promise.all([
    Voucher.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Voucher.find({
      userId,
      status: { $in: ["AVAILABLE", "RESTORED"] },
      expiryDate: { $gt: new Date() },
    })
      .sort({ expiryDate: 1 })
      .limit(5),
  ]);

  const balance = {
    total: 0,
    available: 0,
    redeemed: 0,
    expired: 0,
    restored: 0,
    cancelled: 0,
  };

  for (const stat of statusCounts) {
    const key = stat._id.toLowerCase();
    balance[key] = stat.count;
    balance.total += stat.count;
  }

  // Combine restored with available for practical count
  balance.usable = balance.available + balance.restored;

  // Calculate expiring soon
  let expiringNext = null;
  if (expiringVouchers.length > 0) {
    const soonest = expiringVouchers[0];
    const daysRemaining = Math.ceil(
      (soonest.expiryDate - new Date()) / (1000 * 60 * 60 * 24)
    );
    expiringNext = {
      count: expiringVouchers.length,
      soonestExpiry: soonest.expiryDate,
      daysRemaining,
    };
  }

  return { balance, expiringNext };
}

export default {
  redeemVouchersWithTransaction,
  restoreVouchersForOrder,
  getAvailableVoucherCount,
  checkVoucherAvailability,
  getVoucherBalanceSummary,
};
