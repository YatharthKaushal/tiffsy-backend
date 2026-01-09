import Refund from "../../schema/refund.schema.js";
import Order from "../../schema/order.schema.js";
import Voucher from "../../schema/voucher.schema.js";
import AuditLog from "../../schema/auditLog.schema.js";
import { sendResponse } from "../utils/response.utils.js";

/**
 * ============================================================================
 * CONFIGURATION
 * ============================================================================
 */

const MAX_RETRIES = 3;
const EXPECTED_COMPLETION_DAYS = 7;

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Generate unique refund number
 * @returns {string} Refund number
 */
function generateRefundNumber() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `REF-${dateStr}-${random}`;
}

/**
 * Call payment gateway refund API (mock implementation)
 * @param {string} originalPaymentId - Original payment ID
 * @param {number} amount - Refund amount
 * @returns {Promise<{success: boolean, gatewayRefundId: string|null, error: string|null}>}
 */
async function callPaymentGatewayRefund(originalPaymentId, amount) {
  // Mock implementation - in production, integrate with RazorPay/Stripe
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Simulate 95% success rate
  const isSuccess = Math.random() > 0.05;

  if (isSuccess) {
    const gatewayRefundId = `rfnd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return { success: true, gatewayRefundId, error: null };
  }

  return { success: false, gatewayRefundId: null, error: "Gateway error: Transaction failed" };
}

/**
 * Calculate refundable amount for an order
 * @param {string} orderId - Order ID
 * @returns {Promise<number>} Refundable amount
 */
async function calculateRefundableAmount(orderId) {
  const order = await Order.findById(orderId);
  if (!order) return 0;

  // Sum of existing completed refunds
  const existingRefunds = await Refund.aggregate([
    {
      $match: {
        orderId: order._id,
        status: "COMPLETED",
      },
    },
    {
      $group: {
        _id: null,
        totalRefunded: { $sum: "$amount" },
      },
    },
  ]);

  const totalRefunded = existingRefunds[0]?.totalRefunded || 0;
  return Math.max(0, order.amountPaid - totalRefunded);
}

/**
 * Restore vouchers used in an order
 * @param {string} orderId - Order ID
 * @param {string} reason - Restoration reason
 * @returns {Promise<{restored: number, voucherIds: Array}>}
 */
async function restoreOrderVouchers(orderId, reason) {
  const order = await Order.findById(orderId);
  if (!order || !order.voucherUsage?.voucherIds?.length) {
    return { restored: 0, voucherIds: [] };
  }

  const voucherIds = order.voucherUsage.voucherIds;

  // Map reason string to valid enum value
  let restorationReason = "OTHER";
  if (reason.includes("cancelled") || reason.includes("CANCELLED")) {
    restorationReason = "ORDER_CANCELLED";
  } else if (reason.includes("rejected") || reason.includes("REJECTED")) {
    restorationReason = "ORDER_REJECTED";
  } else if (reason.includes("admin") || reason.includes("ADMIN")) {
    restorationReason = "ADMIN_ACTION";
  }

  const result = await Voucher.updateMany(
    { _id: { $in: voucherIds }, status: "REDEEMED" },
    {
      $set: {
        status: "RESTORED",
        restoredAt: new Date(),
        restorationReason,
        // Clear redemption details
        redeemedAt: null,
        redeemedOrderId: null,
        redeemedKitchenId: null,
        redeemedMealWindow: null
      }
    }
  );

  return { restored: result.modifiedCount, voucherIds };
}

/**
 * Get human-readable status display
 * @param {string} status - Refund status
 * @returns {string}
 */
function getStatusDisplay(status) {
  const displays = {
    INITIATED: "Refund Initiated",
    PENDING: "Pending Approval",
    PROCESSING: "Processing",
    COMPLETED: "Refund Completed",
    FAILED: "Refund Failed",
    CANCELLED: "Refund Cancelled",
  };
  return displays[status] || status;
}

/**
 * Calculate estimated completion date
 * @param {Date} initiatedAt - Refund initiated date
 * @returns {Date}
 */
function getEstimatedCompletion(initiatedAt) {
  const estimated = new Date(initiatedAt);
  estimated.setDate(estimated.getDate() + EXPECTED_COMPLETION_DAYS);
  return estimated;
}

/**
 * ============================================================================
 * AUTOMATIC REFUND FUNCTIONS
 * ============================================================================
 */

/**
 * Initiate refund for an order
 * @route POST /api/refunds/initiate
 * @access Internal
 */
export async function initiateRefund(req, res) {
  try {
    const { orderId, reason, reasonDetails, refundType = "FULL", amount } = req.body;

    // Fetch order
    const order = await Order.findById(orderId);
    if (!order) {
      return sendResponse(res, 400, false, "Order not found");
    }

    // Atomically check for existing refund and create a placeholder
    // This prevents race conditions where two requests both pass the check
    const existingOrCreated = await Refund.findOneAndUpdate(
      {
        orderId,
        status: { $in: ["INITIATED", "PENDING", "PROCESSING"] },
      },
      {
        $setOnInsert: {
          refundNumber: generateRefundNumber(),
          orderId,
          userId: order.userId,
          amount: 0, // Placeholder, will be updated
          refundType: "FULL",
          reason: reason || "ADMIN_INITIATED",
          status: "INITIATED",
          originalPaymentId: order.paymentId || "N/A",
          initiatedAt: new Date(),
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        rawResult: true
      }
    );

    // If it was an existing document (not newly inserted), return conflict
    if (!existingOrCreated.lastErrorObject?.upserted) {
      return sendResponse(res, 409, false, "Refund already in progress for this order");
    }

    // Get the newly created refund document to continue processing
    const refund = await Refund.findById(existingOrCreated.value._id);

    // Determine refund amount
    let refundAmount;
    if (refundType === "PARTIAL") {
      refundAmount = amount;
    } else {
      refundAmount = order.amountPaid;
    }

    // Verify refundable amount
    const refundable = await calculateRefundableAmount(orderId);
    if (refundAmount > refundable) {
      // Delete the placeholder refund we created
      await Refund.findByIdAndDelete(refund._id);
      return sendResponse(res, 400, false, `Maximum refundable amount is ${refundable}`);
    }

    // Handle voucher-only orders
    let vouchersRestored = null;
    if (order.amountPaid === 0 && order.voucherUsage?.voucherIds?.length > 0) {
      // Delete the placeholder refund we created (no monetary refund needed)
      await Refund.findByIdAndDelete(refund._id);

      const voucherResult = await restoreOrderVouchers(orderId, reason);
      vouchersRestored = voucherResult.restored;

      return sendResponse(res, 200, true, "Vouchers restored (no monetary refund)", {
        refund: null,
        vouchersRestored,
      });
    }

    // Update the placeholder refund with actual values
    refund.amount = refundAmount;
    refund.refundType = refundType;
    refund.reason = reason;
    refund.reasonDetails = reasonDetails;
    refund.originalPaymentId = order.paymentId || "N/A";

    await refund.save();

    // Restore vouchers if order used them
    if (order.voucherUsage?.voucherIds?.length > 0) {
      const voucherResult = await restoreOrderVouchers(orderId, reason);
      vouchersRestored = voucherResult.restored;
      refund.vouchersRestored = true;
      refund.restoredVoucherIds = voucherResult.voucherIds;
      await refund.save();
    }

    return sendResponse(res, 200, true, "Refund initiated", {
      refund,
      vouchersRestored,
    });
  } catch (error) {
    console.error("Initiate refund error:", error);
    return sendResponse(res, 500, false, "Failed to initiate refund");
  }
}

/**
 * Process refund via payment gateway
 * @route POST /api/refunds/:id/process
 * @access System/Admin
 */
export async function processRefund(req, res) {
  try {
    const { id } = req.params;

    const refund = await Refund.findById(id);
    if (!refund) {
      return sendResponse(res, 404, false, "Refund not found");
    }

    if (!["INITIATED", "PENDING", "FAILED"].includes(refund.status)) {
      return sendResponse(res, 400, false, "Refund cannot be processed in current status");
    }

    // Update status to processing
    refund.status = "PROCESSING";
    refund.statusTimeline.push({
      status: "PROCESSING",
      timestamp: new Date(),
      notes: "Processing via payment gateway",
    });
    await refund.save();

    // Call payment gateway
    const gatewayResult = await callPaymentGatewayRefund(refund.originalPaymentId, refund.amount);

    if (gatewayResult.success) {
      refund.status = "COMPLETED";
      refund.refundGatewayId = gatewayResult.gatewayRefundId;
      refund.completedAt = new Date();
      refund.statusTimeline.push({
        status: "COMPLETED",
        timestamp: new Date(),
        notes: `Gateway refund ID: ${gatewayResult.gatewayRefundId}`,
      });

      // Update order payment status
      const order = await Order.findById(refund.orderId);
      if (order) {
        const totalRefunded = await calculateTotalRefunded(refund.orderId);
        if (totalRefunded + refund.amount >= order.amountPaid) {
          order.paymentStatus = "REFUNDED";
        } else {
          order.paymentStatus = "PARTIALLY_REFUNDED";
        }
        await order.save();
      }
    } else {
      refund.status = "FAILED";
      refund.retryCount = (refund.retryCount || 0) + 1;
      refund.failureReason = gatewayResult.error;

      if (refund.retryCount < MAX_RETRIES) {
        // Schedule retry in 1 hour
        refund.nextRetryAt = new Date(Date.now() + 60 * 60 * 1000);
      }

      refund.statusTimeline.push({
        status: "FAILED",
        timestamp: new Date(),
        notes: gatewayResult.error,
      });
    }

    await refund.save();

    return sendResponse(res, 200, true, "Refund processing complete", {
      refund,
      success: gatewayResult.success,
    });
  } catch (error) {
    console.error("Process refund error:", error);
    return sendResponse(res, 500, false, "Failed to process refund");
  }
}

/**
 * Calculate total refunded for an order
 */
async function calculateTotalRefunded(orderId) {
  const result = await Refund.aggregate([
    { $match: { orderId, status: "COMPLETED" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return result[0]?.total || 0;
}

/**
 * Process failed refunds (Cron job)
 * @route POST /api/refunds/process-failed
 * @access System
 */
export async function processFailedRefunds(req, res) {
  try {
    const now = new Date();

    const failedRefunds = await Refund.find({
      status: "FAILED",
      retryCount: { $lt: MAX_RETRIES },
      nextRetryAt: { $lte: now },
    });

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
    };

    for (const refund of failedRefunds) {
      results.processed++;

      // Process refund
      refund.status = "PROCESSING";
      await refund.save();

      const gatewayResult = await callPaymentGatewayRefund(refund.originalPaymentId, refund.amount);

      if (gatewayResult.success) {
        refund.status = "COMPLETED";
        refund.refundGatewayId = gatewayResult.gatewayRefundId;
        refund.completedAt = new Date();
        results.succeeded++;
      } else {
        refund.status = "FAILED";
        refund.retryCount++;
        refund.failureReason = gatewayResult.error;

        if (refund.retryCount < MAX_RETRIES) {
          refund.nextRetryAt = new Date(Date.now() + 60 * 60 * 1000);
        }
        results.failed++;
      }

      await refund.save();
    }

    return sendResponse(res, 200, true, "Failed refunds processed", results);
  } catch (error) {
    console.error("Process failed refunds error:", error);
    return sendResponse(res, 500, false, "Failed to process failed refunds");
  }
}

/**
 * ============================================================================
 * CUSTOMER FUNCTIONS
 * ============================================================================
 */

/**
 * Get customer's refunds
 * @route GET /api/refunds/my-refunds
 * @access Authenticated Customer
 */
export async function getMyRefunds(req, res) {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { userId };
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const [refunds, total] = await Promise.all([
      Refund.find(query)
        .populate("orderId", "orderNumber placedAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Refund.countDocuments(query),
    ]);

    const refundsWithMeta = refunds.map((refund) => ({
      ...refund.toObject(),
      order: refund.orderId,
      statusDisplay: getStatusDisplay(refund.status),
      estimatedCompletion:
        refund.status === "INITIATED" || refund.status === "PROCESSING"
          ? getEstimatedCompletion(refund.initiatedAt)
          : null,
    }));

    return sendResponse(res, 200, true, "Refunds retrieved", {
      refunds: refundsWithMeta,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get my refunds error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve refunds");
  }
}

/**
 * Get refund by ID
 * @route GET /api/refunds/:id
 * @access Authenticated (Customer owner, Admin)
 */
export async function getRefundById(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const refund = await Refund.findById(id).populate("orderId");

    if (!refund) {
      return sendResponse(res, 404, false, "Refund not found");
    }

    // Access control
    const isOwner = refund.userId.toString() === user._id.toString();
    const isAdmin = user.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      return sendResponse(res, 403, false, "Not authorized to view this refund");
    }

    // Get vouchers restored info
    let vouchersRestored = null;
    if (refund.vouchersRestored > 0) {
      const order = await Order.findById(refund.orderId);
      if (order?.voucherUsage?.voucherIds) {
        const vouchers = await Voucher.find({
          _id: { $in: order.voucherUsage.voucherIds },
        }).select("voucherCode status");
        vouchersRestored = vouchers;
      }
    }

    return sendResponse(res, 200, true, "Refund retrieved", {
      refund,
      order: refund.orderId,
      timeline: refund.statusTimeline,
      vouchersRestored,
    });
  } catch (error) {
    console.error("Get refund by ID error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve refund");
  }
}

/**
 * ============================================================================
 * ADMIN FUNCTIONS
 * ============================================================================
 */

/**
 * Get all refunds (Admin view)
 * @route GET /api/refunds/admin/all
 * @access Admin
 */
export async function getAllRefunds(req, res) {
  try {
    const { userId, orderId, status, reason, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

    const query = {};

    if (userId) query.userId = userId;
    if (orderId) query.orderId = orderId;
    if (status) query.status = status;
    if (reason) query.reason = reason;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;

    const [refunds, total] = await Promise.all([
      Refund.find(query)
        .populate("userId", "name phone")
        .populate("orderId", "orderNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Refund.countDocuments(query),
    ]);

    // Get summary
    const summary = await Refund.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const byStatus = {};
    let totalAmount = 0;
    summary.forEach((s) => {
      byStatus[s._id.toLowerCase()] = s.count;
      totalAmount += s.totalAmount;
    });

    return sendResponse(res, 200, true, "All refunds retrieved", {
      refunds,
      summary: {
        total,
        totalAmount,
        byStatus,
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all refunds error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve refunds");
  }
}

/**
 * Admin-initiated manual refund
 * @route POST /api/refunds/admin/manual
 * @access Admin
 */
export async function initiateManualRefund(req, res) {
  try {
    const { orderId, amount, reason, reasonDetails, notes } = req.body;
    const adminId = req.user._id;

    // Verify order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return sendResponse(res, 404, false, "Order not found");
    }

    // Verify refundable amount
    const refundable = await calculateRefundableAmount(orderId);
    if (amount > refundable) {
      return sendResponse(res, 400, false, `Maximum refundable amount is ${refundable}`);
    }

    // Create refund
    const refund = new Refund({
      refundNumber: generateRefundNumber(),
      orderId,
      userId: order.userId,
      amount,
      refundType: amount < order.amountPaid ? "PARTIAL" : "FULL",
      reason,
      reasonDetails,
      status: "INITIATED",
      originalPaymentId: order.paymentId,
      originalPaymentMethod: order.paymentMethod,
      initiatedAt: new Date(),
      initiatedBy: adminId,
      notes,
      statusTimeline: [
        {
          status: "INITIATED",
          timestamp: new Date(),
          notes: `Admin initiated: ${reasonDetails}`,
        },
      ],
    });

    await refund.save();

    // Log audit
    await AuditLog.create({
      action: "INITIATE_REFUND",
      entityType: "REFUND",
      entityId: refund._id,
      performedBy: adminId,
      details: { orderId, amount, reason },
    });

    return sendResponse(res, 201, true, "Manual refund initiated", { refund });
  } catch (error) {
    console.error("Initiate manual refund error:", error);
    return sendResponse(res, 500, false, "Failed to initiate manual refund");
  }
}

/**
 * Approve a pending refund
 * @route PATCH /api/refunds/:id/approve
 * @access Admin
 */
export async function approveRefund(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const refund = await Refund.findById(id);
    if (!refund) {
      return sendResponse(res, 404, false, "Refund not found");
    }

    if (refund.status !== "PENDING") {
      return sendResponse(res, 400, false, "Only pending refunds can be approved");
    }

    refund.approvedBy = adminId;
    refund.approvedAt = new Date();
    refund.status = "INITIATED"; // Will be processed
    refund.statusTimeline.push({
      status: "APPROVED",
      timestamp: new Date(),
      notes: "Approved by admin",
    });

    await refund.save();

    // Log audit
    await AuditLog.create({
      action: "APPROVE_REFUND",
      entityType: "REFUND",
      entityId: refund._id,
      performedBy: adminId,
    });

    // Process the refund
    // In production, this might be queued
    const gatewayResult = await callPaymentGatewayRefund(refund.originalPaymentId, refund.amount);

    if (gatewayResult.success) {
      refund.status = "COMPLETED";
      refund.refundGatewayId = gatewayResult.gatewayRefundId;
      refund.completedAt = new Date();
    } else {
      refund.status = "FAILED";
      refund.failureReason = gatewayResult.error;
    }

    await refund.save();

    return sendResponse(res, 200, true, "Refund approved and processed", { refund });
  } catch (error) {
    console.error("Approve refund error:", error);
    return sendResponse(res, 500, false, "Failed to approve refund");
  }
}

/**
 * Cancel a pending refund
 * @route PATCH /api/refunds/:id/cancel
 * @access Admin
 */
export async function cancelRefund(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    const refund = await Refund.findById(id);
    if (!refund) {
      return sendResponse(res, 404, false, "Refund not found");
    }

    if (refund.status === "COMPLETED") {
      return sendResponse(res, 400, false, "Cannot cancel completed refund");
    }

    refund.status = "CANCELLED";
    refund.cancelledAt = new Date();
    refund.cancellationReason = reason;
    refund.statusTimeline.push({
      status: "CANCELLED",
      timestamp: new Date(),
      notes: reason,
    });

    await refund.save();

    // Log audit
    await AuditLog.create({
      action: "CANCEL_REFUND",
      entityType: "REFUND",
      entityId: refund._id,
      performedBy: adminId,
      details: { reason },
    });

    return sendResponse(res, 200, true, "Refund cancelled", { refund });
  } catch (error) {
    console.error("Cancel refund error:", error);
    return sendResponse(res, 500, false, "Failed to cancel refund");
  }
}

/**
 * Manually retry a failed refund
 * @route POST /api/refunds/:id/retry
 * @access Admin
 */
export async function retryRefund(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const refund = await Refund.findById(id);
    if (!refund) {
      return sendResponse(res, 404, false, "Refund not found");
    }

    if (refund.status !== "FAILED") {
      return sendResponse(res, 400, false, "Can only retry failed refunds");
    }

    // Reset retry count and process
    refund.retryCount = 0;
    refund.status = "PROCESSING";
    refund.statusTimeline.push({
      status: "RETRY",
      timestamp: new Date(),
      notes: "Manual retry by admin",
    });
    await refund.save();

    const gatewayResult = await callPaymentGatewayRefund(refund.originalPaymentId, refund.amount);

    if (gatewayResult.success) {
      refund.status = "COMPLETED";
      refund.refundGatewayId = gatewayResult.gatewayRefundId;
      refund.completedAt = new Date();
    } else {
      refund.status = "FAILED";
      refund.retryCount = 1;
      refund.failureReason = gatewayResult.error;
    }

    await refund.save();

    // Log audit
    await AuditLog.create({
      action: "RETRY_REFUND",
      entityType: "REFUND",
      entityId: refund._id,
      performedBy: adminId,
    });

    return sendResponse(res, 200, true, "Refund retry complete", {
      refund,
      success: gatewayResult.success,
    });
  } catch (error) {
    console.error("Retry refund error:", error);
    return sendResponse(res, 500, false, "Failed to retry refund");
  }
}

/**
 * Get refund statistics
 * @route GET /api/refunds/admin/stats
 * @access Admin
 */
export async function getRefundStats(req, res) {
  try {
    const { dateFrom, dateTo } = req.query;

    const matchQuery = {};
    if (dateFrom || dateTo) {
      matchQuery.createdAt = {};
      if (dateFrom) matchQuery.createdAt.$gte = new Date(dateFrom);
      if (dateTo) matchQuery.createdAt.$lte = new Date(dateTo);
    }

    // Get overall stats
    const [stats, byStatus, byReason] = await Promise.all([
      Refund.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalRefunds: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
            completedRefunds: {
              $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] },
            },
            failedRefunds: {
              $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] },
            },
          },
        },
      ]),
      Refund.aggregate([
        { $match: matchQuery },
        { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      ]),
      Refund.aggregate([
        { $match: matchQuery },
        { $group: { _id: "$reason", count: { $sum: 1 } } },
      ]),
    ]);

    const result = stats[0] || {
      totalRefunds: 0,
      totalAmount: 0,
      completedRefunds: 0,
      failedRefunds: 0,
    };

    const successRate =
      result.totalRefunds > 0
        ? Math.round((result.completedRefunds / result.totalRefunds) * 100)
        : 0;

    // Calculate average processing time
    const avgProcessingTime = await Refund.aggregate([
      {
        $match: {
          ...matchQuery,
          status: "COMPLETED",
          initiatedAt: { $exists: true },
          completedAt: { $exists: true },
        },
      },
      {
        $project: {
          processingTime: { $subtract: ["$completedAt", "$initiatedAt"] },
        },
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: "$processingTime" },
        },
      },
    ]);

    const avgTimeHours = avgProcessingTime[0]?.avgTime
      ? Math.round(avgProcessingTime[0].avgTime / (1000 * 60 * 60))
      : 0;

    const byStatusObj = {};
    byStatus.forEach((s) => {
      byStatusObj[s._id] = { count: s.count, amount: s.amount };
    });

    const byReasonObj = {};
    byReason.forEach((r) => {
      byReasonObj[r._id] = r.count;
    });

    return sendResponse(res, 200, true, "Refund statistics", {
      totalRefunds: result.totalRefunds,
      totalAmount: result.totalAmount,
      byStatus: byStatusObj,
      byReason: byReasonObj,
      averageProcessingTime: avgTimeHours,
      successRate,
    });
  } catch (error) {
    console.error("Get refund stats error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve refund statistics");
  }
}

export default {
  initiateRefund,
  processRefund,
  processFailedRefunds,
  getMyRefunds,
  getRefundById,
  getAllRefunds,
  initiateManualRefund,
  approveRefund,
  cancelRefund,
  retryRefund,
  getRefundStats,
};
