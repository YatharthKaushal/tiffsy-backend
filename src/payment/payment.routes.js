import { Router } from "express";
import express from "express";
import paymentController from "./payment.controller.js";
import {
  adminAuthMiddleware,
  adminMiddleware,
  roleMiddleware,
} from "../../middlewares/auth.middleware.js";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../middlewares/validate.middleware.js";
import {
  createOrderPaymentSchema,
  createSubscriptionPaymentSchema,
  verifyPaymentSchema,
  getPaymentStatusSchema,
  retryPaymentSchema,
  queryPaymentHistorySchema,
  adminQueryTransactionsSchema,
  adminInitiateRefundSchema,
} from "./payment.validation.js";
import Joi from "joi";

const router = Router();

// Common param schemas
const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

const orderIdParamSchema = Joi.object({
  orderId: Joi.string().hex().length(24).required(),
});

const razorpayOrderIdParamSchema = Joi.object({
  razorpayOrderId: Joi.string().required(),
});

/**
 * WEBHOOK ROUTE (No auth required, uses signature verification)
 * Must be before other routes and use raw body parser
 */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paymentController.handleWebhook
);

/**
 * PUBLIC/CONFIG ROUTES
 */

// Get payment configuration (public)
router.get("/config", paymentController.getPaymentConfig);

/**
 * CUSTOMER ROUTES
 */

// Initiate payment for an existing order
router.post(
  "/order/:orderId/initiate",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateParams(orderIdParamSchema),
  paymentController.initiateOrderPayment
);

// Retry payment for a failed order
router.post(
  "/order/:orderId/retry",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateParams(orderIdParamSchema),
  paymentController.retryPayment
);

// Initiate payment for subscription purchase
router.post(
  "/subscription/initiate",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateBody(createSubscriptionPaymentSchema),
  paymentController.initiateSubscriptionPayment
);

// Verify payment (client callback after Razorpay checkout)
router.post(
  "/verify",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateBody(verifyPaymentSchema),
  paymentController.verifyPayment
);

// Get payment status
router.get(
  "/status/:razorpayOrderId",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateParams(razorpayOrderIdParamSchema),
  paymentController.getPaymentStatus
);

// Get user's payment history
router.get(
  "/history",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateQuery(queryPaymentHistorySchema),
  paymentController.getPaymentHistory
);

/**
 * ADMIN ROUTES
 */

// Get all transactions
router.get(
  "/admin/transactions",
  adminAuthMiddleware,
  adminMiddleware,
  validateQuery(adminQueryTransactionsSchema),
  paymentController.adminGetTransactions
);

// Get transaction details
router.get(
  "/admin/transactions/:id",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  paymentController.adminGetTransaction
);

// Initiate refund
router.post(
  "/admin/refund",
  adminAuthMiddleware,
  adminMiddleware,
  validateBody(adminInitiateRefundSchema),
  paymentController.adminInitiateRefund
);

// Get payment stats
router.get(
  "/admin/stats",
  adminAuthMiddleware,
  adminMiddleware,
  paymentController.adminGetStats
);

// Cleanup expired transactions (for cron job)
router.post(
  "/admin/cleanup-expired",
  adminAuthMiddleware,
  adminMiddleware,
  paymentController.adminCleanupExpired
);

export default router;
