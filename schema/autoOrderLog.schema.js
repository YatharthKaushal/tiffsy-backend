import mongoose from "mongoose";

/**
 * AutoOrderLog Schema
 * Tracks all auto-order attempts including successes, failures, and skips
 * Used for analytics and debugging auto-ordering issues
 */
const autoOrderLogSchema = new mongoose.Schema(
  {
    // Reference to subscription
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: [true, "Subscription ID is required"],
    },

    // Reference to user
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    // Order details (populated only if successful)
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    orderNumber: {
      type: String,
      trim: true,
      default: null,
    },

    // Processing details
    mealWindow: {
      type: String,
      required: [true, "Meal window is required"],
      enum: {
        values: ["LUNCH", "DINNER"],
        message: "Meal window must be LUNCH or DINNER",
      },
    },

    processedDate: {
      type: Date,
      required: [true, "Processed date is required"],
    },

    // Result status
    status: {
      type: String,
      required: [true, "Status is required"],
      enum: {
        values: ["SUCCESS", "SKIPPED", "FAILED"],
        message: "Status must be SUCCESS, SKIPPED, or FAILED",
      },
    },

    // Human-readable reason for failures/skips
    reason: {
      type: String,
      trim: true,
      maxlength: [500, "Reason cannot exceed 500 characters"],
      default: null,
    },

    // Detailed failure category for analytics
    failureCategory: {
      type: String,
      enum: {
        values: [
          "NO_VOUCHERS",
          "NO_ADDRESS",
          "NO_ZONE",
          "NO_KITCHEN",
          "KITCHEN_NOT_SERVING_ZONE",
          "NO_MENU_ITEM",
          "VOUCHER_REDEMPTION_FAILED",
          "ORDER_CREATION_FAILED",
          "SUBSCRIPTION_PAUSED",
          "SLOT_SKIPPED",
          "SUBSCRIPTION_EXPIRED",
          "UNKNOWN",
        ],
        message: "Invalid failure category",
      },
      default: null,
    },

    // Context for debugging - stores IDs and values at time of processing
    context: {
      addressId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CustomerAddress",
      },
      pincode: {
        type: String,
        trim: true,
      },
      zoneId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Zone",
      },
      zoneName: {
        type: String,
        trim: true,
      },
      kitchenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Kitchen",
      },
      kitchenName: {
        type: String,
        trim: true,
      },
      menuItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MenuItem",
      },
      menuItemName: {
        type: String,
        trim: true,
      },
      vouchersAvailable: {
        type: Number,
      },
    },

    // Cron job run identifier (groups logs from same cron run)
    cronRunId: {
      type: String,
      trim: true,
      required: [true, "Cron run ID is required"],
    },

    // Processing duration in milliseconds
    processingTimeMs: {
      type: Number,
      default: null,
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

// Indexes for efficient queries
autoOrderLogSchema.index({ subscriptionId: 1 });
autoOrderLogSchema.index({ userId: 1 });
autoOrderLogSchema.index({ status: 1 });
autoOrderLogSchema.index({ mealWindow: 1 });
autoOrderLogSchema.index({ cronRunId: 1 });
autoOrderLogSchema.index({ failureCategory: 1 });
autoOrderLogSchema.index({ createdAt: -1 });
autoOrderLogSchema.index({ processedDate: -1 });

// Compound indexes for common queries
autoOrderLogSchema.index({ mealWindow: 1, processedDate: -1 });
autoOrderLogSchema.index({ status: 1, mealWindow: 1 });
autoOrderLogSchema.index({ userId: 1, processedDate: -1 });
autoOrderLogSchema.index({ failureCategory: 1, createdAt: -1 });

/**
 * Get failure summary grouped by category and meal window
 * @param {Date} dateFrom - Start date
 * @param {Date} dateTo - End date
 * @returns {Promise<Array>} Aggregated failure summary
 */
autoOrderLogSchema.statics.getFailureSummary = function (dateFrom, dateTo) {
  return this.aggregate([
    {
      $match: {
        status: { $in: ["FAILED", "SKIPPED"] },
        createdAt: { $gte: dateFrom, $lte: dateTo },
      },
    },
    {
      $group: {
        _id: {
          failureCategory: "$failureCategory",
          mealWindow: "$mealWindow",
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);
};

/**
 * Get daily statistics for a date range
 * @param {Date} dateFrom - Start date
 * @param {Date} dateTo - End date
 * @returns {Promise<Array>} Daily stats
 */
autoOrderLogSchema.statics.getDailyStats = function (dateFrom, dateTo) {
  return this.aggregate([
    {
      $match: {
        processedDate: { $gte: dateFrom, $lte: dateTo },
      },
    },
    {
      $group: {
        _id: {
          date: {
            $dateToString: { format: "%Y-%m-%d", date: "$processedDate" },
          },
          mealWindow: "$mealWindow",
          status: "$status",
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { "_id.date": -1 },
    },
  ]);
};

/**
 * Get logs for a specific cron run
 * @param {String} cronRunId - Cron run identifier
 * @returns {Promise<Array>} Logs for the cron run
 */
autoOrderLogSchema.statics.getByCronRunId = function (cronRunId) {
  return this.find({ cronRunId })
    .populate("userId", "name phone email")
    .populate("subscriptionId", "planId status")
    .populate("orderId", "orderNumber status")
    .sort({ createdAt: 1 });
};

/**
 * Get recent failures for a user
 * @param {ObjectId} userId - User ID
 * @param {Number} limit - Max results
 * @returns {Promise<Array>} Recent failures
 */
autoOrderLogSchema.statics.getRecentFailuresByUser = function (
  userId,
  limit = 10
) {
  return this.find({
    userId,
    status: { $in: ["FAILED", "SKIPPED"] },
  })
    .sort({ createdAt: -1 })
    .limit(limit);
};

/**
 * Cleanup old logs (keep last N days)
 * @param {Number} daysToKeep - Number of days to retain
 * @returns {Promise<Object>} Delete result
 */
autoOrderLogSchema.statics.cleanupOldLogs = function (daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
  });
};

const AutoOrderLog = mongoose.model("AutoOrderLog", autoOrderLogSchema);

export default AutoOrderLog;
