import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import models
import User from "../schema/user.schema.js";
import Zone from "../schema/zone.schema.js";
import Kitchen from "../schema/kitchen.schema.js";
import MenuItem from "../schema/menuItem.schema.js";
import Addon from "../schema/addon.schema.js";
import SubscriptionPlan from "../schema/subscriptionPlan.schema.js";

const seed = async () => {
  try {
    // Connect to database
    if (!process.env.MONGODB_URL) {
      console.log("> Missing MongoDB connection string");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URL);
    console.log("> MongoDB Connected");

    // ===
    // 1. Create Admin User
    // ===
    console.log("\n> Creating Admin User...");

    const existingAdmin = await User.findOne({ username: "admin" });
    let admin;

    if (existingAdmin) {
      console.log("  Admin user already exists, skipping...");
      admin = existingAdmin;
    } else {
      const passwordHash = await bcrypt.hash("admin123", 10);

      admin = await User.create({
        phone: "9999999999",
        role: "ADMIN",
        name: "Super Admin",
        email: "admin@tiffsy.com",
        username: "admin",
        passwordHash,
        status: "ACTIVE",
      });
      console.log("  Admin created successfully");
      console.log("  Username: admin");
      console.log("  Password: admin123");
    }

    // ===
    // 2. Create Zone
    // ===
    console.log("\n> Creating Zone...");

    const existingZone = await Zone.findOne({ pincode: "110001" });
    let zone;

    if (existingZone) {
      console.log("  Zone already exists, skipping...");
      zone = existingZone;
    } else {
      zone = await Zone.create({
        pincode: "110001",
        name: "Connaught Place",
        city: "New Delhi",
        state: "Delhi",
        status: "ACTIVE",
        orderingEnabled: true,
        timezone: "Asia/Kolkata",
        createdBy: admin._id,
      });
      console.log("  Zone created: Connaught Place (110001)");
    }

    // ===
    // 3. Create Kitchen
    // ===
    console.log("\n> Creating Kitchen...");

    const existingKitchen = await Kitchen.findOne({ code: "KIT-TIFSY" });
    let kitchen;

    if (existingKitchen) {
      console.log("  Kitchen already exists, skipping...");
      kitchen = existingKitchen;
    } else {
      kitchen = await Kitchen.create({
        name: "Tiffsy Central Kitchen",
        code: "KIT-TIFSY",
        type: "TIFFSY",
        authorizedFlag: true,
        premiumFlag: true,
        gourmetFlag: false,
        logo: "https://placeholder.com/logo.png",
        coverImage: "https://placeholder.com/cover.png",
        description: "Authentic home-style tiffin meals prepared fresh daily",
        cuisineTypes: ["North Indian", "South Indian", "Punjabi"],
        address: {
          addressLine1: "Shop No. 12, Ground Floor",
          addressLine2: "Connaught Place Market",
          locality: "Connaught Place",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110001",
          coordinates: {
            latitude: 28.6315,
            longitude: 77.2167,
          },
        },
        zonesServed: [zone._id],
        operatingHours: {
          lunch: {
            startTime: "11:00",
            endTime: "14:00",
          },
          dinner: {
            startTime: "19:00",
            endTime: "22:00",
          },
          onDemand: {
            startTime: "10:00",
            endTime: "22:00",
            isAlwaysOpen: false,
          },
        },
        contactPhone: "9876543210",
        contactEmail: "kitchen@tiffsy.com",
        status: "ACTIVE",
        isAcceptingOrders: true,
        averageRating: 4.5,
        totalRatings: 150,
        createdBy: admin._id,
        approvedBy: admin._id,
        approvedAt: new Date(),
      });
      console.log("  Kitchen created: Tiffsy Central Kitchen");
    }

    // ===
    // 4. Create Addons
    // ===
    console.log("\n> Creating Addons...");

    const addonsData = [
      {
        kitchenId: kitchen._id,
        name: "Raita",
        description: "Fresh yogurt with cucumber and mild spices",
        price: 30,
        dietaryType: "VEG",
        isAvailable: true,
        status: "ACTIVE",
        displayOrder: 1,
        createdBy: admin._id,
      },
      {
        kitchenId: kitchen._id,
        name: "Papad (2 pcs)",
        description: "Crispy roasted papad",
        price: 20,
        dietaryType: "VEG",
        isAvailable: true,
        status: "ACTIVE",
        displayOrder: 2,
        createdBy: admin._id,
      },
      {
        kitchenId: kitchen._id,
        name: "Sweet Lassi",
        description: "Thick creamy yogurt drink",
        price: 40,
        dietaryType: "VEG",
        isAvailable: true,
        status: "ACTIVE",
        displayOrder: 3,
        createdBy: admin._id,
      },
      {
        kitchenId: kitchen._id,
        name: "Extra Roti (2 pcs)",
        description: "Fresh whole wheat rotis",
        price: 25,
        dietaryType: "VEG",
        isAvailable: true,
        status: "ACTIVE",
        displayOrder: 4,
        createdBy: admin._id,
      },
      {
        kitchenId: kitchen._id,
        name: "Pickle",
        description: "Homemade mixed pickle",
        price: 15,
        dietaryType: "VEG",
        isAvailable: true,
        status: "ACTIVE",
        displayOrder: 5,
        createdBy: admin._id,
      },
    ];

    const existingAddons = await Addon.find({ kitchenId: kitchen._id });
    let addons = [];

    if (existingAddons.length > 0) {
      console.log("  Addons already exist, skipping...");
      addons = existingAddons;
    } else {
      addons = await Addon.insertMany(addonsData);
      console.log(`  Created ${addons.length} addons`);
    }

    const addonIds = addons.map((a) => a._id);

    // ===
    // 5. Create Menu Items
    // ===
    console.log("\n> Creating Menu Items...");

    // Check for existing menu items
    const existingMenuItems = await MenuItem.find({
      kitchenId: kitchen._id,
      menuType: "MEAL_MENU",
    });

    if (existingMenuItems.length > 0) {
      console.log("  Menu items already exist, skipping...");
    } else {
      // Lunch Thali - Meal Menu
      const lunchThali = await MenuItem.create({
        kitchenId: kitchen._id,
        name: "Lunch Special Thali",
        description:
          "Complete lunch thali with 2 sabzis, dal, rice, 4 rotis, salad, and sweet",
        category: "MAIN_COURSE",
        menuType: "MEAL_MENU",
        mealWindow: "LUNCH",
        price: 150,
        discountedPrice: null,
        portionSize: "Full Thali (serves 1)",
        preparationTime: 30,
        dietaryType: "VEG",
        isJainFriendly: false,
        spiceLevel: "MEDIUM",
        images: ["https://placeholder.com/lunch-thali.jpg"],
        thumbnailImage: "https://placeholder.com/lunch-thali-thumb.jpg",
        addonIds: addonIds,
        includes: [
          "2 Seasonal Sabzis",
          "Dal Tadka",
          "Jeera Rice",
          "4 Rotis",
          "Green Salad",
          "Gulab Jamun",
        ],
        isAvailable: true,
        availableFrom: "11:00",
        availableTill: "14:00",
        status: "ACTIVE",
        displayOrder: 1,
        isFeatured: true,
        createdBy: admin._id,
      });
      console.log("  Created: Lunch Special Thali (MEAL_MENU - LUNCH)");

      // Dinner Thali - Meal Menu
      const dinnerThali = await MenuItem.create({
        kitchenId: kitchen._id,
        name: "Dinner Deluxe Thali",
        description:
          "Premium dinner thali with paneer sabzi, dal makhani, rice, 4 rotis, raita, and dessert",
        category: "MAIN_COURSE",
        menuType: "MEAL_MENU",
        mealWindow: "DINNER",
        price: 180,
        discountedPrice: null,
        portionSize: "Full Thali (serves 1)",
        preparationTime: 35,
        dietaryType: "VEG",
        isJainFriendly: false,
        spiceLevel: "MEDIUM",
        images: ["https://placeholder.com/dinner-thali.jpg"],
        thumbnailImage: "https://placeholder.com/dinner-thali-thumb.jpg",
        addonIds: addonIds,
        includes: [
          "Paneer Butter Masala",
          "Seasonal Sabzi",
          "Dal Makhani",
          "Jeera Rice",
          "4 Rotis",
          "Raita",
          "Kheer",
        ],
        isAvailable: true,
        availableFrom: "19:00",
        availableTill: "22:00",
        status: "ACTIVE",
        displayOrder: 2,
        isFeatured: true,
        createdBy: admin._id,
      });
      console.log("  Created: Dinner Deluxe Thali (MEAL_MENU - DINNER)");

      // On-Demand Menu Items
      const onDemandItems = [
        {
          kitchenId: kitchen._id,
          name: "Paneer Tikka",
          description: "Grilled cottage cheese marinated in spices",
          category: "MAIN_COURSE",
          menuType: "ON_DEMAND_MENU",
          price: 180,
          portionSize: "6 pieces",
          preparationTime: 20,
          dietaryType: "VEG",
          spiceLevel: "MEDIUM",
          addonIds: [],
          isAvailable: true,
          status: "ACTIVE",
          displayOrder: 1,
          createdBy: admin._id,
        },
        {
          kitchenId: kitchen._id,
          name: "Veg Biryani",
          description: "Aromatic basmati rice with mixed vegetables",
          category: "MAIN_COURSE",
          menuType: "ON_DEMAND_MENU",
          price: 160,
          portionSize: "Full plate",
          preparationTime: 25,
          dietaryType: "VEG",
          spiceLevel: "MEDIUM",
          addonIds: addonIds.slice(0, 2),
          isAvailable: true,
          status: "ACTIVE",
          displayOrder: 2,
          createdBy: admin._id,
        },
        {
          kitchenId: kitchen._id,
          name: "Dal Tadka with Rice",
          description: "Yellow dal tempered with spices, served with rice",
          category: "MAIN_COURSE",
          menuType: "ON_DEMAND_MENU",
          price: 120,
          portionSize: "Regular",
          preparationTime: 15,
          dietaryType: "VEG",
          isJainFriendly: true,
          spiceLevel: "MILD",
          addonIds: addonIds.slice(2, 4),
          isAvailable: true,
          status: "ACTIVE",
          displayOrder: 3,
          createdBy: admin._id,
        },
      ];

      await MenuItem.insertMany(onDemandItems);
      console.log("  Created 3 On-Demand Menu items");
    }

    // ===
    // 6. Create 7-Day Subscription Plan
    // ===
    console.log("\n> Creating 7-Day Subscription Plan...");

    const existingPlan = await SubscriptionPlan.findOne({
      durationDays: 7,
      status: "ACTIVE",
    });

    if (existingPlan) {
      console.log("  7-Day plan already exists, skipping...");
    } else {
      const plan = await SubscriptionPlan.create({
        name: "Weekly Meal Plan",
        description:
          "7-day meal subscription with 14 vouchers. Use any voucher for lunch or dinner - no restrictions!",
        durationDays: 7,
        vouchersPerDay: 2,
        voucherValidityDays: 90,
        price: 999,
        originalPrice: 1200,
        coverageRules: {
          includesAddons: false,
          addonValuePerVoucher: 0,
          mealTypes: ["BOTH"], // Voucher can be used for BOTH lunch and dinner
        },
        applicableZoneIds: [zone._id],
        displayOrder: 1,
        badge: "POPULAR",
        features: [
          "14 meal vouchers (2 per day)",
          "Use for lunch OR dinner - your choice!",
          "Valid for 90 days",
          "No meal type restrictions",
          "Cancel anytime",
        ],
        status: "ACTIVE",
        validFrom: new Date(),
        createdBy: admin._id,
      });

      console.log("  Created: Weekly Meal Plan");
      console.log(`    - Duration: 7 days`);
      console.log(`    - Total Vouchers: ${plan.totalVouchers}`);
      console.log(
        `    - Price: ₹${plan.price} (Original: ₹${plan.originalPrice})`,
      );
      console.log(
        `    - Voucher can be used for: LUNCH or DINNER (no restrictions)`,
      );
    }

    // ===
    // Summary
    // ===
    console.log("\n===");
    console.log("SEED COMPLETED SUCCESSFULLY!");
    console.log("===");
    console.log("\nAdmin Login Credentials:");
    console.log("  Username: admin");
    console.log("  Password: admin123");
    console.log("  Phone: 9999999999");
    console.log("\nCreated Data:");
    console.log("  - 1 Admin User");
    console.log("  - 1 Zone (Connaught Place - 110001)");
    console.log("  - 1 Kitchen (Tiffsy Central Kitchen)");
    console.log("  - 5 Addons");
    console.log("  - 2 Meal Menu Items (Lunch + Dinner Thali)");
    console.log("  - 3 On-Demand Menu Items");
    console.log("  - 1 Subscription Plan (7 days, 14 vouchers)");
    console.log("\n");

    await mongoose.disconnect();
    console.log("> MongoDB Disconnected");
    process.exit(0);
  } catch (error) {
    console.error("\n> Seed Error:", error.message);
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seed();
