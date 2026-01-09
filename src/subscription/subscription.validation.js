import Joi from "joi";

/**
 * Subscription Validation Schemas
 */

const DURATION_DAYS = [7, 14, 30, 60];
const MEAL_TYPES = ["LUNCH", "DINNER", "BOTH"];

/**
 * Create subscription plan
 */
export const createPlanSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().required().messages({
    "any.required": "Plan name is required",
  }),
  description: Joi.string().max(500).trim().allow("", null),
  durationDays: Joi.number()
    .valid(...DURATION_DAYS)
    .required()
    .messages({
      "any.required": "Duration is required",
      "any.only": "Duration must be 7, 14, 30, or 60 days",
    }),
  vouchersPerDay: Joi.number().integer().min(1).max(4).default(2),
  voucherValidityDays: Joi.number().integer().min(30).max(365).default(90),
  price: Joi.number().min(0).required().messages({
    "any.required": "Price is required",
  }),
  originalPrice: Joi.number().min(0).allow(null),
  coverageRules: Joi.object({
    includesAddons: Joi.boolean().default(false),
    addonValuePerVoucher: Joi.number().min(0).allow(null),
    mealTypes: Joi.array()
      .items(Joi.string().valid(...MEAL_TYPES))
      .default(["BOTH"]),
  }),
  applicableZoneIds: Joi.array().items(Joi.string().hex().length(24)),
  displayOrder: Joi.number().integer().min(0).default(0),
  badge: Joi.string().max(50).trim().allow("", null),
  features: Joi.array().items(Joi.string().max(100).trim()).max(10),
  status: Joi.string().valid("ACTIVE", "INACTIVE").default("INACTIVE"),
  validFrom: Joi.date().allow(null),
  validTill: Joi.date().greater(Joi.ref("validFrom")).allow(null),
});

/**
 * Update subscription plan
 */
export const updatePlanSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim(),
  description: Joi.string().max(500).trim().allow("", null),
  price: Joi.number().min(0),
  originalPrice: Joi.number().min(0).allow(null),
  coverageRules: Joi.object({
    includesAddons: Joi.boolean(),
    addonValuePerVoucher: Joi.number().min(0).allow(null),
    mealTypes: Joi.array().items(Joi.string().valid(...MEAL_TYPES)),
  }),
  applicableZoneIds: Joi.array().items(Joi.string().hex().length(24)),
  displayOrder: Joi.number().integer().min(0),
  badge: Joi.string().max(50).trim().allow("", null),
  features: Joi.array().items(Joi.string().max(100).trim()).max(10),
  validFrom: Joi.date().allow(null),
  validTill: Joi.date().allow(null),
});

/**
 * Purchase subscription
 */
export const purchaseSubscriptionSchema = Joi.object({
  planId: Joi.string().hex().length(24).required().messages({
    "any.required": "Plan ID is required",
  }),
  paymentId: Joi.string().max(100).trim().allow("", null),
  paymentMethod: Joi.string().max(50).trim().allow("", null),
});

/**
 * Cancel subscription
 */
export const cancelSubscriptionSchema = Joi.object({
  reason: Joi.string().max(500).trim().allow("", null),
});

/**
 * Admin cancel subscription
 */
export const adminCancelSubscriptionSchema = Joi.object({
  reason: Joi.string().min(5).max(500).trim().required().messages({
    "any.required": "Cancellation reason is required",
  }),
  issueRefund: Joi.boolean().default(true),
  refundAmount: Joi.number().min(0).allow(null),
});

/**
 * Query plans
 */
export const queryPlansSchema = Joi.object({
  status: Joi.string().valid("ACTIVE", "INACTIVE", "ARCHIVED"),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

/**
 * Query subscriptions
 */
export const querySubscriptionsSchema = Joi.object({
  userId: Joi.string().hex().length(24),
  planId: Joi.string().hex().length(24),
  status: Joi.string().valid("ACTIVE", "EXPIRED", "CANCELLED"),
  dateFrom: Joi.date(),
  dateTo: Joi.date(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export default {
  createPlanSchema,
  updatePlanSchema,
  purchaseSubscriptionSchema,
  cancelSubscriptionSchema,
  adminCancelSubscriptionSchema,
  queryPlansSchema,
  querySubscriptionsSchema,
};
