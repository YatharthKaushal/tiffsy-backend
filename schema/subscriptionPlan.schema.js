import mongoose from "mongoose";

/**
 * SubscriptionPlan Schema
 * Plans that customers can purchase to get vouchers for Meal Menu
 */
const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Plan name is required"],
      trim: true,
      maxlength: [100, "Plan name cannot exceed 100 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    // Duration
    durationDays: {
      type: Number,
      required: [true, "Duration is required"],
      enum: {
        values: [7, 14, 30, 60],
        message: "Duration must be 7, 14, 30, or 60 days",
      },
    },

    // Voucher Configuration
    vouchersPerDay: {
      type: Number,
      required: true,
      default: 2,
      min: [1, "Vouchers per day must be at least 1"],
      max: [4, "Vouchers per day cannot exceed 4"],
    },

    voucherValidityDays: {
      type: Number,
      default: 90, // 3 months
      min: [1, "Validity days must be at least 1"],
    },

    // Pricing
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },

    originalPrice: {
      type: Number,
      min: [0, "Original price cannot be negative"],
    },

    // Coverage Rules (Future)
    coverageRules: {
      includesAddons: {
        type: Boolean,
        default: false,
      },
      addonValuePerVoucher: {
        type: Number,
        min: 0,
      },
      mealTypes: {
        type: [String],
        enum: ["LUNCH", "DINNER", "BOTH"],
        default: ["BOTH"],
      },
    },

    // Targeting (Future)
    applicableZoneIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Zone",
      default: [],
    },

    // Display
    displayOrder: {
      type: Number,
      default: 0,
      min: 0,
    },

    badge: {
      type: String,
      trim: true,
      maxlength: [30, "Badge cannot exceed 30 characters"],
    },

    features: {
      type: [String],
      default: [],
    },

    // Status
    status: {
      type: String,
      required: true,
      enum: {
        values: ["ACTIVE", "INACTIVE", "ARCHIVED"],
        message: "Invalid status",
      },
      default: "INACTIVE",
    },

    // Validity Period
    validFrom: {
      type: Date,
    },

    validTill: {
      type: Date,
    },

    // Metadata
    createdBy: {
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

// Virtual for totalVouchers
subscriptionPlanSchema.virtual("totalVouchers").get(function () {
  return this.durationDays * this.vouchersPerDay;
});

// Indexes
subscriptionPlanSchema.index({ status: 1 });
subscriptionPlanSchema.index({ durationDays: 1 });
subscriptionPlanSchema.index({ price: 1 });
subscriptionPlanSchema.index({ displayOrder: 1 });

// Validate originalPrice > price if set
subscriptionPlanSchema.pre("save", async function () {
  if (this.originalPrice && this.originalPrice <= this.price) {
    throw new Error("Original price must be greater than discounted price");
  }
  if (this.validTill && this.validFrom && this.validTill <= this.validFrom) {
    throw new Error("Valid till must be after valid from");
  }
});

// Check if plan is purchasable
subscriptionPlanSchema.methods.isPurchasable = function () {
  if (this.status !== "ACTIVE") return false;
  const now = new Date();
  if (this.validFrom && now < this.validFrom) return false;
  if (this.validTill && now > this.validTill) return false;
  return true;
};

// Static method to find active purchasable plans
subscriptionPlanSchema.statics.findPurchasable = function () {
  const now = new Date();
  return this.find({
    status: "ACTIVE",
    $or: [{ validFrom: { $exists: false } }, { validFrom: { $lte: now } }],
    $or: [{ validTill: { $exists: false } }, { validTill: { $gte: now } }],
  }).sort({ displayOrder: 1 });
};

const SubscriptionPlan = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);

export default SubscriptionPlan;
