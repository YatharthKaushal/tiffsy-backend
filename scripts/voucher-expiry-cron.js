/**
 * Voucher Expiry Cron Script
 * Run daily at 8 AM IST to send voucher expiry reminders
 *
 * Usage:
 *   node scripts/voucher-expiry-cron.js
 *
 * Schedule with cron (8 AM IST = 2:30 AM UTC):
 *   30 2 * * * cd /path/to/tiffsy-backend && node scripts/voucher-expiry-cron.js >> logs/voucher-expiry.log 2>&1
 *
 * Or use node-cron in your application:
 *   import cron from "node-cron";
 *   import { runVoucherExpiryCron } from "./scripts/voucher-expiry-cron.js";
 *   cron.schedule("30 2 * * *", runVoucherExpiryCron); // 8 AM IST
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { processBatchVoucherExpiryNotifications } from "../services/voucher-expiry.service.js";

// Load environment variables
dotenv.config();

/**
 * Run the voucher expiry cron job
 * @returns {Promise<{success: boolean, stats?: Object, error?: string}>}
 */
export async function runVoucherExpiryCron() {
  const startTime = Date.now();
  console.log(`> [${new Date().toISOString()}] Voucher expiry cron started`);

  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      const mongoUrl = process.env.MONGODB_URL;
      if (!mongoUrl) {
        throw new Error("MONGODB_URL environment variable not set");
      }
      await mongoose.connect(mongoUrl);
      console.log("> Connected to MongoDB");
    }

    // Process voucher expiry notifications
    const stats = await processBatchVoucherExpiryNotifications({
      batchSize: 50,
      delayBetweenBatches: 1000,
    });

    const duration = Date.now() - startTime;
    console.log(`> [${new Date().toISOString()}] Voucher expiry cron completed in ${duration}ms`);
    console.log(`> Stats: ${stats.processed} processed, ${stats.notified} notified, ${stats.errors} errors`);

    return { success: true, stats, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`> [${new Date().toISOString()}] Voucher expiry cron failed after ${duration}ms`);
    console.log("> Error:", error.message);

    return { success: false, error: error.message, duration };
  }
}

// Run if executed directly
if (process.argv[1].includes("voucher-expiry-cron.js")) {
  runVoucherExpiryCron()
    .then((result) => {
      if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.log("> Unhandled error:", error);
      process.exit(1);
    })
    .finally(() => {
      // Close MongoDB connection if we opened it
      if (mongoose.connection.readyState === 1) {
        mongoose.connection.close();
      }
    });
}

export default { runVoucherExpiryCron };
