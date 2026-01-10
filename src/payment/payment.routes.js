/**
 * Payment Routes
 *
 * API routes for payment operations.
 * Includes customer and admin endpoints.
 */

import { Router } from "express";
import paymentController from "./payment.controller.js";
import webhookController from "./webhook.controller.js";
import {
  authMiddleware,
  adminMiddleware,
  roleMiddleware,
} from "../../middlewares/auth.middleware.js";
import { captureRawBody, verifyWebhookSignature } from "../../middlewares/webhook.middleware.js";
import { validateBody, validateParams, validateQuery } from "../../middlewares/validate.middleware.js";
import validation from "./payment.validation.js";

const router = Router();

// ============================================================
// WEBHOOK ROUTES (must be BEFORE express.json() body parser)
// These routes need raw body for signature verification
// ============================================================

/**
 * Handle webhook from payment provider
 * POST /api/payment/webhook/:provider
 *
 * Note: This route must NOT use express.json() middleware.
 * The captureRawBody middleware handles body parsing.
 */
router.post(
  "/webhook/:provider",
  captureRawBody,
  validateParams(validation.webhookProvider.params),
  verifyWebhookSignature,
  webhookController.handlePaymentWebhook
);

// ============================================================
// PUBLIC ROUTES
// ============================================================

/**
 * Get active payment provider info
 * GET /api/payment/provider
 */
router.get("/provider", paymentController.getProviderInfo);

// ============================================================
// CUSTOMER ROUTES (authenticated)
// ============================================================

/**
 * Initiate payment for an order
 * POST /api/payment/order/:orderId/initiate
 */
router.post(
  "/order/:orderId/initiate",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  validateParams(validation.initiateOrderPayment.params),
  paymentController.initiateOrderPayment
);

/**
 * Initiate payment for subscription purchase
 * POST /api/payment/subscription/initiate
 */
router.post(
  "/subscription/initiate",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  validateBody(validation.initiateSubscriptionPayment.body),
  paymentController.initiateSubscriptionPayment
);

/**
 * Verify payment status
 * GET /api/payment/:paymentId/verify
 */
router.get(
  "/:paymentId/verify",
  authMiddleware,
  validateParams(validation.verifyPayment.params),
  paymentController.verifyPayment
);

/**
 * Get payment history for current user
 * GET /api/payment/history
 */
router.get(
  "/history",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  validateQuery(validation.getPaymentHistory.query),
  paymentController.getPaymentHistory
);

/**
 * Get transaction by entity (order or subscription)
 * GET /api/payment/entity/:entityType/:entityId
 */
router.get(
  "/entity/:entityType/:entityId",
  authMiddleware,
  validateParams(validation.getTransactionByEntity.params),
  paymentController.getTransactionByEntityEndpoint
);

// ============================================================
// ADMIN ROUTES
// ============================================================

/**
 * Admin: List all transactions
 * GET /api/payment/admin/transactions
 */
router.get(
  "/admin/transactions",
  authMiddleware,
  adminMiddleware,
  validateQuery(validation.adminListTransactions.query),
  paymentController.adminListTransactions
);

/**
 * Admin: Get transaction details
 * GET /api/payment/admin/transaction/:transactionId
 */
router.get(
  "/admin/transaction/:transactionId",
  authMiddleware,
  adminMiddleware,
  validateParams(validation.getTransaction.params),
  paymentController.adminGetTransaction
);

/**
 * Admin: Initiate refund
 * POST /api/payment/admin/refund
 */
router.post(
  "/admin/refund",
  authMiddleware,
  adminMiddleware,
  validateBody(validation.initiateRefund.body),
  paymentController.adminInitiateRefund
);

export default router;
