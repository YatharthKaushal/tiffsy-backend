import Joi from "joi";

/**
 * Validation schemas for payment endpoints
 */

// Create payment order for an existing order
export const createOrderPaymentSchema = Joi.object({
  orderId: Joi.string().hex().length(24).required().messages({
    "string.hex": "Invalid order ID format",
    "string.length": "Invalid order ID format",
    "any.required": "Order ID is required",
  }),
});

// Create payment order for subscription purchase
export const createSubscriptionPaymentSchema = Joi.object({
  planId: Joi.string().hex().length(24).required().messages({
    "string.hex": "Invalid plan ID format",
    "string.length": "Invalid plan ID format",
    "any.required": "Plan ID is required",
  }),
});

// Verify payment (client callback)
export const verifyPaymentSchema = Joi.object({
  razorpayOrderId: Joi.string().required().messages({
    "any.required": "Razorpay order ID is required",
  }),
  razorpayPaymentId: Joi.string().required().messages({
    "any.required": "Razorpay payment ID is required",
  }),
  razorpaySignature: Joi.string().required().messages({
    "any.required": "Razorpay signature is required",
  }),
});

// Get payment status
export const getPaymentStatusSchema = Joi.object({
  razorpayOrderId: Joi.string().required().messages({
    "any.required": "Razorpay order ID is required",
  }),
});

// Retry payment
export const retryPaymentSchema = Joi.object({
  orderId: Joi.string().hex().length(24).required().messages({
    "string.hex": "Invalid order ID format",
    "string.length": "Invalid order ID format",
    "any.required": "Order ID is required",
  }),
});

// Query payment history
export const queryPaymentHistorySchema = Joi.object({
  status: Joi.string()
    .valid("CREATED", "CAPTURED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED", "EXPIRED")
    .optional(),
  purchaseType: Joi.string().valid("ORDER", "SUBSCRIPTION").optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  skip: Joi.number().integer().min(0).default(0),
});

// Admin query transactions
export const adminQueryTransactionsSchema = Joi.object({
  status: Joi.string()
    .valid("CREATED", "CAPTURED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED", "EXPIRED")
    .optional(),
  purchaseType: Joi.string().valid("ORDER", "SUBSCRIPTION", "WALLET_RECHARGE").optional(),
  userId: Joi.string().hex().length(24).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  limit: Joi.number().integer().min(1).max(100).default(50),
  skip: Joi.number().integer().min(0).default(0),
});

// Admin initiate refund
export const adminInitiateRefundSchema = Joi.object({
  paymentId: Joi.string().required().messages({
    "any.required": "Payment ID is required",
  }),
  amount: Joi.number().positive().required().messages({
    "number.positive": "Amount must be positive",
    "any.required": "Amount is required",
  }),
  reason: Joi.string().max(500).required().messages({
    "string.max": "Reason cannot exceed 500 characters",
    "any.required": "Reason is required",
  }),
  speed: Joi.string().valid("normal", "optimum").default("normal"),
});

export default {
  createOrderPaymentSchema,
  createSubscriptionPaymentSchema,
  verifyPaymentSchema,
  getPaymentStatusSchema,
  retryPaymentSchema,
  queryPaymentHistorySchema,
  adminQueryTransactionsSchema,
  adminInitiateRefundSchema,
};
