/**
 * Create Test Vouchers for Expiry Testing
 * Creates vouchers with different expiry dates to test the expiry system
 *
 * Usage:
 *   node scripts/create-test-vouchers.js <userId> <subscriptionId>
 *
 * Example:
 *   node scripts/create-test-vouchers.js 507f1f77bcf86cd799439011 507f1f77bcf86cd799439012
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import Voucher from "../schema/voucher.schema.js";

// Load environment variables
dotenv.config();

/**
 * Create test vouchers with various expiry dates
 * @param {string} userId - User ID for the vouchers
 * @param {string} subscriptionId - Subscription ID
 */
async function createTestVouchers(userId, subscriptionId) {
  const startTime = Date.now();
  console.log("\n🧪 Creating Test Vouchers for Expiry Testing");
  console.log("=".repeat(60));
  console.log(`User ID: ${userId}`);
  console.log(`Subscription ID: ${subscriptionId}`);
  console.log("=".repeat(60));

  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      const mongoUrl = process.env.MONGODB_URL;
      if (!mongoUrl) {
        throw new Error("MONGODB_URL environment variable not set");
      }
      await mongoose.connect(mongoUrl);
      console.log("\n✅ Connected to MongoDB");
    }

    const now = new Date();

    // Define test voucher scenarios
    const testScenarios = [
      {
        name: "Already Expired (2 days ago)",
        expiryDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        status: "AVAILABLE",
        mealType: "ANY"
      },
      {
        name: "Already Expired (Yesterday)",
        expiryDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        status: "AVAILABLE",
        mealType: "LUNCH"
      },
      {
        name: "Expires Today (End of Day)",
        expiryDate: new Date(new Date().setHours(23, 59, 59, 999)),
        status: "AVAILABLE",
        mealType: "DINNER"
      },
      {
        name: "Expires Tomorrow",
        expiryDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
        status: "AVAILABLE",
        mealType: "ANY"
      },
      {
        name: "Expires in 3 Days",
        expiryDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        status: "AVAILABLE",
        mealType: "LUNCH"
      },
      {
        name: "Expires in 7 Days",
        expiryDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: "AVAILABLE",
        mealType: "DINNER"
      },
      {
        name: "Expires in 14 Days",
        expiryDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        status: "AVAILABLE",
        mealType: "ANY"
      },
      {
        name: "Expires in 30 Days",
        expiryDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: "AVAILABLE",
        mealType: "ANY"
      },
      {
        name: "RESTORED Voucher (Expires Tomorrow)",
        expiryDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
        status: "RESTORED",
        mealType: "ANY"
      },
      {
        name: "RESTORED Voucher (Already Expired)",
        expiryDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        status: "RESTORED",
        mealType: "ANY"
      }
    ];

    console.log(`\n📝 Creating ${testScenarios.length} test vouchers...\n`);

    const createdVouchers = [];

    for (const scenario of testScenarios) {
      // Generate unique voucher code
      let voucherCode;
      let isUnique = false;

      while (!isUnique) {
        voucherCode = Voucher.generateVoucherCode();
        const existing = await Voucher.findOne({ voucherCode });
        if (!existing) isUnique = true;
      }

      // Create voucher
      const voucher = await Voucher.create({
        userId: new mongoose.Types.ObjectId(userId),
        subscriptionId: new mongoose.Types.ObjectId(subscriptionId),
        voucherCode,
        issuedDate: new Date(),
        expiryDate: scenario.expiryDate,
        status: scenario.status,
        mealType: scenario.mealType,
        value: null // Vouchers represent 1 meal redemption
      });

      createdVouchers.push({
        name: scenario.name,
        code: voucherCode,
        expiryDate: scenario.expiryDate,
        status: scenario.status,
        mealType: scenario.mealType,
        _id: voucher._id
      });

      // Calculate days until expiry
      const daysUntilExpiry = Math.ceil(
        (scenario.expiryDate - now) / (1000 * 60 * 60 * 24)
      );

      // Format expiry date
      const expiryStr = scenario.expiryDate.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      // Status indicator
      const statusIcon = daysUntilExpiry < 0 ? "🔴" :
                        daysUntilExpiry === 0 ? "🟡" :
                        daysUntilExpiry <= 3 ? "🟠" : "🟢";

      console.log(`${statusIcon} ${scenario.name}`);
      console.log(`   Code: ${voucherCode}`);
      console.log(`   Expires: ${expiryStr} (${daysUntilExpiry > 0 ? `in ${daysUntilExpiry} days` : `${Math.abs(daysUntilExpiry)} days ago`})`);
      console.log(`   Status: ${scenario.status} | Meal: ${scenario.mealType}`);
      console.log(`   ID: ${voucher._id}`);
      console.log("");
    }

    const duration = Date.now() - startTime;

    console.log("=".repeat(60));
    console.log(`✅ Successfully created ${createdVouchers.length} test vouchers in ${duration}ms`);
    console.log("=".repeat(60));

    // Summary statistics
    const summary = {
      total: createdVouchers.length,
      expired: createdVouchers.filter(v => v.expiryDate < now).length,
      expiringSoon: createdVouchers.filter(v => {
        const days = Math.ceil((v.expiryDate - now) / (1000 * 60 * 60 * 24));
        return days >= 0 && days <= 7;
      }).length,
      valid: createdVouchers.filter(v => v.expiryDate > now).length,
      byStatus: {
        AVAILABLE: createdVouchers.filter(v => v.status === "AVAILABLE").length,
        RESTORED: createdVouchers.filter(v => v.status === "RESTORED").length
      }
    };

    console.log("\n📊 Summary:");
    console.log(`   Total Created: ${summary.total}`);
    console.log(`   Already Expired: ${summary.expired}`);
    console.log(`   Expiring in 7 Days: ${summary.expiringSoon}`);
    console.log(`   Valid (Future): ${summary.valid}`);
    console.log(`   By Status: AVAILABLE=${summary.byStatus.AVAILABLE}, RESTORED=${summary.byStatus.RESTORED}`);

    console.log("\n💡 Next Steps:");
    console.log("   1. Run: node scripts/test-voucher-expiry.js");
    console.log("   2. Or manually test expiry cron: POST /api/vouchers/admin/expire");
    console.log("   3. Check notifications: node scripts/test-voucher-notification.js " + userId);
    console.log("   4. Query MongoDB to verify: db.vouchers.find({ userId: ObjectId('" + userId + "') })");

    return {
      success: true,
      vouchers: createdVouchers,
      summary,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`\n❌ Error creating test vouchers after ${duration}ms`);
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

if (args.length < 2) {
  console.log("\n❌ Error: Missing required arguments");
  console.log("\nUsage:");
  console.log("  node scripts/create-test-vouchers.js <userId> <subscriptionId>");
  console.log("\nExample:");
  console.log("  node scripts/create-test-vouchers.js 507f1f77bcf86cd799439011 507f1f77bcf86cd799439012");
  console.log("\n💡 Tip: Get user ID from: db.users.findOne({ phone: 'YOUR_PHONE' })._id");
  console.log("         Get subscription ID from: db.subscriptions.findOne({ userId: ObjectId('...') })._id");
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
if (process.argv[1].includes("create-test-vouchers.js")) {
  createTestVouchers(userId, subscriptionId)
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

export default { createTestVouchers };
