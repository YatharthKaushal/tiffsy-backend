import Notification from "../../schema/notification.schema.js";
import { sendResponse } from "../../utils/response.utils.js";

/**
 * Get user's notifications with pagination
 * @route GET /api/notifications
 * @access Customer, Driver, Kitchen Staff, Admin
 */
export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const query = { userId };
    if (unreadOnly === "true") {
      query.isRead = false;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    return sendResponse(res, 200, true, "Notifications retrieved", {
      notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.log("> Get notifications error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve notifications");
  }
};

/**
 * Get latest unread notification (for popup on app open)
 * @route GET /api/notifications/latest-unread
 * @access Customer, Driver, Kitchen Staff, Admin
 */
export const getLatestUnread = async (req, res) => {
  try {
    const userId = req.user._id;

    const notification = await Notification.findOne({
      userId,
      isRead: false,
    })
      .sort({ createdAt: -1 })
      .lean();

    return sendResponse(res, 200, true, "Latest notification", {
      notification,
    });
  } catch (error) {
    console.log("> Get latest notification error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve notification");
  }
};

/**
 * Get unread notification count
 * @route GET /api/notifications/unread-count
 * @access Customer, Driver, Kitchen Staff, Admin
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const count = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    return sendResponse(res, 200, true, "Unread count", {
      count,
    });
  } catch (error) {
    console.log("> Get unread count error:", error);
    return sendResponse(res, 500, false, "Failed to get count");
  }
};

/**
 * Mark notification as read
 * @route PATCH /api/notifications/:id/read
 * @access Customer, Driver, Kitchen Staff, Admin
 */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOne({
      _id: id,
      userId,
    });

    if (!notification) {
      return sendResponse(res, 404, false, "Notification not found");
    }

    if (!notification.isRead) {
      await notification.markAsRead();
    }

    return sendResponse(res, 200, true, "Notification marked as read");
  } catch (error) {
    console.log("> Mark as read error:", error);
    return sendResponse(res, 500, false, "Failed to mark as read");
  }
};

/**
 * Mark all notifications as read
 * @route POST /api/notifications/mark-all-read
 * @access Customer, Driver, Kitchen Staff, Admin
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return sendResponse(res, 200, true, "All notifications marked as read", {
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.log("> Mark all as read error:", error);
    return sendResponse(res, 500, false, "Failed to mark all as read");
  }
};

/**
 * Delete a notification
 * @route DELETE /api/notifications/:id
 * @access Customer, Driver, Kitchen Staff, Admin
 */
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const result = await Notification.deleteOne({
      _id: id,
      userId,
    });

    if (result.deletedCount === 0) {
      return sendResponse(res, 404, false, "Notification not found");
    }

    return sendResponse(res, 200, true, "Notification deleted");
  } catch (error) {
    console.log("> Delete notification error:", error);
    return sendResponse(res, 500, false, "Failed to delete notification");
  }
};

export default {
  getMyNotifications,
  getLatestUnread,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
