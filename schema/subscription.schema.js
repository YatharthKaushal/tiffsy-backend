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

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;
