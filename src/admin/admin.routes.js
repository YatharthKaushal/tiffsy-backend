import { Router } from "express";
import adminController from "./admin.controller.js";
import { adminAuthMiddleware, adminMiddleware, roleMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody, validateQuery, validateParams } from "../../middlewares/validate.middleware.js";
import {
  createUserSchema,
  updateUserSchema,
  suspendUserSchema,
  resetPasswordSchema,
  queryUsersSchema,
  queryAuditLogsSchema,
  updateSystemConfigSchema,
  queryReportsSchema,
  exportReportSchema,
  updateGuidelinesSchema,
} from "./admin.validation.js";
import Joi from "joi";

const router = Router();

// Param schemas
const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

/**
 * DASHBOARD
 */

router.get(
  "/dashboard",
  adminAuthMiddleware,
  adminMiddleware,
  adminController.getDashboard
);

/**
 * SYSTEM CONFIGURATION
 */

router.get(
  "/config",
  adminAuthMiddleware,
  adminMiddleware,
  adminController.getSystemConfig
);

router.put(
  "/config",
  adminAuthMiddleware,
  adminMiddleware,
  validateBody(updateSystemConfigSchema),
  adminController.updateSystemConfig
);

/**
 * GUIDELINES
 */

router.get(
  "/guidelines",
  adminAuthMiddleware,
  roleMiddleware(["ADMIN", "KITCHEN_STAFF"]),
  adminController.getGuidelines
);

router.put(
  "/guidelines",
  adminAuthMiddleware,
  adminMiddleware,
  validateBody(updateGuidelinesSchema),
  adminController.updateGuidelines
);

/**
 * REPORTS
 */

router.get(
  "/reports",
  adminAuthMiddleware,
  adminMiddleware,
  validateQuery(queryReportsSchema),
  adminController.getReports
);

router.get(
  "/reports/export",
  adminAuthMiddleware,
  adminMiddleware,
  validateQuery(exportReportSchema),
  adminController.exportReport
);

/**
 * AUDIT LOGS
 */

router.get(
  "/audit-logs",
  adminAuthMiddleware,
  adminMiddleware,
  validateQuery(queryAuditLogsSchema),
  adminController.getAuditLogs
);

router.get(
  "/audit-logs/:id",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  adminController.getAuditLogById
);

/**
 * USER MANAGEMENT
 */

router.post(
  "/users",
  adminAuthMiddleware,
  adminMiddleware,
  validateBody(createUserSchema),
  adminController.createUser
);

router.get(
  "/users",
  adminAuthMiddleware,
  adminMiddleware,
  validateQuery(queryUsersSchema),
  adminController.getUsers
);

router.get(
  "/users/:id",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  adminController.getUserById
);

router.put(
  "/users/:id",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(updateUserSchema),
  adminController.updateUser
);

router.delete(
  "/users/:id",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  adminController.deleteUser
);

router.patch(
  "/users/:id/activate",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  adminController.activateUser
);

router.patch(
  "/users/:id/deactivate",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  adminController.deactivateUser
);

router.patch(
  "/users/:id/suspend",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(suspendUserSchema),
  adminController.suspendUser
);

router.post(
  "/users/:id/reset-password",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(resetPasswordSchema),
  adminController.resetUserPassword
);

/**
 * DRIVER APPROVAL MANAGEMENT
 */

// Get pending driver registrations
router.get(
  "/drivers/pending",
  adminAuthMiddleware,
  adminMiddleware,
  adminController.getPendingDrivers
);

// Approve driver registration
router.patch(
  "/drivers/:id/approve",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  adminController.approveDriver
);

// Reject driver registration
router.patch(
  "/drivers/:id/reject",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  adminController.rejectDriver
);

/**
 * KITCHEN APPROVAL MANAGEMENT
 */

// Get pending kitchen registrations
router.get(
  "/kitchens/pending",
  adminAuthMiddleware,
  adminMiddleware,
  adminController.getPendingKitchens
);

// Approve kitchen registration
router.patch(
  "/kitchens/:id/approve",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  adminController.approveKitchen
);

// Reject kitchen registration (with reason)
const rejectKitchenSchema = Joi.object({
  reason: Joi.string().min(10).max(500).trim().required().messages({
    "any.required": "Rejection reason is required",
    "string.min": "Rejection reason must be at least 10 characters",
    "string.max": "Rejection reason cannot exceed 500 characters",
  }),
});

router.patch(
  "/kitchens/:id/reject",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(rejectKitchenSchema),
  adminController.rejectKitchen
);

export default router;
