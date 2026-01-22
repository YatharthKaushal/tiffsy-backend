import mongoose from "mongoose";
import Voucher from "../schema/voucher.schema.js";
import Notification from "../schema/notification.schema.js";
import { sendToUser } from "./notification.service.js";
import { getVoucherExpiryNotification } from "./notification-templates.service.js";

/**
 * Voucher Expiry Service
 * Handles checking and sending notifications for expiring vouchers
 *
 * Two modes:
 * 1. Event-driven: Called on user login to check their expiring vouchers
 * 2. Cron-based: Daily batch check for all users with expiring vouchers
 */

/**
 * Calculate days until a date
 * @param {Date} date - Target date
 * @returns {number} Days until date (0 = today, negative = past)
 */
function daysUntil(date) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

/**
 * Generate a unique key for expiry notification to prevent duplicates
 * Format: userId_expiryDate_daysUntil
 * @param {ObjectId} userId - User ID
 * @param {Date} expiryDate - Earliest expiry date
 * @param {number} daysUntilExpiry - Days until expiry
 * @returns {string} Unique key
 */
function generateExpiryKey(userId, expiryDate, daysUntilExpiry) {
  const dateStr = new Date(expiryDate).toISOString().split("T")[0];
  // Group notifications: today, 1 day, 3 days, 7 days
  let bucket = "7d";
  if (daysUntilExpiry <= 0) bucket = "today";
  else if (daysUntilExpiry <= 1) bucket = "1d";
  else if (daysUntilExpiry <= 3) bucket = "3d";

  return `${userId}_${dateStr}_${bucket}`;
}

/**
 * Check and send voucher expiry notification for a single user
 * Called on user login (event-driven approach)
 *
 * @param {ObjectId|string} userId - User ID
 * @returns {Promise<{notified: boolean, reason?: string}>}
 */
export async function checkVoucherExpiryForUser(userId) {
  try {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Find vouchers expiring in next 7 days
    const expiringVouchers = await Voucher.find({
      userId: new mongoose.Types.ObjectId(userId),
      status: { $in: ["AVAILABLE", "RESTORED"] },
      expiryDate: { $gt: now, $lte: in7Days },
    })
      .sort({ expiryDate: 1 })
      .lean();

    if (expiringVouchers.length === 0) {
      return { notified: false, reason: "no_expiring_vouchers" };
    }

    // Get earliest expiry date
    const earliestExpiry = expiringVouchers[0].expiryDate;
    const daysUntilExpiry = daysUntil(earliestExpiry);

    // Generate key to prevent duplicate notifications
    const expiryKey = generateExpiryKey(userId, earliestExpiry, daysUntilExpiry);

    // Check if we already sent this notification today
    const alreadySent = await Notification.wasExpiryNotificationSentToday(
      userId,
      expiryKey
    );

    if (alreadySent) {
      return { notified: false, reason: "already_sent_today" };
    }

    // Build and send notification
    const notification = getVoucherExpiryNotification(
      daysUntilExpiry,
      expiringVouchers.length,
      earliestExpiry
    );

    if (!notification) {
      return { notified: false, reason: "no_template_match" };
    }

    // Send notification with expiry key to track duplicates
    sendToUser(userId, "VOUCHER_EXPIRY_REMINDER", notification.title, notification.body, {
      data: {
        voucherCount: expiringVouchers.length.toString(),
        daysUntilExpiry: daysUntilExpiry.toString(),
        expiryDate: earliestExpiry.toISOString(),
      },
      entityType: "VOUCHER",
      expiryNotificationKey: expiryKey,
    });

    console.log("> Voucher expiry notification sent:", {
      userId,
      voucherCount: expiringVouchers.length,
      daysUntilExpiry,
    });

    return { notified: true, voucherCount: expiringVouchers.length, daysUntilExpiry };
  } catch (error) {
    console.log("> Voucher expiry check error:", { userId, error: error.message });
    return { notified: false, reason: "error", error: error.message };
  }
}

/**
 * Get all users with vouchers expiring in the next N days
 * Used by cron job for batch processing
 *
 * @param {number} days - Days threshold (default: 7)
 * @returns {Promise<Array<ObjectId>>} Array of unique user IDs
 */
export async function getUsersWithExpiringVouchers(days = 7) {
  const now = new Date();
  const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const userIds = await Voucher.distinct("userId", {
    status: { $in: ["AVAILABLE", "RESTORED"] },
    expiryDate: { $gt: now, $lte: threshold },
  });

  return userIds;
}

/**
 * Process batch voucher expiry notifications
 * Called by cron job at 8 AM IST daily
 *
 * @param {Object} options - Processing options
 * @param {number} options.batchSize - Users per batch (default: 50)
 * @param {number} options.delayBetweenBatches - Delay in ms between batches (default: 1000)
 * @returns {Promise<{processed: number, notified: number, errors: number}>}
 */
export async function processBatchVoucherExpiryNotifications(options = {}) {
  const { batchSize = 50, delayBetweenBatches = 1000 } = options;

  const userIds = await getUsersWithExpiringVouchers(7);

  console.log(`> Voucher expiry cron: Found ${userIds.length} users with expiring vouchers`);

  let processed = 0;
  let notified = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async (userId) => {
        try {
          const result = await checkVoucherExpiryForUser(userId);
          return result;
        } catch (error) {
          console.log("> Batch voucher check error:", { userId, error: error.message });
          return { notified: false, reason: "error" };
        }
      })
    );

    processed += batch.length;
    notified += results.filter((r) => r.notified).length;
    errors += results.filter((r) => r.reason === "error").length;

    // Add delay between batches to avoid FCM rate limits
    if (i + batchSize < userIds.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
    }
  }

  console.log(`> Voucher expiry cron completed:`, { processed, notified, errors });

  return { processed, notified, errors };
}

export default {
  checkVoucherExpiryForUser,
  getUsersWithExpiringVouchers,
  processBatchVoucherExpiryNotifications,
};
