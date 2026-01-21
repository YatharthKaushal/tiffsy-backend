import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import models
import User from "../schema/user.schema.js";
import Kitchen from "../schema/kitchen.schema.js";

const assignKitchen = async () => {
  try {
    // Connect to database
    if (!process.env.MONGODB_URL) {
      console.log("> Missing MongoDB connection string");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URL);
    console.log("> MongoDB Connected");

    // Find the test user
    const testPhone = "+919800000001";
    console.log(`\n> Looking for user with phone: ${testPhone}`);

    const user = await User.findOne({ phone: testPhone });

    if (!user) {
      console.log(`  ❌ User not found with phone ${testPhone}`);
      console.log("  Please check if the user exists in the database");
      process.exit(1);
    }

    console.log(`  ✅ Found user: ${user.name} (${user.role})`);

    // Find an active kitchen
    console.log("\n> Looking for an active kitchen...");
    const kitchen = await Kitchen.findOne({ status: "ACTIVE" });

    if (!kitchen) {
      console.log("  ❌ No active kitchen found");
      console.log("  Please run: npm run seed");
      process.exit(1);
    }

    console.log(`  ✅ Found kitchen: ${kitchen.name} (${kitchen.code})`);

    // Assign kitchen to user
    console.log("\n> Assigning kitchen to user...");
    user.kitchenId = kitchen._id;
    user.role = "KITCHEN_STAFF"; // Ensure role is set
    user.status = "ACTIVE"; // Ensure status is active
    await user.save();

    console.log("  ✅ Kitchen assigned successfully!");
    console.log("\n========================================");
    console.log("USER DETAILS:");
    console.log("========================================");
    console.log(`Name: ${user.name}`);
    console.log(`Phone: ${user.phone}`);
    console.log(`Role: ${user.role}`);
    console.log(`Status: ${user.status}`);
    console.log(`Kitchen ID: ${user.kitchenId}`);
    console.log("\n========================================");
    console.log("KITCHEN DETAILS:");
    console.log("========================================");
    console.log(`Name: ${kitchen.name}`);
    console.log(`Code: ${kitchen.code}`);
    console.log(`Type: ${kitchen.type}`);
    console.log(`Status: ${kitchen.status}`);
    console.log("========================================\n");
    console.log("✅ User is now ready to login as kitchen staff!");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
};

assignKitchen();
