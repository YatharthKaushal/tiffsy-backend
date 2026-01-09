import mongoose from "mongoose";

/**
 * DeliveryAssignment Schema
 * Individual delivery assignment and status per order
 */
const deliveryAssignmentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order ID is required"],
      unique: true,
    },

    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Driver ID is required"],
    },

    // Batch Reference
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryBatch",
    },

    sequenceInBatch: Number,

    // Assignment
    assignedAt: {
      type: Date,
      required: [true, "Assigned at is required"],
      default: Date.now,
    },

    assignedBy: {
      type: String,
      enum: {
        values: ["SYSTEM", "KITCHEN_STAFF", "ADMIN"],
        message: "Invalid assigned by",
      },
      default: "SYSTEM",
    },

    assignedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Status
    status: {
      type: String,
      required: true,
      enum: {
        values: [
          "ASSIGNED",
          "ACKNOWLEDGED",
          "PICKED_UP",
          "EN_ROUTE",
          "ARRIVED",
          "DELIVERED",
          "FAILED",
          "RETURNED",
          "CANCELLED",
        ],
        message: "Invalid status",
      },
      default: "ASSIGNED",
    },

    // Timestamps
    acknowledgedAt: Date,
    pickedUpAt: Date,
    enRouteAt: Date,
    arrivedAt: Date,
    deliveredAt: Date,
    failedAt: Date,
    returnedAt: Date,
    cancelledAt: Date,

    // Location Tracking (optional)
    lastKnownLocation: {
      latitude: Number,
      longitude: Number,
      updatedAt: Date,
    },

    locationHistory: [
      {
        latitude: Number,
        longitude: Number,
        timestamp: Date,
      },
    ],

    // Estimated Times
    estimatedPickupTime: Date,
    estimatedDeliveryTime: Date,
    actualDeliveryTime: Date,

    // Proof of Delivery
    proofOfDelivery: {
      type: {
        type: String,
        enum: ["OTP", "SIGNATURE", "PHOTO"],
      },
      otp: String,
      otpVerified: Boolean,
      signatureUrl: String,
      photoUrl: String,
      verifiedAt: Date,
      verifiedBy: String,
    },

    // Failure Handling
    failureReason: {
      type: String,
      enum: [
        "CUSTOMER_UNAVAILABLE",
        "WRONG_ADDRESS",
        "CUSTOMER_REFUSED",
        "ADDRESS_NOT_FOUND",
        "CUSTOMER_UNREACHABLE",
        "OTHER",
      ],
    },

    failureNotes: String,

    attemptCount: {
      type: Number,
      default: 1,
      min: 1,
    },

    returnedToKitchen: {
      type: Boolean,
      default: false,
    },

    // Driver Notes
    driverNotes: String,

    // Customer Contact
    customerContactAttempts: [
      {
        attemptedAt: Date,
        method: {
          type: String,
          enum: ["CALL", "SMS"],
        },
        successful: Boolean,
        notes: String,
      },
    ],
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
deliveryAssignmentSchema.index({ orderId: 1 }, { unique: true });
deliveryAssignmentSchema.index({ driverId: 1 });
deliveryAssignmentSchema.index({ batchId: 1 }, { sparse: true });
deliveryAssignmentSchema.index({ status: 1 });
deliveryAssignmentSchema.index({ assignedAt: -1 });
deliveryAssignmentSchema.index({ driverId: 1, status: 1 });

// Update status with timestamp
deliveryAssignmentSchema.methods.updateStatus = async function (newStatus) {
  this.status = newStatus;

  switch (newStatus) {
    case "ACKNOWLEDGED":
      this.acknowledgedAt = new Date();
      break;
    case "PICKED_UP":
      this.pickedUpAt = new Date();
      break;
    case "EN_ROUTE":
      this.enRouteAt = new Date();
      break;
    case "ARRIVED":
      this.arrivedAt = new Date();
      break;
    case "DELIVERED":
      this.deliveredAt = new Date();
      this.actualDeliveryTime = new Date();
      break;
    case "FAILED":
      this.failedAt = new Date();
      break;
    case "RETURNED":
      this.returnedAt = new Date();
      this.returnedToKitchen = true;
      break;
    case "CANCELLED":
      this.cancelledAt = new Date();
      break;
  }

  return this.save();
};

// Update location
deliveryAssignmentSchema.methods.updateLocation = async function (latitude, longitude) {
  const now = new Date();

  this.lastKnownLocation = {
    latitude,
    longitude,
    updatedAt: now,
  };

  this.locationHistory.push({
    latitude,
    longitude,
    timestamp: now,
  });

  // Keep only last 50 locations
  if (this.locationHistory.length > 50) {
    this.locationHistory = this.locationHistory.slice(-50);
  }

  return this.save();
};

// Verify OTP
deliveryAssignmentSchema.methods.verifyOtp = async function (enteredOtp) {
  if (!this.proofOfDelivery?.otp) {
    throw new Error("OTP not set for this delivery");
  }
  if (this.proofOfDelivery.otp !== enteredOtp) {
    return false;
  }
  this.proofOfDelivery.otpVerified = true;
  this.proofOfDelivery.verifiedAt = new Date();
  this.proofOfDelivery.verifiedBy = "CUSTOMER";
  return this.save();
};

// Generate OTP
deliveryAssignmentSchema.methods.generateOtp = async function () {
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  this.proofOfDelivery = {
    type: "OTP",
    otp,
    otpVerified: false,
  };
  return this.save();
};

// Static method to find active assignments for driver
deliveryAssignmentSchema.statics.findActiveByDriver = function (driverId) {
  return this.find({
    driverId,
    status: { $in: ["ASSIGNED", "ACKNOWLEDGED", "PICKED_UP", "EN_ROUTE", "ARRIVED"] },
  })
    .populate("orderId")
    .sort({ assignedAt: 1 });
};

// Static method to find by batch
deliveryAssignmentSchema.statics.findByBatch = function (batchId) {
  return this.find({ batchId })
    .populate("orderId")
    .sort({ sequenceInBatch: 1 });
};

const DeliveryAssignment = mongoose.model("DeliveryAssignment", deliveryAssignmentSchema);

export default DeliveryAssignment;
