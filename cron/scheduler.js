/**
 * Cron Job Scheduler
 * Manages all scheduled tasks for the application
 *
 * Uses node-cron for scheduling background jobs
 */

import cron from "node-cron";
import { runVoucherExpiryCron } from "../scripts/voucher-expiry-cron.js";
import { createLogger } from "../utils/logger.utils.js";

const log = createLogger("CronScheduler");

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs() {
  log.info("initializeCronJobs", "Initializing scheduled tasks");

  // Voucher Expiry - Daily at 8:00 AM IST (2:30 AM UTC)
  // Cron format: minute hour day month dayOfWeek
  // 30 2 * * * = 2:30 AM UTC = 8:00 AM IST
  const voucherExpiryCron = cron.schedule("30 2 * * *", async () => {
    log.info("voucherExpiryCron", "Starting voucher expiry cron job");

    try {
      const result = await runVoucherExpiryCron();

      if (result.success) {
        log.info("voucherExpiryCron", "Completed successfully", {
          duration: result.duration,
          stats: result.stats
        });
      } else {
        log.error("voucherExpiryCron", "Failed to complete", {
          error: result.error,
          duration: result.duration
        });
      }
    } catch (error) {
      log.error("voucherExpiryCron", "Unexpected error", {
        error: error.message,
        stack: error.stack
      });
    }
  }, {
    scheduled: true,
    timezone: "UTC" // We handle IST offset in the cron time
  });

  // Voucher Expiry Notifications - Daily at 8:00 AM IST (same time as expiry)
  const voucherNotificationCron = cron.schedule("30 2 * * *", async () => {
    log.info("voucherNotificationCron", "Voucher notification already handled by expiry cron");
    // The expiry cron script already includes notification processing
  }, {
    scheduled: true,
    timezone: "UTC"
  });

  log.info("initializeCronJobs", "Cron jobs initialized", {
    jobs: [
      { name: "voucherExpiry", schedule: "30 2 * * *", timezone: "UTC", description: "8:00 AM IST daily" },
    ]
  });

  return {
    voucherExpiryCron,
    voucherNotificationCron
  };
}

/**
 * Stop all cron jobs (for graceful shutdown)
 * @param {Object} jobs - Cron jobs object returned from initializeCronJobs
 */
export function stopCronJobs(jobs) {
  log.info("stopCronJobs", "Stopping all cron jobs");

  if (jobs) {
    Object.keys(jobs).forEach(jobName => {
      if (jobs[jobName] && typeof jobs[jobName].stop === "function") {
        jobs[jobName].stop();
        log.info("stopCronJobs", `Stopped ${jobName}`);
      }
    });
  }

  log.info("stopCronJobs", "All cron jobs stopped");
}

/**
 * Get cron job status
 * @param {Object} jobs - Cron jobs object
 */
export function getCronJobStatus(jobs) {
  const status = {};

  if (jobs) {
    Object.keys(jobs).forEach(jobName => {
      status[jobName] = {
        running: jobs[jobName] ? true : false,
        scheduled: jobs[jobName] ? true : false
      };
    });
  }

  return status;
}

export default {
  initializeCronJobs,
  stopCronJobs,
  getCronJobStatus
};
