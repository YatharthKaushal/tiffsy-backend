import Joi from "joi";

/**
 * Customer Validation Schemas
 */

const DIETARY_PREFERENCES = ["VEG", "NON_VEG", "VEGAN", "JAIN", "EGGETARIAN"];

/**
 * Complete profile during onboarding
 */
export const completeProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().required().messages({
    "any.required": "Name is required",
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name cannot exceed 100 characters",
  }),
  email: Joi.string().email().allow("", null),
  dietaryPreferences: Joi.array().items(
    Joi.string().valid(...DIETARY_PREFERENCES)
  ),
});

/**
 * Update profile
 */
export const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim(),
  email: Joi.string().email().allow("", null),
  dietaryPreferences: Joi.array().items(
    Joi.string().valid(...DIETARY_PREFERENCES)
  ),
  profileImage: Joi.string().uri().allow("", null),
});

/**
 * Update dietary preferences only
 */
export const updateDietarySchema = Joi.object({
  dietaryPreferences: Joi.array()
    .items(Joi.string().valid(...DIETARY_PREFERENCES))
    .required()
    .messages({
      "any.required": "Dietary preferences are required",
    }),
});

/**
 * Update profile image
 */
export const updateImageSchema = Joi.object({
  profileImage: Joi.string().uri().required().messages({
    "any.required": "Profile image URL is required",
  }),
});

/**
 * Delete account confirmation
 */
export const deleteAccountSchema = Joi.object({
  reason: Joi.string().max(500).allow("", null),
  confirmPhone: Joi.string()
    .length(4)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      "any.required": "Phone confirmation is required",
      "string.length": "Enter last 4 digits of your phone number",
      "string.pattern.base": "Enter only digits",
    }),
});

export default {
  completeProfileSchema,
  updateProfileSchema,
  updateDietarySchema,
  updateImageSchema,
  deleteAccountSchema,
};
