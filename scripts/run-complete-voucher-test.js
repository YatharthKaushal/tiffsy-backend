/**
 * Complete Voucher Expiry Test Suite
 * Runs the full test workflow: create vouchers → test expiry → verify results
 *
 * Usage:
 *   node scripts/run-complete-voucher-test.js <userId> <subscriptionId>
 *
 * Example:
 *   node scripts/run-complete-voucher-test.js 507f1f77bcf86cd799439011 507f1f77bcf86cd799439012
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { createTestVouchers } from "./create-test-vouchers.js";
import { runVoucherExpiryTests } from "./test-voucher-expiry.js";
import Voucher from "../schema/voucher.schema.js";

// Load environment variables
dotenv.config();

/**
 * Run complete voucher test workflow
 */
async function runCompleteTest(userId, subscriptionId) {
  const overallStartTime = Date.now();

  console.log("\n" + "=".repeat(70));
  console.log("🧪 COMPLETE VOUCHER EXPIRY TEST SUITE");
  console.log("=".repeat(70));
  console.log(`User ID: ${userId}`);
  console.log(`Subscription ID: ${subscriptionId}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log("=".repeat(70));

  try {
    // Connect to MongoDB
    if (mongoose.connection.readyState !== 1) {
      const mongoUrl = process.env.MONGODB_URL;
      if (!mongoUrl) {
        throw new Error("MONGODB_URL environment variable not set");
      }
      await mongoose.connect(mongoUrl);
      console.log("\n✅ Connected to MongoDB");
    }

    // PHASE 1: Check existing vouchers
    console.log("\n" + "=".repeat(70));
    console.log("PHASE 1: Pre-Test Check");
    console.log("=".repeat(70));

    const existingVouchers = await Voucher.find({
      userId: new mongoose.Types.ObjectId(userId)
    });

    console.log(`\n📊 Found ${existingVouchers.length} existing vouchers for this user`);

    if (existingVouchers.length > 0) {
      console.log("⚠️  Warning: User already has vouchers. Test will use existing + new vouchers.");
      console.log("\n💡 Tip: To start fresh, delete existing vouchers first:");
      console.log(`   db.vouchers.deleteMany({ userId: ObjectId("${userId}") })`);

      const response = await new Promise((resolve) => {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });

        readline.question('\nContinue anyway? (y/n): ', (answer) => {
          readline.close();
          resolve(answer.toLowerCase());
        });
      });

      if (response !== 'y') {
        console.log("\n❌ Test cancelled by user");
        return { success: false, message: "Cancelled by user" };
      }
    }

    // PHASE 2: Create test vouchers
    console.log("\n" + "=".repeat(70));
    console.log("PHASE 2: Creating Test Vouchers");
    console.log("=".repeat(70));

    const createResult = await createTestVouchers(userId, subscriptionId);

    if (!createResult.success) {
      throw new Error(`Failed to create test vouchers: ${createResult.error}`);
    }

    console.log(`\n✅ Created ${createResult.vouchers.length} test vouchers`);

    // Small delay to ensure vouchers are fully indexed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // PHASE 3: Run expiry tests
    console.log("\n" + "=".repeat(70));
    console.log("PHASE 3: Running Expiry Tests");
    console.log("=".repeat(70));

    const testResult = await runVoucherExpiryTests(userId);

    if (!testResult.success) {
      throw new Error(`Tests failed: ${testResult.error || "Some tests failed"}`);
    }

    // PHASE 4: Summary
    console.log("\n" + "=".repeat(70));
    console.log("PHASE 4: Final Summary");
    console.log("=".repeat(70));

    // Get final voucher counts
    const finalCounts = await Voucher.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const statusMap = {};
    finalCounts.forEach(s => {
      statusMap[s._id] = s.count;
    });

    console.log("\n📊 Final Voucher Status:");
    console.log(`   AVAILABLE: ${statusMap.AVAILABLE || 0}`);
    console.log(`   EXPIRED: ${statusMap.EXPIRED || 0}`);
    console.log(`   RESTORED: ${statusMap.RESTORED || 0}`);
    console.log(`   REDEEMED: ${statusMap.REDEEMED || 0}`);
    console.log(`   CANCELLED: ${statusMap.CANCELLED || 0}`);
    console.log(`   Total: ${Object.values(statusMap).reduce((a, b) => a + b, 0)}`);

    const overallDuration = Date.now() - overallStartTime;

    console.log("\n" + "=".repeat(70));
    console.log("✅ COMPLETE TEST SUITE PASSED");
    console.log("=".repeat(70));
    console.log(`Total Duration: ${overallDuration}ms (${(overallDuration / 1000).toFixed(1)}s)`);
    console.log(`Test Results: ${testResult.results.passed}/${testResult.results.tests.length} passed`);
    console.log(`Vouchers Created: ${createResult.vouchers.length}`);
    console.log("=".repeat(70));

    console.log("\n💡 Next Steps:");
    console.log("   1. Check customer app - user should see expiry notifications");
    console.log("   2. Try placing order with voucher");
    console.log("   3. Verify expired vouchers cannot be used");
    console.log("   4. Schedule daily cron job for production");

    console.log("\n🧹 Clean up test data:");
    console.log(`   db.vouchers.deleteMany({ userId: ObjectId("${userId}") })`);

    return {
      success: true,
      duration: overallDuration,
      vouchersCreated: createResult.vouchers.length,
      testResults: testResult.results
    };
  } catch (error) {
    const duration = Date.now() - overallStartTime;
    console.log("\n" + "=".repeat(70));
    console.log("❌ TEST SUITE FAILED");
    console.log("=".repeat(70));
    console.log(`Duration: ${duration}ms`);
    console.log(`Error: ${error.message}`);
    console.log("=".repeat(70));

    return {
      success: false,
      error: error.message,
      duration
    };
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log("\n❌ Error: Missing required arguments");
  console.log("\nUsage:");
  console.log("  node scripts/run-complete-voucher-test.js <userId> <subscriptionId>");
  console.log("\nExample:");
  console.log("  node scripts/run-complete-voucher-test.js 507f1f77bcf86cd799439011 507f1f77bcf86cd799439012");
  console.log("\n💡 Tip: First run this to find IDs:");
  console.log("  node scripts/find-user-for-testing.js [phone]");
  process.exit(1);
}

const userId = args[0];
const subscriptionId = args[1];

// Validate ObjectId format
if (!mongoose.Types.ObjectId.isValid(userId)) {
  console.log("\n❌ Error: Invalid userId format. Must be a valid MongoDB ObjectId");
  process.exit(1);
}

if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
  console.log("\n❌ Error: Invalid subscriptionId format. Must be a valid MongoDB ObjectId");
  process.exit(1);
}

// Run if executed directly
if (process.argv[1].includes("run-complete-voucher-test.js")) {
  runCompleteTest(userId, subscriptionId)
    .then((result) => {
      if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.log("\n💥 Unhandled error:", error);
      process.exit(1);
    })
    .finally(() => {
      // Close MongoDB connection
      if (mongoose.connection.readyState === 1) {
        mongoose.connection.close();
      }
    });
}

export default { runCompleteTest };
