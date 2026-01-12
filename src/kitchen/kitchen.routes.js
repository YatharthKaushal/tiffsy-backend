import { Router } from "express";
import kitchenController from "./kitchen.controller.js";
import { adminAuthMiddleware, adminMiddleware, roleMiddleware, kitchenAccessMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody, validateQuery, validateParams } from "../../middlewares/validate.middleware.js";
import {
  createKitchenSchema,
  updateKitchenSchema,
  assignZonesSchema,
  toggleOrderingSchema,
  queryKitchensSchema,
} from "./kitchen.validation.js";
import Joi from "joi";

const router = Router();

// Param schemas
const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

const zoneIdParamSchema = Joi.object({
  zoneId: Joi.string().hex().length(24).required(),
});

// Query schemas
const zoneKitchensQuerySchema = Joi.object({
  menuType: Joi.string().valid("MEAL_MENU", "ON_DEMAND_MENU").optional(),
});

// Kitchen type schema
const typeSchema = Joi.object({
  type: Joi.string().valid("TIFFSY", "PARTNER").required(),
});

// Kitchen flags schema
const flagsSchema = Joi.object({
  authorizedFlag: Joi.boolean().optional(),
  premiumFlag: Joi.boolean().optional(),
  gourmetFlag: Joi.boolean().optional(),
});

// Suspend schema
const suspendSchema = Joi.object({
  reason: Joi.string().min(10).max(500).required(),
});

/**
 * PUBLIC ROUTES
 */

// Get kitchens for a zone
router.get(
  "/zone/:zoneId",
  validateParams(zoneIdParamSchema),
  validateQuery(zoneKitchensQuerySchema),
  kitchenController.getKitchensForZone
);

/**
 * KITCHEN STAFF ROUTES
 */

// Get my kitchen
router.get(
  "/my-kitchen",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  kitchenController.getMyKitchen
);

// Update my kitchen images
router.patch(
  "/my-kitchen/images",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  kitchenController.updateMyKitchenImages
);

// Toggle order acceptance for own kitchen
router.patch(
  "/my-kitchen/accepting-orders",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateBody(toggleOrderingSchema),
  kitchenController.toggleOrderAcceptance
);

/**
 * PUBLIC KITCHEN DETAILS
 */

// Get kitchen public details
router.get(
  "/:id/public",
  validateParams(idParamSchema),
  kitchenController.getKitchenPublicDetails
);

/**
 * ADMIN ROUTES
 */

// Create kitchen
router.post(
  "/",
  adminAuthMiddleware,
  adminMiddleware,
  validateBody(createKitchenSchema),
  kitchenController.createKitchen
);

// Get all kitchens
router.get(
  "/",
  adminAuthMiddleware,
  roleMiddleware(["ADMIN", "KITCHEN_STAFF"]),
  validateQuery(queryKitchensSchema),
  kitchenController.getKitchens
);

// Get kitchen by ID
router.get(
  "/:id",
  adminAuthMiddleware,
  roleMiddleware(["ADMIN", "KITCHEN_STAFF"]),
  kitchenAccessMiddleware("id"), // FR-AUTH-8: Kitchen staff can only access their own kitchen
  validateParams(idParamSchema),
  kitchenController.getKitchenById
);

// Update kitchen
router.put(
  "/:id",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(updateKitchenSchema),
  kitchenController.updateKitchen
);

// Update kitchen type
router.patch(
  "/:id/type",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(typeSchema),
  kitchenController.updateKitchenType
);

// Update kitchen flags
router.patch(
  "/:id/flags",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(flagsSchema),
  kitchenController.updateKitchenFlags
);

// Update zones served
router.patch(
  "/:id/zones",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(assignZonesSchema),
  kitchenController.updateZonesServed
);

// Activate kitchen
router.patch(
  "/:id/activate",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  kitchenController.activateKitchen
);

// Deactivate kitchen
router.patch(
  "/:id/deactivate",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  kitchenController.deactivateKitchen
);

// Suspend kitchen
router.patch(
  "/:id/suspend",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(suspendSchema),
  kitchenController.suspendKitchen
);

// Toggle order acceptance (admin/staff)
router.patch(
  "/:id/accepting-orders",
  adminAuthMiddleware,
  roleMiddleware(["ADMIN", "KITCHEN_STAFF"]),
  kitchenAccessMiddleware("id"), // FR-AUTH-8: Kitchen staff can only access their own kitchen
  validateParams(idParamSchema),
  validateBody(toggleOrderingSchema),
  kitchenController.toggleOrderAcceptance
);

// Delete kitchen (soft delete)
router.delete(
  "/:id",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  kitchenController.deleteKitchen
);

export default router;
