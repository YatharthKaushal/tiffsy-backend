import { Router } from "express";
import customerController from "./customer.controller.js";
import { adminAuthMiddleware, roleMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import {
  completeProfileSchema,
  updateProfileSchema,
  updateDietarySchema,
  updateImageSchema,
  deleteAccountSchema,
} from "./customer.validation.js";

const router = Router();

/**
 * CUSTOMER PROFILE ROUTES
 * All routes require authentication and CUSTOMER role
 */

// Check profile completeness
router.get(
  "/profile/status",
  adminAuthMiddleware,
  roleMiddleware("CUSTOMER"),
  customerController.checkProfileCompleteness
);

// Complete profile (onboarding)
router.post(
  "/profile/complete",
  adminAuthMiddleware,
  roleMiddleware("CUSTOMER"),
  validateBody(completeProfileSchema),
  customerController.completeProfile
);

// Get profile
router.get(
  "/profile",
  adminAuthMiddleware,
  roleMiddleware("CUSTOMER"),
  customerController.getProfile
);

// Update profile
router.put(
  "/profile",
  adminAuthMiddleware,
  roleMiddleware("CUSTOMER"),
  validateBody(updateProfileSchema),
  customerController.updateProfile
);

// Update dietary preferences
router.patch(
  "/profile/dietary-preferences",
  adminAuthMiddleware,
  roleMiddleware("CUSTOMER"),
  validateBody(updateDietarySchema),
  customerController.updateDietaryPreferences
);

// Update profile image
router.patch(
  "/profile/image",
  adminAuthMiddleware,
  roleMiddleware("CUSTOMER"),
  customerController.updateProfileImage
);

// Delete account
router.delete(
  "/profile",
  adminAuthMiddleware,
  roleMiddleware("CUSTOMER"),
  validateBody(deleteAccountSchema),
  customerController.deleteAccount
);

/**
 * CONSUMER HOME & BROWSE ROUTES
 * Zone-based menu resolution with kitchen anonymization
 */

// Get home feed with menu for customer's zone
// Query: addressId (optional - uses default address if not provided)
router.get(
  "/home",
  adminAuthMiddleware,
  roleMiddleware("CUSTOMER"),
  customerController.getHomeFeed
);

// Get detailed meal menu for specific window
// Params: mealWindow (LUNCH or DINNER)
// Query: addressId (optional)
router.get(
  "/menu/:mealWindow",
  adminAuthMiddleware,
  roleMiddleware("CUSTOMER"),
  customerController.getMealMenu
);

// Check serviceability for a location
// Body: { pincode } or { zoneId }
router.post(
  "/check-serviceability",
  adminAuthMiddleware,
  roleMiddleware("CUSTOMER"),
  customerController.checkServiceability
);

export default router;
