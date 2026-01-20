import Joi from "joi";

/**
 * Order Validation Schemas
 */

const MENU_TYPES = ["MEAL_MENU", "ON_DEMAND_MENU"];
const MEAL_WINDOWS = ["LUNCH", "DINNER"];
const ORDER_STATUSES = [
  "PLACED",
  "ACCEPTED",
  "REJECTED",
  "PREPARING",
  "READY",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "FAILED",
];

/**
 * Order item schema
 */
const orderItemSchema = Joi.object({
  menuItemId: Joi.string().hex().length(24).required().messages({
    "any.required": "Menu item ID is required",
  }),
  quantity: Joi.number().integer().min(1).max(10).required().messages({
    "any.required": "Quantity is required",
    "number.min": "Quantity must be at least 1",
    "number.max": "Quantity cannot exceed 10",
  }),
  addons: Joi.array().items(
    Joi.object({
      addonId: Joi.string().hex().length(24).required(),
      quantity: Joi.number().integer().min(1).max(10).default(1),
    })
  ),
});

/**
 * Create order
 */
export const createOrderSchema = Joi.object({
  kitchenId: Joi.string().hex().length(24).required().messages({
    "any.required": "Kitchen ID is required",
  }),
  menuType: Joi.string()
    .valid(...MENU_TYPES)
    .required()
    .messages({
      "any.required": "Menu type is required",
      "any.only": "Menu type must be MEAL_MENU or ON_DEMAND_MENU",
    }),
  mealWindow: Joi.string()
    .valid(...MEAL_WINDOWS)
    .when("menuType", {
      is: "MEAL_MENU",
      then: Joi.required().messages({
        "any.required": "Meal window is required for MEAL_MENU",
      }),
      otherwise: Joi.forbidden(),
    }),
  deliveryAddressId: Joi.string().hex().length(24).required().messages({
    "any.required": "Delivery address ID is required",
  }),
  items: Joi.array().items(orderItemSchema).min(1).required().messages({
    "any.required": "Order items are required",
    "array.min": "At least one item is required",
  }),
  voucherCount: Joi.number()
    .integer()
    .min(0)
    .max(10)
    .default(0)
    .when("menuType", {
      is: "ON_DEMAND_MENU",
      then: Joi.valid(0).messages({
        "any.only": "Vouchers cannot be used for On-Demand Menu orders",
      }),
    }),
  couponCode: Joi.string()
    .max(20)
    .trim()
    .allow("", null)
    .when("menuType", {
      is: "MEAL_MENU",
      then: Joi.valid("", null).messages({
        "any.only": "Coupons cannot be used for Meal Menu orders",
      }),
    }),
  specialInstructions: Joi.string().max(500).trim().allow("", null),
  deliveryNotes: Joi.string().max(200).trim().allow("", null),
  paymentMethod: Joi.string()
    .valid("UPI", "CARD", "WALLET", "NETBANKING", "VOUCHER_ONLY", "OTHER")
    .allow("", null),
});

/**
 * Calculate order pricing (cart preview)
 */
export const calculatePricingSchema = Joi.object({
  kitchenId: Joi.string().hex().length(24).required(),
  menuType: Joi.string()
    .valid(...MENU_TYPES)
    .required(),
  mealWindow: Joi.string()
    .valid(...MEAL_WINDOWS)
    .when("menuType", {
      is: "MEAL_MENU",
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
  items: Joi.array().items(orderItemSchema).min(1).required(),
  voucherCount: Joi.number().integer().min(0).max(10).default(0),
  couponCode: Joi.string().max(20).trim().allow("", null),
  deliveryAddressId: Joi.string().hex().length(24).required(),
});

/**
 * Query my orders
 */
export const queryMyOrdersSchema = Joi.object({
  status: Joi.string().valid(...ORDER_STATUSES),
  menuType: Joi.string().valid(...MENU_TYPES),
  dateFrom: Joi.date(),
  dateTo: Joi.date(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

/**
 * Query kitchen orders
 */
export const queryKitchenOrdersSchema = Joi.object({
  status: Joi.string().valid(...ORDER_STATUSES),
  mealWindow: Joi.string().valid(...MEAL_WINDOWS),
  date: Joi.date(), // Optional - if not provided, returns all orders
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

/**
 * Accept order
 */
export const acceptOrderSchema = Joi.object({
  estimatedPrepTime: Joi.number().integer().min(5).max(120),
});

/**
 * Reject order
 */
export const rejectOrderSchema = Joi.object({
  reason: Joi.string().min(5).max(500).trim().required().messages({
    "any.required": "Rejection reason is required",
    "string.min": "Reason must be at least 5 characters",
  }),
});

/**
 * Cancel order
 */
export const cancelOrderSchema = Joi.object({
  reason: Joi.string().min(5).max(500).trim().required().messages({
    "any.required": "Cancellation reason is required",
    "string.min": "Reason must be at least 5 characters",
  }),
});

/**
 * Update order status (kitchen)
 */
export const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid("PREPARING", "READY").required().messages({
    "any.required": "Status is required",
    "any.only": "Status must be PREPARING or READY",
  }),
  notes: Joi.string().max(200).trim().allow("", null),
});

/**
 * Update delivery status (driver)
 */
export const updateDeliveryStatusSchema = Joi.object({
  status: Joi.string()
    .valid("PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED")
    .required()
    .messages({
      "any.required": "Status is required",
    }),
  notes: Joi.string().max(200).trim().allow("", null),
  proofOfDelivery: Joi.object({
    type: Joi.string().valid("OTP", "SIGNATURE", "PHOTO").required(),
    value: Joi.string().max(500).required(),
  }).when("status", {
    is: "DELIVERED",
    then: Joi.required().messages({
      "any.required": "Proof of delivery is required for DELIVERED status",
    }),
    otherwise: Joi.optional(),
  }),
});

/**
 * Admin update order status (allows all statuses)
 */
export const adminUpdateStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...ORDER_STATUSES)
    .required()
    .messages({
      "any.required": "Status is required",
      "any.only": `Status must be one of: ${ORDER_STATUSES.join(", ")}`,
    }),
  notes: Joi.string().max(500).trim().allow("", null),
  reason: Joi.string().max(500).trim().allow("", null),
});

/**
 * Admin cancel order
 */
export const adminCancelOrderSchema = Joi.object({
  reason: Joi.string().min(10).max(500).trim().required().messages({
    "any.required": "Cancellation reason is required",
    "string.min": "Reason must be at least 10 characters",
  }),
  issueRefund: Joi.boolean().default(true),
  restoreVouchers: Joi.boolean().default(true),
});

/**
 * Query all orders (admin)
 */
export const queryAllOrdersSchema = Joi.object({
  userId: Joi.string().hex().length(24),
  kitchenId: Joi.string().hex().length(24),
  zoneId: Joi.string().hex().length(24),
  status: Joi.string().valid(...ORDER_STATUSES),
  menuType: Joi.string().valid(...MENU_TYPES),
  dateFrom: Joi.date(),
  dateTo: Joi.date(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

/**
 * Rate order
 */
export const rateOrderSchema = Joi.object({
  stars: Joi.number().integer().min(1).max(5).required().messages({
    "any.required": "Rating stars is required",
    "number.min": "Rating must be at least 1 star",
    "number.max": "Rating cannot exceed 5 stars",
  }),
  comment: Joi.string().max(500).trim().allow("", null),
});

export default {
  createOrderSchema,
  calculatePricingSchema,
  queryMyOrdersSchema,
  queryKitchenOrdersSchema,
  acceptOrderSchema,
  rejectOrderSchema,
  cancelOrderSchema,
  updateOrderStatusSchema,
  updateDeliveryStatusSchema,
  adminUpdateStatusSchema,
  adminCancelOrderSchema,
  queryAllOrdersSchema,
  rateOrderSchema,
};
