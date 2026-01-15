import { Router } from "express";
import driverController from "./driver.controller.js";
import {
  adminAuthMiddleware,
  roleMiddleware,
} from "../../middlewares/auth.middleware.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import {
  updateDriverProfileSchema,
  updateVehicleDetailsSchema,
  updateDriverImageSchema,
  requestDocumentUpdateSchema,
} from "./driver.validation.js";

const router = Router();

/**
 * ============================================================================
 * DRIVER PROFILE ROUTES
 * All routes require authentication and DRIVER role (or ADMIN)
 * ============================================================================
 */

/**
 * Get driver profile with complete details and statistics
 * @route GET /api/driver/profile
 * @access Driver, Admin
 */
router.get(
  "/profile",
  adminAuthMiddleware,
  roleMiddleware(["DRIVER", "ADMIN"]),
  driverController.getDriverProfile
);

/**
 * Update driver basic profile (name, email, profileImage)
 * @route PUT /api/driver/profile
 * @access Driver, Admin
 */
router.put(
  "/profile",
  adminAuthMiddleware,
  roleMiddleware(["DRIVER", "ADMIN"]),
  validateBody(updateDriverProfileSchema),
  driverController.updateDriverProfile
);

/**
 * Update vehicle details (name, number, type)
 * @route PATCH /api/driver/vehicle
 * @access Driver, Admin
 */
router.patch(
  "/vehicle",
  adminAuthMiddleware,
  roleMiddleware(["DRIVER", "ADMIN"]),
  validateBody(updateVehicleDetailsSchema),
  driverController.updateVehicleDetails
);

/**
 * Update profile image only
 * @route PATCH /api/driver/profile/image
 * @access Driver, Admin
 */
router.patch(
  "/profile/image",
  adminAuthMiddleware,
  roleMiddleware(["DRIVER", "ADMIN"]),
  validateBody(updateDriverImageSchema),
  driverController.updateDriverProfileImage
);

/**
 * Request document update (requires admin approval)
 * Used when driver needs to update sensitive documents like license, RC, etc.
 * @route POST /api/driver/documents/request
 * @access Driver, Admin
 */
router.post(
  "/documents/request",
  adminAuthMiddleware,
  roleMiddleware(["DRIVER", "ADMIN"]),
  validateBody(requestDocumentUpdateSchema),
  driverController.requestDocumentUpdate
);

/**
 * Get driver delivery statistics
 * @route GET /api/driver/stats
 * @access Driver, Admin
 */
router.get(
  "/stats",
  adminAuthMiddleware,
  roleMiddleware(["DRIVER", "ADMIN"]),
  driverController.getDriverStatistics
);

export default router;
