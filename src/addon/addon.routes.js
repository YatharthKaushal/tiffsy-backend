import { Router } from "express";
import addonController from "./addon.controller.js";
import { adminAuthMiddleware, roleMiddleware, optionalAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody, validateQuery, validateParams } from "../../middlewares/validate.middleware.js";
import {
  createAddonSchema,
  updateAddonSchema,
  toggleAvailabilitySchema,
  queryAddonsSchema,
} from "./addon.validation.js";
import Joi from "joi";

const router = Router();

// Param schemas
const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

const menuItemIdParamSchema = Joi.object({
  menuItemId: Joi.string().hex().length(24).required(),
});

const kitchenIdParamSchema = Joi.object({
  kitchenId: Joi.string().hex().length(24).required(),
});

/**
 * PUBLIC ROUTES
 */

// Get available add-ons for a menu item (customer view)
router.get(
  "/menu-item/:menuItemId",
  validateParams(menuItemIdParamSchema),
  addonController.getAddonsForCustomer
);

/**
 * AUTHENTICATED ROUTES (Kitchen Staff / Admin)
 */

// Get kitchen add-on library (with usage stats)
router.get(
  "/library/:kitchenId",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateParams(kitchenIdParamSchema),
  addonController.getKitchenAddonLibrary
);

// Get addons available to attach to a menu item
router.get(
  "/for-menu-item/:menuItemId",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateParams(menuItemIdParamSchema),
  addonController.getAddonsForMenuItem
);

/**
 * CRUD OPERATIONS
 */

// Create add-on
router.post(
  "/",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateBody(createAddonSchema),
  addonController.createAddon
);

// Get add-ons for a kitchen
router.get(
  "/",
  optionalAuthMiddleware,
  validateQuery(queryAddonsSchema),
  addonController.getAddons
);

// Get add-on by ID
router.get(
  "/:id",
  optionalAuthMiddleware,
  validateParams(idParamSchema),
  addonController.getAddonById
);

// Update add-on
router.put(
  "/:id",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(updateAddonSchema),
  addonController.updateAddon
);

// Toggle add-on availability
router.patch(
  "/:id/availability",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(toggleAvailabilitySchema),
  addonController.toggleAvailability
);

// Soft delete add-on
router.delete(
  "/:id",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateParams(idParamSchema),
  addonController.deleteAddon
);

export default router;
