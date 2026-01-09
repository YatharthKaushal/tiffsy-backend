import { Router } from "express";
import adminController from "./admin.controller.js";
import { authMiddleware, adminMiddleware, roleMiddleware } from "../../middlewares/auth.middleware.js";
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
  authMiddleware,
  adminMiddleware,
  adminController.getDashboard
);

/**
 * SYSTEM CONFIGURATION
 */

router.get(
  "/config",
  authMiddleware,
  adminMiddleware,
  adminController.getSystemConfig
);

router.put(
  "/config",
  authMiddleware,
  adminMiddleware,
  validateBody(updateSystemConfigSchema),
  adminController.updateSystemConfig
);

/**
 * GUIDELINES
 */

router.get(
  "/guidelines",
  authMiddleware,
  roleMiddleware(["ADMIN", "KITCHEN_STAFF"]),
  adminController.getGuidelines
);

router.put(
  "/guidelines",
  authMiddleware,
  adminMiddleware,
  validateBody(updateGuidelinesSchema),
  adminController.updateGuidelines
);

/**
 * REPORTS
 */

router.get(
  "/reports",
  authMiddleware,
  adminMiddleware,
  validateQuery(queryReportsSchema),
  adminController.getReports
);

router.get(
  "/reports/export",
  authMiddleware,
  adminMiddleware,
  validateQuery(exportReportSchema),
  adminController.exportReport
);

/**
 * AUDIT LOGS
 */

router.get(
  "/audit-logs",
  authMiddleware,
  adminMiddleware,
  validateQuery(queryAuditLogsSchema),
  adminController.getAuditLogs
);

router.get(
  "/audit-logs/:id",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  adminController.getAuditLogById
);

/**
 * USER MANAGEMENT
 */

router.post(
  "/users",
  authMiddleware,
  adminMiddleware,
  validateBody(createUserSchema),
  adminController.createUser
);

router.get(
  "/users",
  authMiddleware,
  adminMiddleware,
  validateQuery(queryUsersSchema),
  adminController.getUsers
);

router.get(
  "/users/:id",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  adminController.getUserById
);

router.put(
  "/users/:id",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(updateUserSchema),
  adminController.updateUser
);

router.delete(
  "/users/:id",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  adminController.deleteUser
);

router.patch(
  "/users/:id/activate",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  adminController.activateUser
);

router.patch(
  "/users/:id/deactivate",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  adminController.deactivateUser
);

router.patch(
  "/users/:id/suspend",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(suspendUserSchema),
  adminController.suspendUser
);

router.post(
  "/users/:id/reset-password",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(resetPasswordSchema),
  adminController.resetUserPassword
);

export default router;
