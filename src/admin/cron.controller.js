/**
 * Admin Cron Controller
 * Manual triggers and status checks for scheduled tasks
 */

import { sendResponse } from "../../utils/response.utils.js";
import { runVoucherExpiryCron } from "../../scripts/voucher-expiry-cron.js";

/**
 * Manually trigger voucher expiry cron
 * @route POST /api/admin/cron/voucher-expiry
 * @access Admin
 */
export async function triggerVoucherExpiry(req, res) {
  try {
    console.log("> Manual trigger: Voucher expiry cron");

    const result = await runVoucherExpiryCron();

    if (result.success) {
      return sendResponse(res, 200, true, "Voucher expiry cron completed", {
        duration: result.duration,
        stats: result.stats
      });
    } else {
      return sendResponse(res, 500, false, "Voucher expiry cron failed", {
        error: result.error,
        duration: result.duration
      });
    }
  } catch (error) {
    console.log("> Trigger voucher expiry error:", error);
    return sendResponse(res, 500, false, "Failed to trigger voucher expiry", {
      error: error.message
    });
  }
}

/**
 * Get cron job status
 * @route GET /api/admin/cron/status
 * @access Admin
 */
export async function getCronStatus(req, res) {
  try {
    // In a real implementation, you'd store cron job state
    // For now, we'll return a basic status
    const status = {
      voucherExpiry: {
        schedule: "Daily at 8:00 AM IST (2:30 AM UTC)",
        cronExpression: "30 2 * * *",
        timezone: "UTC",
        status: "scheduled",
        description: "Expires vouchers and sends notifications",
        lastRun: null, // Would be fetched from logs/database
        nextRun: getNextCronRun("30 2 * * *")
      }
    };

    return sendResponse(res, 200, true, "Cron job status", { jobs: status });
  } catch (error) {
    console.log("> Get cron status error:", error);
    return sendResponse(res, 500, false, "Failed to get cron status");
  }
}

/**
 * Calculate next cron run time
 * @param {string} cronExpression - Cron expression
 * @returns {Date|null} Next run time
 */
function getNextCronRun(cronExpression) {
  try {
    // Simple calculation for "30 2 * * *" (2:30 AM UTC daily)
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(2, 30, 0, 0);

    // If today's run time has passed, schedule for tomorrow
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }

    return next;
  } catch (error) {
    return null;
  }
}

/**
 * Get cron execution history
 * @route GET /api/admin/cron/history
 * @access Admin
 */
export async function getCronHistory(req, res) {
  try {
    // In production, you'd fetch this from logs or a tracking collection
    // For now, return a placeholder
    const history = {
      message: "Cron execution history would be fetched from logs",
      note: "Check application logs for detailed execution history"
    };

    return sendResponse(res, 200, true, "Cron execution history", history);
  } catch (error) {
    console.log("> Get cron history error:", error);
    return sendResponse(res, 500, false, "Failed to get cron history");
  }
}

export default {
  triggerVoucherExpiry,
  getCronStatus,
  getCronHistory
};
