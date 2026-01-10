import { Router } from "express";
import refundController from "./refund.controller.js";
import { adminAuthMiddleware, adminMiddleware, roleMiddleware, internalAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody, validateQuery, validateParams } from "../../middlewares/validate.middleware.js";
import {
  initiateRefundSchema,
  manualRefundSchema,
  cancelRefundSchema,
  queryMyRefundsSchema,
  queryAllRefundsSchema,
  queryRefundStatsSchema,
} from "./refund.validation.js";
import Joi from "joi";

const router = Router();

// Param schemas
const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

/**
 * INTERNAL/SYSTEM ROUTES
 */

// Initiate refund (internal service call or admin)
// This endpoint should only be called by internal services (order rejection, cancellation)
// or by admins for manual refund initiation
router.post(
  "/initiate",
  internalAuthMiddleware,
  validateBody(initiateRefundSchema),
  refundController.initiateRefund
);

// Process failed refunds (cron job)
router.post(
  "/process-failed",
  adminAuthMiddleware,
  adminMiddleware,
  refundController.processFailedRefunds
);

/**
 * CUSTOMER ROUTES
 */

// Get my refunds
router.get(
  "/my-refunds",
  adminAuthMiddleware,
  roleMiddleware("CUSTOMER"),
  validateQuery(queryMyRefundsSchema),
  refundController.getMyRefunds
);

/**
 * ADMIN ROUTES
 */

// Get all refunds
router.get(
  "/admin/all",
  adminAuthMiddleware,
  adminMiddleware,
  validateQuery(queryAllRefundsSchema),
  refundController.getAllRefunds
);

// Get refund statistics
router.get(
  "/admin/stats",
  adminAuthMiddleware,
  adminMiddleware,
  validateQuery(queryRefundStatsSchema),
  refundController.getRefundStats
);

// Initiate manual refund
router.post(
  "/admin/manual",
  adminAuthMiddleware,
  adminMiddleware,
  validateBody(manualRefundSchema),
  refundController.initiateManualRefund
);

/**
 * BY ID ROUTES
 */

// Get refund by ID
router.get(
  "/:id",
  adminAuthMiddleware,
  validateParams(idParamSchema),
  refundController.getRefundById
);

// Process refund
router.post(
  "/:id/process",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  refundController.processRefund
);

// Approve refund
router.patch(
  "/:id/approve",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  refundController.approveRefund
);

// Cancel refund
router.patch(
  "/:id/cancel",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(cancelRefundSchema),
  refundController.cancelRefund
);

// Retry refund
router.post(
  "/:id/retry",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  refundController.retryRefund
);

export default router;
