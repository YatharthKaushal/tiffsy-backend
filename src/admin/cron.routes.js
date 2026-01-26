/**
 * Admin Cron Routes
 * Routes for managing and monitoring scheduled tasks
 */

import express from "express";
import * as cronController from "./cron.controller.js";
import { adminAuthMiddleware, adminMiddleware } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// Apply admin authentication to all routes
router.use(adminAuthMiddleware);
router.use(adminMiddleware);

/**
 * @route   GET /api/admin/cron/status
 * @desc    Get status of all scheduled tasks
 * @access  Admin
 */
router.get("/status", cronController.getCronStatus);

/**
 * @route   GET /api/admin/cron/history
 * @desc    Get execution history of cron jobs
 * @access  Admin
 */
router.get("/history", cronController.getCronHistory);

/**
 * @route   POST /api/admin/cron/voucher-expiry
 * @desc    Manually trigger voucher expiry cron
 * @access  Admin
 */
router.post("/voucher-expiry", cronController.triggerVoucherExpiry);

export default router;
