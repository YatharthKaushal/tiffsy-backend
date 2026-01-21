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
import CustomerAddress from "../schema/customerAddress.schema.js";
import Order from "../schema/order.schema.js";
import DeliveryBatch from "../schema/deliveryBatch.schema.js";

/**
 * Comprehensive seed for testing Driver App
 * Uses EXISTING driver account and creates test data:
 * - Kitchen with staff
 * - Multiple customers with addresses
 * - Orders in ALL possible states
 * - Delivery batches in various states
 */

// EXISTING DRIVER ACCOUNT TO USE FOR TESTING
const EXISTING_DRIVER_ID = "6964ddeb598dd8980a844e61";
const EXISTING_DRIVER_PHONE = "9522455243";
const EXISTING_DRIVER_NAME = "Vaishnavi Sharma";

const seedDriverTest = async () => {
  try {
    // Connect to database
    if (!process.env.MONGODB_URL) {
      console.log("> Missing MongoDB connection string");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URL);
    console.log("> MongoDB Connected\n");

    // ===
    // 1. CREATE ZONE (if not exists)
    // ===
    console.log("=== CREATING ZONE ===");

    let zone = await Zone.findOne({ pincode: "110001" });
    if (!zone) {
      zone = await Zone.create({
        pincode: "110001",
        name: "Connaught Place",
        city: "New Delhi",
        state: "Delhi",
        status: "ACTIVE",
        orderingEnabled: true,
        timezone: "Asia/Kolkata",
      });
      console.log("  Created zone: Connaught Place (110001)");
    } else {
      console.log("  Zone exists: Connaught Place (110001)");
    }

    // ===
    // 2. CREATE ADMIN (if not exists)
    // ===
    console.log("\n=== CREATING ADMIN ===");

    let admin = await User.findOne({ username: "admin" });
    if (!admin) {
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
      console.log("  Created admin: admin / admin123");
    } else {
      console.log("  Admin exists");
    }

    // ===
    // 3. CREATE KITCHEN & KITCHEN STAFF
    // ===
    console.log("\n=== CREATING KITCHEN ===");

    let kitchen = await Kitchen.findOne({ code: "KIT-TEST" });
    if (!kitchen) {
      kitchen = await Kitchen.create({
        name: "Test Kitchen Central",
        code: "KIT-TEST",
        type: "TIFFSY",
        authorizedFlag: true,
        premiumFlag: true,
        description: "Test kitchen for driver app testing",
        cuisineTypes: ["North Indian", "South Indian"],
        address: {
          addressLine1: "Shop 1, Test Market",
          locality: "Connaught Place",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110001",
          coordinates: { latitude: 28.6315, longitude: 77.2167 },
        },
        zonesServed: [zone._id],
        operatingHours: {
          lunch: { startTime: "11:00", endTime: "14:00" },
          dinner: { startTime: "19:00", endTime: "22:00" },
        },
        contactPhone: "9876543210",
        status: "ACTIVE",
        isAcceptingOrders: true,
        createdBy: admin._id,
        approvedBy: admin._id,
        approvedAt: new Date(),
      });
      console.log("  Created kitchen: Test Kitchen Central");
    } else {
      console.log("  Kitchen exists: Test Kitchen Central");
    }

    // Create Kitchen Staff
    let kitchenStaff = await User.findOne({ phone: "9800000001" });
    if (!kitchenStaff) {
      kitchenStaff = await User.create({
        phone: "9800000001",
        role: "KITCHEN_STAFF",
        name: "Kitchen Manager",
        email: "kitchen@tiffsy.com",
        kitchenId: kitchen._id,
        status: "ACTIVE",
      });
      console.log("  Created kitchen staff: 9800000001");
    } else {
      console.log("  Kitchen staff exists");
    }

    // ===
    // 4. USE EXISTING DRIVER
    // ===
    console.log("\n=== USING EXISTING DRIVER ===");

    const driver = await User.findById(EXISTING_DRIVER_ID);
    if (!driver) {
      console.error(`  ERROR: Driver not found with ID: ${EXISTING_DRIVER_ID}`);
      console.error(`  Please verify the driver exists in the database.`);
      process.exit(1);
    }
    console.log(`  Using driver: ${driver.phone} (${driver.name})`);
    console.log(
      `  Status: ${driver.status}, Approval: ${driver.approvalStatus}`,
    );

    // ===
    // 5. CREATE MENU ITEMS & ADDONS
    // ===
    console.log("\n=== CREATING MENU ITEMS ===");

    // Addons
    let addons = await Addon.find({ kitchenId: kitchen._id });
    if (addons.length === 0) {
      addons = await Addon.insertMany([
        {
          kitchenId: kitchen._id,
          name: "Raita",
          price: 30,
          dietaryType: "VEG",
          isAvailable: true,
          status: "ACTIVE",
        },
        {
          kitchenId: kitchen._id,
          name: "Papad",
          price: 20,
          dietaryType: "VEG",
          isAvailable: true,
          status: "ACTIVE",
        },
        {
          kitchenId: kitchen._id,
          name: "Sweet Lassi",
          price: 40,
          dietaryType: "VEG",
          isAvailable: true,
          status: "ACTIVE",
        },
      ]);
      console.log("  Created 3 addons");
    } else {
      console.log("  Addons exist: " + addons.length);
    }

    // Menu Items
    let lunchThali = await MenuItem.findOne({
      kitchenId: kitchen._id,
      mealWindow: "LUNCH",
      menuType: "MEAL_MENU",
    });
    if (!lunchThali) {
      lunchThali = await MenuItem.create({
        kitchenId: kitchen._id,
        name: "Lunch Special Thali",
        description: "Complete lunch thali",
        category: "MAIN_COURSE",
        menuType: "MEAL_MENU",
        mealWindow: "LUNCH",
        price: 150,
        dietaryType: "VEG",
        addonIds: addons.map((a) => a._id),
        isAvailable: true,
        status: "ACTIVE",
        createdBy: admin._id,
      });
      console.log("  Created: Lunch Special Thali");
    }

    let dinnerThali = await MenuItem.findOne({
      kitchenId: kitchen._id,
      mealWindow: "DINNER",
      menuType: "MEAL_MENU",
    });
    if (!dinnerThali) {
      dinnerThali = await MenuItem.create({
        kitchenId: kitchen._id,
        name: "Dinner Deluxe Thali",
        description: "Premium dinner thali",
        category: "MAIN_COURSE",
        menuType: "MEAL_MENU",
        mealWindow: "DINNER",
        price: 180,
        dietaryType: "VEG",
        addonIds: addons.map((a) => a._id),
        isAvailable: true,
        status: "ACTIVE",
        createdBy: admin._id,
      });
      console.log("  Created: Dinner Deluxe Thali");
    }

    // ===
    // 6. CREATE CUSTOMERS WITH ADDRESSES
    // ===
    console.log("\n=== CREATING CUSTOMERS ===");

    const customers = [];
    const addresses = [];

    for (let i = 1; i <= 10; i++) {
      const phone = `98000001${i.toString().padStart(2, "0")}`;
      let customer = await User.findOne({ phone });

      if (!customer) {
        customer = await User.create({
          phone,
          role: "CUSTOMER",
          name: `Test Customer ${i}`,
          email: `customer${i}@test.com`,
          status: "ACTIVE",
          dietaryPreferences: ["VEG"],
        });
        console.log(`  Created customer: ${phone} (Test Customer ${i})`);
      }
      customers.push(customer);

      // Create address for customer
      let address = await CustomerAddress.findOne({ userId: customer._id });
      if (!address) {
        address = await CustomerAddress.create({
          userId: customer._id,
          label: "Home",
          addressLine1: `House ${i}, Street ${i}`,
          addressLine2: "Near Test Landmark",
          locality: "Connaught Place",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110001",
          zoneId: zone._id,
          isServiceable: true,
          contactName: `Test Customer ${i}`,
          contactPhone: phone,
          coordinates: {
            latitude: 28.6315 + i * 0.001,
            longitude: 77.2167 + i * 0.001,
          },
        });
      }
      addresses.push(address);
    }
    console.log(`  Total customers: ${customers.length}`);

    // ===
    // 7. DELETE EXISTING TEST ORDERS (fresh start)
    // ===
    console.log("\n=== CLEANING UP OLD TEST ORDERS ===");

    const deletedOrders = await Order.deleteMany({
      orderNumber: { $regex: /^ORD-TEST-/ },
    });
    console.log(`  Deleted ${deletedOrders.deletedCount} old test orders`);

    const deletedBatches = await DeliveryBatch.deleteMany({
      batchNumber: { $regex: /^BATCH-TEST-/ },
    });
    console.log(`  Deleted ${deletedBatches.deletedCount} old test batches`);

    // ===
    // 8. CREATE ORDERS IN ALL STATES
    // ===
    console.log("\n=== CREATING ORDERS IN ALL STATES ===");

    const orderStates = [
      {
        status: "PLACED",
        count: 3,
        description: "New orders waiting for kitchen",
      },
      {
        status: "ACCEPTED",
        count: 2,
        description: "Accepted, not yet preparing",
      },
      {
        status: "PREPARING",
        count: 3,
        description: "Being prepared in kitchen",
      },
      { status: "READY", count: 4, description: "Ready for driver pickup" },
      {
        status: "PICKED_UP",
        count: 2,
        description: "Picked up by driver",
        needsDriver: true,
      },
      {
        status: "OUT_FOR_DELIVERY",
        count: 3,
        description: "Driver on the way",
        needsDriver: true,
      },
      {
        status: "DELIVERED",
        count: 2,
        description: "Successfully delivered",
        needsDriver: true,
      },
      { status: "CANCELLED", count: 1, description: "Cancelled by customer" },
      { status: "REJECTED", count: 1, description: "Rejected by kitchen" },
      {
        status: "FAILED",
        count: 1,
        description: "Delivery failed",
        needsDriver: true,
      },
    ];

    const createdOrders = [];
    let customerIndex = 0;
    let orderCounter = 1;

    for (const stateConfig of orderStates) {
      console.log(
        `\n  Creating ${stateConfig.count} orders with status: ${stateConfig.status}`,
      );
      console.log(`    (${stateConfig.description})`);

      for (let i = 0; i < stateConfig.count; i++) {
        const customer = customers[customerIndex % customers.length];
        const address = addresses[customerIndex % addresses.length];
        customerIndex++;

        const menuItem = orderCounter % 2 === 0 ? dinnerThali : lunchThali;
        const mealWindow = menuItem.mealWindow;

        const order = new Order({
          orderNumber: `ORD-TEST-${stateConfig.status}-${orderCounter.toString().padStart(3, "0")}`,
          userId: customer._id,
          kitchenId: kitchen._id,
          zoneId: zone._id,
          deliveryAddressId: address._id,
          deliveryAddress: {
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2,
            locality: address.locality,
            city: address.city,
            pincode: address.pincode,
            contactName: address.contactName,
            contactPhone: address.contactPhone,
            coordinates: address.coordinates,
          },
          menuType: "MEAL_MENU",
          mealWindow,
          items: [
            {
              menuItemId: menuItem._id,
              name: menuItem.name,
              quantity: 1,
              unitPrice: menuItem.price,
              totalPrice: menuItem.price,
              isMainCourse: true,
              addons:
                i % 2 === 0
                  ? [
                      {
                        addonId: addons[0]._id,
                        name: addons[0].name,
                        quantity: 1,
                        unitPrice: addons[0].price,
                        totalPrice: addons[0].price,
                      },
                    ]
                  : [],
            },
          ],
          subtotal: menuItem.price + (i % 2 === 0 ? addons[0].price : 0),
          charges: {
            deliveryFee: 30,
            serviceFee: 5,
            packagingFee: 10,
            taxAmount: 10,
          },
          grandTotal: menuItem.price + (i % 2 === 0 ? addons[0].price : 0) + 55,
          voucherUsage: {
            voucherIds: [],
            voucherCount: 0,
            mainCoursesCovered: 0,
          },
          amountPaid: menuItem.price + (i % 2 === 0 ? addons[0].price : 0) + 55,
          paymentStatus: "PAID",
          paymentMethod: "UPI",
          status: "PLACED", // Will be updated below
          statusTimeline: [
            {
              status: "PLACED",
              timestamp: new Date(Date.now() - 3600000),
              updatedBy: customer._id,
            },
          ],
          placedAt: new Date(Date.now() - 3600000),
        });

        // Build status timeline and assign driver if needed
        const now = new Date();
        const timeline = [
          {
            status: "PLACED",
            timestamp: new Date(now - 3600000),
            updatedBy: customer._id,
          },
        ];

        if (
          [
            "ACCEPTED",
            "PREPARING",
            "READY",
            "PICKED_UP",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "FAILED",
          ].includes(stateConfig.status)
        ) {
          timeline.push({
            status: "ACCEPTED",
            timestamp: new Date(now - 3000000),
            updatedBy: kitchenStaff._id,
          });
          order.acceptedAt = new Date(now - 3000000);
        }

        if (
          [
            "PREPARING",
            "READY",
            "PICKED_UP",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "FAILED",
          ].includes(stateConfig.status)
        ) {
          timeline.push({
            status: "PREPARING",
            timestamp: new Date(now - 2400000),
            updatedBy: kitchenStaff._id,
          });
          order.preparingAt = new Date(now - 2400000);
        }

        if (
          [
            "READY",
            "PICKED_UP",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "FAILED",
          ].includes(stateConfig.status)
        ) {
          timeline.push({
            status: "READY",
            timestamp: new Date(now - 1800000),
            updatedBy: kitchenStaff._id,
          });
          order.preparedAt = new Date(now - 1800000);
        }

        if (
          ["PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"].includes(
            stateConfig.status,
          )
        ) {
          order.driverId = driver._id;
          timeline.push({
            status: "PICKED_UP",
            timestamp: new Date(now - 1200000),
            updatedBy: driver._id,
          });
          order.pickedUpAt = new Date(now - 1200000);
        }

        if (
          ["OUT_FOR_DELIVERY", "DELIVERED", "FAILED"].includes(
            stateConfig.status,
          )
        ) {
          timeline.push({
            status: "OUT_FOR_DELIVERY",
            timestamp: new Date(now - 600000),
            updatedBy: driver._id,
          });
          order.outForDeliveryAt = new Date(now - 600000);
        }

        if (stateConfig.status === "DELIVERED") {
          timeline.push({
            status: "DELIVERED",
            timestamp: new Date(now - 300000),
            updatedBy: driver._id,
          });
          order.deliveredAt = new Date(now - 300000);
          order.proofOfDelivery = {
            type: "OTP",
            value: "1234",
            verifiedAt: new Date(now - 300000),
          };
        }

        if (stateConfig.status === "FAILED") {
          timeline.push({
            status: "FAILED",
            timestamp: new Date(now - 300000),
            updatedBy: driver._id,
            notes: "Customer not available",
          });
        }

        if (stateConfig.status === "CANCELLED") {
          timeline.push({
            status: "CANCELLED",
            timestamp: new Date(now - 1800000),
            updatedBy: customer._id,
          });
          order.cancelledAt = new Date(now - 1800000);
          order.cancellationReason = "Customer requested cancellation";
          order.cancelledBy = "CUSTOMER";
        }

        if (stateConfig.status === "REJECTED") {
          timeline.push({
            status: "REJECTED",
            timestamp: new Date(now - 3000000),
            updatedBy: kitchenStaff._id,
          });
          order.rejectedAt = new Date(now - 3000000);
          order.rejectionReason = "Items not available";
        }

        order.status = stateConfig.status;
        order.statusTimeline = timeline;

        await order.save();
        createdOrders.push(order);
        console.log(`    Created: ${order.orderNumber} (${customer.name})`);
        orderCounter++;
      }
    }

    // ===
    // 9. CREATE DELIVERY BATCHES
    // ===
    console.log("\n=== CREATING DELIVERY BATCHES ===");

    // Get READY orders for batching
    const readyOrders = createdOrders.filter((o) => o.status === "READY");
    const outForDeliveryOrders = createdOrders.filter(
      (o) => o.status === "OUT_FOR_DELIVERY",
    );
    const deliveredOrders = createdOrders.filter(
      (o) => o.status === "DELIVERED",
    );

    // Batch 1: READY_FOR_DISPATCH (waiting for driver to accept)
    if (readyOrders.length >= 2) {
      const batch1Orders = readyOrders.slice(0, 2);
      const batch1 = await DeliveryBatch.create({
        batchNumber: "BATCH-TEST-READY-001",
        kitchenId: kitchen._id,
        zoneId: zone._id,
        menuType: "MEAL_MENU",
        mealWindow: "LUNCH",
        batchDate: new Date(),
        orderIds: batch1Orders.map((o) => o._id),
        status: "READY_FOR_DISPATCH",
        windowEndTime: new Date(Date.now() + 3600000),
        creationType: "AUTO",
        maxBatchSize: 15,
        createdBy: admin._id,
      });
      console.log(
        `  Created batch: ${batch1.batchNumber} (READY_FOR_DISPATCH) - ${batch1Orders.length} orders`,
      );

      // Update orders with batchId
      await Order.updateMany(
        { _id: { $in: batch1Orders.map((o) => o._id) } },
        { batchId: batch1._id },
      );
    }

    // Batch 2: IN_PROGRESS (driver is delivering)
    if (outForDeliveryOrders.length >= 2) {
      const batch2Orders = outForDeliveryOrders.slice(0, 2);
      const batch2 = await DeliveryBatch.create({
        batchNumber: "BATCH-TEST-PROGRESS-001",
        kitchenId: kitchen._id,
        zoneId: zone._id,
        menuType: "MEAL_MENU",
        mealWindow: "LUNCH",
        batchDate: new Date(),
        orderIds: batch2Orders.map((o) => o._id),
        driverId: driver._id,
        driverAssignedAt: new Date(Date.now() - 1200000),
        status: "IN_PROGRESS",
        windowEndTime: new Date(Date.now() - 1800000),
        dispatchedAt: new Date(Date.now() - 1200000),
        pickedUpAt: new Date(Date.now() - 1200000),
        deliverySequence: batch2Orders.map((o, idx) => ({
          orderId: o._id,
          sequenceNumber: idx + 1,
          estimatedArrival: new Date(Date.now() + (idx + 1) * 600000),
        })),
        creationType: "AUTO",
        maxBatchSize: 15,
        createdBy: admin._id,
      });
      console.log(
        `  Created batch: ${batch2.batchNumber} (IN_PROGRESS) - assigned to ${driver.name}`,
      );

      // Update orders with batchId
      await Order.updateMany(
        { _id: { $in: batch2Orders.map((o) => o._id) } },
        { batchId: batch2._id },
      );
    }

    // Batch 3: COMPLETED
    if (deliveredOrders.length >= 1) {
      const batch3Orders = deliveredOrders.slice(0, 1);
      const batch3 = await DeliveryBatch.create({
        batchNumber: "BATCH-TEST-COMPLETE-001",
        kitchenId: kitchen._id,
        zoneId: zone._id,
        menuType: "MEAL_MENU",
        mealWindow: "DINNER",
        batchDate: new Date(Date.now() - 86400000), // Yesterday
        orderIds: batch3Orders.map((o) => o._id),
        driverId: driver._id,
        driverAssignedAt: new Date(Date.now() - 90000000),
        status: "COMPLETED",
        windowEndTime: new Date(Date.now() - 90000000),
        dispatchedAt: new Date(Date.now() - 90000000),
        pickedUpAt: new Date(Date.now() - 89000000),
        completedAt: new Date(Date.now() - 86400000),
        totalDelivered: batch3Orders.length,
        totalFailed: 0,
        creationType: "AUTO",
        createdBy: admin._id,
      });
      console.log(`  Created batch: ${batch3.batchNumber} (COMPLETED)`);
    }

    // Batch 4: COLLECTING (still accepting orders)
    const collectingBatch = await DeliveryBatch.create({
      batchNumber: "BATCH-TEST-COLLECT-001",
      kitchenId: kitchen._id,
      zoneId: zone._id,
      menuType: "MEAL_MENU",
      mealWindow: "DINNER",
      batchDate: new Date(),
      orderIds: [],
      status: "COLLECTING",
      windowEndTime: new Date(Date.now() + 7200000), // 2 hours from now
      creationType: "AUTO",
      maxBatchSize: 15,
      createdBy: admin._id,
    });
    console.log(
      `  Created batch: ${collectingBatch.batchNumber} (COLLECTING) - empty, waiting for orders`,
    );

    // ===
    // SUMMARY
    // ===
    console.log("\n===");
    console.log("DRIVER TEST SEED COMPLETED!");
    console.log("===\n");

    console.log("USERS:");
    console.log("  Admin:         admin / admin123");
    console.log(
      `  Driver:        ${EXISTING_DRIVER_PHONE} (${EXISTING_DRIVER_NAME}) - EXISTING ACCOUNT`,
    );
    console.log("  Kitchen Staff: 9800000001 (Kitchen Manager)");
    console.log("  Customers:     9800000101 - 9800000110 (10 customers)\n");

    console.log("ORDERS CREATED:");
    console.log("  PLACED:           3 orders (new, waiting for kitchen)");
    console.log("  ACCEPTED:         2 orders (kitchen accepted)");
    console.log("  PREPARING:        3 orders (being prepared)");
    console.log("  READY:            4 orders (ready for driver pickup)");
    console.log("  PICKED_UP:        2 orders (driver picked up)");
    console.log("  OUT_FOR_DELIVERY: 3 orders (driver on the way)");
    console.log("  DELIVERED:        2 orders (completed)");
    console.log("  CANCELLED:        1 order");
    console.log("  REJECTED:         1 order");
    console.log("  FAILED:           1 order (delivery failed)\n");

    console.log("DELIVERY BATCHES:");
    console.log("  COLLECTING:        1 batch (waiting for orders)");
    console.log("  READY_FOR_DISPATCH: 1 batch (waiting for driver)");
    console.log("  IN_PROGRESS:       1 batch (driver delivering)");
    console.log("  COMPLETED:         1 batch (done)\n");

    console.log("DRIVER APP TEST FLOWS:");
    console.log(
      `  1. Login with phone: ${EXISTING_DRIVER_PHONE} (already logged in)`,
    );
    console.log("  2. View available batches (READY_FOR_DISPATCH)");
    console.log("  3. Accept a batch");
    console.log("  4. View assigned orders");
    console.log(
      "  5. Update order status: PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED",
    );
    console.log("  6. Complete delivery with OTP proof");
    console.log("  7. View delivery history\n");

    console.log("API ENDPOINTS FOR DRIVER:");
    console.log("  GET  /api/orders/driver          - Get assigned orders");
    console.log("  GET  /api/orders/:id             - Get order details");
    console.log(
      "  PATCH /api/orders/:id/delivery-status - Update delivery status",
    );
    console.log(
      "     Body: { status: 'PICKED_UP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' }",
    );
    console.log(
      "     For DELIVERED: { status: 'DELIVERED', proofOfDelivery: { type: 'OTP', value: '1234' } }\n",
    );

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

seedDriverTest();
