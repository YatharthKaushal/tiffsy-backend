/**
 * Payment Service
 * Business logic layer for payment operations
 * Handles order creation, verification, refunds, and webhook processing
 */

import PaymentTransaction from "../schema/paymentTransaction.schema.js";
import Order from "../schema/order.schema.js";
import Subscription from "../schema/subscription.schema.js";
import razorpayProvider from "./razorpay.provider.js";
import { getRazorpayKeyId } from "../config/razorpay.config.js";

// Razorpay orders expire after this duration (30 minutes)
const ORDER_EXPIRY_MINUTES = 30;

/**
 * Create a payment order in Razorpay
 * @param {Object} params
 * @param {string} params.purchaseType - "ORDER" | "SUBSCRIPTION" | "WALLET_RECHARGE"
 * @param {string} params.referenceId - Order/Subscription ID
 * @param {number} params.amount - Amount in rupees
 * @param {string} params.userId - User ID
 * @param {Object} params.breakdown - Pricing breakdown for audit
 * @param {Object} params.metadata - Additional metadata
 * @returns {Promise<Object>} Payment order details
 */
export async function createPaymentOrder({
  purchaseType,
  referenceId,
  amount,
  userId,
  breakdown = {},
  metadata = {},
}) {
  // Validate minimum amount (Razorpay minimum is 1 rupee)
  if (amount < 1) {
    throw new Error("Amount must be at least 1 rupee");
  }

  // Check if Razorpay is available
  if (!razorpayProvider.isAvailable()) {
    throw new Error("Payment gateway is not configured");
  }

  // Generate receipt ID
  const receipt = PaymentTransaction.generateReceipt(purchaseType, referenceId);

  // Create Razorpay order
  const razorpayOrder = await razorpayProvider.createOrder({
    amount,
    currency: "INR",
    receipt,
    notes: {
      purchaseType,
      referenceId: referenceId.toString(),
      userId: userId.toString(),
      ...metadata,
    },
  });

  // Calculate expiry time
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + ORDER_EXPIRY_MINUTES);

  // Create payment transaction record
  const paymentTransaction = new PaymentTransaction({
    razorpayOrderId: razorpayOrder.id,
    purchaseType,
    referenceId,
    userId,
    amount: razorpayOrder.amount,
    amountRupees: amount,
    currency: "INR",
    breakdown,
    status: "CREATED",
    receipt,
    notes: metadata,
    expiresAt,
  });

  await paymentTransaction.save();

  console.log(
    `> Payment order created: ${razorpayOrder.id} for ${purchaseType}:${referenceId}`
  );

  return {
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    amountRupees: amount,
    currency: "INR",
    receipt,
    key: getRazorpayKeyId(),
    transactionId: paymentTransaction._id,
    expiresAt,
  };
}

/**
 * Verify payment signature and confirm payment
 * Called after client receives payment response from Razorpay
 * @param {Object} params
 * @param {string} params.razorpayOrderId - Razorpay order ID
 * @param {string} params.razorpayPaymentId - Razorpay payment ID
 * @param {string} params.razorpaySignature - Signature from client
 * @returns {Promise<Object>} Verification result
 */
export async function verifyPayment({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  // Find payment transaction
  const transaction = await PaymentTransaction.findByRazorpayOrderId(razorpayOrderId);

  if (!transaction) {
    throw new Error(`Payment transaction not found for order: ${razorpayOrderId}`);
  }

  // Check if already processed
  if (transaction.status === "CAPTURED") {
    return {
      success: true,
      alreadyProcessed: true,
      transaction,
    };
  }

  // Check if expired
  if (transaction.status === "EXPIRED") {
    throw new Error("Payment order has expired");
  }

  // Verify signature
  const isValid = razorpayProvider.verifyPaymentSignature({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  if (!isValid) {
    await transaction.markFailed("Signature verification failed", "INVALID_SIGNATURE", null);
    throw new Error("Payment signature verification failed");
  }

  // Fetch payment details from Razorpay
  const payment = await razorpayProvider.fetchPayment(razorpayPaymentId);

  // Verify payment status
  if (payment.status !== "captured" && payment.status !== "authorized") {
    await transaction.markFailed(
      `Unexpected payment status: ${payment.status}`,
      payment.errorCode,
      payment
    );
    throw new Error(`Payment not successful. Status: ${payment.status}`);
  }

  // Update transaction
  transaction.razorpayPaymentId = razorpayPaymentId;
  transaction.razorpaySignature = razorpaySignature;
  await transaction.markCaptured(razorpayPaymentId, payment);

  // Update the purchase entity
  await updatePurchaseEntity(transaction, payment);

  console.log(`> Payment verified: ${razorpayPaymentId} for ${transaction.purchaseType}`);

  return {
    success: true,
    transaction,
    payment,
  };
}

/**
 * Update the purchase entity (Order/Subscription) after successful payment
 * @param {Object} transaction - PaymentTransaction document
 * @param {Object} payment - Razorpay payment details
 */
async function updatePurchaseEntity(transaction, payment) {
  const paymentMethod = razorpayProvider.mapPaymentMethod(payment.method);
  const paymentDetails = {
    razorpayOrderId: transaction.razorpayOrderId,
    razorpayPaymentId: transaction.razorpayPaymentId,
    method: payment.method,
    bank: payment.bank,
    wallet: payment.wallet,
    vpa: payment.vpa,
    card: payment.card,
  };

  if (transaction.purchaseType === "ORDER") {
    await Order.findByIdAndUpdate(transaction.referenceId, {
      paymentStatus: "PAID",
      paymentId: transaction.razorpayPaymentId,
      paymentMethod,
      paymentDetails,
      amountPaid: transaction.amountRupees,
    });
    console.log(`> Order ${transaction.referenceId} marked as PAID`);
  } else if (transaction.purchaseType === "SUBSCRIPTION") {
    await Subscription.findByIdAndUpdate(transaction.referenceId, {
      paymentId: transaction.razorpayPaymentId,
      paymentMethod,
      paymentDetails,
    });
    console.log(`> Subscription ${transaction.referenceId} payment recorded`);
  }
}

/**
 * Process refund via Razorpay
 * @param {Object} params
 * @param {string} params.paymentId - Razorpay payment ID (pay_xxx)
 * @param {number} params.amount - Amount to refund in rupees
 * @param {string} params.reason - Refund reason
 * @param {string} params.refundRecordId - Our Refund schema document ID
 * @param {string} params.speed - Refund speed: "normal" or "optimum"
 * @returns {Promise<Object>} Refund result
 */
export async function processRefund({
  paymentId,
  amount,
  reason,
  refundRecordId,
  speed = "normal",
}) {
  // Find the payment transaction
  const transaction = await PaymentTransaction.findByRazorpayPaymentId(paymentId);

  if (!transaction) {
    console.log(`> Transaction not found for payment: ${paymentId}, proceeding with refund`);
  }

  // Validate refundable amount
  if (transaction) {
    const refundableAmount = transaction.amountRupees - transaction.totalRefundedRupees;
    if (amount > refundableAmount) {
      throw new Error(
        `Refund amount (${amount}) exceeds refundable amount (${refundableAmount})`
      );
    }
  }

  // Create refund via Razorpay
  const refund = await razorpayProvider.createRefund({
    paymentId,
    amount,
    notes: {
      reason,
      refundRecordId: refundRecordId?.toString(),
    },
    speed,
  });

  // Update transaction if found
  if (transaction) {
    await transaction.addRefund({
      refundId: refundRecordId?.toString() || refund.id,
      razorpayRefundId: refund.id,
      amount: refund.amount,
      amountRupees: refund.amountRupees,
      status: refund.status === "processed" ? "PROCESSED" : "PENDING",
      reason,
    });
  }

  console.log(`> Refund created: ${refund.id} for payment ${paymentId}`);

  return {
    refundId: refund.id,
    paymentId: refund.paymentId,
    amount: refund.amount,
    amountRupees: refund.amountRupees,
    status: refund.status,
    response: refund,
  };
}

/**
 * Handle webhook events from Razorpay
 * @param {string} event - Event type
 * @param {Object} payload - Event payload
 * @returns {Promise<Object>} Processing result
 */
export async function handleWebhookEvent(event, payload) {
  console.log(`> Processing webhook event: ${event}`);

  switch (event) {
    case "payment.authorized":
      return handlePaymentAuthorized(payload.payment?.entity);

    case "payment.captured":
      return handlePaymentCaptured(payload.payment?.entity);

    case "payment.failed":
      return handlePaymentFailed(payload.payment?.entity);

    case "refund.created":
      return handleRefundCreated(payload.refund?.entity);

    case "refund.processed":
      return handleRefundProcessed(payload.refund?.entity);

    case "refund.failed":
      return handleRefundFailed(payload.refund?.entity);

    case "order.paid":
      return handleOrderPaid(payload.order?.entity);

    default:
      console.log(`> Unhandled webhook event: ${event}`);
      return { handled: false, event };
  }
}

/**
 * Handle payment.authorized webhook
 */
async function handlePaymentAuthorized(payment) {
  if (!payment) return { handled: false, reason: "No payment entity" };

  const transaction = await PaymentTransaction.findByRazorpayOrderId(payment.order_id);
  if (!transaction) {
    console.log(`> Transaction not found for order: ${payment.order_id}`);
    return { handled: false, reason: "Transaction not found" };
  }

  await transaction.addWebhookEvent("payment.authorized", payment);

  // If using manual capture, this is where you'd capture
  // For auto-capture (default), we wait for payment.captured
  if (transaction.status === "CREATED") {
    transaction.status = "AUTHORIZED";
    transaction.razorpayPaymentId = payment.id;
    await transaction.save();
  }

  return { handled: true, transactionId: transaction._id };
}

/**
 * Handle payment.captured webhook
 * This is the primary success webhook
 */
async function handlePaymentCaptured(payment) {
  if (!payment) return { handled: false, reason: "No payment entity" };

  const transaction = await PaymentTransaction.findByRazorpayOrderId(payment.order_id);
  if (!transaction) {
    console.log(`> Transaction not found for order: ${payment.order_id}`);
    return { handled: false, reason: "Transaction not found" };
  }

  await transaction.addWebhookEvent("payment.captured", payment);

  // If not already captured (client verification might have done it)
  if (transaction.status !== "CAPTURED") {
    await transaction.markCaptured(payment.id, payment);
    await updatePurchaseEntity(transaction, {
      method: payment.method,
      bank: payment.bank,
      wallet: payment.wallet,
      vpa: payment.vpa,
      card: payment.card,
    });
  }

  return { handled: true, transactionId: transaction._id };
}

/**
 * Handle payment.failed webhook
 */
async function handlePaymentFailed(payment) {
  if (!payment) return { handled: false, reason: "No payment entity" };

  const transaction = await PaymentTransaction.findByRazorpayOrderId(payment.order_id);
  if (!transaction) {
    console.log(`> Transaction not found for order: ${payment.order_id}`);
    return { handled: false, reason: "Transaction not found" };
  }

  await transaction.addWebhookEvent("payment.failed", payment);

  // Only mark as failed if not already captured
  if (transaction.status !== "CAPTURED") {
    await transaction.markFailed(
      payment.error_description || "Payment failed",
      payment.error_code,
      payment
    );

    // Update order status if applicable
    if (transaction.purchaseType === "ORDER") {
      await Order.findByIdAndUpdate(transaction.referenceId, {
        paymentStatus: "FAILED",
      });
    }
  }

  return { handled: true, transactionId: transaction._id };
}

/**
 * Handle refund.created webhook
 */
async function handleRefundCreated(refund) {
  if (!refund) return { handled: false, reason: "No refund entity" };

  const transaction = await PaymentTransaction.findByRazorpayPaymentId(refund.payment_id);
  if (!transaction) {
    console.log(`> Transaction not found for payment: ${refund.payment_id}`);
    return { handled: false, reason: "Transaction not found" };
  }

  await transaction.addWebhookEvent("refund.created", refund);

  // Check if refund already tracked
  const existingRefund = transaction.refunds.find(
    (r) => r.razorpayRefundId === refund.id
  );
  if (!existingRefund) {
    await transaction.addRefund({
      refundId: refund.id,
      razorpayRefundId: refund.id,
      amount: refund.amount,
      amountRupees: refund.amount / 100,
      status: "PENDING",
      reason: refund.notes?.reason || "Refund initiated",
    });
  }

  return { handled: true, transactionId: transaction._id };
}

/**
 * Handle refund.processed webhook
 */
async function handleRefundProcessed(refund) {
  if (!refund) return { handled: false, reason: "No refund entity" };

  const transaction = await PaymentTransaction.findByRazorpayPaymentId(refund.payment_id);
  if (!transaction) {
    console.log(`> Transaction not found for payment: ${refund.payment_id}`);
    return { handled: false, reason: "Transaction not found" };
  }

  await transaction.addWebhookEvent("refund.processed", refund);
  await transaction.updateRefundStatus(refund.id, "PROCESSED", new Date());

  return { handled: true, transactionId: transaction._id };
}

/**
 * Handle refund.failed webhook
 */
async function handleRefundFailed(refund) {
  if (!refund) return { handled: false, reason: "No refund entity" };

  const transaction = await PaymentTransaction.findByRazorpayPaymentId(refund.payment_id);
  if (!transaction) {
    console.log(`> Transaction not found for payment: ${refund.payment_id}`);
    return { handled: false, reason: "Transaction not found" };
  }

  await transaction.addWebhookEvent("refund.failed", refund);
  await transaction.updateRefundStatus(refund.id, "FAILED");

  return { handled: true, transactionId: transaction._id };
}

/**
 * Handle order.paid webhook
 */
async function handleOrderPaid(order) {
  if (!order) return { handled: false, reason: "No order entity" };

  const transaction = await PaymentTransaction.findByRazorpayOrderId(order.id);
  if (!transaction) {
    console.log(`> Transaction not found for order: ${order.id}`);
    return { handled: false, reason: "Transaction not found" };
  }

  await transaction.addWebhookEvent("order.paid", order);

  return { handled: true, transactionId: transaction._id };
}

/**
 * Get payment status
 * @param {string} razorpayOrderId - Razorpay order ID
 * @returns {Promise<Object>} Payment status
 */
export async function getPaymentStatus(razorpayOrderId) {
  const transaction = await PaymentTransaction.findByRazorpayOrderId(razorpayOrderId);

  if (!transaction) {
    throw new Error(`Transaction not found for order: ${razorpayOrderId}`);
  }

  // If still pending, check with Razorpay
  if (transaction.status === "CREATED" || transaction.status === "AUTHORIZED") {
    try {
      const order = await razorpayProvider.fetchOrder(razorpayOrderId);
      if (order.status === "paid") {
        // Fetch payments to get payment details
        const payments = await razorpayProvider.fetchOrderPayments(razorpayOrderId);
        const successfulPayment = payments.find((p) => p.status === "captured");
        if (successfulPayment) {
          const payment = await razorpayProvider.fetchPayment(successfulPayment.id);
          await transaction.markCaptured(successfulPayment.id, payment);
          await updatePurchaseEntity(transaction, payment);
        }
      }
    } catch (error) {
      console.log(`> Error fetching order status: ${error.message}`);
    }
  }

  return {
    razorpayOrderId: transaction.razorpayOrderId,
    razorpayPaymentId: transaction.razorpayPaymentId,
    status: transaction.status,
    amount: transaction.amount,
    amountRupees: transaction.amountRupees,
    paymentMethod: transaction.paymentMethod,
    paidAt: transaction.paidAt,
    failureReason: transaction.failureReason,
    purchaseType: transaction.purchaseType,
    referenceId: transaction.referenceId,
  };
}

/**
 * Retry payment for a failed transaction
 * Creates a new Razorpay order for the same purchase
 * @param {string} purchaseType - "ORDER" | "SUBSCRIPTION"
 * @param {string} referenceId - Order/Subscription ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} New payment order
 */
export async function retryPayment(purchaseType, referenceId, userId) {
  // Find the latest transaction for this purchase
  const existingTransaction = await PaymentTransaction.findByPurchase(
    purchaseType,
    referenceId
  );

  if (!existingTransaction) {
    throw new Error("No existing payment transaction found");
  }

  // Check if already paid
  if (existingTransaction.status === "CAPTURED") {
    throw new Error("Payment already completed");
  }

  // Create new payment order with same details
  return createPaymentOrder({
    purchaseType,
    referenceId,
    amount: existingTransaction.amountRupees,
    userId,
    breakdown: existingTransaction.breakdown,
    metadata: existingTransaction.notes,
  });
}

/**
 * Get user's payment history
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Payment transactions
 */
export async function getUserPaymentHistory(userId, options = {}) {
  return PaymentTransaction.findByUser(userId, options);
}

/**
 * Mark expired transactions
 * Should be called periodically (cron job)
 */
export async function markExpiredTransactions() {
  const expiredTransactions = await PaymentTransaction.findExpired();

  for (const transaction of expiredTransactions) {
    transaction.status = "EXPIRED";
    await transaction.save();
    console.log(`> Marked transaction as expired: ${transaction.razorpayOrderId}`);
  }

  return { count: expiredTransactions.length };
}

export default {
  createPaymentOrder,
  verifyPayment,
  processRefund,
  handleWebhookEvent,
  getPaymentStatus,
  retryPayment,
  getUserPaymentHistory,
  markExpiredTransactions,
};
