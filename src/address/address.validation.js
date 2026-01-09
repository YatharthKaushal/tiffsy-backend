import Joi from "joi";
import { commonSchemas } from "../middlewares/validate.middleware.js";

/**
 * Address Validation Schemas
 */

/**
 * Coordinates schema
 */
const coordinatesSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
});

/**
 * Create address
 */
export const createAddressSchema = Joi.object({
  label: Joi.string().min(1).max(50).trim().required().messages({
    "any.required": "Label is required",
  }),
  addressLine1: Joi.string().min(5).max(200).trim().required().messages({
    "any.required": "Address line 1 is required",
  }),
  addressLine2: Joi.string().max(200).trim().allow("", null),
  landmark: Joi.string().max(100).trim().allow("", null),
  locality: Joi.string().min(2).max(100).trim().required().messages({
    "any.required": "Locality is required",
  }),
  city: Joi.string().min(2).max(100).trim().required().messages({
    "any.required": "City is required",
  }),
  state: Joi.string().max(100).trim().allow("", null),
  pincode: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      "any.required": "Pincode is required",
      "string.length": "Pincode must be 6 digits",
      "string.pattern.base": "Pincode must contain only digits",
    }),
  contactName: Joi.string().max(100).trim().allow("", null),
  contactPhone: Joi.string()
    .pattern(/^\+?[0-9]{10,15}$/)
    .allow("", null),
  coordinates: coordinatesSchema.allow(null),
  isDefault: Joi.boolean().default(false),
});

/**
 * Update address
 */
export const updateAddressSchema = Joi.object({
  label: Joi.string().min(1).max(50).trim(),
  addressLine1: Joi.string().min(5).max(200).trim(),
  addressLine2: Joi.string().max(200).trim().allow("", null),
  landmark: Joi.string().max(100).trim().allow("", null),
  locality: Joi.string().min(2).max(100).trim(),
  city: Joi.string().min(2).max(100).trim(),
  state: Joi.string().max(100).trim().allow("", null),
  pincode: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/),
  contactName: Joi.string().max(100).trim().allow("", null),
  contactPhone: Joi.string()
    .pattern(/^\+?[0-9]{10,15}$/)
    .allow("", null),
  coordinates: coordinatesSchema.allow(null),
  isDefault: Joi.boolean(),
});

/**
 * Check serviceability query
 */
export const checkServiceabilitySchema = Joi.object({
  pincode: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      "any.required": "Pincode is required",
    }),
});

/**
 * Get kitchens query
 */
export const getKitchensQuerySchema = Joi.object({
  menuType: Joi.string().valid("MEAL_MENU", "ON_DEMAND_MENU"),
});

export default {
  createAddressSchema,
  updateAddressSchema,
  checkServiceabilitySchema,
  getKitchensQuerySchema,
};
