import { firebaseAdmin } from "../config/firebase.config.js";
import User from "../schema/user.schema.js";
import Notification from "../schema/notification.schema.js";

/**
 * Notification Service
 * Handles FCM push notifications with non-blocking delivery
 *
 * Key features:
 * - Non-blocking: All send operations are fire-and-forget
 * - Platform-specific: Different payloads for Android/iOS/Web
 * - Automatic cleanup: Invalid tokens are removed automatically
 * - Delivery logging: All notifications are logged for history
 * - React Native compatible: Uses @react-native-firebase/messaging structure
 */

/**
 * Notification Channel Mapping for React Native Android
 * Maps notification types to Android notification channels
 * Channels must be created on the client side first
 */
const NOTIFICATION_CHANNELS = {
  // Order related notifications - high priority (for customers)
  ORDER_ACCEPTED: "orders_channel",
  ORDER_REJECTED: "orders_channel",
  ORDER_PREPARING: "orders_channel",
  ORDER_READY: "orders_channel",
  ORDER_PICKED_UP: "orders_channel",
  ORDER_OUT_FOR_DELIVERY: "orders_channel",
  ORDER_DELIVERED: "orders_channel",
  ORDER_CANCELLED: "orders_channel",
  ORDER_FAILED: "orders_channel",
  AUTO_ORDER_SUCCESS: "orders_channel",
  AUTO_ORDER_FAILED: "subscriptions_channel",

  // Kitchen notifications - high priority (for kitchen staff)
  NEW_MANUAL_ORDER: "kitchen_channel",
  NEW_AUTO_ORDER: "kitchen_channel",
  NEW_AUTO_ACCEPTED_ORDER: "kitchen_channel",
  BATCH_REMINDER: "kitchen_channel",

  // Subscription/Voucher related
  VOUCHER_EXPIRY_REMINDER: "subscriptions_channel",
  SUBSCRIPTION_CREATED: "subscriptions_channel",
  SUBSCRIPTION_EXPIRING: "subscriptions_channel",

  // Delivery/Batch related - for drivers
  BATCH_READY: "delivery_channel",
  BATCH_ASSIGNED: "delivery_channel",
  DELIVERY_ASSIGNED: "delivery_channel",

  // General/Promotional
  MENU_UPDATE: "general_channel",
  PROMOTIONAL: "general_channel",
  SYSTEM_UPDATE: "general_channel",
  ADMIN_PUSH: "general_channel",
  CUSTOM: "general_channel",
};

/**
 * Get the appropriate notification channel for a notification type
 * @param {string} type - Notification type
 * @returns {string} Channel ID
 */
function getChannelId(type) {
  return NOTIFICATION_CHANNELS[type] || "default_channel";
}

/**
 * Determine notification priority based on channel
 * @param {string} channelId - Notification channel ID
 * @returns {string} "high" or "default"
 */
function getNotificationPriority(channelId) {
  const highPriorityChannels = ["orders_channel", "delivery_channel", "subscriptions_channel", "kitchen_channel"];
  return highPriorityChannels.includes(channelId) ? "high" : "default";
}

/**
 * Platform-specific payload builders for React Native
 * Optimized for @react-native-firebase/messaging
 */
const buildPayload = {
  /**
   * Android payload for React Native
   * Uses notification + data message with channelId at android level
   */
  ANDROID: (title, body, data, type) => {
    const channelId = getChannelId(type);
    const priority = getNotificationPriority(channelId);

    return {
      notification: {
        title,
        body,
      },
      data: {
        ...Object.fromEntries(
          Object.entries(data || {}).map(([k, v]) => [k, String(v)])
        ),
        type: type || "GENERAL",
        channelId, // Included in data for client-side use
      },
      android: {
        priority,
        ttl: 86400 * 1000, // 24 hours in ms
        notification: {
          channelId, // channelId goes inside notification object
          sound: "default",
          priority: priority === "high" ? "high" : "default",
        },
      },
    };
  },

  /**
   * iOS payload for React Native
   * Uses notification + data message with APNs configuration
   */
  IOS: (title, body, data, type) => ({
    notification: {
      title,
      body,
    },
    data: {
      ...Object.fromEntries(
        Object.entries(data || {}).map(([k, v]) => [k, String(v)])
      ),
      type: type || "GENERAL",
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: 1,
          "content-available": 1,
        },
      },
    },
  }),

  /**
   * Web payload (for Admin Portal if needed)
   */
  WEB: (title, body, data, type) => ({
    notification: {
      title,
      body,
    },
    data: {
      ...Object.fromEntries(
        Object.entries(data || {}).map(([k, v]) => [k, String(v)])
      ),
      type: type || "GENERAL",
    },
    webpush: {
      fcmOptions: {
        link: data?.webLink || "/",
      },
    },
  }),
};

/**
 * Error codes that indicate the FCM token is invalid and should be removed
 */
const INVALID_TOKEN_ERRORS = [
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
  "messaging/invalid-argument",
];

/**
 * Check if error indicates token should be removed
 * @param {Error} error - FCM error object
 * @returns {boolean}
 */
function isInvalidTokenError(error) {
  return INVALID_TOKEN_ERRORS.includes(error.code);
}

/**
 * Send FCM notification to a single token
 * @param {string} token - FCM device token
 * @param {string} deviceType - ANDROID, IOS, or WEB
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Optional payload data for deep linking
 * @param {string} type - Notification type for channel mapping
 * @returns {Promise<{success: boolean, messageId?: string, error?: string, shouldRemoveToken?: boolean}>}
 */
async function sendToToken(token, deviceType, title, body, data = {}, type = "GENERAL") {
  try {
    const payloadBuilder = buildPayload[deviceType] || buildPayload.ANDROID;
    const message = {
      token,
      ...payloadBuilder(title, body, data, type),
    };

    const response = await firebaseAdmin.messaging().send(message);

    console.log("> FCM sent successfully:", { messageId: response, deviceType, type, channelId: getChannelId(type) });

    return { success: true, messageId: response };
  } catch (error) {
    console.log("> FCM send failed:", {
      errorCode: error.code,
      errorMessage: error.message,
      deviceType,
      type,
    });

    return {
      success: false,
      error: error.code || error.message,
      shouldRemoveToken: isInvalidTokenError(error),
    };
  }
}

/**
 * Remove invalid FCM tokens from user document
 * @param {ObjectId} userId - User ID
 * @param {string[]} tokens - Array of tokens to remove
 */
async function removeInvalidTokens(userId, tokens) {
  try {
    await User.findByIdAndUpdate(userId, {
      $pull: { fcmTokens: { token: { $in: tokens } } },
    });
    console.log("> Removed invalid FCM tokens:", { userId, count: tokens.length });
  } catch (error) {
    console.log("> Failed to remove invalid tokens:", { userId, error: error.message });
  }
}

/**
 * Internal async implementation for sending to user
 * This is where the actual work happens
 */
async function _sendToUserAsync(userId, type, title, body, options = {}) {
  const { data = {}, entityType, entityId, saveToDb = true, expiryNotificationKey } = options;

  try {
    // Get user's FCM tokens
    const user = await User.findById(userId).select("fcmTokens").lean();

    if (!user?.fcmTokens?.length) {
      console.log("> No FCM tokens for user:", { userId });
      return { sent: false, reason: "no_tokens" };
    }

    // Create notification record if saving to DB
    let notification = null;
    if (saveToDb) {
      notification = new Notification({
        userId,
        type,
        title,
        body,
        data,
        entityType: entityType || null,
        entityId: entityId || null,
        deliveryStatus: "PENDING",
        expiryNotificationKey: expiryNotificationKey || null,
      });
      await notification.save();
    }

    // Send to all tokens in parallel
    const results = await Promise.all(
      user.fcmTokens.map(async (tokenInfo) => {
        const result = await sendToToken(
          tokenInfo.token,
          tokenInfo.deviceType,
          title,
          body,
          data,
          type // Pass notification type for channel mapping
        );

        return {
          token: tokenInfo.token,
          deviceType: tokenInfo.deviceType,
          success: result.success,
          fcmMessageId: result.messageId || null,
          errorCode: result.error || null,
          sentAt: new Date(),
          shouldRemove: result.shouldRemoveToken || false,
        };
      })
    );

    // Update notification record with delivery results
    if (notification) {
      notification.deliveryResults = results.map((r) => ({
        token: r.token,
        deviceType: r.deviceType,
        success: r.success,
        fcmMessageId: r.fcmMessageId,
        errorCode: r.errorCode,
        sentAt: r.sentAt,
      }));
      notification.sentAt = new Date();
      notification.deliveryStatus = results.every((r) => r.success)
        ? "SENT"
        : results.some((r) => r.success)
          ? "PARTIAL"
          : "FAILED";
      await notification.save();
    }

    // Remove invalid tokens (non-blocking)
    const tokensToRemove = results
      .filter((r) => r.shouldRemove)
      .map((r) => r.token);

    if (tokensToRemove.length > 0) {
      removeInvalidTokens(userId, tokensToRemove).catch(() => {});
    }

    const successCount = results.filter((r) => r.success).length;
    console.log("> Notification sent:", {
      userId,
      type,
      successCount,
      totalTokens: results.length,
    });

    return { sent: true, successCount, totalTokens: results.length };
  } catch (error) {
    console.log("> Failed to send notification:", {
      userId,
      type,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Send notification to a user (all their devices)
 * Non-blocking pattern - fire and forget with logging
 *
 * @param {ObjectId|string} userId - User ID
 * @param {string} type - Notification type (from schema enum)
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} options - Additional options
 * @param {Object} options.data - Payload data for deep linking
 * @param {string} options.entityType - Related entity type (ORDER, VOUCHER, etc.)
 * @param {ObjectId} options.entityId - Related entity ID
 * @param {boolean} options.saveToDb - Whether to save to notification history (default: true)
 * @param {string} options.expiryNotificationKey - Key to prevent duplicate expiry notifications
 */
export function sendToUser(userId, type, title, body, options = {}) {
  // Fire and forget - don't await, catch errors internally
  _sendToUserAsync(userId, type, title, body, options).catch((err) => {
    console.log("> FCM sendToUser error:", { userId, type, error: err.message });
  });
}

/**
 * Send notification to multiple users
 * Processes in parallel but doesn't block
 *
 * @param {Array<ObjectId|string>} userIds - Array of user IDs
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} options - Additional options (same as sendToUser)
 */
export function sendToUsers(userIds, type, title, body, options = {}) {
  // Fire and forget for each user - sendToUser handles errors internally
  for (const userId of userIds) {
    sendToUser(userId, type, title, body, options);
  }
}

/**
 * Send notification to all users of a specific role
 * Useful for broadcast to all drivers, all kitchen staff, etc.
 *
 * @param {string} role - User role (CUSTOMER, DRIVER, KITCHEN_STAFF, ADMIN)
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} options - Additional options
 * @param {ObjectId} options.kitchenId - Filter by kitchen (for KITCHEN_STAFF)
 */
export async function sendToRole(role, type, title, body, options = {}) {
  const { kitchenId, ...restOptions } = options;

  try {
    // Build query for finding users
    const query = {
      role,
      status: "ACTIVE",
      "fcmTokens.0": { $exists: true }, // Has at least one FCM token
    };

    // Add kitchen filter for kitchen staff
    if (kitchenId) {
      query.kitchenId = kitchenId;
    }

    // For drivers, only send to approved ones
    if (role === "DRIVER") {
      query.approvalStatus = "APPROVED";
    }

    const users = await User.find(query).select("_id").lean();
    const userIds = users.map((u) => u._id);

    console.log("> Sending to role:", { role, userCount: userIds.length, type, kitchenId });

    if (userIds.length > 0) {
      sendToUsers(userIds, type, title, body, restOptions);
    }

    return { queued: userIds.length };
  } catch (error) {
    console.log("> FCM sendToRole error:", { role, error: error.message });
    return { queued: 0, error: error.message };
  }
}

/**
 * Send notification to users by their IDs (with await support for counting)
 * Use this when you need to know how many users will receive the notification
 *
 * @param {Array<ObjectId|string>} userIds - Array of user IDs
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} options - Additional options
 * @returns {Promise<{queued: number}>}
 */
export async function sendToUserIds(userIds, type, title, body, options = {}) {
  if (!userIds || userIds.length === 0) {
    return { queued: 0 };
  }

  // Fire notifications (non-blocking)
  sendToUsers(userIds, type, title, body, options);

  return { queued: userIds.length };
}

export default {
  sendToUser,
  sendToUsers,
  sendToRole,
  sendToUserIds,
};
