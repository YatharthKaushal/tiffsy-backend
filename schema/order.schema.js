import mongoose from "mongoose";

/**
 * Order Schema
 * Customer order (Meal Menu or On-Demand Menu)
 */
const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: [true, "Order number is required"],
      unique: true,
      trim: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    kitchenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kitchen",
      required: [true, "Kitchen ID is required"],
    },

    // Location
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      required: [true, "Zone ID is required"],
    },

    deliveryAddressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerAddress",
      required: [true, "Delivery address ID is required"],
    },

    deliveryAddress: {
      addressLine1: { type: String, required: true },
      addressLine2: String,
      landmark: String,
      locality: { type: String, required: true },
      city: { type: String, required: true },
      pincode: { type: String, required: true },
      contactName: String,
      contactPhone: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },

    // Order Type
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

    // Order Items
    items: [
      {
        menuItemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "MenuItem",
          required: true,
        },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
        isMainCourse: { type: Boolean, default: false },
        addons: [
          {
            addonId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Addon",
            },
            name: { type: String, required: true },
            quantity: { type: Number, required: true, min: 1 },
            unitPrice: { type: Number, required: true, min: 0 },
            totalPrice: { type: Number, required: true, min: 0 },
          },
        ],
      },
    ],

    // Pricing Breakdown
    subtotal: {
      type: Number,
      required: [true, "Subtotal is required"],
      min: 0,
    },

    charges: {
      deliveryFee: { type: Number, default: 0, min: 0 },
      serviceFee: { type: Number, default: 0, min: 0 },
      packagingFee: { type: Number, default: 0, min: 0 },
      handlingFee: { type: Number, default: 0, min: 0 },
      taxAmount: { type: Number, default: 0, min: 0 },
      taxBreakdown: [
        {
          taxType: String,
          rate: Number,
          amount: Number,
        },
      ],
    },

    discount: {
      couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Coupon",
      },
      couponCode: String,
      discountAmount: { type: Number, min: 0 },
      discountType: String,
    },

    grandTotal: {
      type: Number,
      required: [true, "Grand total is required"],
      min: 0,
    },

    // Voucher Usage
    voucherUsage: {
      voucherIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Voucher",
        },
      ],
      voucherCount: { type: Number, default: 0 },
      mainCoursesCovered: { type: Number, default: 0 },
    },

    amountPaid: {
      type: Number,
      required: [true, "Amount paid is required"],
      min: 0,
    },

    // Payment Info
    paymentStatus: {
      type: String,
      required: true,
      enum: {
        values: ["PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"],
        message: "Invalid payment status",
      },
      default: "PENDING",
    },

    paymentMethod: {
      type: String,
      enum: ["UPI", "CARD", "WALLET", "NETBANKING", "VOUCHER_ONLY", "OTHER"],
    },

    paymentId: String,
    paymentDetails: mongoose.Schema.Types.Mixed,

    // Order Status
    status: {
      type: String,
      required: true,
      enum: {
        values: [
          "PLACED",
          "ACCEPTED",
          "REJECTED",
          "PREPARING",
          "READY",
          "PICKED_UP",
          "OUT_FOR_DELIVERY",
          "DELIVERED",
          "CANCELLED",
          "FAILED",
        ],
        message: "Invalid status",
      },
      default: "PLACED",
    },

    statusTimeline: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, required: true, default: Date.now },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        notes: String,
      },
    ],

    // Kitchen Response
    acceptedAt: Date,
    rejectedAt: Date,
    rejectionReason: String,
    cancelledAt: Date,
    cancellationReason: String,
    cancelledBy: {
      type: String,
      enum: ["CUSTOMER", "KITCHEN", "ADMIN", "SYSTEM"],
    },

    // Preparation
    estimatedPrepTime: Number,
    preparedAt: Date,

    // Delivery
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryBatch",
    },

    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    estimatedDeliveryTime: Date,
    pickedUpAt: Date,
    deliveredAt: Date,
    deliveryNotes: String,

    proofOfDelivery: {
      type: {
        type: String,
        enum: ["OTP", "SIGNATURE", "PHOTO"],
      },
      value: String,
      verifiedAt: Date,
    },

    // Rating & Feedback
    rating: {
      stars: { type: Number, min: 1, max: 5 },
      comment: String,
      ratedAt: Date,
    },

    // Special Instructions
    specialInstructions: {
      type: String,
      maxlength: [500, "Instructions cannot exceed 500 characters"],
    },

    // Metadata
    placedAt: {
      type: Date,
      required: [true, "Placed at is required"],
      default: Date.now,
    },

    scheduledFor: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ userId: 1 });
orderSchema.index({ kitchenId: 1 });
orderSchema.index({ zoneId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ batchId: 1 }, { sparse: true });
orderSchema.index({ driverId: 1 }, { sparse: true });
orderSchema.index({ placedAt: -1 });
orderSchema.index({ kitchenId: 1, status: 1 });
orderSchema.index({ userId: 1, placedAt: -1 });
orderSchema.index({ zoneId: 1, kitchenId: 1, status: 1 }); // For auto-batching
orderSchema.index({ menuType: 1, status: 1 }); // For filtered queries by menu type
orderSchema.index({ paymentStatus: 1 }); // For refund queries

// Validate mealWindow for MEAL_MENU
orderSchema.pre("save", function (next) {
  if (this.menuType === "MEAL_MENU" && !this.mealWindow) {
    return next(new Error("Meal window is required for Meal Menu orders"));
  }
  if (this.menuType === "ON_DEMAND_MENU" && this.voucherUsage?.voucherCount > 0) {
    return next(new Error("Vouchers cannot be used for On-Demand Menu orders"));
  }
  next();
});

// Generate order number
orderSchema.statics.generateOrderNumber = function () {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `ORD-${dateStr}-${random}`;
};

// Update status with timeline
orderSchema.methods.updateStatus = async function (newStatus, userId, notes) {
  this.status = newStatus;
  this.statusTimeline.push({
    status: newStatus,
    timestamp: new Date(),
    updatedBy: userId,
    notes,
  });

  // Set specific timestamps
  switch (newStatus) {
    case "ACCEPTED":
      this.acceptedAt = new Date();
      break;
    case "REJECTED":
      this.rejectedAt = new Date();
      break;
    case "CANCELLED":
      this.cancelledAt = new Date();
      break;
    case "READY":
      this.preparedAt = new Date();
      break;
    case "PICKED_UP":
      this.pickedUpAt = new Date();
      break;
    case "DELIVERED":
      this.deliveredAt = new Date();
      break;
  }

  return this.save();
};

// Check if order can be cancelled
orderSchema.methods.canBeCancelled = function () {
  const nonCancellableStatuses = [
    "PICKED_UP",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
    "FAILED",
  ];
  return !nonCancellableStatuses.includes(this.status);
};

// Static method to find orders for batching
orderSchema.statics.findForBatching = function (kitchenId, zoneId, mealWindow) {
  return this.find({
    kitchenId,
    zoneId,
    menuType: "MEAL_MENU",
    mealWindow,
    status: { $in: ["ACCEPTED", "READY"] },
    batchId: null,
  }).sort({ placedAt: 1 });
};

// Static method to find user's orders
orderSchema.statics.findByUser = function (userId, options = {}) {
  const query = { userId };
  if (options.status) query.status = options.status;
  return this.find(query)
    .populate("kitchenId", "name logo")
    .sort({ placedAt: -1 })
    .limit(options.limit || 20);
};

const Order = mongoose.model("Order", orderSchema);

export default Order;
