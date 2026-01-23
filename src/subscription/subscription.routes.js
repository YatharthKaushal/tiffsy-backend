import { Router } from "express";
import subscriptionController from "./subscription.controller.js";
import { adminAuthMiddleware, adminMiddleware, roleMiddleware, optionalAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody, validateQuery, validateParams } from "../../middlewares/validate.middleware.js";
import {
  createPlanSchema,
  updatePlanSchema,
  purchaseSubscriptionSchema,
  cancelSubscriptionSchema,
  adminCancelSubscriptionSchema,
  queryPlansSchema,
  querySubscriptionsSchema,
  triggerAutoOrdersSchema,
  updateAutoOrderSettingsSchema,
  pauseSubscriptionSchema,
  skipMealSchema,
  unskipMealSchema,
  cronTriggerSchema,
  queryAutoOrderLogsSchema,
  queryFailureSummarySchema,
} from "./subscription.validation.js";
import Joi from "joi";

const router = Router();

// Param schemas
const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

// Query schemas for active plans
const queryActivePlansSchema = Joi.object({
  zoneId: Joi.string().hex().length(24).optional(),
});

// Query schemas for my subscriptions
const queryMySubscriptionsSchema = Joi.object({
  status: Joi.string().valid("ACTIVE", "EXPIRED", "CANCELLED").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

/**
 * PUBLIC ROUTES
 */

// Get active plans for customer purchase
router.get(
  "/plans/active",
  validateQuery(queryActivePlansSchema),
  subscriptionController.getActivePlans
);

/**
 * ADMIN - PLAN MANAGEMENT ROUTES
 */

// Create plan
router.post(
  "/plans",
  adminAuthMiddleware,
  adminMiddleware,
  validateBody(createPlanSchema),
  subscriptionController.createPlan
);

// Get all plans (admin view)
router.get(
  "/plans",
  adminAuthMiddleware,
  adminMiddleware,
  validateQuery(queryPlansSchema),
  subscriptionController.getPlans
);

// Get plan by ID
router.get(
  "/plans/:id",
  optionalAuthMiddleware,
  validateParams(idParamSchema),
  subscriptionController.getPlanById
);

// Update plan
router.put(
  "/plans/:id",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(updatePlanSchema),
  subscriptionController.updatePlan
);

// Activate plan
router.patch(
  "/plans/:id/activate",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  subscriptionController.activatePlan
);

// Deactivate plan
router.patch(
  "/plans/:id/deactivate",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  subscriptionController.deactivatePlan
);

// Archive plan
router.patch(
  "/plans/:id/archive",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  subscriptionController.archivePlan
);

/**
 * CUSTOMER ROUTES
 */

// Purchase subscription
router.post(
  "/purchase",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateBody(purchaseSubscriptionSchema),
  subscriptionController.purchaseSubscription
);

// Get my subscriptions
router.get(
  "/my-subscriptions",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateQuery(queryMySubscriptionsSchema),
  subscriptionController.getMySubscriptions
);

/**
 * ADMIN - SUBSCRIPTION MANAGEMENT ROUTES
 */

// Get all subscriptions (admin view)
router.get(
  "/admin/all",
  adminAuthMiddleware,
  adminMiddleware,
  validateQuery(querySubscriptionsSchema),
  subscriptionController.getAllSubscriptions
);

/**
 * SYSTEM - AUTO-ORDER TRIGGER
 * Protected by CRON_SECRET header for external schedulers
 * NOTE: These routes MUST be before /:id routes to avoid matching as an ID
 */
router.post(
  "/trigger-auto-orders",
  validateBody(triggerAutoOrdersSchema),
  subscriptionController.triggerAutoOrders
);

/**
 * CRON ENDPOINTS - Dedicated endpoints for LUNCH and DINNER auto-orders
 * Protected by CRON_SECRET header
 */

// Trigger LUNCH auto-orders
router.post(
  "/cron/lunch",
  validateBody(cronTriggerSchema),
  subscriptionController.triggerLunchAutoOrders
);

// Trigger DINNER auto-orders
router.post(
  "/cron/dinner",
  validateBody(cronTriggerSchema),
  subscriptionController.triggerDinnerAutoOrders
);

/**
 * AUTO-ORDER LOGS (Admin)
 * Endpoints to view and analyze auto-order history
 */

// Get auto-order logs with filters
router.get(
  "/auto-order-logs",
  adminAuthMiddleware,
  adminMiddleware,
  validateQuery(queryAutoOrderLogsSchema),
  subscriptionController.getAutoOrderLogs
);

// Get auto-order failure summary
router.get(
  "/auto-order-logs/summary",
  adminAuthMiddleware,
  adminMiddleware,
  validateQuery(queryFailureSummarySchema),
  subscriptionController.getAutoOrderFailureSummary
);

/**
 * SUBSCRIPTION BY ID ROUTES
 */

// Get subscription by ID
router.get(
  "/:id",
  adminAuthMiddleware,
  validateParams(idParamSchema),
  subscriptionController.getSubscriptionById
);

// Cancel subscription (customer-initiated)
router.post(
  "/:id/cancel",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(cancelSubscriptionSchema),
  subscriptionController.cancelSubscription
);

// Admin cancel subscription
router.post(
  "/:id/admin-cancel",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(adminCancelSubscriptionSchema),
  subscriptionController.adminCancelSubscription
);

/**
 * AUTO-ORDERING ROUTES
 */

// Update auto-order settings
router.put(
  "/:id/settings",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(updateAutoOrderSettingsSchema),
  subscriptionController.updateAutoOrderSettings
);

// Pause subscription auto-ordering
router.post(
  "/:id/pause",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(pauseSubscriptionSchema),
  subscriptionController.pauseSubscription
);

// Resume subscription auto-ordering
router.post(
  "/:id/resume",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateParams(idParamSchema),
  subscriptionController.resumeSubscription
);

// Skip a specific meal
router.post(
  "/:id/skip-meal",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(skipMealSchema),
  subscriptionController.skipMeal
);

// Unskip a meal (remove from skipped slots)
router.post(
  "/:id/unskip-meal",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(unskipMealSchema),
  subscriptionController.unskipMeal
);

export default router;
