/**
 * Find User and Subscription IDs for Testing
 * Helper script to get IDs needed for voucher testing
 *
 * Usage:
 *   node scripts/find-user-for-testing.js [phone]
 *
 * Example:
 *   node scripts/find-user-for-testing.js 9876543210
 *   node scripts/find-user-for-testing.js  (shows first 5 users)
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../schema/user.schema.js";
import Subscription from "../schema/subscription.schema.js";

// Load environment variables
dotenv.config();

/**
 * Find user and subscription details for testing
 * @param {string} phone - Optional phone number to search
 */
async function findUserForTesting(phone = null) {
  console.log("\n🔍 Finding User and Subscription IDs");
  console.log("=".repeat(70));

  try {
    // Connect to MongoDB
    if (mongoose.connection.readyState !== 1) {
      const mongoUrl = process.env.MONGODB_URL;
      if (!mongoUrl) {
        throw new Error("MONGODB_URL environment variable not set");
      }
      await mongoose.connect(mongoUrl);
      console.log("✅ Connected to MongoDB\n");
    }

    let users;

    if (phone) {
      // Search by phone number
      console.log(`📱 Searching for user with phone: ${phone}\n`);
      users = await User.find({ phone }).limit(1);

      if (users.length === 0) {
        console.log("❌ No user found with that phone number");
        console.log("💡 Try without phone parameter to see available users");
        return { success: false, message: "User not found" };
      }
    } else {
      // Get first 5 users
      console.log("👥 Showing first 5 users (you can specify phone number):\n");
      users = await User.find({ role: "CUSTOMER" })
        .sort({ createdAt: -1 })
        .limit(5);

      if (users.length === 0) {
        console.log("❌ No users found in database");
        return { success: false, message: "No users found" };
      }
    }

    // Display user information and find subscriptions
    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      console.log(`${i + 1}. User Details:`);
      console.log("-".repeat(70));
      console.log(`   Name: ${user.name || "N/A"}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   Email: ${user.email || "N/A"}`);
      console.log(`   User ID: ${user._id}`);

      // Find subscriptions for this user
      const subscriptions = await Subscription.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(3);

      if (subscriptions.length > 0) {
        console.log(`\n   📦 Subscriptions (${subscriptions.length}):`);
        subscriptions.forEach((sub, idx) => {
          console.log(`      ${idx + 1}. ${sub.planName || "Unnamed Plan"}`);
          console.log(`         ID: ${sub._id}`);
          console.log(`         Status: ${sub.status}`);
          console.log(`         Meals: ${sub.mealsPerWeek} meals/week`);
          console.log(`         Start: ${sub.startDate?.toLocaleDateString() || "N/A"}`);
          console.log(`         End: ${sub.endDate?.toLocaleDateString() || "N/A"}`);
        });

        // Generate command for first subscription
        const firstSub = subscriptions[0];
        console.log(`\n   ✨ Ready-to-use commands:`);
        console.log(`      Create vouchers:`);
        console.log(`      node scripts/create-test-vouchers.js ${user._id} ${firstSub._id}`);
        console.log(`\n      Test expiry:`);
        console.log(`      node scripts/test-voucher-expiry.js ${user._id}`);
      } else {
        console.log(`\n   ⚠️  No subscriptions found for this user`);
        console.log(`   💡 You'll need to create a subscription first, or use a dummy ID`);
        console.log(`\n   Command with dummy subscription ID:`);
        console.log(`      node scripts/create-test-vouchers.js ${user._id} 507f1f77bcf86cd799439012`);
      }

      console.log("");
    }

    console.log("=".repeat(70));
    console.log("✅ User lookup complete\n");

    return {
      success: true,
      users: users.map(u => ({
        id: u._id,
        name: u.name,
        phone: u.phone
      }))
    };
  } catch (error) {
    console.log("\n❌ Error finding user:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const phone = args[0] || null;

// Run if executed directly
if (process.argv[1].includes("find-user-for-testing.js")) {
  findUserForTesting(phone)
    .then(() => {
      process.exit(0);
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

export default { findUserForTesting };
