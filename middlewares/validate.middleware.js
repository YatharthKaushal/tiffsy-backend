import Joi from "joi";
import { sendResponse } from "../utils/response.utils.js";
import { normalizePhone, isValidPhone } from "../utils/phone.utils.js";

/**
 * Creates a validation middleware for request body
 * @param {Joi.ObjectSchema} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
export const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((d) => d.message).join(", ");
      console.log(`> Validation error (body): ${errorMessage}`);
      return sendResponse(res, 400, "Validation failed", null, errorMessage);
    }

    req.body = value;
    next();
  };
};

/**
 * Creates a validation middleware for query parameters
 * @param {Joi.ObjectSchema} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
export const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((d) => d.message).join(", ");
      console.log(`> Validation error (query): ${errorMessage}`);
      return sendResponse(res, 400, "Validation failed", null, errorMessage);
    }

    // Express 5.x: req.query is read-only, store validated values separately
    req.validatedQuery = value;
    // Also try to update in-place for backward compatibility
    try {
      for (const key in req.query) {
        delete req.query[key];
      }
      Object.assign(req.query, value);
    } catch {
      // If mutation fails, controllers should use req.validatedQuery
    }
    next();
  };
};

/**
 * Creates a validation middleware for route parameters
 * @param {Joi.ObjectSchema} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
export const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((d) => d.message).join(", ");
      console.log(`> Validation error (params): ${errorMessage}`);
      return sendResponse(res, 400, "Validation failed", null, errorMessage);
    }

    // Express 5.x: req.params is read-only, store validated values separately
    req.validatedParams = value;
    // Also try to update in-place for backward compatibility
    try {
      for (const key in req.params) {
        delete req.params[key];
      }
      Object.assign(req.params, value);
    } catch {
      // If mutation fails, controllers should use req.validatedParams
    }
    next();
  };
};

/**
 * Common validation schemas for reuse
 */
export const commonSchemas = {
  // MongoDB ObjectId validation
  objectId: Joi.string().hex().length(24),

  // Pagination query schema
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),

  // ID parameter schema
  idParam: Joi.object({
    id: Joi.string().hex().length(24).required(),
  }),

  // Phone number validation with normalization (extracts last 10 digits)
  phone: Joi.string()
    .custom((value, helpers) => {
      const normalized = normalizePhone(value);
      if (!normalized) {
        return helpers.error("string.pattern.base");
      }
      if (!isValidPhone(normalized)) {
        return helpers.error("string.pattern.base");
      }
      return normalized;
    })
    .messages({
      "string.pattern.base": "Phone must be a valid 10-digit Indian mobile number",
    }),

  // Date range query schema
  dateRange: Joi.object({
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso().greater(Joi.ref("dateFrom")),
  }),
};

export default {
  validateBody,
  validateQuery,
  validateParams,
  commonSchemas,
};
