import { Router } from "express";
import * as authController from "./auth.controller.js";
import { authMiddleware, firebaseAuthMiddleware, jwtAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import {
  syncUserSchema,
  registerUserSchema,
  registerDriverSchema,
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

// 
// Firebase OTP Routes (Mobile Apps)
// 

/**
 * POST /api/auth/sync
 * Check if user exists after Firebase OTP authentication
 * Returns user profile if exists, indicates new user if not
 */
router.post(
  "/sync",
  firebaseAuthMiddleware,
  validateBody(syncUserSchema),
  authController.syncUser
);

/**
 * POST /api/auth/register
 * Register new user after Firebase OTP authentication
 * Creates new customer account with profile details
 */
router.post(
  "/register",
  firebaseAuthMiddleware,
  validateBody(registerUserSchema),
  authController.registerUser
);

/**
 * POST /api/auth/register-driver
 * Register new driver after Firebase OTP authentication
 * Creates new driver account with vehicle details - requires admin approval
 */
router.post(
  "/register-driver",
  firebaseAuthMiddleware,
  validateBody(registerDriverSchema),
  authController.registerDriver
);

/**
 * PUT /api/auth/profile
 * Complete or update user profile (for existing users)
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

// 
// Admin Web Portal Routes (Username/Password)
// 

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
