import Joi from "joi";
import { commonSchemas } from "../middlewares/validate.middleware.js";

/**
 * Auth Validation Schemas
 * Joi schemas for auth-related request validation
 */

/**
 * Sync user after Firebase auth
 * Name required for new customers
 */
export const syncUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim(),
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

export default {
  syncUserSchema,
  completeProfileSchema,
  adminLoginSchema,
  changePasswordSchema,
  fcmTokenSchema,
};
