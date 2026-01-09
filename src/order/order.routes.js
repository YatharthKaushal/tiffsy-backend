import { Router } from "express";
import orderController from "./order.controller.js";
import { authMiddleware, adminMiddleware, roleMiddleware } from "../../middlewares/auth.middleware.js";
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
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  validateBody(calculatePricingSchema),
  orderController.getOrderPricing
);

// Get my orders
router.get(
  "/my-orders",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  validateQuery(queryMyOrdersSchema),
  orderController.getMyOrders
);

/**
 * KITCHEN STAFF ROUTES
 */

// Get kitchen orders
router.get(
  "/kitchen",
  authMiddleware,
  roleMiddleware("KITCHEN_STAFF"),
  validateQuery(queryKitchenOrdersSchema),
  orderController.getKitchenOrders
);

/**
 * DRIVER ROUTES
 */

// Get driver's assigned orders
router.get(
  "/driver",
  authMiddleware,
  roleMiddleware("DRIVER"),
  orderController.getDriverOrders
);

/**
 * ADMIN ROUTES
 */

// Get all orders
router.get(
  "/admin/all",
  authMiddleware,
  adminMiddleware,
  validateQuery(queryAllOrdersSchema),
  orderController.getAllOrders
);

// Get order statistics
router.get(
  "/admin/stats",
  authMiddleware,
  adminMiddleware,
  orderController.getOrderStats
);

/**
 * CREATE ORDER
 */

// Create new order
router.post(
  "/",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  validateBody(createOrderSchema),
  orderController.createOrder
);

/**
 * ORDER BY ID ROUTES
 */

// Get order by ID
router.get(
  "/:id",
  authMiddleware,
  validateParams(idParamSchema),
  orderController.getOrderById
);

// Track order
router.get(
  "/:id/track",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  validateParams(idParamSchema),
  orderController.trackOrder
);

// Rate order
router.post(
  "/:id/rate",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  validateParams(idParamSchema),
  validateBody(rateOrderSchema),
  orderController.rateOrder
);

// Customer cancel order
router.patch(
  "/:id/customer-cancel",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  validateParams(idParamSchema),
  validateBody(cancelOrderSchema),
  orderController.customerCancelOrder
);

/**
 * ORDER ACTIONS
 */

// Accept order (Kitchen Staff)
router.patch(
  "/:id/accept",
  authMiddleware,
  roleMiddleware("KITCHEN_STAFF"),
  validateParams(idParamSchema),
  validateBody(acceptOrderSchema),
  orderController.acceptOrder
);

// Reject order (Kitchen Staff)
router.patch(
  "/:id/reject",
  authMiddleware,
  roleMiddleware("KITCHEN_STAFF"),
  validateParams(idParamSchema),
  validateBody(rejectOrderSchema),
  orderController.rejectOrder
);

// Cancel order (Kitchen Staff or Admin)
router.patch(
  "/:id/cancel",
  authMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateParams(idParamSchema),
  validateBody(cancelOrderSchema),
  orderController.cancelOrder
);

// Update order status (Kitchen Staff)
router.patch(
  "/:id/status",
  authMiddleware,
  roleMiddleware("KITCHEN_STAFF"),
  validateParams(idParamSchema),
  validateBody(updateOrderStatusSchema),
  orderController.updateOrderStatus
);

// Update delivery status (Driver)
router.patch(
  "/:id/delivery-status",
  authMiddleware,
  roleMiddleware("DRIVER"),
  validateParams(idParamSchema),
  validateBody(updateDeliveryStatusSchema),
  orderController.updateDeliveryStatus
);

// Admin cancel order
router.patch(
  "/:id/admin-cancel",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(adminCancelOrderSchema),
  orderController.adminCancelOrder
);

export default router;
