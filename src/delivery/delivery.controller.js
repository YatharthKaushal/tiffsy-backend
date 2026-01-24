import DeliveryBatch from "../../schema/deliveryBatch.schema.js";
import DeliveryAssignment from "../../schema/deliveryAssignment.schema.js";
import Order from "../../schema/order.schema.js";
import Kitchen from "../../schema/kitchen.schema.js";
import Zone from "../../schema/zone.schema.js";
import { sendResponse } from "../../utils/response.utils.js";
import { safeAuditCreate } from "../../utils/audit.utils.js";
import { checkCutoffTime } from "../../services/config.service.js";
import { sendToRole, sendToUserIds, sendToUser } from "../../services/notification.service.js";
import { DRIVER_TEMPLATES, BATCH_REMINDER_TEMPLATES, buildFromTemplate, getOrderStatusNotification } from "../../services/notification-templates.service.js";
import User from "../../schema/user.schema.js";


/**
 * 
 * CONFIGURATION
 * 
 */

// In-memory config (could be stored in DB for persistence)
let BATCH_CONFIG = {
  maxBatchSize: 15,
  failedOrderPolicy: "NO_RETURN",
  autoDispatchDelay: 0, // minutes after window end
};

// DEPRECATED: Window end times (now fetched from Kitchen.operatingHours)
// Keeping as fallback only in case kitchen doesn't have operatingHours configured
const WINDOW_END_TIMES = {
  LUNCH: { hour: 13, minute: 0 },
  DINNER: { hour: 22, minute: 0 },
};

/**
 * 
 * HELPER FUNCTIONS
 * 
 */

/**
 * Find or create a batch for auto-batching
 * @param {string} kitchenId - Kitchen ID
 * @param {string} zoneId - Zone ID
 * @param {string} mealWindow - LUNCH or DINNER
 * @param {Date} windowEndTime - Window end time
 * @returns {Promise<{batch: Object, wasCreated: boolean}>} Batch document and creation flag
 */
async function findOrCreateBatch(kitchenId, zoneId, mealWindow, windowEndTime) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find existing collecting batch
  let batch = await DeliveryBatch.findOne({
    kitchenId,
    zoneId,
    mealWindow,
    batchDate: { $gte: today },
    status: "COLLECTING",
    $expr: { $lt: [{ $size: "$orderIds" }, "$maxBatchSize"] },
  });

  let wasCreated = false;

  if (!batch) {
    // Get zone code for batch number
    const zone = await Zone.findById(zoneId);
    const zoneCode = zone?.code || "XX";

    batch = new DeliveryBatch({
      batchNumber: DeliveryBatch.generateBatchNumber(zoneCode),
      kitchenId,
      zoneId,
      menuType: "MEAL_MENU",
      mealWindow,
      batchDate: new Date(),
      windowEndTime,
      maxBatchSize: BATCH_CONFIG.maxBatchSize,
      creationType: "AUTO",
    });
    await batch.save();
    wasCreated = true;
  }

  return { batch, wasCreated };
}

/**
 * Atomic driver assignment to batch (prevents race condition)
 * @param {string} batchId - Batch ID
 * @param {string} driverId - Driver ID
 * @returns {Promise<{success: boolean, batch: Object|null}>}
 */
async function assignDriverToBatch(batchId, driverId) {
  const result = await DeliveryBatch.findOneAndUpdate(
    {
      _id: batchId,
      status: "READY_FOR_DISPATCH",
      driverId: null,
    },
    {
      $set: {
        driverId,
        status: "DISPATCHED",
        driverAssignedAt: new Date(),
        dispatchedAt: new Date(),
      },
    },
    { new: true }
  );

  return {
    success: !!result,
    batch: result,
  };
}

/**
 * Create delivery assignments for batch orders
 * @param {string} batchId - Batch ID
 * @param {Array} orderIds - Order IDs
 * @param {string} driverId - Driver ID
 * @returns {Promise<Array>} Created assignments
 */
async function createDeliveryAssignments(batchId, orderIds, driverId) {
  const assignments = [];

  for (let i = 0; i < orderIds.length; i++) {
    const assignment = new DeliveryAssignment({
      orderId: orderIds[i],
      driverId,
      batchId,
      sequenceInBatch: i + 1,
      assignedBy: "SYSTEM",
    });
    await assignment.generateOtp();
    assignments.push(assignment);
  }

  return assignments;
}

/**
 * Update batch counters based on order statuses
 * @param {string} batchId - Batch ID
 * @returns {Promise<Object>} Updated counters
 */
async function updateBatchCounters(batchId) {
  const batch = await DeliveryBatch.findById(batchId);
  if (!batch) return null;

  const orders = await Order.find({ _id: { $in: batch.orderIds } });

  const delivered = orders.filter((o) => o.status === "DELIVERED").length;
  const failed = orders.filter((o) => o.status === "FAILED").length;

  batch.totalDelivered = delivered;
  batch.totalFailed = failed;
  await batch.save();

  return { delivered, failed, total: orders.length };
}

/**
 * Check if batch is complete
 * @param {string} batchId - Batch ID
 * @returns {Promise<{isComplete: boolean, status: string}>}
 */
async function checkBatchComplete(batchId) {
  const batch = await DeliveryBatch.findById(batchId);
  if (!batch) return { isComplete: false, status: "UNKNOWN" };

  const orders = await Order.find({ _id: { $in: batch.orderIds } });
  const finalStatuses = ["DELIVERED", "FAILED"];

  const allComplete = orders.every((o) => finalStatuses.includes(o.status));
  const hasFailures = orders.some((o) => o.status === "FAILED");

  if (allComplete) {
    return {
      isComplete: true,
      status: hasFailures ? "PARTIAL_COMPLETE" : "COMPLETED",
    };
  }

  return { isComplete: false, status: batch.status };
}

/**
 * Get window end time for a meal window from kitchen operating hours
 * All times are in IST (Asia/Kolkata) timezone
 * @param {string} mealWindow - LUNCH or DINNER
 * @param {Object} kitchen - Kitchen document with operatingHours (optional)
 * @returns {Date} Window end time in IST
 */
function getWindowEndTime(mealWindow, kitchen = null) {
  let endHour, endMinute;

  // Try to get from kitchen's operating hours first
  if (kitchen?.operatingHours) {
    const mealWindowKey = mealWindow.toLowerCase(); // 'lunch' or 'dinner'
    const operatingHours = kitchen.operatingHours[mealWindowKey];

    if (operatingHours?.endTime) {
      const [hour, minute] = operatingHours.endTime.split(':').map(Number);
      endHour = hour;
      endMinute = minute;
    }
  }

  // Fallback to hardcoded values if kitchen doesn't have operating hours configured
  if (endHour === undefined || endMinute === undefined) {
    const windowEnd = WINDOW_END_TIMES[mealWindow];
    endHour = windowEnd.hour;
    endMinute = windowEnd.minute;
  }

  // Get current time in IST (Asia/Kolkata)
  // All users are in India, server might be in different timezone (e.g., Render)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + istOffset);

  // Create end time for today in IST
  const endTime = new Date(istNow);
  endTime.setHours(endHour, endMinute, 0, 0);

  return endTime;
}

/**
 * 
 * AUTO-BATCHING FUNCTIONS
 * 
 */

/**
 * Auto-batch orders
 * @route POST /api/delivery/auto-batch
 * @access System/Admin
 */
export async function autoBatchOrders(req, res) {
  try {
    const { mealWindow, kitchenId } = req.body;

    // Build query for unbatched ready orders
    const query = {
      menuType: "MEAL_MENU",
      status: { $in: ["ACCEPTED", "PREPARING", "READY"] },
      batchId: null,
    };

    if (mealWindow) query.mealWindow = mealWindow;
    if (kitchenId) query.kitchenId = kitchenId;

    const orders = await Order.find(query);

    if (orders.length === 0) {
      return sendResponse(res, 200, true, "No orders to batch", {
        batchesCreated: 0,
        batchesUpdated: 0,
        ordersProcessed: 0,
        batches: [],
      });
    }

    // Group orders by kitchen + zone
    const groups = {};
    for (const order of orders) {
      const key = `${order.kitchenId}_${order.zoneId}_${order.mealWindow}`;
      if (!groups[key]) {
        groups[key] = {
          kitchenId: order.kitchenId,
          zoneId: order.zoneId,
          mealWindow: order.mealWindow,
          orders: [],
        };
      }
      groups[key].orders.push(order);
    }

    let batchesCreated = 0;
    let batchesUpdated = 0;
    let ordersProcessed = 0;
    const batchSummaries = [];

    // Process each group
    for (const key of Object.keys(groups)) {
      const group = groups[key];

      // Fetch kitchen to get operating hours from database
      const kitchen = await Kitchen.findById(group.kitchenId);
      if (!kitchen) {
        console.log(`> Auto-batch: Kitchen ${group.kitchenId} not found, skipping group`);
        continue;
      }

      // Get window end time using kitchen's operating hours
      const windowEndTime = getWindowEndTime(group.mealWindow, kitchen);

      // Find or create batch
      const { batch, wasCreated } = await findOrCreateBatch(
        group.kitchenId,
        group.zoneId,
        group.mealWindow,
        windowEndTime
      );

      if (wasCreated) {
        batchesCreated++;
      } else {
        batchesUpdated++;
      }

      // Add orders to batch (up to max size)
      const availableSlots = BATCH_CONFIG.maxBatchSize - batch.orderIds.length;
      const ordersToAdd = group.orders.slice(0, availableSlots);

      for (const order of ordersToAdd) {
        await batch.addOrder(order._id);
        order.batchId = batch._id;
        await order.save();
        ordersProcessed++;
      }

      batchSummaries.push({
        batchId: batch._id,
        batchNumber: batch.batchNumber,
        orderCount: batch.orderIds.length,
        zone: group.zoneId,
        kitchen: group.kitchenId,
      });
    }

    return sendResponse(res, 200, true, "Auto-batching complete", {
      batchesCreated,
      batchesUpdated,
      ordersProcessed,
      batches: batchSummaries,
    });
  } catch (error) {
    console.log("Auto-batch orders error:", error);
    return sendResponse(res, 500, false, "Failed to auto-batch orders");
  }
}

/**
 * Dispatch batches after meal window ends
 * FR-DLV-9: Dispatch batches only after the meal time window ends
 * @route POST /api/delivery/dispatch
 * @access System/Admin
 */
export async function dispatchBatches(req, res) {
  try {
    const { mealWindow, kitchenId, forceDispatch = false } = req.body;
    const now = new Date();

    // Fetch kitchen to get dynamic operating hours from database
    const kitchen = await Kitchen.findById(kitchenId);
    if (!kitchen) {
      return sendResponse(res, 404, false, "Kitchen not found");
    }

    // FR-DLV-9: Verify meal window / order cutoff time has passed before allowing dispatch
    // Pass kitchen to checkCutoffTime so it uses kitchen's operatingHours.endTime from database
    // instead of system config default cutoff times
    const cutoffInfo = checkCutoffTime(mealWindow, kitchen);

    if (!cutoffInfo.isPastCutoff && !forceDispatch) {
      // Calculate remaining time until cutoff / meal window ends
      const cutoffTimeStr = cutoffInfo.cutoffTime;
      return sendResponse(
        res,
        400,
        false,
        `Cannot dispatch ${mealWindow} batches yet. Meal window ends in ${cutoffInfo.currentTime} (cutoff: ${cutoffTimeStr}). Use forceDispatch=true to override (Admin only).`
      );
    }

    // Find batches ready for dispatch
    // Note: We already validated that cutoff time has passed above
    // No need to filter by windowEndTime (which is delivery end time, not cutoff)
    const batchQuery = {
      status: "COLLECTING",
      mealWindow,
      kitchenId, // Filter by kitchen
      orderIds: { $ne: [] },
    };


    const batches = await DeliveryBatch.find(batchQuery);

    if (batches.length === 0) {
      return sendResponse(res, 200, true, "No batches to dispatch", {
        batchesDispatched: 0,
        batches: [],
      });
    }

    const dispatchedBatches = [];

    for (const batch of batches) {
      batch.status = "READY_FOR_DISPATCH";
      await batch.save();

      dispatchedBatches.push({
        batchId: batch._id,
        batchNumber: batch.batchNumber,
        status: batch.status,
        orderCount: batch.orderIds.length,
      });
    }

    // Notify all active drivers about available batches
    if (dispatchedBatches.length > 0) {
      const totalOrders = dispatchedBatches.reduce((sum, b) => sum + b.orderCount, 0);
      const { title, body } = buildFromTemplate(DRIVER_TEMPLATES.BATCH_READY, {
        orderCount: totalOrders,
        kitchenName: kitchen.name,
      });
      sendToRole("DRIVER", "BATCH_READY", title, body, {
        data: {
          kitchenId: kitchenId.toString(),
          mealWindow,
          batchCount: dispatchedBatches.length.toString(),
        },
        entityType: "BATCH",
      });
    }

    return sendResponse(res, 200, true, "Batches dispatched", {
      batchesDispatched: batches.length,
      batches: dispatchedBatches,
    });
  } catch (error) {
    console.log("Dispatch batches error:", error);
    return sendResponse(res, 500, false, "Failed to dispatch batches");
  }
}

/**
 * 
 * DRIVER - BATCH & DELIVERY FUNCTIONS
 * 
 */

/**
 * Get available batches for driver
 * @route GET /api/delivery/available-batches
 * @access Driver
 */
export async function getAvailableBatches(req, res) {
  try {
    const batches = await DeliveryBatch.find({
      status: "READY_FOR_DISPATCH",
    })
      .populate("kitchenId", "name address")
      .populate("zoneId", "name city")
      .sort({ windowEndTime: 1 });

    const batchList = batches.map((batch) => ({
      _id: batch._id,
      batchNumber: batch.batchNumber,
      kitchen: batch.kitchenId,
      zone: batch.zoneId,
      orderCount: batch.orderIds.length,
      mealWindow: batch.mealWindow,
      estimatedEarnings: batch.orderIds.length * 20, // Simplified calculation
    }));

    return sendResponse(res, 200, true, "Available batches retrieved", {
      batches: batchList,
    });
  } catch (error) {
    console.log("Get available batches error:", error);
    return sendResponse(
      res,
      500,
      false,
      "Failed to retrieve available batches"
    );
  }
}

/**
 * Get driver's batch history
 * @route GET /api/delivery/batches/driver/history
 * @access Driver
 * @returns {object} Response object with batches and single orders
 * @example
 * Response Body:
 * {
 *   "success": true,
 *   "message": "Driver batch history retrieved",
 *   "data": {
 *     "batches": [
 *       {
 *         "batchId": "BATCH-2023...",
 *         "status": "COMPLETED",
 *         "totalOrders": 3,
 *         "kitchen": { "name": "Kitchen 1", ... },
 *         "orders": [ ... ]
 *       }
 *     ],
 *     "singleOrders": []
 *   }
 * }
 */
export async function getDriverBatchHistory(req, res) {
  try {
    const driverId = req.user._id;

    // 1. Get all batches assigned to this driver
    //    Sort by most recent first
    const batches = await DeliveryBatch.find({
      driverId,
      // Optional: Filter for completed statuses?
      // status: { $in: ["COMPLETED", "PARTIAL_COMPLETE", "CANCELLED"] }
      // Or just return all past batches including current one?
      // "History" usually implies past, but seeing everything is safer unless specified.
    })
      .populate("kitchenId", "name address")
      .populate("zoneId", "name city")
      .sort({ createdAt: -1 });

    const batchList = [];

    for (const batch of batches) {
      // Get orders for this batch
      const orders = await Order.find({ _id: { $in: batch.orderIds } })
        .select("orderNumber status deliveryAddress items grandTotal placedAt")
        .sort({ "deliveryAddress.pincode": 1 }); // Just an example sort

      batchList.push({
        batchId: batch.batchNumber, // User asked for batchId which is usually the friendly ID
        _id: batch._id,
        status: batch.status,
        date: batch.batchDate,
        totalOrders: batch.orderIds.length,
        kitchen: batch.kitchenId,
        zone: batch.zoneId,
        orders: orders,
        // Add more fields if needed
        driverAssignedAt: batch.driverAssignedAt,
        completedAt: batch.completedAt,
      });
    }

    // 2. Get single orders (assigned to driver but NO batch)
    //    These might be ad-hoc assignments or errors
    const singleOrders = await Order.find({
      driverId,
      batchId: null,
    })
      .populate("kitchenId", "name address")
      .sort({ placedAt: -1 });

    return sendResponse(res, 200, true, "Driver batch history retrieved", {
      batches: batchList,
      singleOrders,
    });
  } catch (error) {
    console.log("Get driver batch history error:", error);
    return sendResponse(
      res,
      500,
      false,
      "Failed to retrieve driver batch history"
    );
  }
}

/**
 * Accept a batch (first to accept gets it)
 * @route POST /api/delivery/batches/:batchId/accept
 * @access Driver
 */
export async function acceptBatch(req, res) {
  try {
    const { batchId } = req.params;
    const driverId = req.user._id;

    // Atomic assignment
    const result = await assignDriverToBatch(batchId, driverId);

    if (!result.success) {
      return sendResponse(
        res,
        400,
        false,
        "Batch already taken or not available"
      );
    }

    const batch = result.batch;

    // Update orders with driver
    await Order.updateMany(
      { _id: { $in: batch.orderIds } },
      { $set: { driverId } }
    );

    // Create delivery assignments
    await createDeliveryAssignments(batch._id, batch.orderIds, driverId);

    // Get order details (include userId for notifications)
    const orders = await Order.find({ _id: { $in: batch.orderIds } }).select(
      "orderNumber deliveryAddress items status userId"
    );

    // Get kitchen address
    const kitchen = await Kitchen.findById(batch.kitchenId).select(
      "name address"
    );

    // Send notification to all customers that driver is on the way
    for (const order of orders) {
      sendToUser(order.userId, "ORDER_OUT_FOR_DELIVERY", "Driver On The Way!", `Your order #${order.orderNumber} has been picked up by a delivery partner and is on the way!`, {
        data: {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          status: "DISPATCHED",
        },
        entityType: "ORDER",
        entityId: order._id,
      });
    }

    return sendResponse(res, 200, true, "Batch accepted", {
      batch,
      orders,
      pickupAddress: kitchen?.address,
      deliveries: orders.map((o, i) => ({
        order: o,
        address: o.deliveryAddress,
        sequence: i + 1,
      })),
    });
  } catch (error) {
    console.log("Accept batch error:", error);
    return sendResponse(res, 500, false, "Failed to accept batch");
  }
}

/**
 * Get driver's current batch
 * @route GET /api/delivery/my-batch
 * @access Driver
 */
export async function getMyBatch(req, res) {
  try {
    const driverId = req.user._id;

    const batch = await DeliveryBatch.findOne({
      driverId,
      status: { $in: ["DISPATCHED", "IN_PROGRESS"] },
    })
      .populate("kitchenId", "name address phone")
      .populate("zoneId", "name city");

    if (!batch) {
      return sendResponse(res, 200, true, "No active batch", {
        batch: null,
        orders: [],
        summary: { totalOrders: 0, delivered: 0, pending: 0, failed: 0 },
      });
    }

    // Get orders with delivery assignments
    const orders = await Order.find({ _id: { $in: batch.orderIds } });
    const assignments = await DeliveryAssignment.find({ batchId: batch._id });

    // Merge order info with assignment info
    const ordersWithAssignments = orders.map((order) => {
      const assignment = assignments.find(
        (a) => a.orderId.toString() === order._id.toString()
      );
      return {
        ...order.toObject(),
        sequenceNumber: assignment?.sequenceInBatch,
        assignmentStatus: assignment?.status,
      };
    });

    // Calculate summary
    const summary = {
      totalOrders: orders.length,
      delivered: orders.filter((o) => o.status === "DELIVERED").length,
      pending: orders.filter((o) =>
        ["READY", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(o.status)
      ).length,
      failed: orders.filter((o) => o.status === "FAILED").length,
    };

    return sendResponse(res, 200, true, "Current batch retrieved", {
      batch,
      orders: ordersWithAssignments,
      pickupAddress: batch.kitchenId?.address,
      summary,
    });
  } catch (error) {
    console.log("Get my batch error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve batch");
  }
}

/**
 * Mark batch as picked up
 * @route PATCH /api/delivery/batches/:batchId/pickup
 * @access Driver (assigned)
 */
export async function updateBatchPickup(req, res) {
  try {
    const { batchId } = req.params;
    const driverId = req.user._id;
    const isAdmin = req.user.role === "ADMIN";

    const batch = await DeliveryBatch.findById(batchId);
    if (!batch) {
      return sendResponse(res, 404, false, "Batch not found");
    }

    // Admin can update any batch, driver can only update their assigned batches
    if (!isAdmin && batch.driverId?.toString() !== driverId.toString()) {
      return sendResponse(res, 403, false, "Not assigned to this batch");
    }

    if (batch.status !== "DISPATCHED") {
      return sendResponse(
        res,
        400,
        false,
        "Batch must be in DISPATCHED status"
      );
    }

    // Update batch
    batch.status = "IN_PROGRESS";
    batch.pickedUpAt = new Date();
    await batch.save();

    const now = new Date();

    // Update all orders: PICKED_UP then automatically OUT_FOR_DELIVERY
    await Order.updateMany(
      { _id: { $in: batch.orderIds } },
      {
        $set: { status: "OUT_FOR_DELIVERY", pickedUpAt: now },
        $push: {
          statusTimeline: {
            $each: [
              {
                status: "PICKED_UP",
                timestamp: now,
                updatedBy: driverId,
                notes: "Picked up by driver",
              },
              {
                status: "OUT_FOR_DELIVERY",
                timestamp: new Date(now.getTime() + 1), // 1ms later for ordering
                updatedBy: driverId,
                notes: "Driver left for delivery",
              },
            ],
          },
        },
      }
    );

    // Update assignments
    await DeliveryAssignment.updateMany(
      { batchId },
      { $set: { status: "OUT_FOR_DELIVERY", pickedUpAt: now } }
    );

    // Send notifications to all customers in this batch
    const orders = await Order.find({ _id: { $in: batch.orderIds } }).select("userId orderNumber");
    for (const order of orders) {
      const notification = getOrderStatusNotification("OUT_FOR_DELIVERY", order);
      if (notification) {
        sendToUser(order.userId, "ORDER_OUT_FOR_DELIVERY", notification.title, notification.body, {
          data: {
            orderId: order._id.toString(),
            orderNumber: order.orderNumber,
            status: "OUT_FOR_DELIVERY",
          },
          entityType: "ORDER",
          entityId: order._id,
        });
      }
    }

    return sendResponse(res, 200, true, "Batch picked up, driver out for delivery", { batch });
  } catch (error) {
    console.log("Update batch pickup error:", error);
    return sendResponse(res, 500, false, "Failed to update batch pickup");
  }
}

/**
 * Update individual delivery status
 * @route PATCH /api/delivery/orders/:orderId/status
 * @access Driver (assigned)
 */
export async function updateDeliveryStatus(req, res) {
  try {
    const { orderId } = req.params;
    const { status, notes, failureReason, proofOfDelivery } = req.body;
    const driverId = req.user._id;
    const isAdmin = req.user.role === "ADMIN";

    // Find assignment - admin can update any order, driver can only update their assigned orders
    const assignmentQuery = isAdmin ? { orderId } : { orderId, driverId };
    const assignment = await DeliveryAssignment.findOne(assignmentQuery);

    if (!assignment) {
      return sendResponse(res, 403, false, "Not assigned to this order");
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return sendResponse(res, 404, false, "Order not found");
    }

    // Handle DELIVERED status - verify OTP BEFORE updating status
    if (status === "DELIVERED") {
      if (proofOfDelivery?.type === "OTP") {
        // Check if OTP was generated for this assignment
        if (!assignment.proofOfDelivery?.otp) {
          console.log(`> OTP verification failed for order ${orderId}: OTP was not generated for this delivery`);
          return sendResponse(res, 400, false, "OTP was not generated for this delivery. Please contact support.");
        }

        // Log for debugging
        console.log(`> OTP verification for order ${orderId}: stored="${assignment.proofOfDelivery.otp}", received="${proofOfDelivery.otp}"`);

        // Verify OTP matches (compare as strings)
        const storedOtp = String(assignment.proofOfDelivery.otp);
        const receivedOtp = String(proofOfDelivery.otp);

        if (storedOtp !== receivedOtp) {
          console.log(`> OTP mismatch for order ${orderId}: expected "${storedOtp}", got "${receivedOtp}"`);
          return sendResponse(res, 400, false, "Invalid OTP. Please enter the correct OTP to confirm delivery.");
        }

        // OTP verified - update proofOfDelivery fields (don't overwrite the stored OTP)
        assignment.proofOfDelivery.otpVerified = true;
        assignment.proofOfDelivery.verifiedAt = new Date();
        assignment.proofOfDelivery.verifiedBy = "CUSTOMER";
        await assignment.save();

        console.log(`> OTP verified successfully for order ${orderId}`);
      } else if (proofOfDelivery) {
        // Non-OTP proof of delivery (signature, photo)
        assignment.proofOfDelivery = {
          type: proofOfDelivery.type,
          signatureUrl: proofOfDelivery.signatureUrl,
          photoUrl: proofOfDelivery.photoUrl,
          verifiedAt: new Date(),
        };
        await assignment.save();
      }

      // Set proof of delivery on order
      order.proofOfDelivery = {
        type: proofOfDelivery?.type,
        value:
          proofOfDelivery?.otp ||
          proofOfDelivery?.signatureUrl ||
          proofOfDelivery?.photoUrl,
        verifiedAt: new Date(),
      };
    }

    // Now update assignment status (after OTP verification for DELIVERED)
    await assignment.updateStatus(status);

    if (status === "FAILED") {
      assignment.failureReason = failureReason;
      assignment.failureNotes = notes;
      await assignment.save();
    }

    // Update order status - map delivery assignment statuses to order statuses
    let notificationStatus = null; // Track the status to notify customer about

    if (status === "PICKED_UP") {
      await order.updateStatus("PICKED_UP", driverId, notes || "Picked up by driver");
      await order.updateStatus("OUT_FOR_DELIVERY", driverId, "Driver left for delivery");
      await assignment.updateStatus("OUT_FOR_DELIVERY");
      notificationStatus = "OUT_FOR_DELIVERY";
    } else if (status === "EN_ROUTE") {
      // Map EN_ROUTE (DeliveryAssignment) to OUT_FOR_DELIVERY (Order)
      await order.updateStatus("OUT_FOR_DELIVERY", driverId, notes || "Driver en route to delivery location");
      notificationStatus = "OUT_FOR_DELIVERY";
    } else if (status === "ARRIVED") {
      // Map ARRIVED (DeliveryAssignment) to OUT_FOR_DELIVERY (Order) - order stays out for delivery until actually delivered
      await order.updateStatus("OUT_FOR_DELIVERY", driverId, notes || "Driver arrived at delivery location");
      // No notification for ARRIVED - customer already knows it's out for delivery
    } else {
      // For other statuses (DELIVERED, FAILED, CANCELLED), use the same status
      await order.updateStatus(status, driverId, notes);
      notificationStatus = status;
    }

    // Send notification to customer about delivery status change
    if (notificationStatus) {
      const notification = getOrderStatusNotification(notificationStatus, order, notes);
      if (notification) {
        const notificationType = `ORDER_${notificationStatus}`;
        sendToUser(order.userId, notificationType, notification.title, notification.body, {
          data: {
            orderId: order._id.toString(),
            orderNumber: order.orderNumber,
            status: notificationStatus,
          },
          entityType: "ORDER",
          entityId: order._id,
        });
      }
    }

    // Update batch counters
    const batchProgress = await updateBatchCounters(assignment.batchId);

    // Check if batch is complete
    const completion = await checkBatchComplete(assignment.batchId);
    if (completion.isComplete) {
      await DeliveryBatch.findByIdAndUpdate(assignment.batchId, {
        status: completion.status,
        completedAt: new Date(),
      });
    }

    return sendResponse(res, 200, true, "Delivery status updated", {
      order,
      assignment,
      batchProgress,
    });
  } catch (error) {
    console.log("Update delivery status error:", error);
    return sendResponse(res, 500, false, "Failed to update delivery status");
  }
}

/**
 * Complete a batch
 * @route PATCH /api/delivery/batches/:batchId/complete
 * @access Driver (assigned), System
 */
export async function completeBatch(req, res) {
  try {
    const { batchId } = req.params;
    const driverId = req.user._id;
    const isAdmin = req.user.role === "ADMIN";

    const batch = await DeliveryBatch.findById(batchId);
    if (!batch) {
      return sendResponse(res, 404, false, "Batch not found");
    }

    // Admin can complete any batch, driver can only complete their assigned batches
    if (!isAdmin && batch.driverId?.toString() !== driverId.toString()) {
      return sendResponse(res, 403, false, "Not assigned to this batch");
    }

    // Check completion status
    const completion = await checkBatchComplete(batchId);

    if (!completion.isComplete) {
      return sendResponse(res, 400, false, "Not all orders have final status");
    }

    batch.status = completion.status;
    batch.completedAt = new Date();
    await batch.save();

    // Update counters
    await updateBatchCounters(batchId);

    return sendResponse(res, 200, true, "Batch completed", {
      batch,
      summary: {
        totalOrders: batch.orderIds.length,
        delivered: batch.totalDelivered,
        failed: batch.totalFailed,
      },
    });
  } catch (error) {
    console.log("Complete batch error:", error);
    return sendResponse(res, 500, false, "Failed to complete batch");
  }
}

/**
 * Update delivery sequence
 * @route PATCH /api/delivery/batches/:batchId/sequence
 * @access Driver (assigned)
 */
export async function updateDeliverySequence(req, res) {
  try {
    const { batchId } = req.params;
    const { sequence } = req.body;
    const driverId = req.user._id;
    const isAdmin = req.user.role === "ADMIN";

    const batch = await DeliveryBatch.findById(batchId);
    if (!batch) {
      return sendResponse(res, 404, false, "Batch not found");
    }

    // Admin can update any batch, driver can only update their assigned batches
    if (!isAdmin && batch.driverId?.toString() !== driverId.toString()) {
      return sendResponse(res, 403, false, "Not assigned to this batch");
    }

    if (batch.sequencePolicy === "LOCKED") {
      return sendResponse(res, 400, false, "Sequence is locked for this batch");
    }

    // Update delivery sequence
    batch.deliverySequence = sequence.map((item) => ({
      orderId: item.orderId,
      sequenceNumber: item.sequenceNumber,
    }));
    await batch.save();

    // Update assignment sequence numbers
    for (const item of sequence) {
      await DeliveryAssignment.findOneAndUpdate(
        { orderId: item.orderId, batchId },
        { $set: { sequenceInBatch: item.sequenceNumber } }
      );
    }

    return sendResponse(res, 200, true, "Delivery sequence updated", { batch });
  } catch (error) {
    console.log("Update delivery sequence error:", error);
    return sendResponse(res, 500, false, "Failed to update delivery sequence");
  }
}

/**
 *
 * KITCHEN STAFF - BATCH MANAGEMENT
 *
 */

/**
 * Auto-batch orders for kitchen staff's own kitchen
 * @route POST /api/delivery/my-kitchen/auto-batch
 * @access Kitchen Staff
 */
export async function autoBatchMyKitchenOrders(req, res) {
  try {
    const kitchenId = req.user.kitchenId;
    const { mealWindow } = req.body;

    if (!kitchenId) {
      return sendResponse(res, 403, false, "Not associated with a kitchen");
    }

    // Build query for unbatched ready orders for this kitchen only
    const query = {
      menuType: "MEAL_MENU",
      status: { $in: ["ACCEPTED", "PREPARING", "READY"] },
      batchId: null,
      kitchenId: kitchenId,
    };

    if (mealWindow) query.mealWindow = mealWindow;

    const orders = await Order.find(query);

    if (orders.length === 0) {
      return sendResponse(res, 200, true, "No orders to batch", {
        batchesCreated: 0,
        batchesUpdated: 0,
        ordersProcessed: 0,
        batches: [],
      });
    }

    // Fetch kitchen to get operating hours
    const kitchen = await Kitchen.findById(kitchenId);
    if (!kitchen) {
      return sendResponse(res, 404, false, "Kitchen not found");
    }

    // Group orders by zone + mealWindow
    const groups = {};
    for (const order of orders) {
      const key = `${order.zoneId}_${order.mealWindow}`;
      if (!groups[key]) {
        groups[key] = {
          zoneId: order.zoneId,
          mealWindow: order.mealWindow,
          orders: [],
        };
      }
      groups[key].orders.push(order);
    }

    let batchesCreated = 0;
    let batchesUpdated = 0;
    let ordersProcessed = 0;
    const batchSummaries = [];

    // Process each group
    for (const key of Object.keys(groups)) {
      const group = groups[key];

      // Get window end time using kitchen's operating hours
      const windowEndTime = getWindowEndTime(group.mealWindow, kitchen);

      // Find or create batch
      const { batch, wasCreated } = await findOrCreateBatch(
        kitchenId,
        group.zoneId,
        group.mealWindow,
        windowEndTime
      );

      if (wasCreated) {
        batchesCreated++;
      } else {
        batchesUpdated++;
      }

      // Add orders to batch (up to max size)
      const availableSlots = BATCH_CONFIG.maxBatchSize - batch.orderIds.length;
      const ordersToAdd = group.orders.slice(0, availableSlots);

      for (const order of ordersToAdd) {
        await batch.addOrder(order._id);
        order.batchId = batch._id;
        await order.save();
        ordersProcessed++;
      }

      batchSummaries.push({
        batchId: batch._id,
        batchNumber: batch.batchNumber,
        orderCount: batch.orderIds.length,
        zone: group.zoneId,
        mealWindow: group.mealWindow,
      });
    }

    console.log(`> Kitchen staff auto-batched ${ordersProcessed} orders for kitchen ${kitchen.name}`);

    return sendResponse(res, 200, true, "Auto-batching complete", {
      batchesCreated,
      batchesUpdated,
      ordersProcessed,
      batches: batchSummaries,
    });
  } catch (error) {
    console.log("Auto-batch my kitchen orders error:", error);
    return sendResponse(res, 500, false, "Failed to auto-batch orders");
  }
}

/**
 * Dispatch batches for kitchen staff's own kitchen
 * @route POST /api/delivery/my-kitchen/dispatch
 * @access Kitchen Staff
 */
export async function dispatchMyKitchenBatches(req, res) {
  try {
    const kitchenId = req.user.kitchenId;
    const { mealWindow, forceDispatch = false } = req.body;

    if (!kitchenId) {
      return sendResponse(res, 403, false, "Not associated with a kitchen");
    }

    // Fetch kitchen to get dynamic operating hours
    const kitchen = await Kitchen.findById(kitchenId);
    if (!kitchen) {
      return sendResponse(res, 404, false, "Kitchen not found");
    }

    // FR-DLV-9: Verify meal window / order cutoff time has passed before allowing dispatch
    const cutoffInfo = checkCutoffTime(mealWindow, kitchen);

    if (!cutoffInfo.isPastCutoff && !forceDispatch) {
      return sendResponse(
        res,
        400,
        false,
        `Cannot dispatch ${mealWindow} batches yet. Meal window ends at ${cutoffInfo.cutoffTime} (current: ${cutoffInfo.currentTime}). Wait for cutoff or contact admin for force dispatch.`
      );
    }

    // Find batches ready for dispatch for this kitchen only
    const batchQuery = {
      status: "COLLECTING",
      mealWindow,
      kitchenId,
      orderIds: { $ne: [] },
    };

    const batches = await DeliveryBatch.find(batchQuery);

    if (batches.length === 0) {
      return sendResponse(res, 200, true, "No batches to dispatch", {
        batchesDispatched: 0,
        batches: [],
      });
    }

    const dispatchedBatches = [];

    for (const batch of batches) {
      batch.status = "READY_FOR_DISPATCH";
      await batch.save();

      dispatchedBatches.push({
        batchId: batch._id,
        batchNumber: batch.batchNumber,
        status: batch.status,
        orderCount: batch.orderIds.length,
      });
    }

    // Notify all active drivers about available batches
    if (dispatchedBatches.length > 0) {
      const totalOrders = dispatchedBatches.reduce((sum, b) => sum + b.orderCount, 0);
      const { title, body } = buildFromTemplate(DRIVER_TEMPLATES.BATCH_READY, {
        orderCount: totalOrders,
        kitchenName: kitchen.name,
      });
      sendToRole("DRIVER", "BATCH_READY", title, body, {
        data: {
          kitchenId: kitchenId.toString(),
          mealWindow,
          batchCount: dispatchedBatches.length.toString(),
        },
        entityType: "BATCH",
      });
    }

    console.log(`> Kitchen staff dispatched ${batches.length} batches for kitchen ${kitchen.name}`);

    return sendResponse(res, 200, true, "Batches dispatched", {
      batchesDispatched: batches.length,
      batches: dispatchedBatches,
    });
  } catch (error) {
    console.log("Dispatch my kitchen batches error:", error);
    return sendResponse(res, 500, false, "Failed to dispatch batches");
  }
}

/**
 * Get batches for kitchen
 * @route GET /api/delivery/kitchen-batches
 * @access Kitchen Staff
 */
export async function getKitchenBatches(req, res) {
  try {
    const kitchenId = req.user.kitchenId;
    const { status, mealWindow, date, page = 1, limit = 20 } = req.query;

    if (!kitchenId) {
      return sendResponse(res, 403, false, "Not associated with a kitchen");
    }

    // Build query for today's batches by default
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const query = {
      kitchenId,
      batchDate: { $gte: startOfDay, $lte: endOfDay },
    };

    if (status) query.status = status;
    if (mealWindow) query.mealWindow = mealWindow;

    const skip = (page - 1) * limit;

    const [batches, total] = await Promise.all([
      DeliveryBatch.find(query)
        .populate("driverId", "name phone")
        .populate("zoneId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      DeliveryBatch.countDocuments(query),
    ]);

    // Get summary
    const summary = {
      collecting: await DeliveryBatch.countDocuments({
        ...query,
        status: "COLLECTING",
      }),
      dispatched: await DeliveryBatch.countDocuments({
        ...query,
        status: "DISPATCHED",
      }),
      inProgress: await DeliveryBatch.countDocuments({
        ...query,
        status: "IN_PROGRESS",
      }),
      completed: await DeliveryBatch.countDocuments({
        ...query,
        status: { $in: ["COMPLETED", "PARTIAL_COMPLETE"] },
      }),
    };

    return sendResponse(res, 200, true, "Kitchen batches retrieved", {
      batches,
      summary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.log("Get kitchen batches error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve kitchen batches");
  }
}

/**
 * 
 * ADMIN - BATCH MANAGEMENT
 * 
 */

/**
 * Get all batches (Admin view)
 * @route GET /api/delivery/admin/batches
 * @access Admin
 */
export async function getAllBatches(req, res) {
  try {
    const {
      kitchenId,
      zoneId,
      driverId,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    if (kitchenId) query.kitchenId = kitchenId;
    if (zoneId) query.zoneId = zoneId;
    if (driverId) query.driverId = driverId;
    if (status) query.status = status;
    if (dateFrom || dateTo) {
      query.batchDate = {};
      if (dateFrom) query.batchDate.$gte = new Date(dateFrom);
      if (dateTo) query.batchDate.$lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;

    const [batches, total] = await Promise.all([
      DeliveryBatch.find(query)
        .populate("kitchenId", "name")
        .populate("zoneId", "name")
        .populate("driverId", "name phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      DeliveryBatch.countDocuments(query),
    ]);

    return sendResponse(res, 200, true, "All batches retrieved", {
      batches,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.log("Get all batches error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve batches");
  }
}

/**
 * Get batch by ID
 * @route GET /api/delivery/batches/:batchId
 * @access Admin, Kitchen Staff (own), Driver (assigned)
 */
export async function getBatchById(req, res) {
  try {
    const { batchId } = req.params;
    const user = req.user;

    const batch = await DeliveryBatch.findById(batchId)
      .populate("kitchenId", "name address phone")
      .populate("zoneId", "name city")
      .populate("driverId", "name phone");

    if (!batch) {
      return sendResponse(res, 404, false, "Batch not found");
    }

    // Access control
    const isAdmin = user.role === "ADMIN";
    const isKitchenStaff =
      user.role === "KITCHEN_STAFF" &&
      user.kitchenId?.toString() === batch.kitchenId._id.toString();
    const isDriver =
      user.role === "DRIVER" &&
      batch.driverId?._id?.toString() === user._id.toString();

    if (!isAdmin && !isKitchenStaff && !isDriver) {
      return sendResponse(res, 403, false, "Not authorized to view this batch");
    }

    // Get orders
    const orders = await Order.find({ _id: { $in: batch.orderIds } }).select(
      "orderNumber status deliveryAddress items"
    );

    // Get assignments
    const assignments = await DeliveryAssignment.find({ batchId });

    return sendResponse(res, 200, true, "Batch retrieved", {
      batch,
      orders,
      assignments,
    });
  } catch (error) {
    console.log("Get batch by ID error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve batch");
  }
}

/**
 * Reassign batch to different driver
 * @route PATCH /api/delivery/batches/:batchId/reassign
 * @access Admin
 */
export async function reassignBatch(req, res) {
  try {
    const { batchId } = req.params;
    const { driverId, reason } = req.body;
    const adminId = req.user._id;

    const batch = await DeliveryBatch.findById(batchId);
    if (!batch) {
      return sendResponse(res, 404, false, "Batch not found");
    }

    if (!["DISPATCHED", "IN_PROGRESS"].includes(batch.status)) {
      return sendResponse(
        res,
        400,
        false,
        "Can only reassign dispatched or in-progress batches"
      );
    }

    const previousDriver = batch.driverId;
    batch.driverId = driverId;
    batch.driverAssignedAt = new Date();
    batch.modifiedBy = adminId;
    await batch.save();

    // Update orders
    await Order.updateMany(
      { _id: { $in: batch.orderIds } },
      { $set: { driverId } }
    );

    // Update assignments
    await DeliveryAssignment.updateMany(
      { batchId },
      { $set: { driverId, assignedBy: "ADMIN", assignedByUserId: adminId } }
    );

    // Log audit
    safeAuditCreate({
      action: "ASSIGN",
      entityType: "DELIVERY_BATCH",
      entityId: batch._id,
      userId: adminId,
      userRole: "ADMIN",
      userName: req.user.name || "Admin",
      reason: `Reassigned batch. Previous driver: ${previousDriver}, New driver: ${driverId}. ${reason}`,
      performedAt: new Date(),
    });

    return sendResponse(res, 200, true, "Batch reassigned", { batch });
  } catch (error) {
    console.log("Reassign batch error:", error);
    return sendResponse(res, 500, false, "Failed to reassign batch");
  }
}

/**
 * Cancel a batch
 * @route PATCH /api/delivery/batches/:batchId/cancel
 * @access Admin
 */
export async function cancelBatch(req, res) {
  try {
    const { batchId } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    const batch = await DeliveryBatch.findById(batchId);
    if (!batch) {
      return sendResponse(res, 404, false, "Batch not found");
    }

    if (["COMPLETED", "PARTIAL_COMPLETE", "CANCELLED"].includes(batch.status)) {
      return sendResponse(
        res,
        400,
        false,
        "Cannot cancel completed or already cancelled batch"
      );
    }

    // Remove orders from batch
    await Order.updateMany(
      { _id: { $in: batch.orderIds } },
      { $set: { batchId: null, driverId: null } }
    );

    // Cancel assignments
    await DeliveryAssignment.updateMany(
      { batchId },
      { $set: { status: "CANCELLED", cancelledAt: new Date() } }
    );

    batch.status = "CANCELLED";
    batch.modifiedBy = adminId;
    await batch.save();

    // Log audit
    safeAuditCreate({
      action: "CANCEL",
      entityType: "DELIVERY_BATCH",
      entityId: batch._id,
      userId: adminId,
      userRole: "ADMIN",
      userName: req.user.name || "Admin",
      reason: `Cancelled batch. Orders affected: ${batch.orderIds.length}. ${reason}`,
      performedAt: new Date(),
    });

    return sendResponse(res, 200, true, "Batch cancelled", {
      batch,
      ordersRemoved: batch.orderIds.length,
    });
  } catch (error) {
    console.log("Cancel batch error:", error);
    return sendResponse(res, 500, false, "Failed to cancel batch");
  }
}

/**
 * Get delivery statistics
 * @route GET /api/delivery/admin/stats
 * @access Admin
 */
export async function getDeliveryStats(req, res) {
  try {
    const { dateFrom, dateTo, zoneId, driverId } = req.query;

    const matchQuery = {};
    if (dateFrom || dateTo) {
      matchQuery.batchDate = {};
      if (dateFrom) matchQuery.batchDate.$gte = new Date(dateFrom);
      if (dateTo) matchQuery.batchDate.$lte = new Date(dateTo);
    }
    if (zoneId) matchQuery.zoneId = zoneId;
    if (driverId) matchQuery.driverId = driverId;

    const stats = await DeliveryBatch.aggregate([
      {
        $match: {
          ...matchQuery,
          status: { $in: ["COMPLETED", "PARTIAL_COMPLETE"] },
        },
      },
      {
        $group: {
          _id: null,
          totalBatches: { $sum: 1 },
          totalDelivered: { $sum: "$totalDelivered" },
          totalFailed: { $sum: "$totalFailed" },
        },
      },
    ]);

    const result = stats[0] || {
      totalBatches: 0,
      totalDelivered: 0,
      totalFailed: 0,
    };

    const totalDeliveries = result.totalDelivered + result.totalFailed;
    const successRate =
      totalDeliveries > 0
        ? Math.round((result.totalDelivered / totalDeliveries) * 100)
        : 0;

    // Get by zone
    const byZone = await DeliveryBatch.aggregate([
      {
        $match: {
          ...matchQuery,
          status: { $in: ["COMPLETED", "PARTIAL_COMPLETE"] },
        },
      },
      {
        $group: {
          _id: "$zoneId",
          deliveries: { $sum: { $add: ["$totalDelivered", "$totalFailed"] } },
          delivered: { $sum: "$totalDelivered" },
        },
      },
      {
        $lookup: {
          from: "zones",
          localField: "_id",
          foreignField: "_id",
          as: "zone",
        },
      },
      { $unwind: "$zone" },
      {
        $project: {
          zone: "$zone.name",
          deliveries: 1,
          successRate: {
            $round: [
              { $multiply: [{ $divide: ["$delivered", "$deliveries"] }, 100] },
              0,
            ],
          },
        },
      },
    ]);

    return sendResponse(res, 200, true, "Delivery statistics", {
      totalBatches: result.totalBatches,
      totalDeliveries,
      successRate,
      totalFailed: result.totalFailed,
      byZone,
    });
  } catch (error) {
    console.log("Get delivery stats error:", error);
    return sendResponse(
      res,
      500,
      false,
      "Failed to retrieve delivery statistics"
    );
  }
}

/**
 * Update batch configuration
 * @route PUT /api/delivery/config
 * @access Admin
 */
export async function updateBatchConfig(req, res) {
  try {
    const { maxBatchSize, failedOrderPolicy, autoDispatchDelay } = req.body;
    const adminId = req.user._id;

    const previousConfig = { ...BATCH_CONFIG };

    if (maxBatchSize !== undefined) BATCH_CONFIG.maxBatchSize = maxBatchSize;
    if (failedOrderPolicy !== undefined)
      BATCH_CONFIG.failedOrderPolicy = failedOrderPolicy;
    if (autoDispatchDelay !== undefined)
      BATCH_CONFIG.autoDispatchDelay = autoDispatchDelay;

    // Log audit
    safeAuditCreate({
      action: "CONFIG_CHANGE",
      entityType: "SYSTEM_CONFIG",
      entityId: null,
      userId: adminId,
      userRole: "ADMIN",
      userName: req.user.name || "Admin",
      previousValue: previousConfig,
      newValue: BATCH_CONFIG,
      actionDescription: "Updated batch delivery configuration",
      performedAt: new Date(),
    });

    return sendResponse(res, 200, true, "Batch configuration updated", {
      config: BATCH_CONFIG,
    });
  } catch (error) {
    console.log("Update batch config error:", error);
    return sendResponse(
      res,
      500,
      false,
      "Failed to update batch configuration"
    );
  }
}

/**
 * Get current batch configuration
 * @route GET /api/delivery/config
 * @access Admin
 */
export async function getBatchConfig(req, res) {
  return sendResponse(res, 200, true, "Batch configuration", {
    config: BATCH_CONFIG,
  });
}

/**
 * Send batch preparation reminder to kitchen staff
 * Reminds kitchens about pending orders before cutoff time
 * @route POST /api/delivery/kitchen-reminder
 * @access Admin, System
 */
export async function sendKitchenBatchReminder(req, res) {
  try {
    const { mealWindow, kitchenId } = req.body;

    // Validate meal window
    if (!mealWindow || !["LUNCH", "DINNER"].includes(mealWindow)) {
      return sendResponse(res, 400, false, "Valid mealWindow (LUNCH or DINNER) is required");
    }

    // Build query for pending orders
    const orderQuery = {
      menuType: "MEAL_MENU",
      mealWindow,
      status: { $in: ["PLACED", "ACCEPTED", "PREPARING"] },
    };

    if (kitchenId) {
      orderQuery.kitchenId = kitchenId;
    }

    // Get pending orders grouped by kitchen
    const pendingByKitchen = await Order.aggregate([
      { $match: orderQuery },
      {
        $group: {
          _id: "$kitchenId",
          orderCount: { $sum: 1 },
          orders: { $push: { orderId: "$_id", orderNumber: "$orderNumber", status: "$status" } },
        },
      },
    ]);

    if (pendingByKitchen.length === 0) {
      return sendResponse(res, 200, true, "No pending orders to remind about", {
        kitchensNotified: 0,
      });
    }

    let kitchensNotified = 0;
    const notificationResults = [];

    for (const kitchenData of pendingByKitchen) {
      try {
        // Get kitchen with operatingHours for cutoff calculation
        const kitchen = await Kitchen.findById(kitchenData._id).select("name operatingHours");
        if (!kitchen) continue;

        // Calculate minutes until cutoff using kitchen's operating hours
        const cutoffInfo = checkCutoffTime(mealWindow, kitchen);
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + istOffset);
        const minutesRemaining = cutoffInfo.cutoffDate
          ? Math.max(0, Math.round((cutoffInfo.cutoffDate - istNow) / (60 * 1000)))
          : 0;

        // Get kitchen staff for this kitchen
        const kitchenStaff = await User.find({
          role: "KITCHEN_STAFF",
          kitchenId: kitchenData._id,
          status: "ACTIVE",
        }).select("_id");

        if (kitchenStaff.length === 0) continue;

        const staffIds = kitchenStaff.map((s) => s._id.toString());

        // Build notification
        const { title, body } = buildFromTemplate(BATCH_REMINDER_TEMPLATES.CUTOFF_APPROACHING, {
          mealWindow,
          minutesRemaining,
          pendingOrders: kitchenData.orderCount,
        });

        // Send to kitchen staff
        await sendToUserIds(staffIds, "BATCH_REMINDER", title, body, {
          data: {
            kitchenId: kitchenData._id.toString(),
            mealWindow,
            orderCount: kitchenData.orderCount.toString(),
            cutoffTime,
          },
        });

        kitchensNotified++;
        notificationResults.push({
          kitchenId: kitchenData._id,
          kitchenName: kitchen.name,
          orderCount: kitchenData.orderCount,
          staffNotified: staffIds.length,
        });
      } catch (error) {
        console.log("> Kitchen reminder error for kitchen:", kitchenData._id, error.message);
      }
    }

    console.log(`> Kitchen batch reminders sent: ${kitchensNotified} kitchens, ${mealWindow}`);

    return sendResponse(res, 200, true, "Kitchen reminders sent", {
      kitchensNotified,
      mealWindow,
      minutesUntilCutoff: minutesRemaining,
      cutoffTime,
      details: notificationResults,
    });
  } catch (error) {
    console.log("Send kitchen batch reminder error:", error);
    return sendResponse(res, 500, false, "Failed to send kitchen reminders");
  }
}

export default {
  autoBatchOrders,
  dispatchBatches,
  autoBatchMyKitchenOrders,
  dispatchMyKitchenBatches,
  getAvailableBatches,
  getDriverBatchHistory,
  acceptBatch,
  getMyBatch,
  updateBatchPickup,
  updateDeliveryStatus,
  completeBatch,
  updateDeliverySequence,
  getKitchenBatches,
  getAllBatches,
  getBatchById,
  reassignBatch,
  cancelBatch,
  getDeliveryStats,
  updateBatchConfig,
  getBatchConfig,
  sendKitchenBatchReminder,
};
