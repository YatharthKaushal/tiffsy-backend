import mongoose from "mongoose";

/**
 * Subscription Schema
 * Customer's purchased subscription linking to a plan
 */
const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: [true, "Plan ID is required"],
    },

    // Dates
    purchaseDate: {
      type: Date,
      required: [true, "Purchase date is required"],
      default: Date.now,
    },

    startDate: {
      type: Date,
      required: [true, "Start date is required"],
      default: Date.now,
    },

    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },

    // Voucher Tracking
    totalVouchersIssued: {
      type: Number,
      required: [true, "Total vouchers is required"],
      min: [1, "Must issue at least 1 voucher"],
    },

    vouchersUsed: {
      type: Number,
      default: 0,
      min: 0,
    },

    voucherExpiryDate: {
      type: Date,
      required: [true, "Voucher expiry date is required"],
    },

    // Payment Info
    paymentId: {
      type: String,
      trim: true,
    },

    paymentMethod: {
      type: String,
      trim: true,
      enum: ["UPI", "CARD", "NETBANKING", "WALLET", "OTHER"],
    },

    amountPaid: {
      type: Number,
      required: [true, "Amount paid is required"],
      min: [0, "Amount cannot be negative"],
    },

    // Status
    status: {
      type: String,
      required: true,
      enum: {
        values: ["ACTIVE", "EXPIRED", "CANCELLED", "PAUSED"],
        message: "Invalid status",
      },
      default: "ACTIVE",
    },

    // Cancellation
    cancelledAt: {
      type: Date,
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [300, "Cancellation reason cannot exceed 300 characters"],
    },

    refundAmount: {
      type: Number,
      min: 0,
    },

    // Renewal (Future)
    isAutoRenew: {
      type: Boolean,
      default: false,
    },

    renewedFromId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
    },

    // Auto-Ordering Settings
    autoOrderingEnabled: {
      type: Boolean,
      default: false,
    },

    isPaused: {
      type: Boolean,
      default: false,
    },

    pausedUntil: {
      type: Date,
      default: null,
    },

    skippedSlots: [
      {
        date: {
          type: Date,
          required: true,
        },
        mealWindow: {
          type: String,
          enum: ["LUNCH", "DINNER"],
          required: true,
        },
        reason: {
          type: String,
          trim: true,
          maxlength: 200,
        },
        skippedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    defaultMealType: {
      type: String,
      enum: ["LUNCH", "DINNER", "BOTH"],
      default: "BOTH",
    },

    defaultKitchenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kitchen",
      default: null,
    },

    defaultAddressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerAddress",
      default: null,
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

// Virtual for vouchersRemaining
subscriptionSchema.virtual("vouchersRemaining").get(function () {
  return this.totalVouchersIssued - this.vouchersUsed;
});

// Indexes
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ planId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ purchaseDate: -1 });
subscriptionSchema.index({ voucherExpiryDate: 1 });
// Auto-ordering index for cron job queries
subscriptionSchema.index({ status: 1, autoOrderingEnabled: 1, isPaused: 1 });

// Check if subscription is active
subscriptionSchema.methods.isActive = function () {
  return this.status === "ACTIVE" && new Date() <= this.voucherExpiryDate;
};

// Check if has available vouchers
subscriptionSchema.methods.hasAvailableVouchers = function () {
  return this.isActive() && this.vouchersUsed < this.totalVouchersIssued;
};

// Increment vouchers used
subscriptionSchema.methods.useVoucher = async function (count = 1) {
  if (this.vouchersUsed + count > this.totalVouchersIssued) {
    throw new Error("Not enough vouchers available");
  }
  this.vouchersUsed += count;
  return this.save();
};

// Restore voucher (when order is cancelled)
subscriptionSchema.methods.restoreVoucher = async function (count = 1) {
  this.vouchersUsed = Math.max(0, this.vouchersUsed - count);
  return this.save();
};

// Check if auto-ordering is currently active (enabled and not paused)
subscriptionSchema.methods.isAutoOrderingActive = function () {
  if (!this.autoOrderingEnabled || !this.isActive()) {
    return false;
  }
  if (this.isPaused) {
    // Check if pause period has ended
    if (this.pausedUntil && new Date() > this.pausedUntil) {
      return true; // Pause period ended
    }
    return false; // Still paused
  }
  return true;
};

// Check if a specific meal slot is skipped
subscriptionSchema.methods.isSlotSkipped = function (date, mealWindow) {
  if (!this.skippedSlots || this.skippedSlots.length === 0) {
    return false;
  }
  const dateStr = new Date(date).toISOString().split("T")[0];
  return this.skippedSlots.some((slot) => {
    const slotDateStr = new Date(slot.date).toISOString().split("T")[0];
    return slotDateStr === dateStr && slot.mealWindow === mealWindow;
  });
};

// Remove expired skipped slots (cleanup)
subscriptionSchema.methods.cleanupExpiredSkips = async function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const originalCount = this.skippedSlots?.length || 0;
  this.skippedSlots = (this.skippedSlots || []).filter(
    (slot) => new Date(slot.date) >= today
  );
  if (this.skippedSlots.length !== originalCount) {
    await this.save();
  }
  return originalCount - this.skippedSlots.length;
};

// Static method to find active subscriptions by user
subscriptionSchema.statics.findActiveByUser = function (userId) {
  const now = new Date();
  return this.find({
    userId,
    status: "ACTIVE",
    voucherExpiryDate: { $gte: now },
  })
    .populate("planId")
    .sort({ purchaseDate: -1 });
};

// Static method to find subscription with available vouchers
subscriptionSchema.statics.findWithAvailableVouchers = function (userId) {
  const now = new Date();
  return this.find({
    userId,
    status: "ACTIVE",
    voucherExpiryDate: { $gte: now },
    $expr: { $lt: ["$vouchersUsed", "$totalVouchersIssued"] },
  }).sort({ voucherExpiryDate: 1 }); // Prioritize expiring soon
};

// Static method to find subscriptions eligible for auto-ordering
subscriptionSchema.statics.findAutoOrderEligible = function (mealWindow = null) {
  const now = new Date();
  const query = {
    status: "ACTIVE",
    autoOrderingEnabled: true,
    voucherExpiryDate: { $gte: now },
    $expr: { $lt: ["$vouchersUsed", "$totalVouchersIssued"] },
    $or: [
      { isPaused: false },
      { isPaused: true, pausedUntil: { $lt: now } }, // Pause period ended
    ],
  };

  // Filter by meal type preference if specified
  if (mealWindow) {
    query.$or = [
      ...query.$or,
      { defaultMealType: mealWindow },
      { defaultMealType: "BOTH" },
    ];
  }

  return this.find(query)
    .populate("defaultKitchenId", "name isAcceptingOrders status zonesServed")
    .populate("defaultAddressId", "addressLine1 city pincode zoneId isServiceable");
};

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;
