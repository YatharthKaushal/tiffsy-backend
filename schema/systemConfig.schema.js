import mongoose from "mongoose";

/**
 * System Configuration Schema
 * Stores application-wide configuration like cutoff times, cancellation rules, fees, etc.
 * All config values are persisted in DB and loaded on server start.
 */
const systemConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, "Config key is required"],
      unique: true,
      trim: true,
      enum: {
        values: [
          "cutoffTimes",
          "cancellation",
          "fees",
          "batching",
          "refund",
          "subscription",
          "general",
          "autoOrder",
        ],
        message: "Invalid config key",
      },
    },

    value: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, "Config value is required"],
    },

    description: {
      type: String,
      trim: true,
    },

    updatedBy: {
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

// Index for fast lookup
systemConfigSchema.index({ key: 1 }, { unique: true });

/**
 * Get config value by key
 * @param {string} key - Config key
 * @returns {Promise<any>} Config value or null
 */
systemConfigSchema.statics.getValue = async function (key) {
  const config = await this.findOne({ key });
  return config?.value || null;
};

/**
 * Set config value by key (upsert)
 * @param {string} key - Config key
 * @param {any} value - Config value
 * @param {ObjectId} updatedBy - User who updated
 * @param {string} description - Optional description
 * @returns {Promise<Object>} Updated config
 */
systemConfigSchema.statics.setValue = async function (key, value, updatedBy, description) {
  return this.findOneAndUpdate(
    { key },
    {
      $set: {
        value,
        updatedBy,
        ...(description && { description }),
      },
    },
    { upsert: true, new: true }
  );
};

/**
 * Get all config values as object
 * @returns {Promise<Object>} All configs as key-value object
 */
systemConfigSchema.statics.getAllConfigs = async function () {
  const configs = await this.find({});
  const result = {};
  for (const config of configs) {
    result[config.key] = config.value;
  }
  return result;
};

/**
 * Initialize default configs if not exists
 * @returns {Promise<void>}
 */
systemConfigSchema.statics.initializeDefaults = async function () {
  const defaults = [
    {
      key: "cutoffTimes",
      value: {
        LUNCH: "11:00",
        DINNER: "21:00",
      },
      description: "Meal window cutoff times in HH:mm format (IST)",
    },
    {
      key: "cancellation",
      value: {
        // Non-voucher order cancellation window in minutes
        nonVoucherWindowMinutes: 10,
        // Whether to allow cancellation after kitchen accepts (non-voucher)
        allowAfterAccepted: false,
        // Cancellation fee percentage tiers (for future use)
        feeTiers: {
          within5Min: 0,
          within10Min: 0,
          after10Min: 0,
        },
      },
      description: "Order cancellation rules and time windows",
    },
    {
      key: "fees",
      value: {
        deliveryFee: 30,
        serviceFee: 5,
        packagingFee: 10,
        handlingFee: 0,
        taxRate: 0.05,
      },
      description: "Default order charges and fees",
    },
    {
      key: "batching",
      value: {
        maxBatchSize: 15,
        failedOrderPolicy: "NO_RETURN",
        autoDispatchDelay: 0,
      },
      description: "Delivery batching configuration",
    },
    {
      key: "refund",
      value: {
        maxRetries: 3,
        autoProcessDelay: 0,
        processingDays: 5,
      },
      description: "Refund processing configuration",
    },
    {
      key: "autoOrder",
      value: {
        lunchCronTime: "10:00",
        dinnerCronTime: "19:00",
        enabled: true,
        autoAcceptOrders: true,
      },
      description: "Auto-order cron job configuration (times in IST)",
    },
  ];

  for (const config of defaults) {
    const existing = await this.findOne({ key: config.key });
    if (!existing) {
      await this.create(config);
      console.log(`> SystemConfig: Initialized ${config.key}`);
    }
  }
};

const SystemConfig = mongoose.model("SystemConfig", systemConfigSchema);

export default SystemConfig;
