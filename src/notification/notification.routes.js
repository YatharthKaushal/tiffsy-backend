import { Router } from "express";
import notificationController from "./notification.controller.js";
import { adminAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { validateParams, validateQuery } from "../../middlewares/validate.middleware.js";
import Joi from "joi";

const router = Router();

// Validation schemas
const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

const notificationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  unreadOnly: Joi.string().valid("true", "false").optional(),
});

/**
 * Get user's notifications with pagination
 * GET /api/notifications
 */
router.get(
  "/",
  adminAuthMiddleware,
  validateQuery(notificationQuerySchema),
  notificationController.getMyNotifications
);

/**
 * Get latest unread notification (for app open popup)
 * GET /api/notifications/latest-unread
 */
router.get(
  "/latest-unread",
  adminAuthMiddleware,
  notificationController.getLatestUnread
);

/**
 * Get unread notification count (for badge)
 * GET /api/notifications/unread-count
 */
router.get(
  "/unread-count",
  adminAuthMiddleware,
  notificationController.getUnreadCount
);

/**
 * Mark all notifications as read
 * POST /api/notifications/mark-all-read
 */
router.post(
  "/mark-all-read",
  adminAuthMiddleware,
  notificationController.markAllAsRead
);

/**
 * Mark notification as read
 * PATCH /api/notifications/:id/read
 */
router.patch(
  "/:id/read",
  adminAuthMiddleware,
  validateParams(idParamSchema),
  notificationController.markAsRead
);

/**
 * Delete notification
 * DELETE /api/notifications/:id
 */
router.delete(
  "/:id",
  adminAuthMiddleware,
  validateParams(idParamSchema),
  notificationController.deleteNotification
);

export default router;
