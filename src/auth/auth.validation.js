import Joi from "joi";
import { commonSchemas } from "../../middlewares/validate.middleware.js";

/**
 * Auth Validation Schemas
 * Joi schemas for auth-related request validation
 */

/**
 * Sync user after Firebase auth
 * No body required - just checks if user exists
 */
export const syncUserSchema = Joi.object({});

/**
 * Register new user after Firebase auth
 * Name is required
 */
export const registerUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().required().messages({
    "any.required": "Name is required",
    "string.empty": "Name is required",
    "string.min": "Name must be at least 2 characters",
  }),
  email: Joi.string().email().allow("", null),
  dietaryPreferences: Joi.array().items(
    Joi.string().valid("VEG", "NON_VEG", "VEGAN", "JAIN", "EGGETARIAN")
  ),
});

/**
 * Complete/update profile
 * Name is required
 */
export const completeProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().required(),
  email: Joi.string().email().allow("", null),
  dietaryPreferences: Joi.array().items(
    Joi.string().valid("VEG", "NON_VEG", "VEGAN", "JAIN", "EGGETARIAN")
  ),
  profileImage: Joi.string().uri().allow("", null),
});

/**
 * Admin login with username/password
 */
export const adminLoginSchema = Joi.object({
  username: Joi.string().trim().required().messages({
    "any.required": "Username is required",
    "string.empty": "Username is required",
  }),
  password: Joi.string().required().messages({
    "any.required": "Password is required",
    "string.empty": "Password is required",
  }),
});

/**
 * Admin change password
 */
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "any.required": "Current password is required",
  }),
  newPassword: Joi.string().min(8).required().messages({
    "any.required": "New password is required",
    "string.min": "Password must be at least 8 characters",
  }),
  confirmPassword: Joi.string().valid(Joi.ref("newPassword")).required().messages({
    "any.only": "Passwords do not match",
    "any.required": "Confirm password is required",
  }),
});

/**
 * FCM token registration
 */
export const fcmTokenSchema = Joi.object({
  fcmToken: Joi.string().trim().required().messages({
    "any.required": "FCM token is required",
    "string.empty": "FCM token is required",
  }),
  deviceId: Joi.string().trim().allow("", null),
});

/**
 * Vehicle document schema
 */
const vehicleDocumentSchema = Joi.object({
  type: Joi.string().valid("RC", "INSURANCE", "PUC", "OTHER").required().messages({
    "any.required": "Document type is required",
    "any.only": "Document type must be RC, INSURANCE, PUC, or OTHER",
  }),
  imageUrl: Joi.string().uri().required().messages({
    "any.required": "Document image URL is required",
    "string.uri": "Document image must be a valid URL",
  }),
  expiryDate: Joi.date().optional(),
});

/**
 * Register driver after Firebase auth
 * Driver self-registration with vehicle details
 */
export const registerDriverSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().required().messages({
    "any.required": "Name is required",
    "string.empty": "Name is required",
    "string.min": "Name must be at least 2 characters",
  }),
  email: Joi.string().email().allow("", null),
  profileImage: Joi.string().uri().allow("", null),

  // Driver's license details
  licenseNumber: Joi.string().trim().required().messages({
    "any.required": "Driver's license number is required",
    "string.empty": "Driver's license number is required",
  }),
  licenseImageUrl: Joi.string().uri().required().messages({
    "any.required": "Driver's license image is required",
    "string.uri": "License image must be a valid URL",
  }),
  licenseExpiryDate: Joi.date().greater("now").optional().messages({
    "date.greater": "License expiry date must be in the future",
  }),

  // Vehicle details
  vehicleName: Joi.string().trim().required().messages({
    "any.required": "Vehicle name is required",
    "string.empty": "Vehicle name is required",
  }),
  vehicleNumber: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/)
    .required()
    .messages({
      "any.required": "Vehicle number is required",
      "string.pattern.base": "Invalid vehicle number format (e.g., MH12AB1234)",
    }),
  vehicleType: Joi.string().valid("BIKE", "SCOOTER", "BICYCLE", "OTHER").required().messages({
    "any.required": "Vehicle type is required",
    "any.only": "Vehicle type must be BIKE, SCOOTER, BICYCLE, or OTHER",
  }),

  // Vehicle documents
  vehicleDocuments: Joi.array().items(vehicleDocumentSchema).min(1).required().messages({
    "any.required": "At least one vehicle document is required",
    "array.min": "At least one vehicle document is required",
  }),
});

export default {
  syncUserSchema,
  registerUserSchema,
  completeProfileSchema,
  adminLoginSchema,
  changePasswordSchema,
  fcmTokenSchema,
  registerDriverSchema,
};
