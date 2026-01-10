/**
 * Payment Validation Schemas
 *
 * Joi validation schemas for payment-related API endpoints.
 */

import Joi from "joi";

// Common validations
const objectId = Joi.string().hex().length(24);

/**
 * Initiate payment for an order
 * POST /api/payment/order/:orderId/initiate
 */
export const initiateOrderPayment = {
  params: Joi.object({
    orderId: objectId.required(),
  }),
};

/**
 * Initiate payment for a subscription
 * POST /api/payment/subscription/initiate
 */
export const initiateSubscriptionPayment = {
  body: Joi.object({
    planId: objectId.required(),
  }),
};

/**
 * Verify payment status
 * GET /api/payment/:paymentId/verify
 */
export const verifyPayment = {
  params: Joi.object({
    paymentId: Joi.string().required(),
  }),
};

/**
 * Get payment history
 * GET /api/payment/history
 */
export const getPaymentHistory = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    entityType: Joi.string().valid("ORDER", "SUBSCRIPTION").optional(),
    status: Joi.string()
      .valid("INITIATED", "AUTHORIZED", "COMPLETED", "FAILED", "REFUNDED")
      .optional(),
  }),
};

/**
 * Webhook provider validation
 * POST /api/payment/webhook/:provider
 */
export const webhookProvider = {
  params: Joi.object({
    provider: Joi.string().valid("stripe", "razorpay", "mock").required(),
  }),
};

/**
 * Get transaction details
 * GET /api/payment/transaction/:transactionId
 */
export const getTransaction = {
  params: Joi.object({
    transactionId: objectId.required(),
  }),
};

/**
 * Get transaction by entity
 * GET /api/payment/entity/:entityType/:entityId
 */
export const getTransactionByEntity = {
  params: Joi.object({
    entityType: Joi.string().valid("ORDER", "SUBSCRIPTION").required(),
    entityId: objectId.required(),
  }),
};

/**
 * Admin: List all transactions
 * GET /api/payment/admin/transactions
 */
export const adminListTransactions = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string()
      .valid("INITIATED", "AUTHORIZED", "COMPLETED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED")
      .optional(),
    provider: Joi.string().valid("stripe", "razorpay", "mock").optional(),
    entityType: Joi.string().valid("ORDER", "SUBSCRIPTION", "OTHER").optional(),
    fromDate: Joi.date().iso().optional(),
    toDate: Joi.date().iso().optional(),
  }),
};

/**
 * Refund initiation (admin)
 * POST /api/payment/admin/refund
 */
export const initiateRefund = {
  body: Joi.object({
    paymentId: Joi.string().required(),
    amount: Joi.number().positive().required(),
    reason: Joi.string().max(500).required(),
  }),
};

export default {
  initiateOrderPayment,
  initiateSubscriptionPayment,
  verifyPayment,
  getPaymentHistory,
  webhookProvider,
  getTransaction,
  getTransactionByEntity,
  adminListTransactions,
  initiateRefund,
};
