import { Router } from "express";
import voucherController from "./voucher.controller.js";
import { adminAuthMiddleware, adminMiddleware, roleMiddleware, internalAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody, validateQuery, validateParams } from "../../middlewares/validate.middleware.js";
import {
  checkEligibilitySchema,
  redeemVouchersSchema,
  restoreVouchersSchema,
  adminRestoreSchema,
  updateCutoffTimesSchema,
  queryVouchersSchema,
  adminQueryVouchersSchema,
} from "./voucher.validation.js";
import Joi from "joi";

const router = Router();

// Param schemas
const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

// Cutoff times query schema
const cutoffQuerySchema = Joi.object({
  zoneId: Joi.string().hex().length(24).optional(),
});

/**
 * PUBLIC ROUTES
 */

// Get cutoff times configuration
router.get(
  "/cutoff-times",
  validateQuery(cutoffQuerySchema),
  voucherController.getCutoffTimes
);

/**
 * CUSTOMER ROUTES
 */

// Get voucher balance
router.get(
  "/balance",
  adminAuthMiddleware,
  roleMiddleware("CUSTOMER"),
  voucherController.getVoucherBalance
);

// Get my vouchers
router.get(
  "/my-vouchers",
  adminAuthMiddleware,
  roleMiddleware("CUSTOMER"),
  validateQuery(queryVouchersSchema),
  voucherController.getMyVouchers
);

// Check voucher eligibility
router.post(
  "/check-eligibility",
  adminAuthMiddleware,
  roleMiddleware("CUSTOMER"),
  validateBody(checkEligibilitySchema),
  voucherController.checkVoucherEligibility
);

/**
 * INTERNAL ROUTES (Service-to-Service)
 */

// Redeem vouchers (called by order service)
router.post(
  "/redeem",
  internalAuthMiddleware,
  validateBody(redeemVouchersSchema),
  voucherController.redeemVouchers
);

// Restore vouchers (after order cancellation)
router.post(
  "/restore",
  internalAuthMiddleware,
  validateBody(restoreVouchersSchema),
  voucherController.restoreVouchers
);

/**
 * ADMIN ROUTES
 */

// Get all vouchers (admin view)
router.get(
  "/admin/all",
  adminAuthMiddleware,
  adminMiddleware,
  validateQuery(adminQueryVouchersSchema),
  voucherController.getAllVouchers
);

// Get voucher statistics
router.get(
  "/admin/stats",
  adminAuthMiddleware,
  adminMiddleware,
  voucherController.getVoucherStats
);

// Expire vouchers (cron job endpoint)
router.post(
  "/admin/expire",
  adminAuthMiddleware,
  adminMiddleware,
  voucherController.expireVouchers
);

// Admin restore vouchers
router.post(
  "/admin/restore",
  adminAuthMiddleware,
  adminMiddleware,
  validateBody(adminRestoreSchema),
  voucherController.adminRestoreVouchers
);

// Update cutoff times configuration
router.put(
  "/cutoff-times",
  adminAuthMiddleware,
  adminMiddleware,
  validateBody(updateCutoffTimesSchema),
  voucherController.updateCutoffTimes
);

/**
 * VOUCHER BY ID ROUTES
 */

// Get voucher by ID
router.get(
  "/:id",
  adminAuthMiddleware,
  validateParams(idParamSchema),
  voucherController.getVoucherById
);

export default router;
