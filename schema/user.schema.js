import mongoose from "mongoose";
import { normalizePhone } from "../utils/phone.utils.js";

/**
 * User Schema
 * Represents all users: Customers, Kitchen Staff, Delivery Drivers, and Admins
 */
const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Invalid phone number format (must be 10 digits starting with 6-9)"],
      set: normalizePhone,
    },

    role: {
      type: String,
      required: [true, "Role is required"],
      enum: {
        values: ["CUSTOMER", "KITCHEN_STAFF", "DRIVER", "ADMIN"],
        message: "Invalid role",
      },
    },

    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },

    dietaryPreferences: {
      type: [String],
      enum: {
        values: ["VEG", "NON_VEG", "VEGAN", "JAIN", "EGGETARIAN"],
        message: "Invalid dietary preference",
      },
      default: [],
    },

    profileImage: {
      type: String,
      trim: true,
    },

    firebaseUid: {
      type: String,
      trim: true,
      sparse: true,
    },

    status: {
      type: String,
      required: true,
      enum: {
        values: ["ACTIVE", "INACTIVE", "SUSPENDED", "DELETED"],
        message: "Invalid status",
      },
      default: "ACTIVE",
    },

    // For KITCHEN_STAFF role
    kitchenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kitchen",
      sparse: true,
    },

    // For ADMIN role
    username: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      match: [/^[a-z0-9_]+$/, "Username can only contain lowercase letters, numbers, and underscores"],
    },

    passwordHash: {
      type: String,
      select: false, // Don't return in queries by default
    },

    // Metadata
    lastLoginAt: {
      type: Date,
    },

    fcmTokens: {
      type: [String],
      default: [],
    },

    // For suspended users
    suspensionReason: {
      type: String,
      trim: true,
    },

    suspendedAt: {
      type: Date,
    },

    suspendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ role: 1, status: 1 }); // Compound index for role-based queries with status
userSchema.index({ kitchenId: 1 }, { sparse: true });
userSchema.index({ username: 1 }, { unique: true, sparse: true });
userSchema.index({ firebaseUid: 1 }, { sparse: true });

// Validate kitchenId is set for KITCHEN_STAFF
userSchema.pre("save", function (next) {
  if (this.role === "KITCHEN_STAFF" && !this.kitchenId) {
    return next(new Error("Kitchen ID is required for kitchen staff"));
  }
  next();
});

// Instance method to check if user can login
userSchema.methods.canLogin = function () {
  return this.status === "ACTIVE";
};

// Static method to find active users by role
userSchema.statics.findActiveByRole = function (role) {
  return this.find({ role, status: "ACTIVE" });
};

// Static method to find by phone (normalizes input)
userSchema.statics.findByPhone = function (phone) {
  const normalizedPhone = normalizePhone(phone);
  return this.findOne({ phone: normalizedPhone, status: { $ne: "DELETED" } });
};

const User = mongoose.model("User", userSchema);

export default User;
