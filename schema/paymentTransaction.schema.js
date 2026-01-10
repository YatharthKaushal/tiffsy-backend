/**
 * Payment Transaction Schema
 *
 * Central record for all payment transactions.
 * Decouples gateway-specific data from Order and Subscription schemas,
 * making it easier to switch payment providers in the future.
 *
 * Features:
 * - Tracks payment lifecycle from initiation to completion
 * - Stores webhook events for idempotency and debugging
 * - Tracks refunds associated with a payment
 * - Supports multiple entity types (ORDER, SUBSCRIPTION, OTHER)
 */

import mongoose from "mongoose";

const webhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const refundEntrySchema = new mongoose.Schema(
  {
    gatewayRefundId: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "PROCESSED", "COMPLETED", "FAILED"],
      default: "PENDING",
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
    },
    initiatedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
  },
  { _id: false }
);

const paymentTransactionSchema = new mongoose.Schema(
  {
    // Entity reference (what is being paid for)
    entityType: {
      type: String,
      required: true,
      enum: ["ORDER", "SUBSCRIPTION", "OTHER"],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "entityModel",
    },
    entityModel: {
      type: String,
      required: true,
      enum: ["Order", "Subscription"],
    },

    // Gateway information
    gatewayProvider: {
      type: String,
      required: true,
      enum: ["stripe", "razorpay", "mock"],
    },
    gatewayPaymentId: {
      type: String,
      required: true,
    },
    gatewayOrderId: {
      type: String,
    },

    // Payment details
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },
    paymentMethod: {
      type: String,
      enum: ["UPI", "CARD", "WALLET", "NETBANKING", "VOUCHER_ONLY", "OTHER", null],
    },

    // Status tracking
    status: {
      type: String,
      required: true,
      enum: ["INITIATED", "AUTHORIZED", "COMPLETED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"],
      default: "INITIATED",
    },

    // Gateway response storage
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Refund tracking
    refunds: [refundEntrySchema],

    // Webhook events for idempotency
    webhookEvents: [webhookEventSchema],

    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Timestamps for status changes
    completedAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
paymentTransactionSchema.index({ entityType: 1, entityId: 1 });
paymentTransactionSchema.index({ gatewayPaymentId: 1 }, { unique: true });
paymentTransactionSchema.index({ gatewayOrderId: 1 }, { sparse: true });
paymentTransactionSchema.index({ status: 1 });
paymentTransactionSchema.index({ "webhookEvents.eventId": 1 });
paymentTransactionSchema.index({ gatewayProvider: 1, status: 1 });
paymentTransactionSchema.index({ createdAt: -1 });

// Virtual for total refunded amount
paymentTransactionSchema.virtual("totalRefunded").get(function () {
  if (!this.refunds || this.refunds.length === 0) return 0;
  return this.refunds
    .filter((r) => r.status === "COMPLETED" || r.status === "PROCESSED")
    .reduce((sum, r) => sum + r.amount, 0);
});

// Virtual for checking if fully refunded
paymentTransactionSchema.virtual("isFullyRefunded").get(function () {
  return this.totalRefunded >= this.amount;
});

/**
 * Find transaction by entity (Order or Subscription)
 * @param {string} entityType - 'ORDER' or 'SUBSCRIPTION'
 * @param {string} entityId - Entity ObjectId
 * @returns {Promise<PaymentTransaction|null>}
 */
paymentTransactionSchema.statics.findByEntity = function (entityType, entityId) {
  return this.findOne({ entityType, entityId }).sort({ createdAt: -1 });
};

/**
 * Find transaction by gateway payment ID
 * @param {string} gatewayPaymentId - Payment ID from gateway
 * @returns {Promise<PaymentTransaction|null>}
 */
paymentTransactionSchema.statics.findByGatewayId = function (gatewayPaymentId) {
  return this.findOne({ gatewayPaymentId });
};

/**
 * Check if webhook event was already processed (idempotency)
 * @param {string} eventId - Webhook event ID
 * @returns {Promise<boolean>}
 */
paymentTransactionSchema.statics.hasProcessedEvent = async function (eventId) {
  const count = await this.countDocuments({ "webhookEvents.eventId": eventId });
  return count > 0;
};

/**
 * Get all transactions for a user's orders
 * @param {Array<string>} orderIds - Array of order IDs
 * @param {Object} options - Query options
 * @returns {Promise<Array<PaymentTransaction>>}
 */
paymentTransactionSchema.statics.findByOrderIds = function (orderIds, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  return this.find({
    entityType: "ORDER",
    entityId: { $in: orderIds },
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

/**
 * Get all transactions for a user's subscriptions
 * @param {Array<string>} subscriptionIds - Array of subscription IDs
 * @param {Object} options - Query options
 * @returns {Promise<Array<PaymentTransaction>>}
 */
paymentTransactionSchema.statics.findBySubscriptionIds = function (subscriptionIds, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  return this.find({
    entityType: "SUBSCRIPTION",
    entityId: { $in: subscriptionIds },
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

/**
 * Get failed transactions for retry
 * @param {string} gatewayProvider - Provider name
 * @param {number} limit - Max results
 * @returns {Promise<Array<PaymentTransaction>>}
 */
paymentTransactionSchema.statics.findFailedForRetry = function (gatewayProvider, limit = 100) {
  return this.find({
    gatewayProvider,
    status: "FAILED",
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
  })
    .sort({ createdAt: -1 })
    .limit(limit);
};

/**
 * Update refund status
 * @param {string} gatewayRefundId - Refund ID from gateway
 * @param {string} status - New status
 * @param {Object} [gatewayResponse] - Gateway response data
 * @returns {Promise<PaymentTransaction|null>}
 */
paymentTransactionSchema.statics.updateRefundStatus = function (
  gatewayRefundId,
  status,
  gatewayResponse
) {
  const updateFields = {
    "refunds.$.status": status,
  };

  if (gatewayResponse) {
    updateFields["refunds.$.gatewayResponse"] = gatewayResponse;
  }

  if (status === "COMPLETED" || status === "PROCESSED") {
    updateFields["refunds.$.completedAt"] = new Date();
  }

  return this.findOneAndUpdate(
    { "refunds.gatewayRefundId": gatewayRefundId },
    { $set: updateFields },
    { new: true }
  );
};

// Ensure virtuals are included in JSON/Object conversion
paymentTransactionSchema.set("toJSON", { virtuals: true });
paymentTransactionSchema.set("toObject", { virtuals: true });

const PaymentTransaction = mongoose.model("PaymentTransaction", paymentTransactionSchema);

export default PaymentTransaction;
