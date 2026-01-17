import mongoose from "mongoose";
import { normalizePhone } from "../utils/phone.utils.js";

/**
 * Kitchen Schema
 * Represents a cloud kitchen (Tiffsy-owned or Partner)
 */
const kitchenSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Kitchen name is required"],
      trim: true,
      maxlength: [100, "Kitchen name cannot exceed 100 characters"],
    },

    code: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    // Kitchen Type & Flags
    type: {
      type: String,
      required: [true, "Kitchen type is required"],
      enum: {
        values: ["TIFFSY", "PARTNER"],
        message: "Invalid kitchen type",
      },
    },

    authorizedFlag: {
      type: Boolean,
      default: false,
    },

    premiumFlag: {
      type: Boolean,
      default: false,
    },

    gourmetFlag: {
      type: Boolean,
      default: false,
    },

    // Branding
    logo: {
      type: String,
      trim: true,
    },

    coverImage: {
      type: String,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    cuisineTypes: {
      type: [String],
      default: [],
    },

    // Address
    address: {
      addressLine1: {
        type: String,
        required: [true, "Address line 1 is required"],
        trim: true,
      },
      addressLine2: {
        type: String,
        trim: true,
      },
      locality: {
        type: String,
        required: [true, "Locality is required"],
        trim: true,
      },
      city: {
        type: String,
        required: [true, "City is required"],
        trim: true,
      },
      state: {
        type: String,
        trim: true,
      },
      pincode: {
        type: String,
        required: [true, "Pincode is required"],
        trim: true,
        match: [/^[0-9]{6}$/, "Invalid pincode format"],
      },
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },

    // Zone Serving
    zonesServed: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Zone",
      required: [true, "At least one zone is required"],
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: "Kitchen must serve at least one zone",
      },
    },

    // Operating Hours
    operatingHours: {
      lunch: {
        startTime: {
          type: String,
          match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"],
        },
        endTime: {
          type: String,
          match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"],
        },
      },
      dinner: {
        startTime: {
          type: String,
          match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"],
        },
        endTime: {
          type: String,
          match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"],
        },
      },
      onDemand: {
        startTime: {
          type: String,
          match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"],
        },
        endTime: {
          type: String,
          match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"],
        },
        isAlwaysOpen: {
          type: Boolean,
          default: false,
        },
      },
    },

    // Contact
    contactPhone: {
      type: String,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Invalid phone number format (must be 10 digits starting with 6-9)"],
      set: normalizePhone,
    },

    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },

    // Owner/Manager (for Partner kitchens)
    ownerName: {
      type: String,
      trim: true,
    },

    ownerPhone: {
      type: String,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Invalid phone number format (must be 10 digits starting with 6-9)"],
      set: normalizePhone,
    },

    // Status
    status: {
      type: String,
      required: true,
      enum: {
        values: ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_APPROVAL", "DELETED"],
        message: "Invalid status",
      },
      default: "PENDING_APPROVAL",
    },

    isAcceptingOrders: {
      type: Boolean,
      default: true,
    },

    // Ratings
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    totalRatings: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: {
      type: Date,
    },

    // Rejection tracking
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, "Rejection reason cannot exceed 500 characters"],
    },

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    rejectedAt: {
      type: Date,
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
kitchenSchema.index({ name: "text" });
kitchenSchema.index({ type: 1 });
kitchenSchema.index({ status: 1 });
kitchenSchema.index({ zonesServed: 1 });
kitchenSchema.index({ type: 1, status: 1 });
kitchenSchema.index({ "address.city": 1 });

// Check if kitchen can accept orders
kitchenSchema.methods.canAcceptOrders = function () {
  return this.status === "ACTIVE" && this.isAcceptingOrders;
};

// Check if kitchen serves a zone
kitchenSchema.methods.servesZone = function (zoneId) {
  return this.zonesServed.some(
    (zone) => zone.toString() === zoneId.toString()
  );
};

// Static method to generate unique kitchen code
kitchenSchema.statics.generateKitchenCode = async function () {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  let isUnique = false;

  while (!isUnique) {
    code = "KIT-";
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const existing = await this.findOne({ code });
    if (!existing) {
      isUnique = true;
    }
  }

  return code;
};

// Static method to find active kitchens by zone
kitchenSchema.statics.findActiveByZone = function (zoneId) {
  return this.find({
    zonesServed: zoneId,
    status: "ACTIVE",
    isAcceptingOrders: true,
  });
};

// Static method to find partner kitchens in a zone
kitchenSchema.statics.findPartnerByZone = function (zoneId) {
  return this.findOne({
    zonesServed: zoneId,
    type: "PARTNER",
    status: "ACTIVE",
  });
};

const Kitchen = mongoose.model("Kitchen", kitchenSchema);

export default Kitchen;
