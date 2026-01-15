import Joi from "joi";

/**
 * Driver Validation Schemas
 * Validation rules for driver profile management endpoints
 */

// Update basic profile (name, email, profileImage)
export const updateDriverProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().messages({
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name cannot exceed 100 characters",
  }),
  email: Joi.string().email().trim().lowercase().allow(null, "").messages({
    "string.email": "Invalid email format",
  }),
  profileImage: Joi.string().uri().trim().allow(null, "").messages({
    "string.uri": "Profile image must be a valid URL",
  }),
}).min(1).messages({
  "object.min": "At least one field must be provided to update",
});

// Update vehicle details (name, number, type)
export const updateVehicleDetailsSchema = Joi.object({
  vehicleName: Joi.string().min(2).max(100).trim().messages({
    "string.min": "Vehicle name must be at least 2 characters",
    "string.max": "Vehicle name cannot exceed 100 characters",
  }),
  vehicleNumber: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/)
    .messages({
      "string.pattern.base": "Invalid vehicle number format (e.g., DL01AB1234)",
    }),
  vehicleType: Joi.string()
    .valid("BIKE", "SCOOTER", "BICYCLE", "OTHER")
    .messages({
      "any.only": "Vehicle type must be one of: BIKE, SCOOTER, BICYCLE, OTHER",
    }),
}).min(1).messages({
  "object.min": "At least one field must be provided to update",
});

// Update profile image only
export const updateDriverImageSchema = Joi.object({
  profileImage: Joi.string().uri().trim().required().messages({
    "string.uri": "Profile image must be a valid URL",
    "any.required": "Profile image is required",
  }),
});

// Request document update (requires admin approval)
export const requestDocumentUpdateSchema = Joi.object({
  documentType: Joi.string()
    .valid("LICENSE", "RC", "INSURANCE", "PUC", "OTHER")
    .required()
    .messages({
      "any.only": "Document type must be one of: LICENSE, RC, INSURANCE, PUC, OTHER",
      "any.required": "Document type is required",
    }),
  reason: Joi.string().min(10).max(500).trim().required().messages({
    "string.min": "Reason must be at least 10 characters",
    "string.max": "Reason cannot exceed 500 characters",
    "any.required": "Reason for document update is required",
  }),
  currentValue: Joi.string().trim().messages({
    "string.base": "Current value must be a string",
  }),
  requestedValue: Joi.string().trim().messages({
    "string.base": "Requested value must be a string",
  }),
}).messages({
  "object.base": "Invalid request format",
});

export default {
  updateDriverProfileSchema,
  updateVehicleDetailsSchema,
  updateDriverImageSchema,
  requestDocumentUpdateSchema,
};
