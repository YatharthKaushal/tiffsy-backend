/**
 * Payment Controller
 *
 * Handles payment-related API endpoints for customers and admins.
 */

import { sendResponse } from "../../utils/response.utils.js";
import {
  createOrderPayment,
  createSubscriptionPayment,
  verifyPayment as verifyPaymentService,
  getProviderName,
  getTransactionByEntity,
  getTransactionByPaymentId,
  initiateRefund as initiateRefundService,
} from "../../services/payment/payment.service.js";
import PaymentTransaction from "../../schema/paymentTransaction.schema.js";
import Order from "../../schema/order.schema.js";
import Subscription from "../../schema/subscription.schema.js";
import SubscriptionPlan from "../../schema/subscriptionPlan.schema.js";

/**
 * Initiate payment for an order
 * POST /api/payment/order/:orderId/initiate
 *
 * @param {Request} req
 * @param {Response} res
 */
export async function initiateOrderPayment(req, res) {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    // Fetch the order
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return sendResponse(res, 404, false, "Order not found");
    }

    // Check if payment is needed
    if (order.paymentStatus === "PAID") {
      return sendResponse(res, 400, false, "Order is already paid");
    }

    if (!order.amountPaid || order.amountPaid <= 0) {
      return sendResponse(res, 400, false, "No payment required for this order");
    }

    // Check for existing pending transaction
    const existingTransaction = await getTransactionByEntity("ORDER", orderId);
    if (existingTransaction && existingTransaction.status === "INITIATED") {
      // Return existing payment intent
      return sendResponse(res, 200, true, "Payment already initiated", {
        paymentId: existingTransaction.gatewayPaymentId,
        amount: existingTransaction.amount,
        provider: getProviderName(),
        status: "INITIATED",
      });
    }

    // Create payment intent
    const customer = {
      id: userId.toString(),
      name: req.user.name || "",
      email: req.user.email || "",
      phone: req.user.phone || "",
    };

    const paymentIntent = await createOrderPayment({
      orderId: orderId.toString(),
      amount: order.amountPaid,
      customer,
      metadata: {
        orderNumber: order.orderNumber,
        menuType: order.menuType,
      },
    });

    return sendResponse(res, 200, true, "Payment initiated", {
      paymentId: paymentIntent.id,
      clientSecret: paymentIntent.clientSecret,
      amount: order.amountPaid,
      provider: getProviderName(),
    });
  } catch (error) {
    console.error("> PaymentController: initiateOrderPayment error:", error);
    return sendResponse(res, 500, false, "Failed to initiate payment", null, error.message);
  }
}

/**
 * Initiate payment for a subscription plan
 * POST /api/payment/subscription/initiate
 *
 * @param {Request} req
 * @param {Response} res
 */
export async function initiateSubscriptionPayment(req, res) {
  try {
    const { planId } = req.body;
    const userId = req.user._id;

    // Fetch the plan
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return sendResponse(res, 404, false, "Subscription plan not found");
    }

    // Validate plan is purchasable
    if (!plan.isPurchasable()) {
      return sendResponse(res, 400, false, "This plan is not available for purchase");
    }

    // Check for existing active subscription for this plan
    const existingSubscription = await Subscription.findOne({
      userId,
      planId,
      status: { $in: ["ACTIVE", "PENDING"] },
    });

    if (existingSubscription) {
      if (existingSubscription.status === "PENDING") {
        // Return existing pending subscription payment
        const existingTransaction = await getTransactionByEntity(
          "SUBSCRIPTION",
          existingSubscription._id.toString()
        );
        if (existingTransaction && existingTransaction.status === "INITIATED") {
          return sendResponse(res, 200, true, "Payment already initiated", {
            subscriptionId: existingSubscription._id,
            paymentId: existingTransaction.gatewayPaymentId,
            amount: plan.price,
            provider: getProviderName(),
          });
        }
      } else {
        return sendResponse(res, 400, false, "You already have an active subscription for this plan");
      }
    }

    // Create subscription in PENDING status
    const subscription = new Subscription({
      userId,
      planId,
      purchaseDate: new Date(),
      startDate: new Date(),
      endDate: new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000),
      totalVouchersIssued: plan.totalVouchers || plan.durationDays * (plan.vouchersPerDay || 2),
      vouchersUsed: 0,
      voucherExpiryDate: new Date(
        Date.now() + (plan.voucherValidityDays || 90) * 24 * 60 * 60 * 1000
      ),
      amountPaid: plan.price,
      status: "PENDING", // Will be activated by webhook
    });

    await subscription.save();

    // Create payment intent
    const customer = {
      id: userId.toString(),
      name: req.user.name || "",
      email: req.user.email || "",
      phone: req.user.phone || "",
    };

    const paymentIntent = await createSubscriptionPayment({
      subscriptionId: subscription._id.toString(),
      planId: planId.toString(),
      amount: plan.price,
      customer,
      metadata: {
        planName: plan.name,
        durationDays: plan.durationDays,
      },
    });

    return sendResponse(res, 200, true, "Payment initiated", {
      subscriptionId: subscription._id,
      paymentId: paymentIntent.id,
      clientSecret: paymentIntent.clientSecret,
      amount: plan.price,
      provider: getProviderName(),
      plan: {
        id: plan._id,
        name: plan.name,
        durationDays: plan.durationDays,
        totalVouchers: subscription.totalVouchersIssued,
      },
    });
  } catch (error) {
    console.error("> PaymentController: initiateSubscriptionPayment error:", error);
    return sendResponse(res, 500, false, "Failed to initiate payment", null, error.message);
  }
}

/**
 * Verify payment status
 * GET /api/payment/:paymentId/verify
 *
 * @param {Request} req
 * @param {Response} res
 */
export async function verifyPayment(req, res) {
  try {
    const { paymentId } = req.params;

    const payment = await verifyPaymentService(paymentId);

    return sendResponse(res, 200, true, "Payment status retrieved", {
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount / 100, // Convert from paisa
      currency: payment.currency,
      method: payment.method,
    });
  } catch (error) {
    console.error("> PaymentController: verifyPayment error:", error);
    return sendResponse(res, 500, false, "Failed to verify payment", null, error.message);
  }
}

/**
 * Get payment history for current user
 * GET /api/payment/history
 *
 * @param {Request} req
 * @param {Response} res
 */
export async function getPaymentHistory(req, res) {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, entityType, status } = req.query;

    // Get user's orders and subscriptions
    const [orders, subscriptions] = await Promise.all([
      Order.find({ userId }).select("_id"),
      Subscription.find({ userId }).select("_id"),
    ]);

    const orderIds = orders.map((o) => o._id);
    const subscriptionIds = subscriptions.map((s) => s._id);

    // Build query
    const query = {
      $or: [
        { entityType: "ORDER", entityId: { $in: orderIds } },
        { entityType: "SUBSCRIPTION", entityId: { $in: subscriptionIds } },
      ],
    };

    if (entityType) {
      query.entityType = entityType;
    }

    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      PaymentTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      PaymentTransaction.countDocuments(query),
    ]);

    return sendResponse(res, 200, true, "Payment history retrieved", {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("> PaymentController: getPaymentHistory error:", error);
    return sendResponse(res, 500, false, "Failed to get payment history", null, error.message);
  }
}

/**
 * Get transaction by entity (order or subscription)
 * GET /api/payment/entity/:entityType/:entityId
 *
 * @param {Request} req
 * @param {Response} res
 */
export async function getTransactionByEntityEndpoint(req, res) {
  try {
    const { entityType, entityId } = req.params;
    const userId = req.user._id;

    // Verify ownership
    if (entityType === "ORDER") {
      const order = await Order.findOne({ _id: entityId, userId });
      if (!order) {
        return sendResponse(res, 404, false, "Order not found");
      }
    } else if (entityType === "SUBSCRIPTION") {
      const subscription = await Subscription.findOne({ _id: entityId, userId });
      if (!subscription) {
        return sendResponse(res, 404, false, "Subscription not found");
      }
    }

    const transaction = await getTransactionByEntity(entityType, entityId);
    if (!transaction) {
      return sendResponse(res, 404, false, "Transaction not found");
    }

    return sendResponse(res, 200, true, "Transaction retrieved", { transaction });
  } catch (error) {
    console.error("> PaymentController: getTransactionByEntity error:", error);
    return sendResponse(res, 500, false, "Failed to get transaction", null, error.message);
  }
}

/**
 * Get provider info (public endpoint)
 * GET /api/payment/provider
 *
 * @param {Request} req
 * @param {Response} res
 */
export async function getProviderInfo(req, res) {
  try {
    return sendResponse(res, 200, true, "Provider info", {
      provider: getProviderName(),
      supportedMethods: ["UPI", "CARD"],
    });
  } catch (error) {
    console.error("> PaymentController: getProviderInfo error:", error);
    return sendResponse(res, 500, false, "Failed to get provider info", null, error.message);
  }
}

// ============ Admin Endpoints ============

/**
 * Admin: List all transactions
 * GET /api/payment/admin/transactions
 *
 * @param {Request} req
 * @param {Response} res
 */
export async function adminListTransactions(req, res) {
  try {
    const { page = 1, limit = 20, status, provider, entityType, fromDate, toDate } = req.query;

    const query = {};

    if (status) query.status = status;
    if (provider) query.gatewayProvider = provider;
    if (entityType) query.entityType = entityType;

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      PaymentTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      PaymentTransaction.countDocuments(query),
    ]);

    return sendResponse(res, 200, true, "Transactions retrieved", {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("> PaymentController: adminListTransactions error:", error);
    return sendResponse(res, 500, false, "Failed to list transactions", null, error.message);
  }
}

/**
 * Admin: Get transaction details
 * GET /api/payment/admin/transaction/:transactionId
 *
 * @param {Request} req
 * @param {Response} res
 */
export async function adminGetTransaction(req, res) {
  try {
    const { transactionId } = req.params;

    const transaction = await PaymentTransaction.findById(transactionId).lean();
    if (!transaction) {
      return sendResponse(res, 404, false, "Transaction not found");
    }

    // Get related entity
    let entity = null;
    if (transaction.entityType === "ORDER") {
      entity = await Order.findById(transaction.entityId).lean();
    } else if (transaction.entityType === "SUBSCRIPTION") {
      entity = await Subscription.findById(transaction.entityId).populate("planId").lean();
    }

    return sendResponse(res, 200, true, "Transaction retrieved", {
      transaction,
      entity,
    });
  } catch (error) {
    console.error("> PaymentController: adminGetTransaction error:", error);
    return sendResponse(res, 500, false, "Failed to get transaction", null, error.message);
  }
}

/**
 * Admin: Initiate refund
 * POST /api/payment/admin/refund
 *
 * @param {Request} req
 * @param {Response} res
 */
export async function adminInitiateRefund(req, res) {
  try {
    const { paymentId, amount, reason } = req.body;

    // Get the transaction
    const transaction = await getTransactionByPaymentId(paymentId);
    if (!transaction) {
      return sendResponse(res, 404, false, "Transaction not found");
    }

    if (transaction.status !== "COMPLETED") {
      return sendResponse(res, 400, false, "Can only refund completed payments");
    }

    // Check if amount is valid
    const alreadyRefunded = transaction.totalRefunded || 0;
    const maxRefundable = transaction.amount - alreadyRefunded;

    if (amount > maxRefundable) {
      return sendResponse(
        res,
        400,
        false,
        `Maximum refundable amount is ${maxRefundable}. Already refunded: ${alreadyRefunded}`
      );
    }

    const refund = await initiateRefundService({
      paymentId,
      amount,
      reason,
      metadata: {
        initiatedBy: req.user._id.toString(),
        adminAction: true,
      },
    });

    return sendResponse(res, 200, true, "Refund initiated", {
      refundId: refund.id,
      status: refund.status,
      amount,
    });
  } catch (error) {
    console.error("> PaymentController: adminInitiateRefund error:", error);
    return sendResponse(res, 500, false, "Failed to initiate refund", null, error.message);
  }
}

export default {
  initiateOrderPayment,
  initiateSubscriptionPayment,
  verifyPayment,
  getPaymentHistory,
  getTransactionByEntityEndpoint,
  getProviderInfo,
  adminListTransactions,
  adminGetTransaction,
  adminInitiateRefund,
};
