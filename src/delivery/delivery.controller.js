import DeliveryBatch from "../../schema/deliveryBatch.schema.js";
import DeliveryAssignment from "../../schema/deliveryAssignment.schema.js";
import Order from "../../schema/order.schema.js";
import Kitchen from "../../schema/kitchen.schema.js";
import Zone from "../../schema/zone.schema.js";
import { sendResponse } from "../../utils/response.utils.js";
import { safeAuditCreate } from "../../utils/audit.utils.js";

/**
 * ============================================================================
 * CONFIGURATION
 * ============================================================================
 */

// In-memory config (could be stored in DB for persistence)
let BATCH_CONFIG = {
  maxBatchSize: 15,
  failedOrderPolicy: "NO_RETURN",
  autoDispatchDelay: 0, // minutes after window end
};

// Window end times
const WINDOW_END_TIMES = {
  LUNCH: { hour: 13, minute: 0 },
  DINNER: { hour: 22, minute: 0 },
};

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
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
 * Get window end time for a meal window
 * @param {string} mealWindow - LUNCH or DINNER
 * @returns {Date} Window end time
 */
function getWindowEndTime(mealWindow) {
  const windowEnd = WINDOW_END_TIMES[mealWindow];
  const endTime = new Date();
  endTime.setHours(windowEnd.hour, windowEnd.minute, 0, 0);
  return endTime;
}

/**
 * ============================================================================
 * AUTO-BATCHING FUNCTIONS
 * ============================================================================
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
      const windowEndTime = getWindowEndTime(group.mealWindow);

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
    const { mealWindow, forceDispatch = false } = req.body;
    const now = new Date();

    // FR-DLV-9: Verify meal window has ended before allowing dispatch
    const windowEndTime = getWindowEndTime(mealWindow);
    if (now < windowEndTime && !forceDispatch) {
      const remainingMinutes = Math.ceil((windowEndTime - now) / (1000 * 60));
      return sendResponse(
        res,
        400,
        false,
        `Cannot dispatch ${mealWindow} batches yet. Meal window ends in ${remainingMinutes} minute(s). Use forceDispatch=true to override (Admin only).`
      );
    }

    // Find batches ready for dispatch
    const batchQuery = {
      status: "COLLECTING",
      mealWindow,
      orderIds: { $ne: [] },
    };

    // Only apply windowEndTime filter if NOT forcing dispatch
    if (!forceDispatch) {
      batchQuery.windowEndTime = { $lte: now };
    }

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
 * ============================================================================
 * DRIVER - BATCH & DELIVERY FUNCTIONS
 * ============================================================================
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

    // Get order details
    const orders = await Order.find({ _id: { $in: batch.orderIds } }).select(
      "orderNumber deliveryAddress items status"
    );

    // Get kitchen address
    const kitchen = await Kitchen.findById(batch.kitchenId).select(
      "name address"
    );

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

    // Update assignment status
    await assignment.updateStatus(status);

    // Handle specific statuses
    if (status === "DELIVERED") {
      if (proofOfDelivery) {
        assignment.proofOfDelivery = {
          type: proofOfDelivery.type,
          otp: proofOfDelivery.otp,
          signatureUrl: proofOfDelivery.signatureUrl,
          photoUrl: proofOfDelivery.photoUrl,
          verifiedAt: new Date(),
        };

        if (proofOfDelivery.type === "OTP") {
          await assignment.verifyOtp(proofOfDelivery.otp);
        }

        await assignment.save();
      }

      order.proofOfDelivery = {
        type: proofOfDelivery?.type,
        value:
          proofOfDelivery?.otp ||
          proofOfDelivery?.signatureUrl ||
          proofOfDelivery?.photoUrl,
        verifiedAt: new Date(),
      };
    }

    if (status === "FAILED") {
      assignment.failureReason = failureReason;
      assignment.failureNotes = notes;
      await assignment.save();
    }

    // Update order status - map delivery assignment statuses to order statuses
    if (status === "PICKED_UP") {
      await order.updateStatus("PICKED_UP", driverId, notes || "Picked up by driver");
      await order.updateStatus("OUT_FOR_DELIVERY", driverId, "Driver left for delivery");
      await assignment.updateStatus("OUT_FOR_DELIVERY");
    } else if (status === "EN_ROUTE") {
      // Map EN_ROUTE (DeliveryAssignment) to OUT_FOR_DELIVERY (Order)
      await order.updateStatus("OUT_FOR_DELIVERY", driverId, notes || "Driver en route to delivery location");
    } else if (status === "ARRIVED") {
      // Map ARRIVED (DeliveryAssignment) to OUT_FOR_DELIVERY (Order) - order stays out for delivery until actually delivered
      await order.updateStatus("OUT_FOR_DELIVERY", driverId, notes || "Driver arrived at delivery location");
    } else {
      // For other statuses (DELIVERED, FAILED, CANCELLED), use the same status
      await order.updateStatus(status, driverId, notes);
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
 * ============================================================================
 * KITCHEN STAFF - BATCH VIEWING
 * ============================================================================
 */

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
 * ============================================================================
 * ADMIN - BATCH MANAGEMENT
 * ============================================================================
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

export default {
  autoBatchOrders,
  dispatchBatches,
  getAvailableBatches,
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
};
