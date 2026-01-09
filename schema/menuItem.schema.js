import mongoose from "mongoose";

/**
 * MenuItem Schema
 * Menu items for Meal Menu (voucher-eligible) or On-Demand Menu (coupon-eligible)
 */
const menuItemSchema = new mongoose.Schema(
  {
    kitchenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kitchen",
      required: [true, "Kitchen ID is required"],
    },

    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
      maxlength: [100, "Item name cannot exceed 100 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    // Categorization
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: {
        values: ["MAIN_COURSE", "ADDON"],
        message: "Invalid category",
      },
      default: "MAIN_COURSE",
    },

    menuType: {
      type: String,
      required: [true, "Menu type is required"],
      enum: {
        values: ["MEAL_MENU", "ON_DEMAND_MENU"],
        message: "Invalid menu type",
      },
    },

    mealWindow: {
      type: String,
      enum: {
        values: ["LUNCH", "DINNER"],
        message: "Invalid meal window",
      },
      // Required only for MEAL_MENU
    },

    // Pricing
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },

    discountedPrice: {
      type: Number,
      min: [0, "Discounted price cannot be negative"],
    },

    // Item Details
    portionSize: {
      type: String,
      trim: true,
      maxlength: [50, "Portion size cannot exceed 50 characters"],
    },

    preparationTime: {
      type: Number,
      min: [0, "Preparation time cannot be negative"],
    },

    // Dietary Info
    dietaryType: {
      type: String,
      enum: {
        values: ["VEG", "NON_VEG", "VEGAN", "EGGETARIAN"],
        message: "Invalid dietary type",
      },
    },

    isJainFriendly: {
      type: Boolean,
      default: false,
    },

    spiceLevel: {
      type: String,
      enum: {
        values: ["MILD", "MEDIUM", "SPICY", "EXTRA_SPICY"],
        message: "Invalid spice level",
      },
    },

    // Images
    images: {
      type: [String],
      default: [],
    },

    thumbnailImage: {
      type: String,
      trim: true,
    },

    // Add-ons
    addonIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Addon",
      default: [],
    },

    // What's Included (for thalis)
    includes: {
      type: [String],
      default: [],
    },

    // Availability
    isAvailable: {
      type: Boolean,
      default: true,
    },

    availableFrom: {
      type: String,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"],
    },

    availableTill: {
      type: String,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"],
    },

    // Status
    status: {
      type: String,
      required: true,
      enum: {
        values: ["ACTIVE", "INACTIVE", "DISABLED_BY_ADMIN"],
        message: "Invalid status",
      },
      default: "ACTIVE",
    },

    disabledReason: {
      type: String,
      trim: true,
      maxlength: [300, "Disabled reason cannot exceed 300 characters"],
    },

    // Display
    displayOrder: {
      type: Number,
      default: 0,
      min: 0,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    disabledBy: {
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
menuItemSchema.index({ kitchenId: 1 });
menuItemSchema.index({ kitchenId: 1, menuType: 1 });
menuItemSchema.index({ kitchenId: 1, menuType: 1, mealWindow: 1 });
menuItemSchema.index({ status: 1 });
menuItemSchema.index({ category: 1 });
menuItemSchema.index({ dietaryType: 1 });
menuItemSchema.index({ displayOrder: 1 });

// Validate mealWindow for MEAL_MENU
menuItemSchema.pre("save", async function (next) {
  if (this.menuType === "MEAL_MENU" && !this.mealWindow) {
    return next(new Error("Meal window is required for Meal Menu items"));
  }

  // Validate discountedPrice < price
  if (this.discountedPrice && this.discountedPrice >= this.price) {
    return next(new Error("Discounted price must be less than original price"));
  }

  // For MEAL_MENU, ensure only 1 item per mealWindow per kitchen
  if (this.menuType === "MEAL_MENU" && this.isNew) {
    const existing = await this.constructor.findOne({
      kitchenId: this.kitchenId,
      menuType: "MEAL_MENU",
      mealWindow: this.mealWindow,
      status: { $ne: "INACTIVE" },
    });
    if (existing) {
      return next(
        new Error(`Kitchen already has a ${this.mealWindow} item in Meal Menu`)
      );
    }
  }

  next();
});

// Get effective price
menuItemSchema.methods.getEffectivePrice = function () {
  return this.discountedPrice || this.price;
};

// Check if item is orderable
menuItemSchema.methods.isOrderable = function () {
  return this.status === "ACTIVE" && this.isAvailable;
};

// Static method to find menu items by kitchen and type
menuItemSchema.statics.findByKitchenAndType = function (kitchenId, menuType) {
  return this.find({
    kitchenId,
    menuType,
    status: "ACTIVE",
    isAvailable: true,
  })
    .populate("addonIds")
    .sort({ displayOrder: 1 });
};

// Static method to find meal menu item
menuItemSchema.statics.findMealMenuItem = function (kitchenId, mealWindow) {
  return this.findOne({
    kitchenId,
    menuType: "MEAL_MENU",
    mealWindow,
    status: "ACTIVE",
  }).populate("addonIds");
};

const MenuItem = mongoose.model("MenuItem", menuItemSchema);

export default MenuItem;
