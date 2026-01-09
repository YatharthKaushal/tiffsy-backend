import Joi from "joi";

/**
 * Coupon Validation Schemas
 */

const DISCOUNT_TYPES = ["PERCENTAGE", "FLAT", "FREE_DELIVERY"];
const TARGET_USER_TYPES = ["ALL", "NEW_USERS", "EXISTING_USERS", "SPECIFIC_USERS"];

/**
 * Create coupon (Admin)
 */
export const createCouponSchema = Joi.object({
  code: Joi.string()
    .pattern(/^[A-Z0-9]+$/)
    .min(3)
    .max(20)
    .required()
    .messages({
      "any.required": "Coupon code is required",
      "string.pattern.base": "Coupon code must be alphanumeric uppercase",
    }),
  name: Joi.string().min(2).max(100).trim().required().messages({
    "any.required": "Coupon name is required",
  }),
  description: Joi.string().max(500).trim().allow("", null),
  discountType: Joi.string()
    .valid(...DISCOUNT_TYPES)
    .required()
    .messages({
      "any.required": "Discount type is required",
      "any.only": "Discount type must be PERCENTAGE, FLAT, or FREE_DELIVERY",
    }),
  discountValue: Joi.number()
    .min(0)
    .required()
    .when("discountType", {
      is: "PERCENTAGE",
      then: Joi.number().max(100).messages({
        "number.max": "Percentage discount cannot exceed 100%",
      }),
    })
    .messages({
      "any.required": "Discount value is required",
    }),
  maxDiscountAmount: Joi.number().min(0).allow(null),
  minOrderValue: Joi.number().min(0).default(0),
  minItems: Joi.number().integer().min(0).default(0),
  applicableKitchenIds: Joi.array().items(Joi.string().hex().length(24)),
  applicableZoneIds: Joi.array().items(Joi.string().hex().length(24)),
  excludedKitchenIds: Joi.array().items(Joi.string().hex().length(24)),
  totalUsageLimit: Joi.number().integer().min(1).allow(null),
  perUserLimit: Joi.number().integer().min(1).default(1),
  targetUserType: Joi.string()
    .valid(...TARGET_USER_TYPES)
    .default("ALL"),
  specificUserIds: Joi.array()
    .items(Joi.string().hex().length(24))
    .when("targetUserType", {
      is: "SPECIFIC_USERS",
      then: Joi.array().min(1).required().messages({
        "array.min": "At least one user ID is required for SPECIFIC_USERS target",
      }),
    }),
  isFirstOrderOnly: Joi.boolean().default(false),
  validFrom: Joi.date().required().messages({
    "any.required": "Valid from date is required",
  }),
  validTill: Joi.date().greater(Joi.ref("validFrom")).required().messages({
    "any.required": "Valid till date is required",
    "date.greater": "Valid till must be after valid from",
  }),
  status: Joi.string().valid("ACTIVE", "INACTIVE").default("INACTIVE"),
  isVisible: Joi.boolean().default(true),
  displayOrder: Joi.number().integer().min(0).default(0),
  bannerImage: Joi.string().uri().allow("", null),
  termsAndConditions: Joi.string().max(2000).trim().allow("", null),
});

/**
 * Update coupon (Admin)
 */
export const updateCouponSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim(),
  description: Joi.string().max(500).trim().allow("", null),
  discountValue: Joi.number().min(0),
  maxDiscountAmount: Joi.number().min(0).allow(null),
  minOrderValue: Joi.number().min(0),
  minItems: Joi.number().integer().min(0),
  applicableKitchenIds: Joi.array().items(Joi.string().hex().length(24)),
  applicableZoneIds: Joi.array().items(Joi.string().hex().length(24)),
  excludedKitchenIds: Joi.array().items(Joi.string().hex().length(24)),
  totalUsageLimit: Joi.number().integer().min(1).allow(null),
  perUserLimit: Joi.number().integer().min(1),
  targetUserType: Joi.string().valid(...TARGET_USER_TYPES),
  specificUserIds: Joi.array().items(Joi.string().hex().length(24)),
  isFirstOrderOnly: Joi.boolean(),
  validFrom: Joi.date(),
  validTill: Joi.date(),
  isVisible: Joi.boolean(),
  displayOrder: Joi.number().integer().min(0),
  bannerImage: Joi.string().uri().allow("", null),
  termsAndConditions: Joi.string().max(2000).trim().allow("", null),
});

/**
 * Validate coupon
 */
export const validateCouponSchema = Joi.object({
  code: Joi.string().max(20).trim().required().messages({
    "any.required": "Coupon code is required",
  }),
  kitchenId: Joi.string().hex().length(24).required().messages({
    "any.required": "Kitchen ID is required",
  }),
  zoneId: Joi.string().hex().length(24).required().messages({
    "any.required": "Zone ID is required",
  }),
  orderValue: Joi.number().min(0).required().messages({
    "any.required": "Order value is required",
  }),
  itemCount: Joi.number().integer().min(1).required().messages({
    "any.required": "Item count is required",
  }),
  menuType: Joi.string().valid("ON_DEMAND_MENU").required().messages({
    "any.required": "Menu type is required",
    "any.only": "Coupons are only valid for ON_DEMAND_MENU",
  }),
});

/**
 * Apply coupon (Internal)
 */
export const applyCouponSchema = Joi.object({
  code: Joi.string().max(20).trim().required(),
  userId: Joi.string().hex().length(24).required(),
  orderId: Joi.string().hex().length(24).required(),
  orderValue: Joi.number().min(0).required(),
});

/**
 * Query available coupons
 */
export const queryAvailableCouponsSchema = Joi.object({
  kitchenId: Joi.string().hex().length(24),
  zoneId: Joi.string().hex().length(24),
  orderValue: Joi.number().min(0),
});

/**
 * Query coupons (Admin)
 */
export const queryCouponsSchema = Joi.object({
  status: Joi.string().valid("ACTIVE", "INACTIVE", "EXPIRED", "EXHAUSTED"),
  discountType: Joi.string().valid(...DISCOUNT_TYPES),
  search: Joi.string().max(50).trim(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export default {
  createCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
  applyCouponSchema,
  queryAvailableCouponsSchema,
  queryCouponsSchema,
};
