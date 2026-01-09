import { Router } from "express";
import * as authController from "./auth.controller.js";
import { authMiddleware, jwtAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import {
  syncUserSchema,
  completeProfileSchema,
  adminLoginSchema,
  changePasswordSchema,
  fcmTokenSchema,
} from "./auth.validation.js";

const router = Router();

/**
 * Auth Routes
 * Base path: /api/auth
 */

// =====================
// Firebase OTP Routes (Mobile Apps)
// =====================

/**
 * POST /api/auth/sync
 * Sync/register user after Firebase OTP authentication
 */
router.post(
  "/sync",
  authMiddleware,
  validateBody(syncUserSchema),
  authController.syncUser
);

/**
 * PUT /api/auth/profile
 * Complete or update user profile
 */
router.put(
  "/profile",
  authMiddleware,
  validateBody(completeProfileSchema),
  authController.completeProfile
);

/**
 * GET /api/auth/me
 * Get current authenticated user's profile
 */
router.get("/me", authMiddleware, authController.getCurrentUser);

/**
 * POST /api/auth/fcm-token
 * Register FCM token for push notifications
 */
router.post(
  "/fcm-token",
  authMiddleware,
  validateBody(fcmTokenSchema),
  authController.updateFcmToken
);

/**
 * DELETE /api/auth/fcm-token
 * Remove FCM token (logout from device)
 */
router.delete(
  "/fcm-token",
  authMiddleware,
  validateBody(fcmTokenSchema),
  authController.removeFcmToken
);

// =====================
// Admin Web Portal Routes (Username/Password)
// =====================

/**
 * POST /api/auth/admin/login
 * Admin login with username and password
 */
router.post(
  "/admin/login",
  validateBody(adminLoginSchema),
  authController.adminLogin
);

/**
 * POST /api/auth/admin/change-password
 * Change admin password
 */
router.post(
  "/admin/change-password",
  jwtAuthMiddleware,
  validateBody(changePasswordSchema),
  authController.adminChangePassword
);

/**
 * POST /api/auth/admin/refresh
 * Refresh JWT token
 */
router.post("/admin/refresh", jwtAuthMiddleware, authController.adminRefreshToken);

export default router;
