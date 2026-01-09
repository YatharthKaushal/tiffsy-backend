import Joi from "joi";
import { commonSchemas } from "../../middlewares/validate.middleware.js";

/**
 * Kitchen Validation Schemas
 */

const operatingHoursSchema = Joi.object({
  lunch: Joi.object({
    startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
    endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
  }),
  dinner: Joi.object({
    startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
    endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
  }),
  onDemand: Joi.object({
    startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
    endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
    isAlwaysOpen: Joi.boolean().default(false),
  }),
});

const addressSchema = Joi.object({
  addressLine1: Joi.string().max(200).trim().required(),
  addressLine2: Joi.string().max(200).trim().allow("", null),
  locality: Joi.string().max(100).trim().required(),
  city: Joi.string().max(100).trim().required(),
  state: Joi.string().max(100).trim().allow("", null),
  pincode: Joi.string().length(6).pattern(/^[0-9]+$/).required(),
  coordinates: Joi.object({
    latitude: Joi.number().min(-90).max(90),
    longitude: Joi.number().min(-180).max(180),
  }),
});

/**
 * Create kitchen
 */
export const createKitchenSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().required(),
  type: Joi.string().valid("TIFFSY", "PARTNER").required(),
  authorizedFlag: Joi.boolean().default(false),
  premiumFlag: Joi.boolean().default(false),
  gourmetFlag: Joi.boolean().default(false),
  logo: Joi.string().uri().allow("", null),
  coverImage: Joi.string().uri().allow("", null),
  description: Joi.string().max(1000).trim().allow("", null),
  cuisineTypes: Joi.array().items(Joi.string().max(50).trim()),
  address: addressSchema.required(),
  zonesServed: Joi.array()
    .items(Joi.string().hex().length(24))
    .min(1)
    .required(),
  operatingHours: operatingHoursSchema,
  contactPhone: Joi.string().pattern(/^\+?[0-9]{10,15}$/).allow("", null),
  contactEmail: Joi.string().email().allow("", null),
  ownerName: Joi.string().max(100).trim().allow("", null),
  ownerPhone: Joi.string().pattern(/^\+?[0-9]{10,15}$/).allow("", null),
});

/**
 * Update kitchen
 */
export const updateKitchenSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim(),
  authorizedFlag: Joi.boolean(),
  premiumFlag: Joi.boolean(),
  gourmetFlag: Joi.boolean(),
  logo: Joi.string().uri().allow("", null),
  coverImage: Joi.string().uri().allow("", null),
  description: Joi.string().max(1000).trim().allow("", null),
  cuisineTypes: Joi.array().items(Joi.string().max(50).trim()),
  address: Joi.object({
    addressLine1: Joi.string().max(200).trim(),
    addressLine2: Joi.string().max(200).trim().allow("", null),
    locality: Joi.string().max(100).trim(),
    city: Joi.string().max(100).trim(),
    state: Joi.string().max(100).trim().allow("", null),
    pincode: Joi.string().length(6).pattern(/^[0-9]+$/),
    coordinates: Joi.object({
      latitude: Joi.number().min(-90).max(90),
      longitude: Joi.number().min(-180).max(180),
    }),
  }),
  operatingHours: operatingHoursSchema,
  contactPhone: Joi.string().pattern(/^\+?[0-9]{10,15}$/).allow("", null),
  contactEmail: Joi.string().email().allow("", null),
  ownerName: Joi.string().max(100).trim().allow("", null),
  ownerPhone: Joi.string().pattern(/^\+?[0-9]{10,15}$/).allow("", null),
});

/**
 * Assign zones
 */
export const assignZonesSchema = Joi.object({
  zonesServed: Joi.array()
    .items(Joi.string().hex().length(24))
    .min(1)
    .required(),
});

/**
 * Toggle ordering
 */
export const toggleOrderingSchema = Joi.object({
  isAcceptingOrders: Joi.boolean().required(),
});

/**
 * Query kitchens
 */
export const queryKitchensSchema = Joi.object({
  type: Joi.string().valid("TIFFSY", "PARTNER"),
  status: Joi.string().valid("ACTIVE", "INACTIVE", "PENDING_APPROVAL", "SUSPENDED"),
  zoneId: Joi.string().hex().length(24),
  search: Joi.string().max(50).trim(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

export default {
  createKitchenSchema,
  updateKitchenSchema,
  assignZonesSchema,
  toggleOrderingSchema,
  queryKitchensSchema,
};
