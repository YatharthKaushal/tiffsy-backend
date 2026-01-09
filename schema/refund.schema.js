import mongoose from "mongoose";

/**
 * Refund Schema
 * Tracks refunds for cancelled/rejected/failed paid orders
 * Linked to original order and payment
 */
const refundSchema = new mongoose.Schema(
  {
    refundNumber: {
      type: String,
      required: [true, "Refund number is required"],
      unique: true,
      trim: true,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order ID is required"],
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    // Refund Amount
    amount: {
      type: Number,
      required: [true, "Refund amount is required"],
      min: [0, "Amount cannot be negative"],
    },

    refundType: {
      type: String,
      required: [true, "Refund type is required"],
      enum: {
        values: ["FULL", "PARTIAL"],
        message: "Invalid refund type",
      },
    },

    // Reason
    reason: {
      type: String,
      required: [true, "Refund reason is required"],
      enum: {
        values: [
          "ORDER_REJECTED",
          "ORDER_CANCELLED_BY_KITCHEN",
          "ORDER_CANCELLED_BY_CUSTOMER",
          "DELIVERY_FAILED",
          "QUALITY_ISSUE",
          "WRONG_ORDER",
          "ADMIN_INITIATED",
          "PAYMENT_ISSUE",
          "OTHER",
        ],
        message: "Invalid refund reason",
      },
    },

    reasonDetails: {
      type: String,
      trim: true,
      maxlength: [500, "Reason details cannot exceed 500 characters"],
    },

    // Status
    status: {
      type: String,
      required: true,
      enum: {
        values: [
          "INITIATED",
          "PENDING",
          "PROCESSING",
          "COMPLETED",
          "FAILED",
          "CANCELLED",
        ],
        message: "Invalid refund status",
      },
      default: "INITIATED",
    },

    // Payment Gateway Details
    originalPaymentId: {
      type: String,
      required: [true, "Original payment ID is required"],
      trim: true,
    },

    refundGatewayId: {
      type: String,
      trim: true,
    },

    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
    },

    gatewayStatus: {
      type: String,
      trim: true,
    },

    // Timing
    initiatedAt: {
      type: Date,
      required: [true, "Initiated at is required"],
      default: Date.now,
    },

    processedAt: Date,
    completedAt: Date,
    failedAt: Date,

    expectedCompletionDate: Date,

    // Retry Handling
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxRetries: {
      type: Number,
      default: 3,
      min: 1,
    },

    lastRetryAt: Date,
    nextRetryAt: Date,

    // Voucher Restoration
    vouchersRestored: {
      type: Boolean,
      default: false,
    },

    restoredVoucherIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Voucher",
      },
    ],

    // Admin Actions
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: Date,

    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
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
refundSchema.index({ refundNumber: 1 }, { unique: true });
refundSchema.index({ orderId: 1 });
refundSchema.index({ userId: 1 });
refundSchema.index({ status: 1 });
refundSchema.index({ initiatedAt: -1 });
refundSchema.index({ status: 1, nextRetryAt: 1 });
refundSchema.index({ userId: 1, status: 1 });

/**
 * Generate unique refund number
 * Format: REF-YYYYMMDD-XXXXX
 * @returns {string} Refund number
 */
refundSchema.statics.generateRefundNumber = function () {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `REF-${dateStr}-${random}`;
};

/**
 * Check if refund can be retried
 * @returns {boolean} Whether retry is allowed
 */
refundSchema.methods.canRetry = function () {
  return (
    this.status === "FAILED" &&
    this.retryCount < this.maxRetries
  );
};

/**
 * Mark refund as processing
 * @returns {Promise<Document>} Updated refund document
 */
refundSchema.methods.markProcessing = async function () {
  this.status = "PROCESSING";
  this.processedAt = new Date();
  return this.save();
};

/**
 * Mark refund as completed
 * @param {string} gatewayId - Payment gateway refund ID
 * @param {Object} response - Gateway response object
 * @returns {Promise<Document>} Updated refund document
 */
refundSchema.methods.markCompleted = async function (gatewayId, response) {
  this.status = "COMPLETED";
  this.completedAt = new Date();
  if (gatewayId) this.refundGatewayId = gatewayId;
  if (response) this.gatewayResponse = response;
  return this.save();
};

/**
 * Mark refund as failed and schedule retry
 * @param {string} errorMessage - Error message from gateway
 * @param {Object} response - Gateway response object
 * @returns {Promise<Document>} Updated refund document
 */
refundSchema.methods.markFailed = async function (errorMessage, response) {
  this.status = "FAILED";
  this.failedAt = new Date();
  this.lastRetryAt = new Date();
  this.retryCount += 1;

  if (response) {
    this.gatewayResponse = response;
    this.gatewayStatus = errorMessage;
  }

  // Schedule next retry if allowed (exponential backoff: 1hr, 2hr, 4hr)
  if (this.canRetry()) {
    const delayHours = Math.pow(2, this.retryCount - 1);
    this.nextRetryAt = new Date(Date.now() + delayHours * 60 * 60 * 1000);
  }

  return this.save();
};

/**
 * Mark vouchers as restored
 * @param {ObjectId[]} voucherIds - Array of restored voucher IDs
 * @returns {Promise<Document>} Updated refund document
 */
refundSchema.methods.markVouchersRestored = async function (voucherIds) {
  this.vouchersRestored = true;
  this.restoredVoucherIds = voucherIds;
  this.status = "COMPLETED";
  this.completedAt = new Date();
  return this.save();
};

/**
 * Find refunds pending retry
 * @returns {Query} Mongoose query for pending retries
 */
refundSchema.statics.findPendingRetries = function () {
  const now = new Date();
  return this.find({
    status: "FAILED",
    nextRetryAt: { $lte: now },
    $expr: { $lt: ["$retryCount", "$maxRetries"] },
  }).sort({ nextRetryAt: 1 });
};

/**
 * Find refunds by user
 * @param {ObjectId} userId - User ID
 * @returns {Query} Mongoose query
 */
refundSchema.statics.findByUser = function (userId) {
  return this.find({ userId })
    .populate("orderId", "orderNumber totalAmount")
    .sort({ initiatedAt: -1 });
};

/**
 * Find refund by order
 * @param {ObjectId} orderId - Order ID
 * @returns {Query} Mongoose query
 */
refundSchema.statics.findByOrder = function (orderId) {
  return this.findOne({ orderId });
};

const Refund = mongoose.model("Refund", refundSchema);

export default Refund;
