import Joi from "joi";

/**
 * Refund Validation Schemas
 */

const REFUND_REASONS = [
  "ORDER_REJECTED",
  "ORDER_CANCELLED_BY_KITCHEN",
  "ORDER_CANCELLED_BY_CUSTOMER",
  "DELIVERY_FAILED",
  "QUALITY_ISSUE",
  "WRONG_ORDER",
  "ADMIN_INITIATED",
  "OTHER",
];
const REFUND_STATUSES = [
  "INITIATED",
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

/**
 * Initiate refund (internal)
 */
export const initiateRefundSchema = Joi.object({
  orderId: Joi.string().hex().length(24).required().messages({
    "any.required": "Order ID is required",
  }),
  reason: Joi.string()
    .valid(...REFUND_REASONS)
    .required()
    .messages({
      "any.required": "Reason is required",
    }),
  reasonDetails: Joi.string().max(500).trim().allow("", null),
  refundType: Joi.string().valid("FULL", "PARTIAL").default("FULL"),
  amount: Joi.number()
    .min(0)
    .when("refundType", {
      is: "PARTIAL",
      then: Joi.required().messages({
        "any.required": "Amount is required for partial refund",
      }),
    }),
});

/**
 * Manual refund (admin)
 */
export const manualRefundSchema = Joi.object({
  orderId: Joi.string().hex().length(24).required().messages({
    "any.required": "Order ID is required",
  }),
  amount: Joi.number().min(0.01).required().messages({
    "any.required": "Refund amount is required",
    "number.min": "Refund amount must be greater than 0",
  }),
  reason: Joi.string()
    .valid("ADMIN_INITIATED", "QUALITY_ISSUE", "WRONG_ORDER", "OTHER")
    .required()
    .messages({
      "any.required": "Reason is required",
    }),
  reasonDetails: Joi.string().min(5).max(500).trim().required().messages({
    "any.required": "Reason details are required",
    "string.min": "Reason details must be at least 5 characters",
  }),
  notes: Joi.string().max(500).trim().allow("", null),
});

/**
 * Cancel refund (admin)
 */
export const cancelRefundSchema = Joi.object({
  reason: Joi.string().min(5).max(500).trim().required().messages({
    "any.required": "Cancellation reason is required",
  }),
});

/**
 * Query my refunds
 */
export const queryMyRefundsSchema = Joi.object({
  status: Joi.string().valid(...REFUND_STATUSES),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

/**
 * Query all refunds (admin)
 */
export const queryAllRefundsSchema = Joi.object({
  userId: Joi.string().hex().length(24),
  orderId: Joi.string().hex().length(24),
  status: Joi.string().valid(...REFUND_STATUSES),
  reason: Joi.string().valid(...REFUND_REASONS),
  dateFrom: Joi.date(),
  dateTo: Joi.date(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

/**
 * Query refund stats
 */
export const queryRefundStatsSchema = Joi.object({
  dateFrom: Joi.date(),
  dateTo: Joi.date(),
});

export default {
  initiateRefundSchema,
  manualRefundSchema,
  cancelRefundSchema,
  queryMyRefundsSchema,
  queryAllRefundsSchema,
  queryRefundStatsSchema,
};
