/**
 * Payment Constants
 *
 * Centralized constants for payment-related enums and statuses.
 * Used across payment service, controllers, and schemas.
 */

/**
 * Payment providers supported by the system
 */
export const PAYMENT_PROVIDERS = {
  STRIPE: "stripe",
  RAZORPAY: "razorpay",
  MOCK: "mock",
};

/**
 * Purchase types for categorizing transactions
 */
export const PURCHASE_TYPES = {
  ORDER: "ORDER",
  SUBSCRIPTION: "SUBSCRIPTION",
  OTHER: "OTHER",
};

/**
 * Payment transaction status
 */
export const TRANSACTION_STATUS = {
  INITIATED: "INITIATED",
  AUTHORIZED: "AUTHORIZED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
};

/**
 * Gateway-normalized payment status
 */
export const PAYMENT_STATUS = {
  CREATED: "created",
  AUTHORIZED: "authorized",
  CAPTURED: "captured",
  FAILED: "failed",
  REFUNDED: "refunded",
};

/**
 * Refund status
 */
export const REFUND_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  PROCESSED: "PROCESSED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
};

/**
 * Payment methods
 */
export const PAYMENT_METHODS = {
  UPI: "UPI",
  CARD: "CARD",
  WALLET: "WALLET",
  NETBANKING: "NETBANKING",
  VOUCHER_ONLY: "VOUCHER_ONLY",
  OTHER: "OTHER",
};

/**
 * Normalized webhook event types (common across providers)
 */
export const WEBHOOK_EVENTS = {
  // Payment events
  PAYMENT_SUCCESS: "payment.success",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_AUTHORIZED: "payment.authorized",

  // Refund events
  REFUND_SUCCESS: "refund.success",
  REFUND_FAILED: "refund.failed",
  REFUND_PENDING: "refund.pending",

  // Order events (provider-specific)
  ORDER_PAID: "order.paid",
};

/**
 * Stripe event type mappings to normalized events
 */
export const STRIPE_EVENT_MAP = {
  "payment_intent.succeeded": WEBHOOK_EVENTS.PAYMENT_SUCCESS,
  "payment_intent.payment_failed": WEBHOOK_EVENTS.PAYMENT_FAILED,
  "payment_intent.requires_action": WEBHOOK_EVENTS.PAYMENT_AUTHORIZED,
  "payment_intent.canceled": WEBHOOK_EVENTS.PAYMENT_FAILED,
  "charge.refunded": WEBHOOK_EVENTS.REFUND_SUCCESS,
  "refund.created": WEBHOOK_EVENTS.REFUND_PENDING,
  "refund.updated": WEBHOOK_EVENTS.REFUND_SUCCESS,
  "refund.failed": WEBHOOK_EVENTS.REFUND_FAILED,
};

/**
 * Razorpay event type mappings to normalized events
 */
export const RAZORPAY_EVENT_MAP = {
  "payment.captured": WEBHOOK_EVENTS.PAYMENT_SUCCESS,
  "payment.failed": WEBHOOK_EVENTS.PAYMENT_FAILED,
  "payment.authorized": WEBHOOK_EVENTS.PAYMENT_AUTHORIZED,
  "order.paid": WEBHOOK_EVENTS.ORDER_PAID,
  "refund.processed": WEBHOOK_EVENTS.REFUND_SUCCESS,
  "refund.failed": WEBHOOK_EVENTS.REFUND_FAILED,
  "refund.created": WEBHOOK_EVENTS.REFUND_PENDING,
};

/**
 * Stripe payment status to normalized status
 */
export const STRIPE_STATUS_MAP = {
  requires_payment_method: PAYMENT_STATUS.CREATED,
  requires_confirmation: PAYMENT_STATUS.CREATED,
  requires_action: PAYMENT_STATUS.AUTHORIZED,
  processing: PAYMENT_STATUS.AUTHORIZED,
  succeeded: PAYMENT_STATUS.CAPTURED,
  canceled: PAYMENT_STATUS.FAILED,
};

/**
 * Razorpay payment status to normalized status
 */
export const RAZORPAY_STATUS_MAP = {
  created: PAYMENT_STATUS.CREATED,
  authorized: PAYMENT_STATUS.AUTHORIZED,
  captured: PAYMENT_STATUS.CAPTURED,
  refunded: PAYMENT_STATUS.REFUNDED,
  failed: PAYMENT_STATUS.FAILED,
};

/**
 * Stripe payment method type to normalized method
 */
export const STRIPE_METHOD_MAP = {
  card: PAYMENT_METHODS.CARD,
  upi: PAYMENT_METHODS.UPI,
};

/**
 * Razorpay payment method type to normalized method
 */
export const RAZORPAY_METHOD_MAP = {
  upi: PAYMENT_METHODS.UPI,
  card: PAYMENT_METHODS.CARD,
  wallet: PAYMENT_METHODS.WALLET,
  netbanking: PAYMENT_METHODS.NETBANKING,
};

/**
 * Currency constants
 */
export const CURRENCIES = {
  INR: "INR",
  USD: "USD",
};

/**
 * Default currency
 */
export const DEFAULT_CURRENCY = CURRENCIES.INR;

export default {
  PAYMENT_PROVIDERS,
  PURCHASE_TYPES,
  TRANSACTION_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
  PAYMENT_METHODS,
  WEBHOOK_EVENTS,
  STRIPE_EVENT_MAP,
  RAZORPAY_EVENT_MAP,
  STRIPE_STATUS_MAP,
  RAZORPAY_STATUS_MAP,
  STRIPE_METHOD_MAP,
  RAZORPAY_METHOD_MAP,
  CURRENCIES,
  DEFAULT_CURRENCY,
};
