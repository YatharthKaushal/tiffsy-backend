import Joi from "joi";

/**
 * Delivery Validation Schemas
 */

const MEAL_WINDOWS = ["LUNCH", "DINNER"];
const BATCH_STATUSES = [
  "COLLECTING",
  "READY_FOR_DISPATCH",
  "DISPATCHED",
  "IN_PROGRESS",
  "COMPLETED",
  "PARTIAL_COMPLETE",
  "CANCELLED",
];
const DELIVERY_STATUSES = [
  "ASSIGNED",
  "ACKNOWLEDGED",
  "PICKED_UP",
  "EN_ROUTE",
  "ARRIVED",
  "DELIVERED",
  "FAILED",
  "RETURNED",
  "CANCELLED",
];
const FAILURE_REASONS = [
  "CUSTOMER_UNAVAILABLE",
  "WRONG_ADDRESS",
  "CUSTOMER_REFUSED",
  "ADDRESS_NOT_FOUND",
  "CUSTOMER_UNREACHABLE",
  "OTHER",
];
const FAILED_ORDER_POLICIES = ["NO_RETURN", "RETURN_TO_KITCHEN"];

/**
 * Auto-batch orders
 */
export const autoBatchSchema = Joi.object({
  mealWindow: Joi.string().valid(...MEAL_WINDOWS),
  kitchenId: Joi.string().hex().length(24),
});

/**
 * Dispatch batches
 */
export const dispatchBatchesSchema = Joi.object({
  mealWindow: Joi.string()
    .valid(...MEAL_WINDOWS)
    .required()
    .messages({
      "any.required": "Meal window is required for dispatch",
    }),
});

/**
 * Accept batch
 */
export const acceptBatchSchema = Joi.object({});

/**
 * Update batch pickup
 */
export const updateBatchPickupSchema = Joi.object({
  notes: Joi.string().max(200).trim().allow("", null),
});

/**
 * Update delivery status
 */
export const updateDeliveryStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...DELIVERY_STATUSES.filter((s) => ["EN_ROUTE", "ARRIVED", "DELIVERED", "FAILED"].includes(s)))
    .required()
    .messages({
      "any.required": "Status is required",
    }),
  notes: Joi.string().max(200).trim().allow("", null),
  failureReason: Joi.string()
    .valid(...FAILURE_REASONS)
    .when("status", {
      is: "FAILED",
      then: Joi.required().messages({
        "any.required": "Failure reason is required for FAILED status",
      }),
      otherwise: Joi.forbidden(),
    }),
  proofOfDelivery: Joi.object({
    type: Joi.string().valid("OTP", "SIGNATURE", "PHOTO").required(),
    otp: Joi.string().when("type", {
      is: "OTP",
      then: Joi.required(),
    }),
    signatureUrl: Joi.string().uri().when("type", {
      is: "SIGNATURE",
      then: Joi.required(),
    }),
    photoUrl: Joi.string().uri().when("type", {
      is: "PHOTO",
      then: Joi.required(),
    }),
  }).when("status", {
    is: "DELIVERED",
    then: Joi.required().messages({
      "any.required": "Proof of delivery is required for DELIVERED status",
    }),
    otherwise: Joi.optional(),
  }),
});

/**
 * Complete batch
 */
export const completeBatchSchema = Joi.object({
  notes: Joi.string().max(200).trim().allow("", null),
});

/**
 * Update delivery sequence
 */
export const updateDeliverySequenceSchema = Joi.object({
  sequence: Joi.array()
    .items(
      Joi.object({
        orderId: Joi.string().hex().length(24).required(),
        sequenceNumber: Joi.number().integer().min(1).required(),
      })
    )
    .min(1)
    .required()
    .messages({
      "any.required": "Sequence array is required",
      "array.min": "At least one order sequence is required",
    }),
});

/**
 * Query kitchen batches
 */
export const queryKitchenBatchesSchema = Joi.object({
  status: Joi.string().valid(...BATCH_STATUSES),
  mealWindow: Joi.string().valid(...MEAL_WINDOWS),
  date: Joi.date().default(() => new Date()),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

/**
 * Query all batches (admin)
 */
export const queryAllBatchesSchema = Joi.object({
  kitchenId: Joi.string().hex().length(24),
  zoneId: Joi.string().hex().length(24),
  driverId: Joi.string().hex().length(24),
  status: Joi.string().valid(...BATCH_STATUSES),
  dateFrom: Joi.date(),
  dateTo: Joi.date(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

/**
 * Reassign batch
 */
export const reassignBatchSchema = Joi.object({
  driverId: Joi.string().hex().length(24).required().messages({
    "any.required": "Driver ID is required",
  }),
  reason: Joi.string().min(5).max(200).trim().required().messages({
    "any.required": "Reassignment reason is required",
  }),
});

/**
 * Cancel batch
 */
export const cancelBatchSchema = Joi.object({
  reason: Joi.string().min(5).max(200).trim().required().messages({
    "any.required": "Cancellation reason is required",
  }),
});

/**
 * Update batch config
 */
export const updateBatchConfigSchema = Joi.object({
  maxBatchSize: Joi.number().integer().min(1).max(30).default(15),
  failedOrderPolicy: Joi.string().valid(...FAILED_ORDER_POLICIES).default("NO_RETURN"),
  autoDispatchDelay: Joi.number().integer().min(0).max(60).default(0),
});

/**
 * Query delivery stats
 */
export const queryDeliveryStatsSchema = Joi.object({
  dateFrom: Joi.date(),
  dateTo: Joi.date(),
  zoneId: Joi.string().hex().length(24),
  driverId: Joi.string().hex().length(24),
});

export default {
  autoBatchSchema,
  dispatchBatchesSchema,
  acceptBatchSchema,
  updateBatchPickupSchema,
  updateDeliveryStatusSchema,
  completeBatchSchema,
  updateDeliverySequenceSchema,
  queryKitchenBatchesSchema,
  queryAllBatchesSchema,
  reassignBatchSchema,
  cancelBatchSchema,
  updateBatchConfigSchema,
  queryDeliveryStatsSchema,
};
