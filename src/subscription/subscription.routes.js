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
  roleMiddleware("CUSTOMER"),
  validateBody(purchaseSubscriptionSchema),
  subscriptionController.purchaseSubscription
);

// Get my subscriptions
router.get(
  "/my-subscriptions",
  adminAuthMiddleware,
  roleMiddleware("CUSTOMER"),
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
  roleMiddleware("CUSTOMER"),
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

export default router;
