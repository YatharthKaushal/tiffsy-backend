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

/**
 * Trigger auto orders (for cron/scheduler)
 */
export const triggerAutoOrdersSchema = Joi.object({
  // Empty schema - validates that body exists but doesn't require specific fields
  // Auth is handled by CRON_SECRET header validation in the controller
}).unknown(true);

/**
 * Update auto-order settings
 */
export const updateAutoOrderSettingsSchema = Joi.object({
  autoOrderingEnabled: Joi.boolean(),
  defaultMealType: Joi.string().valid("LUNCH", "DINNER", "BOTH"),
  defaultKitchenId: Joi.string().hex().length(24).allow(null),
  defaultAddressId: Joi.string().hex().length(24).allow(null),
}).min(1);

/**
 * Pause subscription
 */
export const pauseSubscriptionSchema = Joi.object({
  pauseReason: Joi.string().max(500).trim().allow("", null),
  pauseUntil: Joi.date().greater("now").allow(null),
});

/**
 * Skip meal
 */
export const skipMealSchema = Joi.object({
  date: Joi.date().required().messages({
    "any.required": "Date is required",
  }),
  mealWindow: Joi.string()
    .valid("LUNCH", "DINNER")
    .required()
    .messages({
      "any.required": "Meal window is required",
    }),
  reason: Joi.string().max(200).trim().allow("", null),
});

/**
 * Unskip meal (remove from skipped slots)
 */
export const unskipMealSchema = Joi.object({
  date: Joi.date().required().messages({
    "any.required": "Date is required",
  }),
  mealWindow: Joi.string()
    .valid("LUNCH", "DINNER")
    .required()
    .messages({
      "any.required": "Meal window is required",
    }),
});

/**
 * Cron trigger (for dedicated lunch/dinner endpoints)
 */
export const cronTriggerSchema = Joi.object({
  dryRun: Joi.boolean().default(false),
});

/**
 * Query auto-order logs
 */
export const queryAutoOrderLogsSchema = Joi.object({
  subscriptionId: Joi.string().hex().length(24),
  userId: Joi.string().hex().length(24),
  status: Joi.string().valid("SUCCESS", "SKIPPED", "FAILED"),
  mealWindow: Joi.string().valid("LUNCH", "DINNER"),
  failureCategory: Joi.string().valid(
    "NO_VOUCHERS",
    "NO_ADDRESS",
    "NO_ZONE",
    "NO_KITCHEN",
    "KITCHEN_NOT_SERVING_ZONE",
    "NO_MENU_ITEM",
    "VOUCHER_REDEMPTION_FAILED",
    "ORDER_CREATION_FAILED",
    "SUBSCRIPTION_PAUSED",
    "SLOT_SKIPPED",
    "SUBSCRIPTION_EXPIRED",
    "UNKNOWN"
  ),
  cronRunId: Joi.string().max(100),
  dateFrom: Joi.date(),
  dateTo: Joi.date(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

/**
 * Query failure summary
 */
export const queryFailureSummarySchema = Joi.object({
  dateFrom: Joi.date(),
  dateTo: Joi.date(),
});

export default {
  createPlanSchema,
  updatePlanSchema,
  purchaseSubscriptionSchema,
  cancelSubscriptionSchema,
  adminCancelSubscriptionSchema,
  queryPlansSchema,
  querySubscriptionsSchema,
  triggerAutoOrdersSchema,
  updateAutoOrderSettingsSchema,
  pauseSubscriptionSchema,
  skipMealSchema,
  unskipMealSchema,
  cronTriggerSchema,
  queryAutoOrderLogsSchema,
  queryFailureSummarySchema,
};
