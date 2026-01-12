import { Router } from "express";
import addressController from "./address.controller.js";
import { adminAuthMiddleware, roleMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody, validateQuery, validateParams } from "../../middlewares/validate.middleware.js";
import {
  createAddressSchema,
  updateAddressSchema,
  checkServiceabilitySchema,
  getKitchensQuerySchema,
} from "./address.validation.js";
import Joi from "joi";

const router = Router();

// Param schemas
const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

// Addresses query schema
const addressesQuerySchema = Joi.object({
  includeDeleted: Joi.boolean().default(false),
});

/**
 * PUBLIC/AUTHENTICATED ROUTES
 */

// Check serviceability (can be public or authenticated)
router.get(
  "/check-serviceability",
  validateQuery(checkServiceabilitySchema),
  addressController.checkServiceability
);

/**
 * CUSTOMER ROUTES
 */

// Create address
router.post(
  "/",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateBody(createAddressSchema),
  addressController.createAddress
);

// Get all addresses
router.get(
  "/",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateQuery(addressesQuerySchema),
  addressController.getAddresses
);

// Get address by ID
router.get(
  "/:id",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateParams(idParamSchema),
  addressController.getAddressById
);

// Update address
router.put(
  "/:id",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(updateAddressSchema),
  addressController.updateAddress
);

// Delete address
router.delete(
  "/:id",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateParams(idParamSchema),
  addressController.deleteAddress
);

// Set default address
router.patch(
  "/:id/default",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateParams(idParamSchema),
  addressController.setDefaultAddress
);

// Get kitchens for address
router.get(
  "/:id/kitchens",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateParams(idParamSchema),
  validateQuery(getKitchensQuerySchema),
  addressController.getServiceableKitchens
);

export default router;
