/**
 * Payment Controller
 * Handles payment-related API endpoints
 */

import paymentService from "../../services/payment.service.js";
import razorpayProvider from "../../services/razorpay.provider.js";
import { getRazorpayKeyId } from "../../config/razorpay.config.js";
import PaymentTransaction from "../../schema/paymentTransaction.schema.js";
import Order from "../../schema/order.schema.js";
import SubscriptionPlan from "../../schema/subscriptionPlan.schema.js";
import { sendResponse } from "../../utils/response.utils.js";

/**
 * Create payment order for an existing order
 * POST /api/payment/order/:orderId/initiate
 */
export async function initiateOrderPayment(req, res) {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    // Find the order
    const order = await Order.findById(orderId);

    if (!order) {
      return sendResponse(res, 404, false, "Order not found");
    }

    // Verify ownership
    if (order.userId.toString() !== userId.toString()) {
      return sendResponse(res, 403, false, "Unauthorized access to this order");
    }

    // Check if payment is already completed
    if (order.paymentStatus === "PAID") {
      return sendResponse(
        res,
        400,
        false,
        "Payment already completed for this order",
      );
    }

    // Check if amount to pay is zero (voucher-only order)
    if (order.amountPaid === 0 || order.paymentMethod === "VOUCHER_ONLY") {
      return sendResponse(
        res,
        400,
        false,
        "No payment required for this order",
      );
    }

    // Create payment order
    const paymentOrder = await paymentService.createPaymentOrder({
      purchaseType: "ORDER",
      referenceId: order._id,
      amount: order.amountPaid,
      userId,
      breakdown: {
        subtotal: order.subtotal,
        mainCourseTotal: order.items
          .filter((i) => i.isMainCourse)
          .reduce((sum, i) => sum + i.totalPrice, 0),
        addonTotal: order.items.reduce(
          (sum, i) =>
            sum + i.addons.reduce((a, addon) => a + addon.totalPrice, 0),
          0,
        ),
        deliveryFee: order.charges?.deliveryFee || 0,
        serviceFee: order.charges?.serviceFee || 0,
        packagingFee: order.charges?.packagingFee || 0,
        taxAmount: order.charges?.taxAmount || 0,
        voucherDiscount: order.voucherUsage?.voucherCoverage || 0,
        couponDiscount: order.discount?.discountAmount || 0,
      },
      metadata: {
        orderNumber: order.orderNumber,
        menuType: order.menuType,
        mealWindow: order.mealWindow,
      },
    });

    // Update order with Razorpay order ID
    order.paymentDetails = order.paymentDetails || {};
    order.paymentDetails.razorpayOrderId = paymentOrder.razorpayOrderId;
    await order.save();

    return sendResponse(res, 200, true, "Payment order created", {
      razorpayOrderId: paymentOrder.razorpayOrderId,
      amount: paymentOrder.amountRupees,
      currency: "INR",
      key: paymentOrder.key,
      orderId: order._id,
      orderNumber: order.orderNumber,
      expiresAt: paymentOrder.expiresAt,
      prefill: {
        name: req.user.name,
        contact: req.user.phone,
        email: req.user.email,
      },
    });
  } catch (error) {
    console.log("> initiateOrderPayment error:", error);
    return sendResponse(
      res,
      500,
      false,
      error.message || "Failed to create payment order",
    );
  }
}

/**
 * Create payment order for subscription purchase
 * POST /api/payment/subscription/initiate
 */
export async function initiateSubscriptionPayment(req, res) {
  try {
    const { planId } = req.body;
    const userId = req.user._id;

    // Find the plan
    const plan = await SubscriptionPlan.findById(planId);

    if (!plan) {
      return sendResponse(res, 404, false, "Subscription plan not found");
    }

    // Check if plan is purchasable
    if (!plan.isPurchasable()) {
      return sendResponse(
        res,
        400,
        false,
        "This plan is not available for purchase",
      );
    }

    // Create payment order
    const paymentOrder = await paymentService.createPaymentOrder({
      purchaseType: "SUBSCRIPTION",
      referenceId: planId, // We'll create subscription after payment
      amount: plan.price,
      userId,
      breakdown: {
        subtotal: plan.price,
      },
      metadata: {
        planName: plan.name,
        durationDays: plan.durationDays,
        vouchersPerDay: plan.vouchersPerDay,
        totalVouchers: plan.totalVouchers,
      },
    });

    return sendResponse(res, 200, true, "Payment order created", {
      razorpayOrderId: paymentOrder.razorpayOrderId,
      amount: paymentOrder.amountRupees,
      currency: "INR",
      key: paymentOrder.key,
      planId: plan._id,
      planName: plan.name,
      expiresAt: paymentOrder.expiresAt,
      prefill: {
        name: req.user.name,
        contact: req.user.phone,
        email: req.user.email,
      },
    });
  } catch (error) {
    console.log("> initiateSubscriptionPayment error:", error);
    return sendResponse(
      res,
      500,
      false,
      error.message || "Failed to create payment order",
    );
  }
}

/**
 * Verify payment (client callback)
 * POST /api/payment/verify
 */
export async function verifyPayment(req, res) {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const userId = req.user._id;

    // Find the transaction
    const transaction =
      await PaymentTransaction.findByRazorpayOrderId(razorpayOrderId);

    if (!transaction) {
      return sendResponse(res, 404, false, "Payment transaction not found");
    }

    // Verify ownership
    if (transaction.userId.toString() !== userId.toString()) {
      return sendResponse(
        res,
        403,
        false,
        "Unauthorized access to this payment",
      );
    }

    // Verify payment
    const result = await paymentService.verifyPayment({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    return sendResponse(res, 200, true, "Payment verified successfully", {
      success: result.success,
      status: result.transaction.status,
      purchaseType: result.transaction.purchaseType,
      referenceId: result.transaction.referenceId,
      paymentId: razorpayPaymentId,
    });
  } catch (error) {
    console.log("> verifyPayment error:", error);
    return sendResponse(
      res,
      400,
      false,
      error.message || "Payment verification failed",
    );
  }
}

/**
 * Razorpay webhook handler
 * POST /api/payment/webhook
 * NOTE: This endpoint uses raw body parser for signature verification
 */
export async function handleWebhook(req, res) {
  const timestamp = new Date().toISOString();
  console.log(`\n= RAZORPAY WEBHOOK [${timestamp}] =`);

  try {
    const signature = req.headers["x-razorpay-signature"];

    if (!signature) {
      console.log("[WEBHOOK] ERROR: Missing x-razorpay-signature header");
      console.log(
        "[WEBHOOK] Headers received:",
        JSON.stringify(req.headers, null, 2),
      );
      return res.status(400).json({ error: "Missing signature" });
    }

    console.log(
      "[WEBHOOK] Signature received:",
      signature.substring(0, 20) + "...",
    );

    // Get raw body - handle Buffer from express.raw()
    let rawBody;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString("utf8");
      console.log("[WEBHOOK] Body type: Buffer, converted to string");
    } else if (typeof req.body === "string") {
      rawBody = req.body;
      console.log("[WEBHOOK] Body type: String");
    } else {
      // If body was already parsed (shouldn't happen with express.raw)
      rawBody = JSON.stringify(req.body);
      console.log("[WEBHOOK] Body type: Object (unexpected), stringified");
    }

    console.log("[WEBHOOK] Body length:", rawBody.length, "chars");

    // Verify webhook signature
    const isValid = razorpayProvider.verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      console.log("[WEBHOOK] ERROR: Signature verification FAILED");
      console.log("[WEBHOOK] This could mean:");
      console.log("  - RAZORPAY_WEBHOOK_SECRET env var is incorrect");
      console.log("  - Body was modified/re-encoded before verification");
      console.log("  - Signature header was tampered with");
      return res.status(400).json({ error: "Invalid signature" });
    }

    console.log("[WEBHOOK] Signature verification: PASSED");

    // Parse payload
    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const paymentEntity = payload.payload?.payment?.entity;
    const orderEntity = payload.payload?.order?.entity;
    const refundEntity = payload.payload?.refund?.entity;

    console.log("[WEBHOOK] Event type:", event);

    if (paymentEntity) {
      console.log("[WEBHOOK] Payment details:");
      console.log("  - payment_id:", paymentEntity.id);
      console.log("  - order_id:", paymentEntity.order_id);
      console.log("  - status:", paymentEntity.status);
      console.log("  - amount:", paymentEntity.amount / 100, "INR");
      console.log("  - method:", paymentEntity.method);
    }

    if (orderEntity) {
      console.log("[WEBHOOK] Order details:");
      console.log("  - order_id:", orderEntity.id);
      console.log("  - status:", orderEntity.status);
      console.log("  - amount:", orderEntity.amount / 100, "INR");
    }

    if (refundEntity) {
      console.log("[WEBHOOK] Refund details:");
      console.log("  - refund_id:", refundEntity.id);
      console.log("  - payment_id:", refundEntity.payment_id);
      console.log("  - amount:", refundEntity.amount / 100, "INR");
      console.log("  - status:", refundEntity.status);
    }

    // Process webhook event
    console.log("[WEBHOOK] Processing event...");
    const result = await paymentService.handleWebhookEvent(
      event,
      payload.payload,
    );

    console.log(
      "[WEBHOOK] Processing result:",
      JSON.stringify(result, null, 2),
    );
    console.log(`= WEBHOOK COMPLETE [${event}] =\n`);

    // Always respond 200 to acknowledge receipt
    return res.status(200).json({
      received: true,
      event,
      handled: result.handled,
    });
  } catch (error) {
    console.log("[WEBHOOK] ERROR:", error.message);
    console.log("[WEBHOOK] Stack:", error.stack);
    console.log(`= WEBHOOK ERROR =\n`);

    // Still return 200 to prevent Razorpay retries for our errors
    return res.status(200).json({
      received: true,
      error: error.message,
    });
  }
}

/**
 * Get payment status
 * GET /api/payment/status/:razorpayOrderId
 */
export async function getPaymentStatus(req, res) {
  try {
    const { razorpayOrderId } = req.params;
    const userId = req.user._id;

    const status = await paymentService.getPaymentStatus(razorpayOrderId);

    // Verify ownership (allow admin to view any)
    if (
      status.userId &&
      status.userId.toString() !== userId.toString() &&
      req.user.role !== "ADMIN"
    ) {
      return sendResponse(
        res,
        403,
        false,
        "Unauthorized access to this payment",
      );
    }

    return sendResponse(res, 200, true, "Payment status retrieved", status);
  } catch (error) {
    console.log("> getPaymentStatus error:", error);
    return sendResponse(
      res,
      400,
      false,
      error.message || "Failed to get payment status",
    );
  }
}

/**
 * Retry payment for a failed order
 * POST /api/payment/order/:orderId/retry
 */
export async function retryPayment(req, res) {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    // Find the order
    const order = await Order.findById(orderId);

    if (!order) {
      return sendResponse(res, 404, false, "Order not found");
    }

    // Verify ownership
    if (order.userId.toString() !== userId.toString()) {
      return sendResponse(res, 403, false, "Unauthorized access to this order");
    }

    // Check if order can be retried
    if (order.paymentStatus === "PAID") {
      return sendResponse(res, 400, false, "Payment already completed");
    }

    if (order.status === "CANCELLED" || order.status === "REJECTED") {
      return sendResponse(
        res,
        400,
        false,
        "Cannot retry payment for cancelled/rejected order",
      );
    }

    // Create new payment order
    const paymentOrder = await paymentService.retryPayment(
      "ORDER",
      orderId,
      userId,
    );

    // Update order with new Razorpay order ID
    order.paymentDetails = order.paymentDetails || {};
    order.paymentDetails.razorpayOrderId = paymentOrder.razorpayOrderId;
    await order.save();

    return sendResponse(res, 200, true, "New payment order created", {
      razorpayOrderId: paymentOrder.razorpayOrderId,
      amount: paymentOrder.amountRupees,
      currency: "INR",
      key: paymentOrder.key,
      orderId: order._id,
      expiresAt: paymentOrder.expiresAt,
    });
  } catch (error) {
    console.log("> retryPayment error:", error);
    return sendResponse(
      res,
      500,
      false,
      error.message || "Failed to create retry payment",
    );
  }
}

/**
 * Get user's payment history
 * GET /api/payment/history
 */
export async function getPaymentHistory(req, res) {
  try {
    const userId = req.user._id;
    const { status, purchaseType, limit, skip } = req.query;

    const transactions = await paymentService.getUserPaymentHistory(userId, {
      status,
      purchaseType,
      limit: parseInt(limit) || 20,
      skip: parseInt(skip) || 0,
    });

    return sendResponse(res, 200, true, "Payment history retrieved", {
      transactions,
      count: transactions.length,
    });
  } catch (error) {
    console.log("> getPaymentHistory error:", error);
    return sendResponse(res, 500, false, "Failed to get payment history");
  }
}

/**
 * Get Razorpay config for client
 * GET /api/payment/config
 */
export async function getPaymentConfig(req, res) {
  try {
    const isAvailable = razorpayProvider.isAvailable();

    return sendResponse(res, 200, true, "Payment config retrieved", {
      available: isAvailable,
      key: isAvailable ? getRazorpayKeyId() : null,
      currency: "INR",
      provider: "razorpay",
    });
  } catch (error) {
    console.log("> getPaymentConfig error:", error);
    return sendResponse(res, 500, false, "Failed to get payment config");
  }
}

//  ADMIN ENDPOINTS

/**
 * Get all transactions (admin)
 * GET /api/payment/admin/transactions
 */
export async function adminGetTransactions(req, res) {
  try {
    const { status, purchaseType, userId, startDate, endDate, limit, skip } =
      req.query;

    const query = {};

    if (status) query.status = status;
    if (purchaseType) query.purchaseType = purchaseType;
    if (userId) query.userId = userId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await PaymentTransaction.find(query)
      .populate("userId", "name phone email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) || 50)
      .skip(parseInt(skip) || 0);

    const total = await PaymentTransaction.countDocuments(query);

    return sendResponse(res, 200, true, "Transactions retrieved", {
      transactions,
      total,
      limit: parseInt(limit) || 50,
      skip: parseInt(skip) || 0,
    });
  } catch (error) {
    console.log("> adminGetTransactions error:", error);
    return sendResponse(res, 500, false, "Failed to get transactions");
  }
}

/**
 * Get transaction details (admin)
 * GET /api/payment/admin/transactions/:id
 */
export async function adminGetTransaction(req, res) {
  try {
    const { id } = req.params;

    const transaction = await PaymentTransaction.findById(id)
      .populate("userId", "name phone email")
      .populate("referenceId");

    if (!transaction) {
      return sendResponse(res, 404, false, "Transaction not found");
    }

    return sendResponse(res, 200, true, "Transaction retrieved", transaction);
  } catch (error) {
    console.log("> adminGetTransaction error:", error);
    return sendResponse(res, 500, false, "Failed to get transaction");
  }
}

/**
 * Initiate refund (admin)
 * POST /api/payment/admin/refund
 */
export async function adminInitiateRefund(req, res) {
  try {
    const { paymentId, amount, reason, speed } = req.body;

    const result = await paymentService.processRefund({
      paymentId,
      amount,
      reason,
      refundRecordId: null, // Admin-initiated refund
      speed: speed || "normal",
    });

    return sendResponse(res, 200, true, "Refund initiated", result);
  } catch (error) {
    console.log("> adminInitiateRefund error:", error);
    return sendResponse(
      res,
      500,
      false,
      error.message || "Failed to initiate refund",
    );
  }
}

/**
 * Get payment stats (admin)
 * GET /api/payment/admin/stats
 */
export async function adminGetStats(req, res) {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Aggregate stats
    const stats = await PaymentTransaction.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amountRupees" },
        },
      },
    ]);

    // Format stats
    const formattedStats = {
      total: 0,
      totalAmount: 0,
      byStatus: {},
    };

    stats.forEach((stat) => {
      formattedStats.byStatus[stat._id] = {
        count: stat.count,
        amount: stat.totalAmount,
      };
      formattedStats.total += stat.count;
      if (stat._id === "CAPTURED") {
        formattedStats.totalAmount += stat.totalAmount;
      }
    });

    // Get by purchase type
    const typeStats = await PaymentTransaction.aggregate([
      { $match: { ...dateFilter, status: "CAPTURED" } },
      {
        $group: {
          _id: "$purchaseType",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amountRupees" },
        },
      },
    ]);

    formattedStats.byPurchaseType = {};
    typeStats.forEach((stat) => {
      formattedStats.byPurchaseType[stat._id] = {
        count: stat.count,
        amount: stat.totalAmount,
      };
    });

    return sendResponse(res, 200, true, "Stats retrieved", formattedStats);
  } catch (error) {
    console.log("> adminGetStats error:", error);
    return sendResponse(res, 500, false, "Failed to get stats");
  }
}

/**
 * Mark expired transactions (admin/cron)
 * POST /api/payment/admin/cleanup-expired
 */
export async function adminCleanupExpired(req, res) {
  try {
    const result = await paymentService.markExpiredTransactions();
    return sendResponse(
      res,
      200,
      true,
      "Expired transactions cleaned up",
      result,
    );
  } catch (error) {
    console.log("> adminCleanupExpired error:", error);
    return sendResponse(
      res,
      500,
      false,
      "Failed to cleanup expired transactions",
    );
  }
}

export default {
  initiateOrderPayment,
  initiateSubscriptionPayment,
  verifyPayment,
  handleWebhook,
  getPaymentStatus,
  retryPayment,
  getPaymentHistory,
  getPaymentConfig,
  adminGetTransactions,
  adminGetTransaction,
  adminInitiateRefund,
  adminGetStats,
  adminCleanupExpired,
};
