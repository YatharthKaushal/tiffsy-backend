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
 */

/**
 * Platform-specific payload builders
 * Android uses data-only messages for more control
 * iOS uses notification messages for proper display
 * Web uses standard notification messages
 */
const buildPayload = {
  ANDROID: (title, body, data) => ({
    data: {
      title,
      body,
      ...Object.fromEntries(
        Object.entries(data || {}).map(([k, v]) => [k, String(v)])
      ),
      click_action: "FLUTTER_NOTIFICATION_CLICK",
    },
    android: {
      priority: "high",
      ttl: 86400 * 1000, // 24 hours in ms
    },
  }),

  IOS: (title, body, data) => ({
    notification: {
      title,
      body,
    },
    data: Object.fromEntries(
      Object.entries(data || {}).map(([k, v]) => [k, String(v)])
    ),
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

  WEB: (title, body, data) => ({
    notification: {
      title,
      body,
    },
    data: Object.fromEntries(
      Object.entries(data || {}).map(([k, v]) => [k, String(v)])
    ),
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
 * @returns {Promise<{success: boolean, messageId?: string, error?: string, shouldRemoveToken?: boolean}>}
 */
async function sendToToken(token, deviceType, title, body, data = {}) {
  try {
    const payloadBuilder = buildPayload[deviceType] || buildPayload.ANDROID;
    const message = {
      token,
      ...payloadBuilder(title, body, data),
    };

    const response = await firebaseAdmin.messaging().send(message);

    console.log("> FCM sent successfully:", { messageId: response, deviceType });

    return { success: true, messageId: response };
  } catch (error) {
    console.log("> FCM send failed:", {
      errorCode: error.code,
      errorMessage: error.message,
      deviceType,
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
          data
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
