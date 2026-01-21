/**
 * Razorpay Provider Service
 * Wrapper around Razorpay SDK for payment operations
 */

import crypto from "crypto";
import {
  getRazorpayInstance,
  isRazorpayConfigured,
  getRazorpayWebhookSecret,
} from "../config/razorpay.config.js";

/**
 * Create a Razorpay order
 * @param {Object} params
 * @param {number} params.amount - Amount in rupees (will be converted to paise)
 * @param {string} params.currency - Currency code (default: INR)
 * @param {string} params.receipt - Unique receipt ID
 * @param {Object} params.notes - Additional notes/metadata
 * @returns {Promise<Object>} Razorpay order object
 */
export async function createOrder({ amount, currency = "INR", receipt, notes = {} }) {
  const razorpay = getRazorpayInstance();

  // Convert rupees to paise (Razorpay expects amount in smallest currency unit)
  const amountInPaise = Math.round(amount * 100);

  const options = {
    amount: amountInPaise,
    currency,
    receipt,
    notes,
  };

  try {
    const order = await razorpay.orders.create(options);
    return {
      id: order.id,
      amount: order.amount,
      amountRupees: amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
      createdAt: new Date(order.created_at * 1000),
      notes: order.notes,
    };
  } catch (error) {
    console.log("> Razorpay createOrder error:", error.message);
    throw new Error(`Failed to create Razorpay order: ${error.message}`);
  }
}

/**
 * Verify payment signature (for client callback verification)
 * @param {Object} params
 * @param {string} params.razorpayOrderId - Razorpay order ID
 * @param {string} params.razorpayPaymentId - Razorpay payment ID
 * @param {string} params.razorpaySignature - Signature from client
 * @returns {boolean} Whether signature is valid
 */
export function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const razorpay = getRazorpayInstance();

  const body = razorpayOrderId + "|" + razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "hex"),
    Buffer.from(razorpaySignature, "hex")
  );
}

/**
 * Verify webhook signature
 * @param {string|Buffer} body - Raw request body
 * @param {string} signature - x-razorpay-signature header
 * @returns {boolean} Whether webhook signature is valid
 */
export function verifyWebhookSignature(body, signature) {
  const webhookSecret = getRazorpayWebhookSecret();

  if (!webhookSecret) {
    console.log("> Razorpay: Webhook secret not configured");
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(body)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch (error) {
    console.log("> Razorpay: Webhook signature verification error:", error.message);
    return false;
  }
}

/**
 * Fetch payment details
 * @param {string} paymentId - Razorpay payment ID (pay_xxx)
 * @returns {Promise<Object>} Payment details
 */
export async function fetchPayment(paymentId) {
  const razorpay = getRazorpayInstance();

  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return {
      id: payment.id,
      orderId: payment.order_id,
      amount: payment.amount,
      amountRupees: payment.amount / 100,
      currency: payment.currency,
      status: payment.status,
      method: payment.method,
      bank: payment.bank,
      wallet: payment.wallet,
      vpa: payment.vpa,
      email: payment.email,
      contact: payment.contact,
      card: payment.card
        ? {
            last4: payment.card.last4,
            network: payment.card.network,
            type: payment.card.type,
            issuer: payment.card.issuer,
          }
        : null,
      errorCode: payment.error_code,
      errorDescription: payment.error_description,
      createdAt: new Date(payment.created_at * 1000),
      capturedAt: payment.captured ? new Date() : null,
    };
  } catch (error) {
    console.log("> Razorpay fetchPayment error:", error.message);
    throw new Error(`Failed to fetch payment: ${error.message}`);
  }
}

/**
 * Capture an authorized payment (if not using auto-capture)
 * @param {string} paymentId - Razorpay payment ID
 * @param {number} amount - Amount to capture in rupees
 * @param {string} currency - Currency code
 * @returns {Promise<Object>} Captured payment details
 */
export async function capturePayment(paymentId, amount, currency = "INR") {
  const razorpay = getRazorpayInstance();

  try {
    const payment = await razorpay.payments.capture(
      paymentId,
      Math.round(amount * 100),
      currency
    );
    return {
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      amountRupees: payment.amount / 100,
      captured: payment.captured,
    };
  } catch (error) {
    console.log("> Razorpay capturePayment error:", error.message);
    throw new Error(`Failed to capture payment: ${error.message}`);
  }
}

/**
 * Create a refund
 * @param {Object} params
 * @param {string} params.paymentId - Razorpay payment ID to refund
 * @param {number} params.amount - Amount to refund in rupees (optional, full refund if not specified)
 * @param {Object} params.notes - Additional notes
 * @param {string} params.speed - Refund speed: "normal" or "optimum"
 * @returns {Promise<Object>} Refund details
 */
export async function createRefund({ paymentId, amount, notes = {}, speed = "normal" }) {
  const razorpay = getRazorpayInstance();

  const options = {
    notes,
    speed,
  };

  // If amount specified, it's a partial refund
  if (amount) {
    options.amount = Math.round(amount * 100);
  }

  try {
    const refund = await razorpay.payments.refund(paymentId, options);
    return {
      id: refund.id,
      paymentId: refund.payment_id,
      amount: refund.amount,
      amountRupees: refund.amount / 100,
      currency: refund.currency,
      status: refund.status,
      speed: refund.speed_requested,
      notes: refund.notes,
      createdAt: new Date(refund.created_at * 1000),
    };
  } catch (error) {
    console.log("> Razorpay createRefund error:", error.message);
    throw new Error(`Failed to create refund: ${error.message}`);
  }
}

/**
 * Fetch refund details
 * @param {string} paymentId - Original payment ID
 * @param {string} refundId - Refund ID
 * @returns {Promise<Object>} Refund details
 */
export async function fetchRefund(paymentId, refundId) {
  const razorpay = getRazorpayInstance();

  try {
    const refund = await razorpay.payments.fetchRefund(paymentId, refundId);
    return {
      id: refund.id,
      paymentId: refund.payment_id,
      amount: refund.amount,
      amountRupees: refund.amount / 100,
      currency: refund.currency,
      status: refund.status,
      speed: refund.speed_requested,
      speedProcessed: refund.speed_processed,
      notes: refund.notes,
      createdAt: new Date(refund.created_at * 1000),
    };
  } catch (error) {
    console.log("> Razorpay fetchRefund error:", error.message);
    throw new Error(`Failed to fetch refund: ${error.message}`);
  }
}

/**
 * Fetch order details
 * @param {string} orderId - Razorpay order ID
 * @returns {Promise<Object>} Order details
 */
export async function fetchOrder(orderId) {
  const razorpay = getRazorpayInstance();

  try {
    const order = await razorpay.orders.fetch(orderId);
    return {
      id: order.id,
      amount: order.amount,
      amountRupees: order.amount / 100,
      amountPaid: order.amount_paid,
      amountPaidRupees: order.amount_paid / 100,
      amountDue: order.amount_due,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
      attempts: order.attempts,
      notes: order.notes,
      createdAt: new Date(order.created_at * 1000),
    };
  } catch (error) {
    console.log("> Razorpay fetchOrder error:", error.message);
    throw new Error(`Failed to fetch order: ${error.message}`);
  }
}

/**
 * Fetch payments for an order
 * @param {string} orderId - Razorpay order ID
 * @returns {Promise<Array>} List of payments
 */
export async function fetchOrderPayments(orderId) {
  const razorpay = getRazorpayInstance();

  try {
    const response = await razorpay.orders.fetchPayments(orderId);
    return response.items.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      amountRupees: payment.amount / 100,
      status: payment.status,
      method: payment.method,
      createdAt: new Date(payment.created_at * 1000),
    }));
  } catch (error) {
    console.log("> Razorpay fetchOrderPayments error:", error.message);
    throw new Error(`Failed to fetch order payments: ${error.message}`);
  }
}

/**
 * Map Razorpay payment method to internal payment method
 * @param {string} razorpayMethod - Razorpay method string
 * @returns {string} Internal payment method enum
 */
export function mapPaymentMethod(razorpayMethod) {
  const methodMap = {
    card: "CARD",
    upi: "UPI",
    netbanking: "NETBANKING",
    wallet: "WALLET",
    emi: "CARD",
    bank_transfer: "NETBANKING",
    paylater: "WALLET",
  };

  return methodMap[razorpayMethod] || "OTHER";
}

/**
 * Check if Razorpay is available
 * @returns {boolean}
 */
export function isAvailable() {
  return isRazorpayConfigured();
}

export default {
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPayment,
  capturePayment,
  createRefund,
  fetchRefund,
  fetchOrder,
  fetchOrderPayments,
  mapPaymentMethod,
  isAvailable,
};
