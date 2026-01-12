import { Router } from "express";
import orderController from "./order.controller.js";
import { adminAuthMiddleware, adminMiddleware, roleMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody, validateQuery, validateParams } from "../../middlewares/validate.middleware.js";
import {
  createOrderSchema,
  calculatePricingSchema,
  queryMyOrdersSchema,
  queryKitchenOrdersSchema,
  acceptOrderSchema,
  rejectOrderSchema,
  cancelOrderSchema,
  updateOrderStatusSchema,
  updateDeliveryStatusSchema,
  adminUpdateStatusSchema,
  adminCancelOrderSchema,
  queryAllOrdersSchema,
  rateOrderSchema,
} from "./order.validation.js";
import Joi from "joi";

const router = Router();

// Common param schemas
const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

/**
 * CUSTOMER ROUTES
 */

// Calculate pricing (cart preview)
router.post(
  "/calculate-pricing",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateBody(calculatePricingSchema),
  orderController.getOrderPricing
);

// Get my orders
router.get(
  "/my-orders",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateQuery(queryMyOrdersSchema),
  orderController.getMyOrders
);

/**
 * KITCHEN STAFF ROUTES
 */

// Get kitchen orders
router.get(
  "/kitchen",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateQuery(queryKitchenOrdersSchema),
  orderController.getKitchenOrders
);

/**
 * DRIVER ROUTES
 */

// Get driver's assigned orders
router.get(
  "/driver",
  adminAuthMiddleware,
  roleMiddleware(["DRIVER", "ADMIN"]),
  orderController.getDriverOrders
);

/**
 * ADMIN ROUTES
 */

// Get all orders
router.get(
  "/admin/all",
  adminAuthMiddleware,
  adminMiddleware,
  validateQuery(queryAllOrdersSchema),
  orderController.getAllOrders
);

// Get order statistics
router.get(
  "/admin/stats",
  adminAuthMiddleware,
  adminMiddleware,
  orderController.getOrderStats
);

// Admin update order status (allows any status)
router.patch(
  "/admin/:id/status",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(adminUpdateStatusSchema),
  orderController.adminUpdateStatus
);

/**
 * CREATE ORDER
 */

// Create new order
router.post(
  "/",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateBody(createOrderSchema),
  orderController.createOrder
);

/**
 * ORDER BY ID ROUTES
 */

// Get order by ID
router.get(
  "/:id",
  adminAuthMiddleware,
  validateParams(idParamSchema),
  orderController.getOrderById
);

// Track order
router.get(
  "/:id/track",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateParams(idParamSchema),
  orderController.trackOrder
);

// Rate order
router.post(
  "/:id/rate",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(rateOrderSchema),
  orderController.rateOrder
);

// Customer cancel order
router.patch(
  "/:id/customer-cancel",
  adminAuthMiddleware,
  roleMiddleware(["CUSTOMER", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(cancelOrderSchema),
  orderController.customerCancelOrder
);

/**
 * ORDER ACTIONS
 */

// Accept order (Kitchen Staff or Admin)
router.patch(
  "/:id/accept",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(acceptOrderSchema),
  orderController.acceptOrder
);

// Reject order (Kitchen Staff or Admin)
router.patch(
  "/:id/reject",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(rejectOrderSchema),
  orderController.rejectOrder
);

// Cancel order (Kitchen Staff or Admin)
router.patch(
  "/:id/cancel",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(cancelOrderSchema),
  orderController.cancelOrder
);

// Update order status (Kitchen Staff or Admin)
router.patch(
  "/:id/status",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(updateOrderStatusSchema),
  orderController.updateOrderStatus
);

// Update delivery status (Driver or Admin)
router.patch(
  "/:id/delivery-status",
  adminAuthMiddleware,
  roleMiddleware(["DRIVER", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(updateDeliveryStatusSchema),
  orderController.updateDeliveryStatus
);

// Admin cancel order
router.patch(
  "/:id/admin-cancel",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(adminCancelOrderSchema),
  orderController.adminCancelOrder
);

export default router;
