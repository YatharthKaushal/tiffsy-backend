import { Router } from "express";
import menuController from "./menu.controller.js";
import { adminAuthMiddleware, adminMiddleware, roleMiddleware, optionalAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody, validateQuery, validateParams } from "../../middlewares/validate.middleware.js";
import {
  createMenuItemSchema,
  updateMenuItemSchema,
  toggleAvailabilitySchema,
  updateAddonsSchema,
  disableMenuItemSchema,
  queryMenuItemsSchema,
} from "./menu.validation.js";
import Joi from "joi";

const router = Router();

// Param schemas
const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

const kitchenIdParamSchema = Joi.object({
  kitchenId: Joi.string().hex().length(24).required(),
});

const mealWindowParamSchema = Joi.object({
  kitchenId: Joi.string().hex().length(24).required(),
  mealWindow: Joi.string().valid("LUNCH", "DINNER").required(),
});

// Kitchen menu query schema
const kitchenMenuQuerySchema = Joi.object({
  menuType: Joi.string().valid("MEAL_MENU", "ON_DEMAND_MENU").optional(),
});

/**
 * PUBLIC ROUTES (Customer App)
 */

// Get complete menu for a kitchen
router.get(
  "/kitchen/:kitchenId",
  validateParams(kitchenIdParamSchema),
  validateQuery(kitchenMenuQuerySchema),
  menuController.getKitchenMenu
);

// Get meal menu item for specific window
router.get(
  "/kitchen/:kitchenId/meal/:mealWindow",
  validateParams(mealWindowParamSchema),
  menuController.getMealMenuForWindow
);

/**
 * AUTHENTICATED ROUTES (Kitchen Staff / Admin)
 */

// Create menu item
router.post(
  "/",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateBody(createMenuItemSchema),
  menuController.createMenuItem
);

// Get menu items with filters
router.get(
  "/",
  optionalAuthMiddleware,
  validateQuery(queryMenuItemsSchema),
  menuController.getMenuItems
);

// Get menu item by ID
router.get(
  "/:id",
  optionalAuthMiddleware,
  validateParams(idParamSchema),
  menuController.getMenuItemById
);

// Update menu item
router.put(
  "/:id",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(updateMenuItemSchema),
  menuController.updateMenuItem
);

// Toggle item availability
router.patch(
  "/:id/availability",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(toggleAvailabilitySchema),
  menuController.toggleAvailability
);

// Update add-ons for item
router.patch(
  "/:id/addons",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(updateAddonsSchema),
  menuController.updateAddons
);

// Soft delete menu item
router.delete(
  "/:id",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateParams(idParamSchema),
  menuController.deleteMenuItem
);

/**
 * ADMIN-ONLY ROUTES
 */

// Disable item for policy violation
router.patch(
  "/:id/disable",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(disableMenuItemSchema),
  menuController.disableMenuItem
);

// Re-enable disabled item
router.patch(
  "/:id/enable",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  menuController.enableMenuItem
);

/**
 * KITCHEN DASHBOARD ROUTES
 */

// Get kitchen's menu statistics
router.get(
  "/my-kitchen/stats",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  menuController.getMyKitchenMenuStats
);

export default router;
