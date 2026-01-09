import mongoose from "mongoose";

/**
 * Addon Schema
 * Standalone add-on items that can be attached to menu items
 */
const addonSchema = new mongoose.Schema(
  {
    kitchenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kitchen",
      required: [true, "Kitchen ID is required"],
    },

    name: {
      type: String,
      required: [true, "Addon name is required"],
      trim: true,
      maxlength: [100, "Addon name cannot exceed 100 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [300, "Description cannot exceed 300 characters"],
    },

    // Pricing
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },

    // Dietary Info
    dietaryType: {
      type: String,
      enum: {
        values: ["VEG", "NON_VEG", "VEGAN", "EGGETARIAN"],
        message: "Invalid dietary type",
      },
    },

    // Image
    image: {
      type: String,
      trim: true,
    },

    // Quantity Constraints
    minQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxQuantity: {
      type: Number,
      default: 10,
      min: 1,
    },

    // Availability
    isAvailable: {
      type: Boolean,
      default: true,
    },

    // Status
    status: {
      type: String,
      required: true,
      enum: {
        values: ["ACTIVE", "INACTIVE", "DELETED"],
        message: "Invalid status",
      },
      default: "ACTIVE",
    },

    // Display
    displayOrder: {
      type: Number,
      default: 0,
      min: 0,
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
addonSchema.index({ kitchenId: 1 });
addonSchema.index({ kitchenId: 1, status: 1 });
addonSchema.index({ status: 1 });
addonSchema.index({ displayOrder: 1 });

// Validate maxQuantity >= minQuantity
addonSchema.pre("save", async function () {
  if (this.maxQuantity < this.minQuantity) {
    throw new Error("Max quantity must be >= min quantity");
  }
});

// Check if addon is orderable
addonSchema.methods.isOrderable = function () {
  return this.status === "ACTIVE" && this.isAvailable;
};

// Static method to find active addons by kitchen
addonSchema.statics.findActiveByKitchen = function (kitchenId) {
  return this.find({
    kitchenId,
    status: "ACTIVE",
    isAvailable: true,
  }).sort({ displayOrder: 1 });
};

// Static method to find all addons by kitchen (for management)
addonSchema.statics.findAllByKitchen = function (kitchenId) {
  return this.find({
    kitchenId,
    status: { $ne: "DELETED" },
  }).sort({ displayOrder: 1 });
};

const Addon = mongoose.model("Addon", addonSchema);

export default Addon;
