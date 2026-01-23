/**
 * Payment Service
 * Business logic layer for payment operations
 * Handles order creation, verification, refunds, and webhook processing
 */

import PaymentTransaction from "../schema/paymentTransaction.schema.js";
import Order from "../schema/order.schema.js";
import Subscription from "../schema/subscription.schema.js";
import Kitchen from "../schema/kitchen.schema.js";
import razorpayProvider from "./razorpay.provider.js";
import { getRazorpayKeyId } from "../config/razorpay.config.js";
import { isWithinMealWindowOperatingHours } from "./config.service.js";

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

  // Map purchaseType to model name for Mongoose refPath
  const purchaseTypeModelMap = {
    ORDER: "Order",
    SUBSCRIPTION: "Subscription",
    WALLET_RECHARGE: "WalletRecharge",
    FUTURE_PRODUCT: "FutureProduct",
  };

  // Create payment transaction record
  const paymentTransaction = new PaymentTransaction({
    razorpayOrderId: razorpayOrder.id,
    purchaseType,
    purchaseTypeModel: purchaseTypeModelMap[purchaseType],
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
  console.log("\n[PAYMENT SERVICE] verifyPayment called");
  console.log("  - razorpayOrderId:", razorpayOrderId);
  console.log("  - razorpayPaymentId:", razorpayPaymentId);
  console.log("  - razorpaySignature:", razorpaySignature?.substring(0, 20) + "...");

  // Find payment transaction
  const transaction = await PaymentTransaction.findByRazorpayOrderId(razorpayOrderId);

  if (!transaction) {
    console.log("[PAYMENT SERVICE] ERROR: Transaction not found for order:", razorpayOrderId);
    throw new Error(`Payment transaction not found for order: ${razorpayOrderId}`);
  }

  console.log("[PAYMENT SERVICE] Transaction found:");
  console.log("  - _id:", transaction._id);
  console.log("  - purchaseType:", transaction.purchaseType);
  console.log("  - referenceId:", transaction.referenceId);
  console.log("  - current status:", transaction.status);
  console.log("  - amountRupees:", transaction.amountRupees);

  // Check if already processed
  if (transaction.status === "CAPTURED") {
    console.log("[PAYMENT SERVICE] Transaction already CAPTURED, returning success");
    return {
      success: true,
      alreadyProcessed: true,
      transaction,
    };
  }

  // Check if expired
  if (transaction.status === "EXPIRED") {
    console.log("[PAYMENT SERVICE] ERROR: Transaction EXPIRED");
    throw new Error("Payment order has expired");
  }

  // Verify signature
  console.log("[PAYMENT SERVICE] Verifying payment signature...");
  const isValid = razorpayProvider.verifyPaymentSignature({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  if (!isValid) {
    console.log("[PAYMENT SERVICE] ERROR: Signature verification FAILED");
    await transaction.markFailed("Signature verification failed", "INVALID_SIGNATURE", null);
    throw new Error("Payment signature verification failed");
  }

  console.log("[PAYMENT SERVICE] Signature verification: PASSED");

  // Fetch payment details from Razorpay
  console.log("[PAYMENT SERVICE] Fetching payment details from Razorpay...");
  const payment = await razorpayProvider.fetchPayment(razorpayPaymentId);
  console.log("[PAYMENT SERVICE] Razorpay payment status:", payment.status);
  console.log("[PAYMENT SERVICE] Razorpay payment method:", payment.method);

  // Verify payment status
  if (payment.status !== "captured" && payment.status !== "authorized") {
    console.log("[PAYMENT SERVICE] ERROR: Unexpected payment status:", payment.status);
    await transaction.markFailed(
      `Unexpected payment status: ${payment.status}`,
      payment.errorCode,
      payment
    );
    throw new Error(`Payment not successful. Status: ${payment.status}`);
  }

  // Update transaction
  console.log("[PAYMENT SERVICE] Marking transaction as CAPTURED...");
  transaction.razorpayPaymentId = razorpayPaymentId;
  transaction.razorpaySignature = razorpaySignature;
  await transaction.markCaptured(razorpayPaymentId, payment);
  console.log("[PAYMENT SERVICE] Transaction marked CAPTURED");

  // Update the purchase entity
  console.log("[PAYMENT SERVICE] Calling updatePurchaseEntity...");
  await updatePurchaseEntity(transaction, payment);
  console.log("[PAYMENT SERVICE] updatePurchaseEntity completed");

  console.log(`[PAYMENT SERVICE] Payment verified successfully: ${razorpayPaymentId} for ${transaction.purchaseType}`);

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
  console.log("[PAYMENT SERVICE] updatePurchaseEntity called");
  console.log("  - purchaseType:", transaction.purchaseType);
  console.log("  - referenceId:", transaction.referenceId);
  console.log("  - razorpayPaymentId:", transaction.razorpayPaymentId);
  console.log("  - payment.method:", payment.method);

  const paymentMethod = razorpayProvider.mapPaymentMethod(payment.method);
  console.log("  - mappedPaymentMethod:", paymentMethod);

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
    console.log("[PAYMENT SERVICE] Updating Order to PAID status...");

    const updateData = {
      paymentStatus: "PAID",
      paymentId: transaction.razorpayPaymentId,
      paymentMethod,
      paymentDetails,
      amountPaid: transaction.amountRupees,
    };
    console.log("[PAYMENT SERVICE] Update data:", JSON.stringify(updateData, null, 2));

    const updatedOrder = await Order.findByIdAndUpdate(
      transaction.referenceId,
      updateData,
      { new: true }
    );

    if (updatedOrder) {
      console.log("[PAYMENT SERVICE] Order updated successfully:");
      console.log("  - orderNumber:", updatedOrder.orderNumber);
      console.log("  - paymentStatus:", updatedOrder.paymentStatus);
      console.log("  - paymentMethod:", updatedOrder.paymentMethod);

      // Auto-accept voucher orders after payment if within operating hours
      if (
        updatedOrder.voucherUsage?.voucherCount > 0 &&
        updatedOrder.status === "PLACED" &&
        updatedOrder.menuType === "MEAL_MENU"
      ) {
        const kitchen = await Kitchen.findById(updatedOrder.kitchenId);
        const opHours = isWithinMealWindowOperatingHours(
          updatedOrder.mealWindow,
          kitchen
        );

        if (opHours.isWithinOperatingHours) {
          console.log("[PAYMENT SERVICE] Auto-accepting voucher order after payment");
          updatedOrder.status = "ACCEPTED";
          updatedOrder.acceptedAt = new Date();
          updatedOrder.statusTimeline.push({
            status: "ACCEPTED",
            timestamp: new Date(),
            notes: "Auto-accepted after payment (voucher order within operating hours)",
          });
          await updatedOrder.save();
          console.log("[PAYMENT SERVICE] Order auto-accepted:", updatedOrder.orderNumber);
        } else {
          console.log("[PAYMENT SERVICE] Voucher order outside operating hours, not auto-accepting:", opHours.message);
        }
      }
    } else {
      console.log("[PAYMENT SERVICE] WARNING: Order not found for update:", transaction.referenceId);
    }
  } else if (transaction.purchaseType === "SUBSCRIPTION") {
    console.log("[PAYMENT SERVICE] Updating Subscription payment details...");

    const updatedSubscription = await Subscription.findByIdAndUpdate(
      transaction.referenceId,
      {
        paymentId: transaction.razorpayPaymentId,
        paymentMethod,
        paymentDetails,
      },
      { new: true }
    );

    if (updatedSubscription) {
      console.log("[PAYMENT SERVICE] Subscription updated successfully");
    } else {
      console.log("[PAYMENT SERVICE] WARNING: Subscription not found:", transaction.referenceId);
    }
  } else {
    console.log("[PAYMENT SERVICE] Unknown purchaseType:", transaction.purchaseType);
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
  console.log(`[PAYMENT SERVICE] handleWebhookEvent: ${event}`);
  console.log(`[PAYMENT SERVICE] payload keys:`, Object.keys(payload || {}));

  switch (event) {
    case "payment.authorized":
      console.log("[PAYMENT SERVICE] Routing to handlePaymentAuthorized");
      return handlePaymentAuthorized(payload.payment?.entity);

    case "payment.captured":
      console.log("[PAYMENT SERVICE] Routing to handlePaymentCaptured");
      return handlePaymentCaptured(payload.payment?.entity);

    case "payment.failed":
      console.log("[PAYMENT SERVICE] Routing to handlePaymentFailed");
      return handlePaymentFailed(payload.payment?.entity);

    case "refund.created":
      console.log("[PAYMENT SERVICE] Routing to handleRefundCreated");
      return handleRefundCreated(payload.refund?.entity);

    case "refund.processed":
      console.log("[PAYMENT SERVICE] Routing to handleRefundProcessed");
      return handleRefundProcessed(payload.refund?.entity);

    case "refund.failed":
      console.log("[PAYMENT SERVICE] Routing to handleRefundFailed");
      return handleRefundFailed(payload.refund?.entity);

    case "order.paid":
      console.log("[PAYMENT SERVICE] Routing to handleOrderPaid");
      return handleOrderPaid(payload.order?.entity);

    default:
      console.log(`[PAYMENT SERVICE] Unhandled webhook event: ${event}`);
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
  console.log("[WEBHOOK HANDLER] handlePaymentCaptured called");

  if (!payment) {
    console.log("[WEBHOOK HANDLER] ERROR: No payment entity in payload");
    return { handled: false, reason: "No payment entity" };
  }

  console.log("[WEBHOOK HANDLER] Looking for transaction with order_id:", payment.order_id);

  const transaction = await PaymentTransaction.findByRazorpayOrderId(payment.order_id);
  if (!transaction) {
    console.log(`[WEBHOOK HANDLER] ERROR: Transaction not found for order: ${payment.order_id}`);
    console.log("[WEBHOOK HANDLER] This means the Razorpay order was not created by our system");
    return { handled: false, reason: "Transaction not found" };
  }

  console.log("[WEBHOOK HANDLER] Transaction found:");
  console.log("  - _id:", transaction._id);
  console.log("  - purchaseType:", transaction.purchaseType);
  console.log("  - referenceId:", transaction.referenceId);
  console.log("  - current status:", transaction.status);

  await transaction.addWebhookEvent("payment.captured", payment);
  console.log("[WEBHOOK HANDLER] Webhook event recorded in transaction");

  // If not already captured (client verification might have done it)
  if (transaction.status !== "CAPTURED") {
    console.log("[WEBHOOK HANDLER] Transaction not yet CAPTURED, updating...");

    await transaction.markCaptured(payment.id, payment);
    console.log("[WEBHOOK HANDLER] Transaction marked as CAPTURED");

    console.log("[WEBHOOK HANDLER] Calling updatePurchaseEntity...");
    await updatePurchaseEntity(transaction, {
      method: payment.method,
      bank: payment.bank,
      wallet: payment.wallet,
      vpa: payment.vpa,
      card: payment.card,
    });
    console.log("[WEBHOOK HANDLER] updatePurchaseEntity completed");
  } else {
    console.log("[WEBHOOK HANDLER] Transaction already CAPTURED (by verify endpoint), skipping update");
  }

  console.log("[WEBHOOK HANDLER] handlePaymentCaptured completed successfully");
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
