import Joi from "joi";
import { commonSchemas } from "../../middlewares/validate.middleware.js";

/**
 * Zone Validation Schemas
 */

/**
 * Create zone
 */
export const createZoneSchema = Joi.object({
  pincode: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      "any.required": "Pincode is required",
      "string.length": "Pincode must be 6 digits",
      "string.pattern.base": "Pincode must contain only digits",
    }),
  name: Joi.string().min(2).max(100).trim().required().messages({
    "any.required": "Zone name is required",
  }),
  city: Joi.string().min(2).max(100).trim().required().messages({
    "any.required": "City is required",
  }),
  state: Joi.string().max(100).trim().allow("", null),
  timezone: Joi.string().default("Asia/Kolkata"),
  status: Joi.string().valid("ACTIVE", "INACTIVE").default("INACTIVE"),
  orderingEnabled: Joi.boolean().default(true),
  displayOrder: Joi.number().integer().min(0).default(0),
});

/**
 * Update zone
 */
export const updateZoneSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim(),
  city: Joi.string().min(2).max(100).trim(),
  state: Joi.string().max(100).trim().allow("", null),
  timezone: Joi.string(),
  displayOrder: Joi.number().integer().min(0),
});

/**
 * Toggle ordering
 */
export const toggleOrderingSchema = Joi.object({
  orderingEnabled: Joi.boolean().required().messages({
    "any.required": "orderingEnabled is required",
  }),
});

/**
 * Query zones
 */
export const queryZonesSchema = Joi.object({
  city: Joi.string().max(100).trim(),
  status: Joi.string().valid("ACTIVE", "INACTIVE"),
  orderingEnabled: Joi.boolean(),
  search: Joi.string().max(50).trim(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

/**
 * City status filter
 */
export const cityStatusSchema = Joi.object({
  status: Joi.string().valid("ACTIVE", "INACTIVE", "ALL").default("ACTIVE"),
});

/**
 * Pincode lookup
 */
export const pincodeSchema = Joi.object({
  pincode: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      "any.required": "Pincode is required",
      "string.length": "Pincode must be 6 digits",
      "string.pattern.base": "Pincode must contain only digits",
    }),
});

export default {
  createZoneSchema,
  updateZoneSchema,
  toggleOrderingSchema,
  queryZonesSchema,
  cityStatusSchema,
  pincodeSchema,
};
