import Joi from "joi";
import { normalizePhone, isValidPhone } from "../../utils/phone.utils.js";

/**
 * Admin Validation Schemas
 */

const ROLES = ["CUSTOMER", "KITCHEN_STAFF", "DRIVER", "ADMIN"];
const USER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "DELETED"];
const REPORT_TYPES = ["ORDERS", "REVENUE", "VOUCHERS", "REFUNDS"];
const SEGMENT_BY = ["CITY", "ZONE", "KITCHEN"];

/**
 * Create user
 */
export const createUserSchema = Joi.object({
  phone: Joi.string()
    .required()
    .custom((value, helpers) => {
      const normalized = normalizePhone(value);
      if (!normalized || !isValidPhone(normalized)) {
        return helpers.error("string.pattern.base");
      }
      return normalized;
    })
    .messages({
      "any.required": "Phone number is required",
      "string.pattern.base": "Phone must be a valid 10-digit Indian mobile number",
    }),
  role: Joi.string()
    .valid("KITCHEN_STAFF", "DRIVER", "ADMIN")
    .required()
    .messages({
      "any.required": "Role is required",
      "any.only": "Role must be KITCHEN_STAFF, DRIVER, or ADMIN",
    }),
  name: Joi.string().min(2).max(100).trim().required().messages({
    "any.required": "Name is required",
  }),
  email: Joi.string().email().allow("", null),
  kitchenId: Joi.string()
    .hex()
    .length(24)
    .when("role", {
      is: "KITCHEN_STAFF",
      then: Joi.required().messages({
        "any.required": "Kitchen ID is required for Kitchen Staff",
      }),
      otherwise: Joi.forbidden(),
    }),
  username: Joi.string().min(3).max(50).trim().when("role", {
    is: "ADMIN",
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),
  password: Joi.string().min(8).max(100).when("role", {
    is: "ADMIN",
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),
});

/**
 * Update user
 */
export const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim(),
  email: Joi.string().email().allow("", null),
  kitchenId: Joi.string().hex().length(24),
  username: Joi.string().min(3).max(50).trim(),
});

/**
 * Suspend user
 */
export const suspendUserSchema = Joi.object({
  reason: Joi.string().min(5).max(500).trim().required().messages({
    "any.required": "Suspension reason is required",
  }),
});

/**
 * Reset password
 */
export const resetPasswordSchema = Joi.object({
  newPassword: Joi.string().min(8).max(100).required().messages({
    "any.required": "New password is required",
    "string.min": "Password must be at least 8 characters",
  }),
});

/**
 * Query users
 */
export const queryUsersSchema = Joi.object({
  role: Joi.string().valid(...ROLES),
  status: Joi.string().valid(...USER_STATUSES),
  kitchenId: Joi.string().hex().length(24),
  search: Joi.string().max(50).trim(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

/**
 * Query audit logs
 */
export const queryAuditLogsSchema = Joi.object({
  userId: Joi.string().hex().length(24),
  action: Joi.string().max(50).trim(),
  entityType: Joi.string().max(50).trim(),
  entityId: Joi.string().hex().length(24),
  dateFrom: Joi.date(),
  dateTo: Joi.date(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

/**
 * Update system config
 */
export const updateSystemConfigSchema = Joi.object({
  cutoffTimes: Joi.object({
    LUNCH: Joi.string().pattern(/^\d{2}:\d{2}$/).messages({
      "string.pattern.base": "LUNCH cutoff must be in HH:mm format (e.g., 11:00)",
    }),
    DINNER: Joi.string().pattern(/^\d{2}:\d{2}$/).messages({
      "string.pattern.base": "DINNER cutoff must be in HH:mm format (e.g., 21:00)",
    }),
  }),
  cancellation: Joi.object({
    nonVoucherWindowMinutes: Joi.number().integer().min(1).max(60).messages({
      "number.min": "Cancellation window must be at least 1 minute",
      "number.max": "Cancellation window cannot exceed 60 minutes",
    }),
    allowAfterAccepted: Joi.boolean().messages({
      "boolean.base": "allowAfterAccepted must be true or false",
    }),
    feeTiers: Joi.object({
      within5Min: Joi.number().min(0),
      within10Min: Joi.number().min(0),
      after10Min: Joi.number().min(0),
    }),
  }),
  batching: Joi.object({
    maxBatchSize: Joi.number().integer().min(1).max(30),
    failedOrderPolicy: Joi.string().valid("NO_RETURN", "RETURN_TO_KITCHEN"),
    autoDispatchDelay: Joi.number().integer().min(0).max(60),
  }),
  fees: Joi.object({
    deliveryFee: Joi.number().min(0),
    serviceFee: Joi.number().min(0),
    packagingFee: Joi.number().min(0),
    handlingFee: Joi.number().min(0),
    taxRate: Joi.number().min(0).max(1).messages({
      "number.max": "Tax rate must be a decimal between 0 and 1 (e.g., 0.05 for 5%)",
    }),
  }),
  taxes: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      rate: Joi.number().min(0).max(100).required(),
      enabled: Joi.boolean().default(true),
    })
  ),
  refund: Joi.object({
    maxRetries: Joi.number().integer().min(1).max(10),
    autoProcessDelay: Joi.number().integer().min(0),
  }),
});

/**
 * Query reports
 */
export const queryReportsSchema = Joi.object({
  type: Joi.string()
    .valid(...REPORT_TYPES)
    .required()
    .messages({
      "any.required": "Report type is required",
    }),
  segmentBy: Joi.string().valid(...SEGMENT_BY),
  dateFrom: Joi.date(),
  dateTo: Joi.date(),
  kitchenId: Joi.string().hex().length(24),
  zoneId: Joi.string().hex().length(24),
});

/**
 * Export report
 */
export const exportReportSchema = Joi.object({
  type: Joi.string()
    .valid(...REPORT_TYPES)
    .required(),
  segmentBy: Joi.string().valid(...SEGMENT_BY),
  dateFrom: Joi.date(),
  dateTo: Joi.date(),
  format: Joi.string().valid("CSV", "EXCEL").default("CSV"),
});

/**
 * Update guidelines
 */
export const updateGuidelinesSchema = Joi.object({
  menuGuidelines: Joi.string().max(10000).trim().allow("", null),
  kitchenGuidelines: Joi.string().max(10000).trim().allow("", null),
  qualityPolicy: Joi.string().max(10000).trim().allow("", null),
});

export default {
  createUserSchema,
  updateUserSchema,
  suspendUserSchema,
  resetPasswordSchema,
  queryUsersSchema,
  queryAuditLogsSchema,
  updateSystemConfigSchema,
  queryReportsSchema,
  exportReportSchema,
  updateGuidelinesSchema,
};
