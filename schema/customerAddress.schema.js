import mongoose from "mongoose";
import { normalizePhone } from "../utils/phone.utils.js";

/**
 * CustomerAddress Schema
 * Stores delivery addresses for customers with zone mapping
 */
const customerAddressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    label: {
      type: String,
      required: [true, "Address label is required"],
      trim: true,
      maxlength: [50, "Label cannot exceed 50 characters"],
    },

    // Address Fields
    addressLine1: {
      type: String,
      required: [true, "Address line 1 is required"],
      trim: true,
      maxlength: [200, "Address line 1 cannot exceed 200 characters"],
    },

    addressLine2: {
      type: String,
      trim: true,
      maxlength: [200, "Address line 2 cannot exceed 200 characters"],
    },

    landmark: {
      type: String,
      trim: true,
      maxlength: [100, "Landmark cannot exceed 100 characters"],
    },

    locality: {
      type: String,
      required: [true, "Locality is required"],
      trim: true,
      maxlength: [100, "Locality cannot exceed 100 characters"],
    },

    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
      maxlength: [50, "City cannot exceed 50 characters"],
    },

    state: {
      type: String,
      trim: true,
      maxlength: [50, "State cannot exceed 50 characters"],
    },

    pincode: {
      type: String,
      required: [true, "Pincode is required"],
      trim: true,
      match: [/^[0-9]{6}$/, "Invalid pincode format (must be 6 digits)"],
    },

    // Zone Reference (auto-resolved from pincode)
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
    },

    // Coordinates
    coordinates: {
      latitude: Number,
      longitude: Number,
    },

    // Contact for this address
    contactName: {
      type: String,
      trim: true,
      maxlength: [100, "Contact name cannot exceed 100 characters"],
    },

    contactPhone: {
      type: String,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Invalid phone number format (must be 10 digits starting with 6-9)"],
      set: normalizePhone,
    },

    // Serviceability
    isServiceable: {
      type: Boolean,
      default: false,
    },

    // Status
    isDefault: {
      type: Boolean,
      default: false,
    },

    isDeleted: {
      type: Boolean,
      default: false,
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
customerAddressSchema.index({ userId: 1 });
customerAddressSchema.index({ userId: 1, isDefault: 1 });
customerAddressSchema.index({ zoneId: 1 });
customerAddressSchema.index({ pincode: 1 });
customerAddressSchema.index({ userId: 1, isDeleted: 1 });

// Ensure only one default address per user
customerAddressSchema.pre("save", async function (next) {
  if (this.isDefault && this.isModified("isDefault")) {
    await this.constructor.updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

// Get full address string
customerAddressSchema.methods.getFullAddress = function () {
  const parts = [
    this.addressLine1,
    this.addressLine2,
    this.landmark,
    this.locality,
    this.city,
    this.state,
    this.pincode,
  ].filter(Boolean);
  return parts.join(", ");
};

// Static method to find user's addresses
customerAddressSchema.statics.findByUser = function (userId) {
  return this.find({ userId, isDeleted: false }).sort({ isDefault: -1, createdAt: -1 });
};

// Static method to find default address
customerAddressSchema.statics.findDefaultByUser = function (userId) {
  return this.findOne({ userId, isDefault: true, isDeleted: false });
};

const CustomerAddress = mongoose.model("CustomerAddress", customerAddressSchema);

export default CustomerAddress;
