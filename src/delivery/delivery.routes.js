import { Router } from "express";
import deliveryController from "./delivery.controller.js";
import { authMiddleware, adminMiddleware, roleMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody, validateQuery, validateParams } from "../../middlewares/validate.middleware.js";
import {
  autoBatchSchema,
  dispatchBatchesSchema,
  updateDeliveryStatusSchema,
  updateDeliverySequenceSchema,
  queryKitchenBatchesSchema,
  queryAllBatchesSchema,
  reassignBatchSchema,
  cancelBatchSchema,
  updateBatchConfigSchema,
} from "./delivery.validation.js";
import Joi from "joi";

const router = Router();

// Param schemas
const batchIdParamSchema = Joi.object({
  batchId: Joi.string().hex().length(24).required(),
});

const orderIdParamSchema = Joi.object({
  orderId: Joi.string().hex().length(24).required(),
});

/**
 * SYSTEM/INTERNAL ROUTES
 */

// Auto-batch orders
router.post(
  "/auto-batch",
  authMiddleware,
  adminMiddleware,
  validateBody(autoBatchSchema),
  deliveryController.autoBatchOrders
);

// Dispatch batches
router.post(
  "/dispatch",
  authMiddleware,
  adminMiddleware,
  validateBody(dispatchBatchesSchema),
  deliveryController.dispatchBatches
);

/**
 * DRIVER ROUTES
 */

// Get available batches
router.get(
  "/available-batches",
  authMiddleware,
  roleMiddleware("DRIVER"),
  deliveryController.getAvailableBatches
);

// Get my batch
router.get(
  "/my-batch",
  authMiddleware,
  roleMiddleware("DRIVER"),
  deliveryController.getMyBatch
);

/**
 * KITCHEN STAFF ROUTES
 */

// Get kitchen batches
router.get(
  "/kitchen-batches",
  authMiddleware,
  roleMiddleware("KITCHEN_STAFF"),
  validateQuery(queryKitchenBatchesSchema),
  deliveryController.getKitchenBatches
);

/**
 * ADMIN ROUTES
 */

// Get all batches
router.get(
  "/admin/batches",
  authMiddleware,
  adminMiddleware,
  validateQuery(queryAllBatchesSchema),
  deliveryController.getAllBatches
);

// Get delivery statistics
router.get(
  "/admin/stats",
  authMiddleware,
  adminMiddleware,
  deliveryController.getDeliveryStats
);

// Update batch configuration
router.put(
  "/config",
  authMiddleware,
  adminMiddleware,
  validateBody(updateBatchConfigSchema),
  deliveryController.updateBatchConfig
);

// Get batch configuration
router.get(
  "/config",
  authMiddleware,
  adminMiddleware,
  deliveryController.getBatchConfig
);

/**
 * BATCH ROUTES
 */

// Get batch by ID
router.get(
  "/batches/:batchId",
  authMiddleware,
  validateParams(batchIdParamSchema),
  deliveryController.getBatchById
);

// Accept batch (Driver)
router.post(
  "/batches/:batchId/accept",
  authMiddleware,
  roleMiddleware("DRIVER"),
  validateParams(batchIdParamSchema),
  deliveryController.acceptBatch
);

// Mark batch as picked up (Driver)
router.patch(
  "/batches/:batchId/pickup",
  authMiddleware,
  roleMiddleware("DRIVER"),
  validateParams(batchIdParamSchema),
  deliveryController.updateBatchPickup
);

// Complete batch (Driver)
router.patch(
  "/batches/:batchId/complete",
  authMiddleware,
  roleMiddleware("DRIVER"),
  validateParams(batchIdParamSchema),
  deliveryController.completeBatch
);

// Update delivery sequence (Driver)
router.patch(
  "/batches/:batchId/sequence",
  authMiddleware,
  roleMiddleware("DRIVER"),
  validateParams(batchIdParamSchema),
  validateBody(updateDeliverySequenceSchema),
  deliveryController.updateDeliverySequence
);

// Reassign batch (Admin)
router.patch(
  "/batches/:batchId/reassign",
  authMiddleware,
  adminMiddleware,
  validateParams(batchIdParamSchema),
  validateBody(reassignBatchSchema),
  deliveryController.reassignBatch
);

// Cancel batch (Admin)
router.patch(
  "/batches/:batchId/cancel",
  authMiddleware,
  adminMiddleware,
  validateParams(batchIdParamSchema),
  validateBody(cancelBatchSchema),
  deliveryController.cancelBatch
);

/**
 * ORDER DELIVERY STATUS
 */

// Update delivery status (Driver)
router.patch(
  "/orders/:orderId/status",
  authMiddleware,
  roleMiddleware("DRIVER"),
  validateParams(orderIdParamSchema),
  validateBody(updateDeliveryStatusSchema),
  deliveryController.updateDeliveryStatus
);

export default router;
