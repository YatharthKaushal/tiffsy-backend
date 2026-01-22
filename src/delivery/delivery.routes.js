import { Router } from "express";
import deliveryController from "./delivery.controller.js";
import { adminAuthMiddleware, adminMiddleware, roleMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody, validateQuery, validateParams } from "../../middlewares/validate.middleware.js";
import {
  autoBatchSchema,
  dispatchBatchesSchema,
  myKitchenAutoBatchSchema,
  myKitchenDispatchSchema,
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
  adminAuthMiddleware,
  adminMiddleware,
  validateBody(autoBatchSchema),
  deliveryController.autoBatchOrders
);

// Dispatch batches
router.post(
  "/dispatch",
  adminAuthMiddleware,
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
  adminAuthMiddleware,
  roleMiddleware(["DRIVER", "ADMIN"]),
  deliveryController.getAvailableBatches
);

// Get driver batch history
router.get(
  "/batches/driver/history",
  adminAuthMiddleware,
  roleMiddleware(["DRIVER", "ADMIN"]),
  deliveryController.getDriverBatchHistory
);

// Get my batch
router.get(
  "/my-batch",
  adminAuthMiddleware,
  roleMiddleware(["DRIVER", "ADMIN"]),
  deliveryController.getMyBatch
);

/**
 * KITCHEN STAFF ROUTES
 */

// Auto-batch orders for kitchen staff's own kitchen
router.post(
  "/my-kitchen/auto-batch",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateBody(myKitchenAutoBatchSchema),
  deliveryController.autoBatchMyKitchenOrders
);

// Dispatch batches for kitchen staff's own kitchen
router.post(
  "/my-kitchen/dispatch",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateBody(myKitchenDispatchSchema),
  deliveryController.dispatchMyKitchenBatches
);

// Get kitchen batches
router.get(
  "/kitchen-batches",
  adminAuthMiddleware,
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),
  validateQuery(queryKitchenBatchesSchema),
  deliveryController.getKitchenBatches
);

/**
 * ADMIN ROUTES
 */

// Get all batches
router.get(
  "/admin/batches",
  adminAuthMiddleware,
  adminMiddleware,
  validateQuery(queryAllBatchesSchema),
  deliveryController.getAllBatches
);

// Get delivery statistics
router.get(
  "/admin/stats",
  adminAuthMiddleware,
  adminMiddleware,
  deliveryController.getDeliveryStats
);

// Update batch configuration
router.put(
  "/config",
  adminAuthMiddleware,
  adminMiddleware,
  validateBody(updateBatchConfigSchema),
  deliveryController.updateBatchConfig
);

// Get batch configuration
router.get(
  "/config",
  adminAuthMiddleware,
  adminMiddleware,
  deliveryController.getBatchConfig
);

// Kitchen batch reminder validation schema
const kitchenReminderSchema = Joi.object({
  mealWindow: Joi.string().valid("LUNCH", "DINNER").required(),
  kitchenId: Joi.string().hex().length(24).optional(),
});

// Send kitchen batch reminder (Admin/System)
router.post(
  "/kitchen-reminder",
  adminAuthMiddleware,
  adminMiddleware,
  validateBody(kitchenReminderSchema),
  deliveryController.sendKitchenBatchReminder
);

/**
 * BATCH ROUTES
 */

// Get batch by ID
router.get(
  "/batches/:batchId",
  adminAuthMiddleware,
  validateParams(batchIdParamSchema),
  deliveryController.getBatchById
);

// Accept batch (Driver or Admin)
router.post(
  "/batches/:batchId/accept",
  adminAuthMiddleware,
  roleMiddleware(["DRIVER", "ADMIN"]),
  validateParams(batchIdParamSchema),
  deliveryController.acceptBatch
);

// Mark batch as picked up (Driver or Admin)
router.patch(
  "/batches/:batchId/pickup",
  adminAuthMiddleware,
  roleMiddleware(["DRIVER", "ADMIN"]),
  validateParams(batchIdParamSchema),
  deliveryController.updateBatchPickup
);

// Complete batch (Driver or Admin)
router.patch(
  "/batches/:batchId/complete",
  adminAuthMiddleware,
  roleMiddleware(["DRIVER", "ADMIN"]),
  validateParams(batchIdParamSchema),
  deliveryController.completeBatch
);

// Update delivery sequence (Driver or Admin)
router.patch(
  "/batches/:batchId/sequence",
  adminAuthMiddleware,
  roleMiddleware(["DRIVER", "ADMIN"]),
  validateParams(batchIdParamSchema),
  validateBody(updateDeliverySequenceSchema),
  deliveryController.updateDeliverySequence
);

// Reassign batch (Admin)
router.patch(
  "/batches/:batchId/reassign",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(batchIdParamSchema),
  validateBody(reassignBatchSchema),
  deliveryController.reassignBatch
);

// Cancel batch (Admin)
router.patch(
  "/batches/:batchId/cancel",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(batchIdParamSchema),
  validateBody(cancelBatchSchema),
  deliveryController.cancelBatch
);

/**
 * ORDER DELIVERY STATUS
 */

// Update delivery status (Driver or Admin)
router.patch(
  "/orders/:orderId/status",
  adminAuthMiddleware,
  roleMiddleware(["DRIVER", "ADMIN"]),
  validateParams(orderIdParamSchema),
  validateBody(updateDeliveryStatusSchema),
  deliveryController.updateDeliveryStatus
);

export default router;
