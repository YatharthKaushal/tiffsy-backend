import mongoose from "mongoose";

/**
 * DeliveryBatch Schema
 * Batch of orders grouped for delivery by zone and kitchen
 */
const deliveryBatchSchema = new mongoose.Schema(
  {
    batchNumber: {
      type: String,
      required: [true, "Batch number is required"],
      unique: true,
      trim: true,
    },

    // Kitchen & Zone
    kitchenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kitchen",
      required: [true, "Kitchen ID is required"],
    },

    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      required: [true, "Zone ID is required"],
    },

    // Meal Context
    menuType: {
      type: String,
      required: [true, "Menu type is required"],
      enum: {
        values: ["MEAL_MENU", "ON_DEMAND_MENU"],
        message: "Invalid menu type",
      },
    },

    mealWindow: {
      type: String,
      enum: ["LUNCH", "DINNER"],
    },

    batchDate: {
      type: Date,
      required: [true, "Batch date is required"],
    },

    // Orders
    orderIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],

    // Driver Assignment
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    driverAssignedAt: Date,

    // Sequence
    sequencePolicy: {
      type: String,
      enum: {
        values: ["DRIVER_CHOICE", "SYSTEM_OPTIMIZED", "LOCKED"],
        message: "Invalid sequence policy",
      },
      default: "DRIVER_CHOICE",
    },

    deliverySequence: [
      {
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
        },
        sequenceNumber: Number,
        estimatedArrival: Date,
      },
    ],

    // Status
    status: {
      type: String,
      required: true,
      enum: {
        values: [
          "COLLECTING",
          "READY_FOR_DISPATCH",
          "DISPATCHED",
          "IN_PROGRESS",
          "COMPLETED",
          "PARTIAL_COMPLETE",
          "CANCELLED",
        ],
        message: "Invalid status",
      },
      default: "COLLECTING",
    },

    // Timing
    windowEndTime: {
      type: Date,
      required: [true, "Window end time is required"],
    },

    dispatchedAt: Date,
    pickedUpAt: Date,
    completedAt: Date,

    // Delivery Stats
    totalDelivered: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalFailed: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Failed Order Handling
    failedOrderPolicy: {
      type: String,
      enum: {
        values: ["NO_RETURN", "RETURN_TO_KITCHEN"],
        message: "Invalid failed order policy",
      },
      default: "NO_RETURN",
    },

    failedOrders: [
      {
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
        },
        reason: String,
        returnedToKitchen: { type: Boolean, default: false },
      },
    ],

    // Batch Creation
    creationType: {
      type: String,
      enum: {
        values: ["AUTO", "MANUAL"],
        message: "Invalid creation type",
      },
      default: "AUTO",
    },

    // Configuration
    maxBatchSize: {
      type: Number,
      default: 15,
      min: 1,
    },

    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Virtual for orderCount
deliveryBatchSchema.virtual("orderCount").get(function () {
  return this.orderIds?.length || 0;
});

// Indexes
deliveryBatchSchema.index({ batchNumber: 1 }, { unique: true });
deliveryBatchSchema.index({ kitchenId: 1 });
deliveryBatchSchema.index({ zoneId: 1 });
deliveryBatchSchema.index({ driverId: 1 }, { sparse: true });
deliveryBatchSchema.index({ status: 1 });
deliveryBatchSchema.index({ batchDate: 1 });
deliveryBatchSchema.index({ kitchenId: 1, zoneId: 1, batchDate: 1, mealWindow: 1 });
deliveryBatchSchema.index({ status: 1, windowEndTime: 1 });

// Generate batch number
deliveryBatchSchema.statics.generateBatchNumber = function (zoneCode) {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `BATCH-${dateStr}-${zoneCode || "XX"}-${random}`;
};

// Check if batch can accept more orders
deliveryBatchSchema.methods.canAddOrder = function () {
  return (
    this.status === "COLLECTING" &&
    this.orderIds.length < this.maxBatchSize
  );
};

// Add order to batch
deliveryBatchSchema.methods.addOrder = async function (orderId) {
  if (!this.canAddOrder()) {
    throw new Error("Batch cannot accept more orders");
  }
  if (this.orderIds.includes(orderId)) {
    throw new Error("Order already in batch");
  }
  this.orderIds.push(orderId);
  return this.save();
};

// Remove order from batch
deliveryBatchSchema.methods.removeOrder = async function (orderId) {
  const index = this.orderIds.findIndex(
    (id) => id.toString() === orderId.toString()
  );
  if (index === -1) {
    throw new Error("Order not in batch");
  }
  this.orderIds.splice(index, 1);
  return this.save();
};

// Static method to find or create batch for auto-batching
deliveryBatchSchema.statics.findOrCreateForAutoBatch = async function (
  kitchenId,
  zoneId,
  mealWindow,
  windowEndTime,
  maxBatchSize = 15
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find existing batch that's still collecting
  let batch = await this.findOne({
    kitchenId,
    zoneId,
    mealWindow,
    batchDate: { $gte: today },
    status: "COLLECTING",
    $expr: { $lt: [{ $size: "$orderIds" }, "$maxBatchSize"] },
  });

  if (!batch) {
    batch = new this({
      batchNumber: this.generateBatchNumber(),
      kitchenId,
      zoneId,
      menuType: "MEAL_MENU",
      mealWindow,
      batchDate: new Date(),
      windowEndTime,
      maxBatchSize,
      creationType: "AUTO",
    });
    await batch.save();
  }

  return batch;
};

// Static method to find batches ready for dispatch
deliveryBatchSchema.statics.findReadyForDispatch = function () {
  const now = new Date();
  return this.find({
    status: "COLLECTING",
    windowEndTime: { $lte: now },
    orderIds: { $ne: [] },
  });
};

const DeliveryBatch = mongoose.model("DeliveryBatch", deliveryBatchSchema);

export default DeliveryBatch;
