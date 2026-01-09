import Joi from "joi";

/**
 * Addon Validation Schemas
 */

const DIETARY_TYPES = ["VEG", "NON_VEG", "VEGAN", "EGGETARIAN"];

/**
 * Create addon
 */
export const createAddonSchema = Joi.object({
  kitchenId: Joi.string().hex().length(24), // Required for admin, auto for staff
  name: Joi.string().min(2).max(100).trim().required().messages({
    "any.required": "Addon name is required",
    "string.min": "Name must be at least 2 characters",
  }),
  description: Joi.string().max(300).trim().allow("", null),
  price: Joi.number().min(0).required().messages({
    "any.required": "Price is required",
    "number.min": "Price cannot be negative",
  }),
  dietaryType: Joi.string()
    .valid(...DIETARY_TYPES)
    .allow(null),
  image: Joi.string().uri().allow("", null),
  minQuantity: Joi.number().integer().min(0).default(0),
  maxQuantity: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(10)
    .when("minQuantity", {
      is: Joi.exist(),
      then: Joi.number().min(Joi.ref("minQuantity")),
    }),
  isAvailable: Joi.boolean().default(true),
  displayOrder: Joi.number().integer().min(0).default(0),
});

/**
 * Update addon
 */
export const updateAddonSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim(),
  description: Joi.string().max(300).trim().allow("", null),
  price: Joi.number().min(0),
  dietaryType: Joi.string()
    .valid(...DIETARY_TYPES)
    .allow(null),
  image: Joi.string().uri().allow("", null),
  minQuantity: Joi.number().integer().min(0),
  maxQuantity: Joi.number().integer().min(1).max(20),
  displayOrder: Joi.number().integer().min(0),
});

/**
 * Toggle availability
 */
export const toggleAvailabilitySchema = Joi.object({
  isAvailable: Joi.boolean().required().messages({
    "any.required": "isAvailable is required",
  }),
});

/**
 * Query addons
 */
export const queryAddonsSchema = Joi.object({
  kitchenId: Joi.string().hex().length(24),
  status: Joi.string().valid("ACTIVE", "INACTIVE", "DELETED"),
  isAvailable: Joi.boolean(),
  dietaryType: Joi.string().valid(...DIETARY_TYPES),
  search: Joi.string().max(50).trim(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

export default {
  createAddonSchema,
  updateAddonSchema,
  toggleAvailabilitySchema,
  queryAddonsSchema,
};
