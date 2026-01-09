import { Router } from "express";
import zoneController from "./zone.controller.js";
import { authMiddleware, adminMiddleware, roleMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody, validateQuery, validateParams } from "../../middlewares/validate.middleware.js";
import {
  createZoneSchema,
  updateZoneSchema,
  toggleOrderingSchema,
  queryZonesSchema,
  cityStatusSchema,
  pincodeSchema,
} from "./zone.validation.js";
import Joi from "joi";

const router = Router();

// Param schemas
const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

/**
 * PUBLIC ROUTES
 */

// Get active zones
router.get(
  "/active",
  validateQuery(cityStatusSchema),
  zoneController.getActiveZones
);

// Get cities
router.get(
  "/cities",
  validateQuery(cityStatusSchema),
  zoneController.getCities
);

// Lookup zone by pincode
router.get(
  "/lookup/:pincode",
  validateParams(pincodeSchema),
  zoneController.lookupZoneByPincode
);

// Get zones by city
router.get(
  "/city/:cityName",
  validateQuery(cityStatusSchema),
  zoneController.getZonesByCity
);

/**
 * ADMIN ROUTES
 */

// Create zone
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  validateBody(createZoneSchema),
  zoneController.createZone
);

// Get all zones
router.get(
  "/",
  authMiddleware,
  roleMiddleware(["ADMIN", "KITCHEN_STAFF"]),
  validateQuery(queryZonesSchema),
  zoneController.getZones
);

// Get zone by ID
router.get(
  "/:id",
  authMiddleware,
  roleMiddleware(["ADMIN", "KITCHEN_STAFF"]),
  validateParams(idParamSchema),
  zoneController.getZoneById
);

// Update zone
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(updateZoneSchema),
  zoneController.updateZone
);

// Activate zone
router.patch(
  "/:id/activate",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  zoneController.activateZone
);

// Deactivate zone
router.patch(
  "/:id/deactivate",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  zoneController.deactivateZone
);

// Toggle ordering
router.patch(
  "/:id/ordering",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(toggleOrderingSchema),
  zoneController.toggleOrdering
);

// Delete zone
router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  zoneController.deleteZone
);

export default router;
