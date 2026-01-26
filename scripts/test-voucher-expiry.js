/**
 * Test Voucher Expiry System
 * Comprehensive test suite for voucher expiry functionality
 *
 * Usage:
 *   node scripts/test-voucher-expiry.js <userId>
 *
 * Example:
 *   node scripts/test-voucher-expiry.js 507f1f77bcf86cd799439011
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import Voucher from "../schema/voucher.schema.js";
import { checkVoucherExpiryForUser } from "../services/voucher-expiry.service.js";

// Load environment variables
dotenv.config();

/**
 * Run comprehensive voucher expiry tests
 * @param {string} userId - User ID to test
 */
async function runVoucherExpiryTests(userId) {
  const startTime = Date.now();
  console.log("\n🧪 Testing Voucher Expiry System");
  console.log("=".repeat(70));
  console.log(`User ID: ${userId}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log("=".repeat(70));

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      const mongoUrl = process.env.MONGODB_URL;
      if (!mongoUrl) {
        throw new Error("MONGODB_URL environment variable not set");
      }
      await mongoose.connect(mongoUrl);
      console.log("\n✅ Connected to MongoDB\n");
    }

    // TEST 1: Check for expired vouchers with AVAILABLE status
    console.log("📋 Test 1: Detect Expired Vouchers");
    console.log("-".repeat(70));
    const expiredAvailable = await Voucher.find({
      userId: new mongoose.Types.ObjectId(userId),
      expiryDate: { $lt: new Date() },
      status: "AVAILABLE"
    });

    const test1Pass = expiredAvailable.length > 0;
    results.tests.push({
      name: "Detect expired vouchers with AVAILABLE status",
      passed: test1Pass,
      details: `Found ${expiredAvailable.length} expired AVAILABLE vouchers`
    });

    console.log(`   ${test1Pass ? "✅ PASS" : "❌ FAIL"}: Found ${expiredAvailable.length} vouchers that should be expired`);
    if (expiredAvailable.length > 0) {
      expiredAvailable.forEach(v => {
        console.log(`      - ${v.voucherCode} | Expired: ${v.expiryDate.toLocaleDateString()}`);
      });
    }
    console.log("");

    // TEST 2: Run expiry function
    console.log("📋 Test 2: Run Expiry Function");
    console.log("-".repeat(70));
    const expiredCount = await Voucher.expireVouchers();

    const test2Pass = expiredCount > 0;
    results.tests.push({
      name: "Run expireVouchers() function",
      passed: test2Pass,
      details: `Expired ${expiredCount} vouchers`
    });

    console.log(`   ${test2Pass ? "✅ PASS" : "ℹ️  INFO"}: Expired ${expiredCount} vouchers`);
    console.log("");

    // TEST 3: Verify no expired vouchers remain with AVAILABLE status
    console.log("📋 Test 3: Verify Expiry Status Update");
    console.log("-".repeat(70));
    const stillAvailable = await Voucher.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      expiryDate: { $lt: new Date() },
      status: "AVAILABLE"
    });

    const test3Pass = stillAvailable === 0;
    results.tests.push({
      name: "No expired vouchers should have AVAILABLE status",
      passed: test3Pass,
      details: `Found ${stillAvailable} expired vouchers still marked AVAILABLE`
    });

    console.log(`   ${test3Pass ? "✅ PASS" : "❌ FAIL"}: ${stillAvailable} expired vouchers still marked AVAILABLE`);
    console.log("");

    // TEST 4: Check EXPIRED status count
    console.log("📋 Test 4: Count EXPIRED Vouchers");
    console.log("-".repeat(70));
    const expiredStatus = await Voucher.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      status: "EXPIRED"
    });

    const test4Pass = expiredStatus > 0;
    results.tests.push({
      name: "Vouchers should have EXPIRED status",
      passed: test4Pass,
      details: `Found ${expiredStatus} vouchers with EXPIRED status`
    });

    console.log(`   ${test4Pass ? "✅ PASS" : "❌ FAIL"}: ${expiredStatus} vouchers have EXPIRED status`);
    console.log("");

    // TEST 5: Test findAvailableByUser excludes expired
    console.log("📋 Test 5: Available Vouchers Query");
    console.log("-".repeat(70));
    const availableVouchers = await Voucher.findAvailableByUser(
      new mongoose.Types.ObjectId(userId)
    );

    const hasExpiredInAvailable = availableVouchers.some(v => new Date() > v.expiryDate);
    const test5Pass = !hasExpiredInAvailable;
    results.tests.push({
      name: "findAvailableByUser() excludes expired vouchers",
      passed: test5Pass,
      details: `Returned ${availableVouchers.length} vouchers, ${hasExpiredInAvailable ? "includes expired" : "no expired"}`
    });

    console.log(`   ${test5Pass ? "✅ PASS" : "❌ FAIL"}: Available query returned ${availableVouchers.length} vouchers`);
    console.log(`   ${test5Pass ? "✅" : "❌"} No expired vouchers in result`);

    if (availableVouchers.length > 0) {
      console.log(`\n   Valid vouchers:`);
      availableVouchers.forEach(v => {
        const daysUntil = Math.ceil((v.expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        console.log(`      - ${v.voucherCode} | Expires in ${daysUntil} days (${v.expiryDate.toLocaleDateString()})`);
      });
    }
    console.log("");

    // TEST 6: Test canRedeem() method
    console.log("📋 Test 6: canRedeem() Validation");
    console.log("-".repeat(70));
    const expiredVoucher = await Voucher.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      expiryDate: { $lt: new Date() },
      status: { $in: ["AVAILABLE", "RESTORED", "EXPIRED"] }
    });

    let test6Pass = false;
    if (expiredVoucher) {
      const canRedeem = expiredVoucher.canRedeem("LUNCH");
      test6Pass = !canRedeem;
      results.tests.push({
        name: "canRedeem() returns false for expired voucher",
        passed: test6Pass,
        details: `Voucher ${expiredVoucher.voucherCode} canRedeem=${canRedeem}`
      });

      console.log(`   ${test6Pass ? "✅ PASS" : "❌ FAIL"}: Expired voucher canRedeem() = ${canRedeem} (should be false)`);
      console.log(`   Tested with: ${expiredVoucher.voucherCode}`);
    } else {
      results.tests.push({
        name: "canRedeem() validation (skipped)",
        passed: true,
        details: "No expired vouchers found to test"
      });
      console.log(`   ⚠️  SKIP: No expired vouchers found to test`);
    }
    console.log("");

    // TEST 7: Test notification system
    console.log("📋 Test 7: Expiry Notification System");
    console.log("-".repeat(70));
    const notificationResult = await checkVoucherExpiryForUser(userId);

    const test7Pass = notificationResult.notified || notificationResult.reason === "no_expiring_vouchers" || notificationResult.reason === "already_sent_today";
    results.tests.push({
      name: "Notification system runs without errors",
      passed: test7Pass,
      details: `Result: ${notificationResult.notified ? "Notified" : notificationResult.reason}`
    });

    console.log(`   ${test7Pass ? "✅ PASS" : "❌ FAIL"}: Notification system executed`);
    console.log(`   Result: ${notificationResult.notified ? "✅ Notification sent" : `ℹ️  ${notificationResult.reason}`}`);
    if (notificationResult.notified) {
      console.log(`   Vouchers expiring: ${notificationResult.voucherCount}`);
      console.log(`   Days until expiry: ${notificationResult.daysUntilExpiry}`);
    }
    console.log("");

    // TEST 8: Count vouchers by status
    console.log("📋 Test 8: Voucher Status Distribution");
    console.log("-".repeat(70));
    const statusCounts = await Voucher.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const statusMap = {};
    statusCounts.forEach(s => {
      statusMap[s._id] = s.count;
    });

    console.log(`   AVAILABLE: ${statusMap.AVAILABLE || 0}`);
    console.log(`   EXPIRED: ${statusMap.EXPIRED || 0}`);
    console.log(`   RESTORED: ${statusMap.RESTORED || 0}`);
    console.log(`   REDEEMED: ${statusMap.REDEEMED || 0}`);
    console.log(`   CANCELLED: ${statusMap.CANCELLED || 0}`);
    console.log("");

    // TEST 9: Check expiring vouchers (next 7 days)
    console.log("📋 Test 9: Expiring Vouchers Detection");
    console.log("-".repeat(70));
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const expiringVouchers = await Voucher.find({
      userId: new mongoose.Types.ObjectId(userId),
      status: { $in: ["AVAILABLE", "RESTORED"] },
      expiryDate: { $gt: now, $lte: in7Days }
    }).sort({ expiryDate: 1 });

    console.log(`   Found ${expiringVouchers.length} vouchers expiring in next 7 days:`);
    expiringVouchers.forEach(v => {
      const daysUntil = Math.ceil((v.expiryDate - now) / (1000 * 60 * 60 * 24));
      const urgency = daysUntil === 0 ? "🔴 TODAY" :
                     daysUntil === 1 ? "🟠 TOMORROW" :
                     daysUntil <= 3 ? "🟡 SOON" : "🟢";
      console.log(`      ${urgency} - ${v.voucherCode} | ${daysUntil} day(s) (${v.expiryDate.toLocaleDateString()})`);
    });
    console.log("");

    // Calculate results
    results.passed = results.tests.filter(t => t.passed).length;
    results.failed = results.tests.filter(t => !t.passed).length;

    const duration = Date.now() - startTime;

    // Final Summary
    console.log("=".repeat(70));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(70));
    console.log(`   Total Tests: ${results.tests.length}`);
    console.log(`   ✅ Passed: ${results.passed}`);
    console.log(`   ❌ Failed: ${results.failed}`);
    console.log(`   Duration: ${duration}ms`);
    console.log("");

    if (results.failed > 0) {
      console.log("❌ Failed Tests:");
      results.tests.filter(t => !t.passed).forEach(t => {
        console.log(`   - ${t.name}`);
        console.log(`     ${t.details}`);
      });
      console.log("");
    }

    const allPassed = results.failed === 0;
    console.log(`${allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`);
    console.log("=".repeat(70));

    return {
      success: allPassed,
      results,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`\n❌ Test suite failed after ${duration}ms`);
    console.log("Error:", error.message);
    console.log("Stack:", error.stack);

    return {
      success: false,
      error: error.message,
      duration
    };
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
  console.log("\n❌ Error: Missing required argument");
  console.log("\nUsage:");
  console.log("  node scripts/test-voucher-expiry.js <userId>");
  console.log("\nExample:");
  console.log("  node scripts/test-voucher-expiry.js 507f1f77bcf86cd799439011");
  console.log("\n💡 Tip: Use the same userId you used to create test vouchers");
  process.exit(1);
}

const userId = args[0];

// Validate ObjectId format
if (!mongoose.Types.ObjectId.isValid(userId)) {
  console.log("\n❌ Error: Invalid userId format. Must be a valid MongoDB ObjectId");
  process.exit(1);
}

// Run if executed directly
if (process.argv[1].includes("test-voucher-expiry.js")) {
  runVoucherExpiryTests(userId)
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
      // Close MongoDB connection if we opened it
      if (mongoose.connection.readyState === 1) {
        mongoose.connection.close();
      }
    });
}

export default { runVoucherExpiryTests };
