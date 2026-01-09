import mongoose from "mongoose";

/**
 * Voucher Schema
 * Individual vouchers issued from subscriptions (Meal Menu only)
 */
const voucherSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: [true, "Subscription ID is required"],
    },

    // Voucher Details
    voucherCode: {
      type: String,
      required: [true, "Voucher code is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },

    value: {
      type: Number,
      min: 0,
      // Currently null as voucher = 1 meal redemption
    },

    // Meal Type (Future: meal-tagged vouchers)
    mealType: {
      type: String,
      enum: {
        values: ["LUNCH", "DINNER", "ANY"],
        message: "Invalid meal type",
      },
      default: "ANY",
    },

    // Validity
    issuedDate: {
      type: Date,
      required: [true, "Issued date is required"],
      default: Date.now,
    },

    expiryDate: {
      type: Date,
      required: [true, "Expiry date is required"],
    },

    // Status
    status: {
      type: String,
      required: true,
      enum: {
        values: ["AVAILABLE", "REDEEMED", "EXPIRED", "RESTORED", "CANCELLED"],
        message: "Invalid status",
      },
      default: "AVAILABLE",
    },

    // Redemption Details
    redeemedAt: {
      type: Date,
    },

    redeemedOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },

    redeemedKitchenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kitchen",
    },

    redeemedMealWindow: {
      type: String,
      enum: ["LUNCH", "DINNER"],
    },

    // Restoration Details
    restoredAt: {
      type: Date,
    },

    restorationReason: {
      type: String,
      trim: true,
      enum: ["ORDER_CANCELLED", "ORDER_REJECTED", "ADMIN_ACTION", "OTHER"],
    },
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
voucherSchema.index({ userId: 1 });
voucherSchema.index({ userId: 1, status: 1 });
voucherSchema.index({ subscriptionId: 1 });
voucherSchema.index({ voucherCode: 1 }, { unique: true });
voucherSchema.index({ status: 1 });
voucherSchema.index({ expiryDate: 1 });
voucherSchema.index({ redeemedOrderId: 1 }, { sparse: true });

// Generate unique voucher code
voucherSchema.statics.generateVoucherCode = function () {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoiding confusing chars
  let code = "VCH-";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  code += "-";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Check if voucher can be redeemed
voucherSchema.methods.canRedeem = function (mealWindow) {
  if (this.status !== "AVAILABLE" && this.status !== "RESTORED") {
    return false;
  }
  if (new Date() > this.expiryDate) {
    return false;
  }
  // Check meal type restriction
  if (this.mealType !== "ANY" && this.mealType !== mealWindow) {
    return false;
  }
  return true;
};

// Redeem voucher
voucherSchema.methods.redeem = async function (orderId, kitchenId, mealWindow) {
  if (!this.canRedeem(mealWindow)) {
    throw new Error("Voucher cannot be redeemed");
  }
  this.status = "REDEEMED";
  this.redeemedAt = new Date();
  this.redeemedOrderId = orderId;
  this.redeemedKitchenId = kitchenId;
  this.redeemedMealWindow = mealWindow;
  return this.save();
};

// Restore voucher (when order is cancelled/rejected)
voucherSchema.methods.restore = async function (reason) {
  if (this.status !== "REDEEMED") {
    throw new Error("Only redeemed vouchers can be restored");
  }
  this.status = "RESTORED";
  this.restoredAt = new Date();
  this.restorationReason = reason;
  return this.save();
};

// Static method to find available vouchers by user
voucherSchema.statics.findAvailableByUser = function (userId) {
  const now = new Date();
  return this.find({
    userId,
    status: { $in: ["AVAILABLE", "RESTORED"] },
    expiryDate: { $gte: now },
  }).sort({ expiryDate: 1 }); // Prioritize expiring soon
};

// Static method to count available vouchers
voucherSchema.statics.countAvailableByUser = function (userId) {
  const now = new Date();
  return this.countDocuments({
    userId,
    status: { $in: ["AVAILABLE", "RESTORED"] },
    expiryDate: { $gte: now },
  });
};

// Static method to expire vouchers (cron job)
voucherSchema.statics.expireVouchers = async function () {
  const now = new Date();
  const result = await this.updateMany(
    {
      status: { $in: ["AVAILABLE", "RESTORED"] },
      expiryDate: { $lt: now },
    },
    { status: "EXPIRED" }
  );
  return result.modifiedCount;
};

// Static method to issue vouchers for a subscription
voucherSchema.statics.issueForSubscription = async function (
  userId,
  subscriptionId,
  count,
  expiryDate
) {
  const vouchers = [];
  for (let i = 0; i < count; i++) {
    let voucherCode;
    let isUnique = false;

    // Generate unique code
    while (!isUnique) {
      voucherCode = this.generateVoucherCode();
      const existing = await this.findOne({ voucherCode });
      if (!existing) isUnique = true;
    }

    vouchers.push({
      userId,
      subscriptionId,
      voucherCode,
      issuedDate: new Date(),
      expiryDate,
      status: "AVAILABLE",
    });
  }

  return this.insertMany(vouchers);
};

const Voucher = mongoose.model("Voucher", voucherSchema);

export default Voucher;
