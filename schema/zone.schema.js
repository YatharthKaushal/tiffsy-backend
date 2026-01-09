import mongoose from "mongoose";

/**
 * Zone Schema
 * Represents a delivery zone based on pincode (1 pincode = 1 zone)
 */
const zoneSchema = new mongoose.Schema(
  {
    pincode: {
      type: String,
      required: [true, "Pincode is required"],
      unique: true,
      trim: true,
      match: [/^[0-9]{6}$/, "Invalid pincode format (must be 6 digits)"],
    },

    name: {
      type: String,
      required: [true, "Zone name is required"],
      trim: true,
      maxlength: [100, "Zone name cannot exceed 100 characters"],
    },

    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
      maxlength: [50, "City name cannot exceed 50 characters"],
    },

    state: {
      type: String,
      trim: true,
      maxlength: [50, "State name cannot exceed 50 characters"],
    },

    status: {
      type: String,
      required: true,
      enum: {
        values: ["ACTIVE", "INACTIVE"],
        message: "Invalid status",
      },
      default: "INACTIVE",
    },

    orderingEnabled: {
      type: Boolean,
      default: true,
    },

    timezone: {
      type: String,
      default: "Asia/Kolkata",
      trim: true,
    },

    displayOrder: {
      type: Number,
      default: 0,
      min: 0,
    },

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
zoneSchema.index({ pincode: 1 }, { unique: true });
zoneSchema.index({ city: 1 });
zoneSchema.index({ status: 1 });
zoneSchema.index({ city: 1, status: 1 });
zoneSchema.index({ displayOrder: 1 });

// Check if zone is serviceable
zoneSchema.methods.isServiceable = function () {
  return this.status === "ACTIVE" && this.orderingEnabled;
};

// Static method to find active zones by city
zoneSchema.statics.findActiveByCity = function (city) {
  return this.find({ city, status: "ACTIVE", orderingEnabled: true });
};

// Static method to find zone by pincode
zoneSchema.statics.findByPincode = function (pincode) {
  return this.findOne({ pincode });
};

// Static method to get distinct cities
zoneSchema.statics.getActiveCities = function () {
  return this.distinct("city", { status: "ACTIVE" });
};

const Zone = mongoose.model("Zone", zoneSchema);

export default Zone;
