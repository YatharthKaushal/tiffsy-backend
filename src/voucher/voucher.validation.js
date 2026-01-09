import Joi from "joi";

/**
 * Voucher Validation Schemas
 */

const VOUCHER_STATUSES = [
  "AVAILABLE",
  "REDEEMED",
  "EXPIRED",
  "RESTORED",
  "CANCELLED",
];
const MEAL_WINDOWS = ["LUNCH", "DINNER"];

/**
 * Check voucher eligibility
 */
export const checkEligibilitySchema = Joi.object({
  kitchenId: Joi.string().hex().length(24).required().messages({
    "any.required": "Kitchen ID is required",
  }),
  menuType: Joi.string().valid("MEAL_MENU").required().messages({
    "any.required": "Menu type is required",
    "any.only": "Vouchers can only be used for MEAL_MENU",
  }),
  mealWindow: Joi.string()
    .valid(...MEAL_WINDOWS)
    .required()
    .messages({
      "any.required": "Meal window is required",
    }),
  mainCourseQuantity: Joi.number().integer().min(1).max(10).default(1),
});

/**
 * Redeem vouchers (internal)
 */
export const redeemVouchersSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  orderId: Joi.string().hex().length(24).required(),
  kitchenId: Joi.string().hex().length(24).required(),
  mealWindow: Joi.string()
    .valid(...MEAL_WINDOWS)
    .required(),
  voucherCount: Joi.number().integer().min(1).max(10).required(),
});

/**
 * Restore vouchers (internal)
 */
export const restoreVouchersSchema = Joi.object({
  orderId: Joi.string().hex().length(24).required(),
  reason: Joi.string()
    .valid("ORDER_CANCELLED", "ORDER_REJECTED")
    .required(),
});

/**
 * Admin restore vouchers
 */
export const adminRestoreSchema = Joi.object({
  voucherIds: Joi.array().items(Joi.string().hex().length(24)),
  orderId: Joi.string().hex().length(24),
  reason: Joi.string().min(5).max(500).trim().required().messages({
    "any.required": "Reason is required",
  }),
}).or("voucherIds", "orderId");

/**
 * Update cutoff times
 */
export const updateCutoffTimesSchema = Joi.object({
  lunch: Joi.object({
    cutoffTime: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .required()
      .messages({
        "string.pattern.base": "Time must be in HH:mm format",
      }),
  }),
  dinner: Joi.object({
    cutoffTime: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .required()
      .messages({
        "string.pattern.base": "Time must be in HH:mm format",
      }),
  }),
});

/**
 * Query vouchers
 */
export const queryVouchersSchema = Joi.object({
  status: Joi.string().valid(...VOUCHER_STATUSES),
  subscriptionId: Joi.string().hex().length(24),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

/**
 * Admin query vouchers
 */
export const adminQueryVouchersSchema = Joi.object({
  userId: Joi.string().hex().length(24),
  subscriptionId: Joi.string().hex().length(24),
  status: Joi.string().valid(...VOUCHER_STATUSES),
  dateFrom: Joi.date(),
  dateTo: Joi.date(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

export default {
  checkEligibilitySchema,
  redeemVouchersSchema,
  restoreVouchersSchema,
  adminRestoreSchema,
  updateCutoffTimesSchema,
  queryVouchersSchema,
  adminQueryVouchersSchema,
};
