import mongoose from "mongoose";

/**
 * Notification Schema
 * Stores sent push notifications for logging and user notification history
 */
const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      required: true,
      enum: {
        values: [
          // Customer order status notifications
          "ORDER_STATUS_CHANGE", // Legacy catch-all
          "ORDER_ACCEPTED",
          "ORDER_REJECTED",
          "ORDER_PREPARING",
          "ORDER_READY",
          "ORDER_PICKED_UP",
          "ORDER_OUT_FOR_DELIVERY",
          "ORDER_DELIVERED",
          "ORDER_CANCELLED",
          "ORDER_FAILED",

          // Voucher/Subscription notifications
          "VOUCHER_EXPIRY_REMINDER",
          "SUBSCRIPTION_CREATED",
          "SUBSCRIPTION_EXPIRING",

          // Auto-order notifications
          "AUTO_ORDER_SUCCESS",
          "AUTO_ORDER_FAILED",

          // Kitchen notifications
          "NEW_AUTO_ORDER",
          "NEW_MANUAL_ORDER",
          "NEW_AUTO_ACCEPTED_ORDER",
          "BATCH_REMINDER",

          // Driver notifications
          "BATCH_READY",
          "BATCH_ASSIGNED",
          "DELIVERY_ASSIGNED",
          "ORDER_READY_FOR_PICKUP",

          // General notifications
          "MENU_UPDATE",
          "PROMOTIONAL",
          "SYSTEM_UPDATE",
          "ADMIN_PUSH",
          "CUSTOM",
        ],
        message: "Invalid notification type",
      },
      index: true,
    },

    title: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
    },

    body: {
      type: String,
      required: true,
      maxlength: 500,
      trim: true,
    },

    // Payload data for deep linking in apps
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Reference to related entity for deep linking
    entityType: {
      type: String,
      enum: ["ORDER", "VOUCHER", "MENU_ITEM", "BATCH", "SUBSCRIPTION", null],
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // Delivery tracking
    deliveryStatus: {
      type: String,
      enum: {
        values: ["PENDING", "SENT", "FAILED", "PARTIAL"],
        message: "Invalid delivery status",
      },
      default: "PENDING",
    },

    // FCM delivery results per device
    deliveryResults: [
      {
        token: String,
        deviceType: {
          type: String,
          enum: ["ANDROID", "IOS", "WEB"],
        },
        success: Boolean,
        fcmMessageId: String,
        errorCode: String,
        errorMessage: String,
        sentAt: Date,
      },
    ],

    // User interaction
    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
    },

    sentAt: {
      type: Date,
    },

    // For voucher expiry tracking (to avoid duplicate notifications)
    expiryNotificationKey: {
      type: String,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ deliveryStatus: 1 });
notificationSchema.index({ expiryNotificationKey: 1 }, { sparse: true });

/**
 * Mark notification as read
 */
notificationSchema.methods.markAsRead = function () {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

/**
 * Find unread notifications for user
 */
notificationSchema.statics.findUnreadByUser = function (userId, limit = 50) {
  return this.find({ userId, isRead: false })
    .sort({ createdAt: -1 })
    .limit(limit);
};

/**
 * Find notifications for user with pagination
 */
notificationSchema.statics.findByUserPaginated = function (
  userId,
  page = 1,
  limit = 20
) {
  const skip = (page - 1) * limit;
  return this.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit);
};

/**
 * Count unread notifications for user
 */
notificationSchema.statics.countUnreadByUser = function (userId) {
  return this.countDocuments({ userId, isRead: false });
};

/**
 * Check if expiry notification was already sent today
 */
notificationSchema.statics.wasExpiryNotificationSentToday = async function (
  userId,
  expiryKey
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const notification = await this.findOne({
    userId,
    type: "VOUCHER_EXPIRY_REMINDER",
    expiryNotificationKey: expiryKey,
    createdAt: { $gte: today },
  });

  return !!notification;
};

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
