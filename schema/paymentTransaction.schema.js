import mongoose from "mongoose";

/**
 * PaymentTransaction Schema
 * Tracks all payment attempts through Razorpay for audit and reconciliation
 */
const paymentTransactionSchema = new mongoose.Schema(
  {
    // Razorpay identifiers
    razorpayOrderId: {
      type: String,
      required: [true, "Razorpay order ID is required"],
      unique: true,
      trim: true,
      index: true,
    },

    razorpayPaymentId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },

    razorpaySignature: {
      type: String,
      trim: true,
    },

    // Purchase reference (polymorphic)
    purchaseType: {
      type: String,
      required: [true, "Purchase type is required"],
      enum: {
        values: ["ORDER", "SUBSCRIPTION", "WALLET_RECHARGE", "FUTURE_PRODUCT"],
        message: "Invalid purchase type",
      },
      index: true,
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Reference ID is required"],
      refPath: "purchaseTypeModel",
    },

    // Virtual field for dynamic ref
    purchaseTypeModel: {
      type: String,
      required: true,
      enum: ["Order", "Subscription", "WalletRecharge", "FutureProduct"],
    },

    // User
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },

    // Amount details (stored in both paise and rupees for convenience)
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },

    amountRupees: {
      type: Number,
      required: [true, "Amount in rupees is required"],
      min: [0, "Amount cannot be negative"],
    },

    currency: {
      type: String,
      default: "INR",
      enum: ["INR"],
    },

    // Breakdown for audit trail
    breakdown: {
      subtotal: { type: Number, min: 0 },
      mainCourseTotal: { type: Number, min: 0 },
      addonTotal: { type: Number, min: 0 },
      deliveryFee: { type: Number, min: 0 },
      serviceFee: { type: Number, min: 0 },
      packagingFee: { type: Number, min: 0 },
      handlingFee: { type: Number, min: 0 },
      taxAmount: { type: Number, min: 0 },
      voucherDiscount: { type: Number, min: 0 },
      couponDiscount: { type: Number, min: 0 },
    },

    // Payment status
    status: {
      type: String,
      required: true,
      enum: {
        values: [
          "CREATED",
          "AUTHORIZED",
          "CAPTURED",
          "FAILED",
          "REFUNDED",
          "PARTIALLY_REFUNDED",
          "EXPIRED",
        ],
        message: "Invalid status",
      },
      default: "CREATED",
      index: true,
    },

    // Payment method (populated after payment)
    paymentMethod: {
      type: String,
      enum: ["UPI", "CARD", "WALLET", "NETBANKING", "OTHER"],
    },

    // Full Razorpay response for debugging
    razorpayResponse: mongoose.Schema.Types.Mixed,

    // Failure tracking
    failureReason: {
      type: String,
      trim: true,
    },

    failureCode: {
      type: String,
      trim: true,
    },

    // Webhooks received (for debugging and audit)
    webhooksReceived: [
      {
        event: { type: String, required: true },
        receivedAt: { type: Date, default: Date.now },
        payload: mongoose.Schema.Types.Mixed,
      },
    ],

    // Timestamps
    paidAt: Date,

    expiresAt: {
      type: Date,
      index: true,
    },

    // Receipt for reconciliation
    receipt: {
      type: String,
      trim: true,
    },

    // Additional notes/metadata
    notes: mongoose.Schema.Types.Mixed,

    // Refund tracking
    refunds: [
      {
        refundId: { type: String, required: true },
        razorpayRefundId: { type: String },
        amount: { type: Number, required: true },
        amountRupees: { type: Number, required: true },
        status: {
          type: String,
          enum: ["INITIATED", "PENDING", "PROCESSED", "FAILED"],
          default: "INITIATED",
        },
        reason: String,
        createdAt: { type: Date, default: Date.now },
        processedAt: Date,
      },
    ],

    totalRefunded: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalRefundedRupees: {
      type: Number,
      default: 0,
      min: 0,
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

// Indexes
paymentTransactionSchema.index({ razorpayOrderId: 1 }, { unique: true });
paymentTransactionSchema.index({ razorpayPaymentId: 1 }, { sparse: true });
paymentTransactionSchema.index({ userId: 1, createdAt: -1 });
paymentTransactionSchema.index({ purchaseType: 1, referenceId: 1 });
paymentTransactionSchema.index({ status: 1, createdAt: -1 });
paymentTransactionSchema.index({ createdAt: -1 });

// Pre-save: Set purchaseTypeModel based on purchaseType
paymentTransactionSchema.pre("save", function () {
  const typeModelMap = {
    ORDER: "Order",
    SUBSCRIPTION: "Subscription",
    WALLET_RECHARGE: "WalletRecharge",
    FUTURE_PRODUCT: "FutureProduct",
  };
  this.purchaseTypeModel = typeModelMap[this.purchaseType];
});

// Generate unique receipt ID
paymentTransactionSchema.statics.generateReceipt = function (purchaseType, referenceId) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const prefix = purchaseType.substring(0, 3);
  return `${prefix}-${timestamp}-${random}`;
};

// Find by Razorpay order ID
paymentTransactionSchema.statics.findByRazorpayOrderId = function (razorpayOrderId) {
  return this.findOne({ razorpayOrderId });
};

// Find by Razorpay payment ID
paymentTransactionSchema.statics.findByRazorpayPaymentId = function (razorpayPaymentId) {
  return this.findOne({ razorpayPaymentId });
};

// Find by purchase reference
paymentTransactionSchema.statics.findByPurchase = function (purchaseType, referenceId) {
  return this.findOne({ purchaseType, referenceId }).sort({ createdAt: -1 });
};

// Find pending/expired transactions for cleanup
paymentTransactionSchema.statics.findExpired = function () {
  return this.find({
    status: "CREATED",
    expiresAt: { $lt: new Date() },
  });
};

// Get user's payment history
paymentTransactionSchema.statics.findByUser = function (userId, options = {}) {
  const query = { userId };
  if (options.status) query.status = options.status;
  if (options.purchaseType) query.purchaseType = options.purchaseType;

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);
};

// Instance method: Mark as captured
paymentTransactionSchema.methods.markCaptured = async function (paymentId, response) {
  this.status = "CAPTURED";
  this.razorpayPaymentId = paymentId;
  this.razorpayResponse = response;
  this.paidAt = new Date();
  if (response?.method) {
    const methodMap = {
      card: "CARD",
      upi: "UPI",
      netbanking: "NETBANKING",
      wallet: "WALLET",
    };
    this.paymentMethod = methodMap[response.method] || "OTHER";
  }
  return this.save();
};

// Instance method: Mark as failed
paymentTransactionSchema.methods.markFailed = async function (reason, code, response) {
  this.status = "FAILED";
  this.failureReason = reason;
  this.failureCode = code;
  this.razorpayResponse = response;
  return this.save();
};

// Instance method: Add webhook event
paymentTransactionSchema.methods.addWebhookEvent = async function (event, payload) {
  this.webhooksReceived.push({
    event,
    receivedAt: new Date(),
    payload,
  });
  return this.save();
};

// Instance method: Add refund
paymentTransactionSchema.methods.addRefund = async function (refundData) {
  this.refunds.push({
    refundId: refundData.refundId,
    razorpayRefundId: refundData.razorpayRefundId,
    amount: refundData.amount,
    amountRupees: refundData.amountRupees,
    status: refundData.status || "INITIATED",
    reason: refundData.reason,
  });

  // Update totals if refund is processed
  if (refundData.status === "PROCESSED") {
    this.totalRefunded += refundData.amount;
    this.totalRefundedRupees += refundData.amountRupees;

    // Update status based on refund amount
    if (this.totalRefunded >= this.amount) {
      this.status = "REFUNDED";
    } else {
      this.status = "PARTIALLY_REFUNDED";
    }
  }

  return this.save();
};

// Instance method: Update refund status
paymentTransactionSchema.methods.updateRefundStatus = async function (
  razorpayRefundId,
  status,
  processedAt
) {
  const refund = this.refunds.find((r) => r.razorpayRefundId === razorpayRefundId);
  if (refund) {
    refund.status = status;
    if (processedAt) refund.processedAt = processedAt;

    // Update totals if newly processed
    if (status === "PROCESSED" && !this.totalRefunded) {
      this.totalRefunded += refund.amount;
      this.totalRefundedRupees += refund.amountRupees;

      if (this.totalRefunded >= this.amount) {
        this.status = "REFUNDED";
      } else {
        this.status = "PARTIALLY_REFUNDED";
      }
    }
  }
  return this.save();
};

// Virtual: isFullyRefunded
paymentTransactionSchema.virtual("isFullyRefunded").get(function () {
  return this.totalRefunded >= this.amount;
});

// Virtual: refundableAmount
paymentTransactionSchema.virtual("refundableAmount").get(function () {
  return Math.max(0, this.amount - this.totalRefunded);
});

paymentTransactionSchema.virtual("refundableAmountRupees").get(function () {
  return Math.max(0, this.amountRupees - this.totalRefundedRupees);
});

const PaymentTransaction = mongoose.model("PaymentTransaction", paymentTransactionSchema);

export default PaymentTransaction;
