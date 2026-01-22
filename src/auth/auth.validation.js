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
  deviceType: Joi.string().valid("ANDROID", "IOS", "WEB").required().messages({
    "any.required": "Device type is required",
    "any.only": "Device type must be ANDROID, IOS, or WEB",
  }),
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

/**
 * Operating hours schema (for kitchen registration)
 */
const operatingHoursSchema = Joi.object({
  lunch: Joi.object({
    startTime: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .required()
      .messages({
        "any.required": "Lunch start time is required",
        "string.pattern.base": "Lunch start time must be in HH:mm format",
      }),
    endTime: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .required()
      .messages({
        "any.required": "Lunch end time is required",
        "string.pattern.base": "Lunch end time must be in HH:mm format",
      }),
  }).required(),
  dinner: Joi.object({
    startTime: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .required()
      .messages({
        "any.required": "Dinner start time is required",
        "string.pattern.base": "Dinner start time must be in HH:mm format",
      }),
    endTime: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .required()
      .messages({
        "any.required": "Dinner end time is required",
        "string.pattern.base": "Dinner end time must be in HH:mm format",
      }),
  }).required(),
  onDemand: Joi.object({
    startTime: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .optional(),
    endTime: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .optional(),
    isAlwaysOpen: Joi.boolean().default(false),
  }).optional(),
});

/**
 * Address schema (for kitchen registration)
 */
const addressSchema = Joi.object({
  addressLine1: Joi.string().max(200).trim().required().messages({
    "any.required": "Address line 1 is required",
    "string.max": "Address line 1 cannot exceed 200 characters",
  }),
  addressLine2: Joi.string().max(200).trim().allow("", null),
  locality: Joi.string().max(100).trim().required().messages({
    "any.required": "Locality is required",
  }),
  city: Joi.string().max(100).trim().required().messages({
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
      "string.pattern.base": "Pincode must contain only numbers",
    }),
  coordinates: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
  }).optional(),
});

/**
 * Register kitchen after Firebase auth
 * Kitchen self-registration - requires admin approval
 */
export const registerKitchenSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().required().messages({
    "any.required": "Kitchen name is required",
    "string.empty": "Kitchen name is required",
    "string.min": "Kitchen name must be at least 2 characters",
    "string.max": "Kitchen name cannot exceed 100 characters",
  }),
  cuisineTypes: Joi.array()
    .items(Joi.string().max(50).trim())
    .min(1)
    .required()
    .messages({
      "any.required": "At least one cuisine type is required",
      "array.min": "At least one cuisine type is required",
    }),
  address: addressSchema.required(),
  zonesServed: Joi.array()
    .items(Joi.string().hex().length(24))
    .min(1)
    .required()
    .messages({
      "any.required": "At least one zone is required",
      "array.min": "At least one zone is required",
      "string.hex": "Invalid zone ID format",
      "string.length": "Invalid zone ID length",
    }),
  operatingHours: operatingHoursSchema.required(),
  contactPhone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({
      "any.required": "Contact phone is required",
      "string.pattern.base":
        "Phone must be 10 digits starting with 6-9",
    }),
  contactEmail: Joi.string().email().required().messages({
    "any.required": "Contact email is required",
    "string.email": "Invalid email format",
  }),
  ownerName: Joi.string().min(2).max(100).trim().required().messages({
    "any.required": "Owner name is required",
    "string.min": "Owner name must be at least 2 characters",
  }),
  logo: Joi.string().uri().required().messages({
    "any.required": "Kitchen logo is required",
    "string.uri": "Logo must be a valid URL",
  }),
  coverImage: Joi.string().uri().allow("", null),
  staffName: Joi.string().min(2).max(100).trim().required().messages({
    "any.required": "Staff name is required",
    "string.min": "Staff name must be at least 2 characters",
  }),
  staffEmail: Joi.string().email().allow("", null),
});

/**
 * Resubmit kitchen registration after rejection
 * Same as registerKitchenSchema but all fields are optional
 */
export const resubmitKitchenSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim(),
  cuisineTypes: Joi.array().items(Joi.string().max(50).trim()).min(1),
  address: addressSchema,
  zonesServed: Joi.array()
    .items(Joi.string().hex().length(24))
    .min(1),
  operatingHours: operatingHoursSchema,
  contactPhone: Joi.string().pattern(/^[6-9]\d{9}$/),
  contactEmail: Joi.string().email(),
  ownerName: Joi.string().min(2).max(100).trim(),
  logo: Joi.string().uri(),
  coverImage: Joi.string().uri().allow("", null),
});

export default {
  syncUserSchema,
  registerUserSchema,
  completeProfileSchema,
  adminLoginSchema,
  changePasswordSchema,
  fcmTokenSchema,
  registerDriverSchema,
  registerKitchenSchema,
  resubmitKitchenSchema,
};
