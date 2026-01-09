import mongoose from "mongoose";

/**
 * Coupon Schema
 * Promotional discount codes for On-Demand Menu orders only
 */
const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z0-9]+$/, "Coupon code must be alphanumeric"],
      maxlength: [20, "Coupon code cannot exceed 20 characters"],
    },

    name: {
      type: String,
      required: [true, "Coupon name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    // Discount Configuration
    discountType: {
      type: String,
      required: [true, "Discount type is required"],
      enum: {
        values: ["PERCENTAGE", "FLAT", "FREE_DELIVERY"],
        message: "Invalid discount type",
      },
    },

    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"],
    },

    maxDiscountAmount: {
      type: Number,
      min: [0, "Max discount cannot be negative"],
    },

    // Minimum Requirements
    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    minItems: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Applicability
    applicableMenuTypes: {
      type: [String],
      enum: ["ON_DEMAND_MENU"],
      default: ["ON_DEMAND_MENU"],
    },

    applicableKitchenIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Kitchen",
      default: [],
    },

    applicableZoneIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Zone",
      default: [],
    },

    excludedKitchenIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Kitchen",
      default: [],
    },

    // Usage Limits
    totalUsageLimit: {
      type: Number,
      min: 1,
      // null = unlimited
    },

    totalUsageCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    perUserLimit: {
      type: Number,
      default: 1,
      min: 1,
    },

    // User Targeting
    targetUserType: {
      type: String,
      enum: {
        values: ["ALL", "NEW_USERS", "EXISTING_USERS", "SPECIFIC_USERS"],
        message: "Invalid target user type",
      },
      default: "ALL",
    },

    specificUserIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },

    isFirstOrderOnly: {
      type: Boolean,
      default: false,
    },

    // Validity Period
    validFrom: {
      type: Date,
      required: [true, "Valid from date is required"],
    },

    validTill: {
      type: Date,
      required: [true, "Valid till date is required"],
    },

    // Status
    status: {
      type: String,
      required: true,
      enum: {
        values: ["ACTIVE", "INACTIVE", "EXPIRED", "EXHAUSTED"],
        message: "Invalid status",
      },
      default: "INACTIVE",
    },

    // Display
    isVisible: {
      type: Boolean,
      default: true,
    },

    displayOrder: {
      type: Number,
      default: 0,
      min: 0,
    },

    bannerImage: {
      type: String,
      trim: true,
    },

    termsAndConditions: {
      type: String,
      trim: true,
      maxlength: [2000, "Terms cannot exceed 2000 characters"],
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
      transform: function (_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ status: 1 });
couponSchema.index({ validFrom: 1 });
couponSchema.index({ validTill: 1 });
couponSchema.index({ status: 1, validFrom: 1, validTill: 1 });
couponSchema.index({ displayOrder: 1 });

// Validate discount value for percentage
couponSchema.pre("save", function (next) {
  if (this.discountType === "PERCENTAGE" && this.discountValue > 100) {
    return next(new Error("Percentage discount cannot exceed 100%"));
  }
  if (this.validTill <= this.validFrom) {
    return next(new Error("Valid till must be after valid from"));
  }
  next();
});

// Check if coupon is valid for use
couponSchema.methods.isValid = function () {
  const now = new Date();
  if (this.status !== "ACTIVE") return false;
  if (now < this.validFrom || now > this.validTill) return false;
  if (this.totalUsageLimit && this.totalUsageCount >= this.totalUsageLimit) {
    return false;
  }
  return true;
};

// Check if coupon applies to kitchen
couponSchema.methods.appliesToKitchen = function (kitchenId) {
  const kitchenIdStr = kitchenId.toString();

  // Check if kitchen is excluded
  if (this.excludedKitchenIds.some((id) => id.toString() === kitchenIdStr)) {
    return false;
  }

  // If no specific kitchens, applies to all
  if (this.applicableKitchenIds.length === 0) return true;

  return this.applicableKitchenIds.some((id) => id.toString() === kitchenIdStr);
};

// Check if coupon applies to zone
couponSchema.methods.appliesToZone = function (zoneId) {
  if (this.applicableZoneIds.length === 0) return true;
  return this.applicableZoneIds.some(
    (id) => id.toString() === zoneId.toString()
  );
};

// Calculate discount amount
couponSchema.methods.calculateDiscount = function (orderValue) {
  let discount = 0;

  switch (this.discountType) {
    case "PERCENTAGE":
      discount = (orderValue * this.discountValue) / 100;
      if (this.maxDiscountAmount) {
        discount = Math.min(discount, this.maxDiscountAmount);
      }
      break;
    case "FLAT":
      discount = Math.min(this.discountValue, orderValue);
      break;
    case "FREE_DELIVERY":
      // Handled separately in order calculation
      discount = 0;
      break;
  }

  return Math.round(discount * 100) / 100; // Round to 2 decimal places
};

// Increment usage count
couponSchema.methods.incrementUsage = async function () {
  this.totalUsageCount += 1;
  if (this.totalUsageLimit && this.totalUsageCount >= this.totalUsageLimit) {
    this.status = "EXHAUSTED";
  }
  return this.save();
};

// Static method to find valid coupons for customer
couponSchema.statics.findValidForCustomer = function (zoneId, kitchenId) {
  const now = new Date();
  return this.find({
    status: "ACTIVE",
    isVisible: true,
    validFrom: { $lte: now },
    validTill: { $gte: now },
    $or: [
      { totalUsageLimit: null },
      { $expr: { $lt: ["$totalUsageCount", "$totalUsageLimit"] } },
    ],
    $or: [
      { applicableZoneIds: { $size: 0 } },
      { applicableZoneIds: zoneId },
    ],
    excludedKitchenIds: { $ne: kitchenId },
    $or: [
      { applicableKitchenIds: { $size: 0 } },
      { applicableKitchenIds: kitchenId },
    ],
  }).sort({ displayOrder: 1 });
};

const Coupon = mongoose.model("Coupon", couponSchema);

export default Coupon;
