import Subscription from "../schema/subscription.schema.js";
import Order from "../schema/order.schema.js";
import Kitchen from "../schema/kitchen.schema.js";
import MenuItem from "../schema/menuItem.schema.js";
import CustomerAddress from "../schema/customerAddress.schema.js";
import Zone from "../schema/zone.schema.js";
import Voucher from "../schema/voucher.schema.js";
import AutoOrderLog from "../schema/autoOrderLog.schema.js";
import { redeemVouchersWithTransaction } from "./voucher.service.js";
import { sendToRole, sendToUser } from "./notification.service.js";
import {
  KITCHEN_TEMPLATES,
  AUTO_ORDER_TEMPLATES,
  buildFromTemplate,
} from "./notification-templates.service.js";
import { getAutoOrderConfig } from "./config.service.js";

/**
 * Auto-Order Service
 * Handles automated order placement for subscription users
 *
 * Flow:
 * 1. Get eligible subscriptions (auto-order enabled, vouchers available, not paused/skipped)
 * 2. For each subscription:
 *    - Get default address → resolve zone from pincode
 *    - Find kitchens serving that zone
 *    - Select first available kitchen
 *    - Get menu item for meal window
 *    - Redeem voucher and create order
 *    - Auto-accept order (voucher policy)
 * 3. Log all outcomes (success, skipped, failed) with detailed reasons
 */

/**
 * Generate unique cron run ID for grouping logs
 * Format: CRON-{MEALWINDOW}-{YYYYMMDD}-{RANDOM}
 * @param {string} mealWindow - LUNCH or DINNER
 * @returns {string} Unique cron run ID
 */
function generateCronRunId(mealWindow) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CRON-${mealWindow}-${date}-${random}`;
}

/**
 * Log auto-order attempt result to database
 * @param {Object} params - Log parameters
 * @returns {Promise<void>}
 */
async function logAutoOrderResult(params) {
  try {
    const log = new AutoOrderLog({
      subscriptionId: params.subscriptionId,
      userId: params.userId,
      orderId: params.orderId || null,
      orderNumber: params.orderNumber || null,
      mealWindow: params.mealWindow,
      processedDate: params.processedDate,
      status: params.status,
      reason: params.reason || null,
      failureCategory: params.failureCategory || null,
      context: params.context || {},
      cronRunId: params.cronRunId,
      processingTimeMs: params.processingTimeMs || null,
    });
    await log.save();
  } catch (error) {
    console.error("> AutoOrderLog: Failed to save log:", error.message);
  }
}

/**
 * Send failure notification to customer
 * Maps failure categories to appropriate notification templates
 *
 * @param {ObjectId} userId - User ID
 * @param {string} failureCategory - Failure category from AutoOrderLog
 * @param {string} mealWindow - LUNCH or DINNER
 * @param {Object} context - Context data (pincode, etc.)
 */
function sendFailureNotification(userId, failureCategory, mealWindow, context = {}) {
  // Map failure category to template
  const templateMap = {
    NO_VOUCHERS: AUTO_ORDER_TEMPLATES.FAILED_NO_VOUCHERS,
    NO_ADDRESS: AUTO_ORDER_TEMPLATES.FAILED_NO_ADDRESS,
    NO_ZONE: AUTO_ORDER_TEMPLATES.FAILED_NO_ZONE,
    NO_KITCHEN: AUTO_ORDER_TEMPLATES.FAILED_NO_KITCHEN,
    NO_MENU_ITEM: AUTO_ORDER_TEMPLATES.FAILED_NO_MENU,
    VOUCHER_REDEMPTION_FAILED: AUTO_ORDER_TEMPLATES.FAILED_GENERIC,
    ORDER_CREATION_FAILED: AUTO_ORDER_TEMPLATES.FAILED_GENERIC,
    KITCHEN_NOT_SERVING_ZONE: AUTO_ORDER_TEMPLATES.FAILED_NO_KITCHEN,
    UNKNOWN: AUTO_ORDER_TEMPLATES.FAILED_GENERIC,
  };

  const template = templateMap[failureCategory];
  if (!template) {
    return; // No notification for SKIPPED states (paused/slot skipped)
  }

  const { title, body } = buildFromTemplate(template, {
    mealWindow: mealWindow.toLowerCase(),
    pincode: context.pincode || "",
  });

  sendToUser(userId, "AUTO_ORDER_FAILED", title, body, {
    data: {
      type: "AUTO_ORDER_FAILED",
      failureCategory,
      mealWindow,
    },
    entityType: "SUBSCRIPTION",
  });
}

/**
 * Check if a slot is skipped for a subscription
 * @param {Object} subscription - Subscription document
 * @param {Date} date - Date to check
 * @param {string} mealWindow - LUNCH or DINNER
 * @returns {boolean}
 */
function isSlotSkipped(subscription, date, mealWindow) {
  if (!subscription.skippedSlots || subscription.skippedSlots.length === 0) {
    return false;
  }

  const dateStr = date.toISOString().split("T")[0];
  return subscription.skippedSlots.some((slot) => {
    const slotDateStr = new Date(slot.date).toISOString().split("T")[0];
    return slotDateStr === dateStr && slot.mealWindow === mealWindow;
  });
}

/**
 * Get default address for a subscription with zone resolution
 * Resolves zone from address pincode if not already set
 *
 * @param {Object} subscription - Subscription document
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Object>} { address, zone, error }
 */
async function getDefaultAddressWithZone(subscription, userId) {
  let address = null;

  // Use explicitly set default address
  if (subscription.defaultAddressId) {
    address = await CustomerAddress.findOne({
      _id: subscription.defaultAddressId,
      userId,
      isDeleted: false,
    });
  }

  // Fallback: Find default/primary address
  if (!address) {
    address = await CustomerAddress.findOne({
      userId,
      isDeleted: false,
      isDefault: true,
    });
  }

  // Last fallback: Any non-deleted address
  if (!address) {
    address = await CustomerAddress.findOne({
      userId,
      isDeleted: false,
    });
  }

  if (!address) {
    return { address: null, zone: null, error: "NO_ADDRESS" };
  }

  // Resolve zone from address
  let zone = null;

  // First try: use zoneId if already set on address
  if (address.zoneId) {
    zone = await Zone.findById(address.zoneId);
  }

  // Second try: lookup zone by pincode
  if (!zone && address.pincode) {
    zone = await Zone.findByPincode(address.pincode);
  }

  if (!zone) {
    return {
      address,
      zone: null,
      error: "NO_ZONE",
      errorMessage: `No zone found for pincode ${address.pincode}`,
    };
  }

  // Check if zone is serviceable
  if (!zone.isServiceable || !zone.isServiceable()) {
    // If zone doesn't have isServiceable method, check manually
    const isServiceable =
      zone.status === "ACTIVE" && zone.orderingEnabled !== false;
    if (!isServiceable) {
      return {
        address,
        zone,
        error: "NO_ZONE",
        errorMessage: `Zone ${zone.name} (${zone.pincode}) is not serviceable`,
      };
    }
  }

  return { address, zone, error: null };
}

/**
 * Find kitchen that serves the given zone
 * Uses defaultKitchenId if set and valid, otherwise finds first active kitchen in zone
 *
 * @param {Object} subscription - Subscription document
 * @param {ObjectId} zoneId - Zone ID
 * @returns {Promise<Object>} { kitchen, error }
 */
async function findKitchenForZone(subscription, zoneId) {
  // First, try the explicitly set default kitchen
  if (subscription.defaultKitchenId) {
    const kitchen = await Kitchen.findById(subscription.defaultKitchenId);
    if (
      kitchen &&
      kitchen.status === "ACTIVE" &&
      kitchen.isAcceptingOrders &&
      kitchen.zonesServed &&
      kitchen.zonesServed.some((z) => z.toString() === zoneId.toString())
    ) {
      return { kitchen, error: null };
    }
    // Default kitchen doesn't serve this zone or is inactive, continue to find another
  }

  // Find any active kitchen serving this zone
  const kitchens = await Kitchen.find({
    zonesServed: zoneId,
    status: "ACTIVE",
    isAcceptingOrders: true,
  }).sort({ createdAt: 1 }); // Consistent ordering - use first created

  if (!kitchens || kitchens.length === 0) {
    return { kitchen: null, error: "NO_KITCHEN" };
  }

  // Return first available kitchen
  return { kitchen: kitchens[0], error: null };
}

/**
 * Get menu item for the meal window from a kitchen
 * Prioritizes "Thali" or "Standard" items
 *
 * @param {ObjectId} kitchenId - Kitchen ID
 * @param {string} mealWindow - LUNCH or DINNER
 * @returns {Promise<Object|null>} Menu item document
 */
async function getMenuItemForMealWindow(kitchenId, mealWindow) {
  // Try to find a "Thali" or "Standard" menu item first
  let menuItem = await MenuItem.findOne({
    kitchenId,
    menuType: "MEAL_MENU",
    mealWindow,
    isAvailable: true,
    status: "ACTIVE",
    $or: [
      { name: { $regex: /thali/i } },
      { name: { $regex: /standard/i } },
      { category: "MAIN_COURSE" },
    ],
  });

  // Fallback: Any available meal menu item
  if (!menuItem) {
    menuItem = await MenuItem.findOne({
      kitchenId,
      menuType: "MEAL_MENU",
      mealWindow,
      isAvailable: true,
      status: "ACTIVE",
    });
  }

  return menuItem;
}

/**
 * Process auto-order for a single subscription
 * Creates order if all conditions are met, logs outcome regardless
 *
 * @param {Object} subscription - Subscription document
 * @param {Date} date - Date for the order
 * @param {string} mealWindow - LUNCH or DINNER
 * @param {boolean} dryRun - If true, don't actually create orders
 * @param {string} cronRunId - Cron run identifier for log grouping
 * @returns {Promise<Object>} Result { success, orderId, orderNumber, skipped, error }
 */
export async function processAutoOrder(
  subscription,
  date,
  mealWindow,
  dryRun = false,
  cronRunId = null
) {
  const startTime = Date.now();
  const userId = subscription.userId;
  const context = {};
  const processedDate = new Date(date);
  processedDate.setHours(0, 0, 0, 0);

  const logParams = {
    subscriptionId: subscription._id,
    userId,
    mealWindow,
    processedDate,
    cronRunId: cronRunId || generateCronRunId(mealWindow),
    context,
  };

  try {
    // 1. Check if subscription is paused
    if (subscription.isPaused) {
      if (!subscription.pausedUntil || subscription.pausedUntil > date) {
        await logAutoOrderResult({
          ...logParams,
          status: "SKIPPED",
          reason: "Subscription is paused",
          failureCategory: "SUBSCRIPTION_PAUSED",
          processingTimeMs: Date.now() - startTime,
        });
        return { success: false, skipped: true, reason: "Subscription is paused" };
      }
    }

    // 2. Check if slot is skipped
    if (isSlotSkipped(subscription, date, mealWindow)) {
      await logAutoOrderResult({
        ...logParams,
        status: "SKIPPED",
        reason: "Slot is skipped by user",
        failureCategory: "SLOT_SKIPPED",
        processingTimeMs: Date.now() - startTime,
      });
      return { success: false, skipped: true, reason: "Slot is skipped" };
    }

    // 3. Check voucher availability
    const availableVouchers = await Voucher.countDocuments({
      userId,
      status: { $in: ["AVAILABLE", "RESTORED"] },
      expiryDate: { $gt: new Date() },
    });

    context.vouchersAvailable = availableVouchers;

    if (availableVouchers < 1) {
      await logAutoOrderResult({
        ...logParams,
        status: "FAILED",
        reason: "No vouchers available",
        failureCategory: "NO_VOUCHERS",
        processingTimeMs: Date.now() - startTime,
      });
      sendFailureNotification(userId, "NO_VOUCHERS", mealWindow, context);
      return { success: false, error: "No vouchers available" };
    }

    // 4. Get address and resolve zone from pincode
    const {
      address,
      zone,
      error: addressError,
      errorMessage: addressErrorMessage,
    } = await getDefaultAddressWithZone(subscription, userId);

    if (addressError === "NO_ADDRESS") {
      await logAutoOrderResult({
        ...logParams,
        status: "FAILED",
        reason: "No default address found",
        failureCategory: "NO_ADDRESS",
        processingTimeMs: Date.now() - startTime,
      });
      sendFailureNotification(userId, "NO_ADDRESS", mealWindow, context);
      return { success: false, error: "No default address found" };
    }

    context.addressId = address._id;
    context.pincode = address.pincode;

    if (addressError === "NO_ZONE") {
      await logAutoOrderResult({
        ...logParams,
        status: "FAILED",
        reason: addressErrorMessage || `No serviceable zone found for pincode ${address.pincode}`,
        failureCategory: "NO_ZONE",
        processingTimeMs: Date.now() - startTime,
      });
      sendFailureNotification(userId, "NO_ZONE", mealWindow, context);
      return {
        success: false,
        error: `No zone found for pincode ${address.pincode}`,
      };
    }

    context.zoneId = zone._id;
    context.zoneName = zone.name;

    // 5. Find kitchen that serves this zone
    const { kitchen, error: kitchenError } = await findKitchenForZone(
      subscription,
      zone._id
    );

    if (kitchenError === "NO_KITCHEN") {
      await logAutoOrderResult({
        ...logParams,
        status: "FAILED",
        reason: `No active kitchen found serving zone ${zone.name} (${zone.pincode})`,
        failureCategory: "NO_KITCHEN",
        processingTimeMs: Date.now() - startTime,
      });
      sendFailureNotification(userId, "NO_KITCHEN", mealWindow, context);
      return { success: false, error: "No kitchen found serving address zone" };
    }

    context.kitchenId = kitchen._id;
    context.kitchenName = kitchen.name;

    // 6. Get menu item for the meal window
    const menuItem = await getMenuItemForMealWindow(kitchen._id, mealWindow);

    if (!menuItem) {
      await logAutoOrderResult({
        ...logParams,
        status: "FAILED",
        reason: `No ${mealWindow} menu item available at kitchen ${kitchen.name}`,
        failureCategory: "NO_MENU_ITEM",
        processingTimeMs: Date.now() - startTime,
      });
      sendFailureNotification(userId, "NO_MENU_ITEM", mealWindow, context);
      return { success: false, error: "No menu item available" };
    }

    context.menuItemId = menuItem._id;
    context.menuItemName = menuItem.name;

    // 7. Dry run - return what would be ordered
    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        kitchen: kitchen.name,
        menuItem: menuItem.name,
        address: address.addressLine1,
        zone: zone.name,
        pincode: address.pincode,
      };
    }

    // 8. Get auto-order config for auto-accept setting
    const autoOrderConfig = getAutoOrderConfig();
    const autoAccept = autoOrderConfig.autoAcceptOrders !== false;

    // 9. Redeem voucher
    const voucherResult = await redeemVouchersWithTransaction(
      userId,
      1,
      mealWindow,
      null, // Will be updated after order creation
      kitchen._id
    );

    if (!voucherResult.success) {
      await logAutoOrderResult({
        ...logParams,
        status: "FAILED",
        reason: `Voucher redemption failed: ${voucherResult.error}`,
        failureCategory: "VOUCHER_REDEMPTION_FAILED",
        processingTimeMs: Date.now() - startTime,
      });
      sendFailureNotification(userId, "VOUCHER_REDEMPTION_FAILED", mealWindow, context);
      return { success: false, error: voucherResult.error };
    }

    // 10. Create order with ACCEPTED status (auto-accept policy for voucher orders)
    const orderNumber = Order.generateOrderNumber();
    const initialStatus = autoAccept ? "ACCEPTED" : "PLACED";

    const statusTimeline = [
      {
        status: "PLACED",
        timestamp: new Date(),
        notes: "Auto-ordered by system",
      },
    ];

    if (autoAccept) {
      statusTimeline.push({
        status: "ACCEPTED",
        timestamp: new Date(),
        notes: "Auto-accepted (voucher order policy)",
      });
    }

    const order = new Order({
      orderNumber,
      userId,
      kitchenId: kitchen._id,
      zoneId: zone._id,
      deliveryAddressId: address._id,
      deliveryAddress: {
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        landmark: address.landmark,
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
          unitPrice: menuItem.discountedPrice || menuItem.price,
          totalPrice: menuItem.discountedPrice || menuItem.price,
          isMainCourse: menuItem.category === "MAIN_COURSE",
          addons: [],
        },
      ],
      subtotal: menuItem.discountedPrice || menuItem.price,
      charges: {
        deliveryFee: 0,
        serviceFee: 0,
        packagingFee: 0,
        handlingFee: 0,
        taxAmount: 0,
        taxBreakdown: [],
      },
      grandTotal: 0, // Covered by voucher
      voucherUsage: {
        voucherIds: voucherResult.vouchers,
        voucherCount: 1,
        mainCoursesCovered: 1,
      },
      amountPaid: 0,
      paymentStatus: "PAID",
      paymentMethod: "VOUCHER_ONLY",
      status: initialStatus,
      statusTimeline,
      ...(autoAccept && { acceptedAt: new Date() }),
      specialInstructions: "Auto-order",
      placedAt: new Date(),
      isAutoOrder: true,
    });

    await order.save();

    console.log(
      `> Auto-order created: ${orderNumber} for user ${userId} (status: ${initialStatus})`
    );

    // 11. Log success
    await logAutoOrderResult({
      ...logParams,
      status: "SUCCESS",
      orderId: order._id,
      orderNumber: order.orderNumber,
      reason: null,
      processingTimeMs: Date.now() - startTime,
    });

    // 12. Send notifications
    // Customer notification using template
    const { title: customerTitle, body: customerBody } = buildFromTemplate(
      AUTO_ORDER_TEMPLATES.SUCCESS,
      {
        mealWindow: mealWindow.toLowerCase(),
        orderNumber: order.orderNumber,
        kitchenName: kitchen.name,
      }
    );
    sendToUser(userId, "AUTO_ORDER_SUCCESS", customerTitle, customerBody, {
      data: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        status: initialStatus,
        kitchenId: kitchen._id.toString(),
        type: "AUTO_ORDER_SUCCESS",
      },
      entityType: "ORDER",
      entityId: order._id,
    });

    const { title, body } = buildFromTemplate(KITCHEN_TEMPLATES.NEW_AUTO_ORDER, {
      orderNumber: order.orderNumber,
      mealWindow: mealWindow,
    });
    sendToRole("KITCHEN_STAFF", "NEW_AUTO_ORDER", title, body, {
      kitchenId: kitchen._id,
      data: { orderId: order._id.toString(), orderNumber: order.orderNumber },
      entityType: "ORDER",
      entityId: order._id,
    });

    return {
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
    };
  } catch (error) {
    console.error(
      `> Auto-order error for subscription ${subscription._id}:`,
      error
    );

    await logAutoOrderResult({
      ...logParams,
      status: "FAILED",
      reason: error.message,
      failureCategory: "UNKNOWN",
      processingTimeMs: Date.now() - startTime,
    });
    sendFailureNotification(userId, "UNKNOWN", mealWindow, context);

    return { success: false, error: error.message };
  }
}

/**
 * Get subscriptions eligible for auto-ordering
 * Filters by: active status, auto-ordering enabled, vouchers available, not paused
 *
 * @param {string} mealWindow - LUNCH or DINNER
 * @returns {Promise<Array>} Array of subscription documents
 */
export async function getEligibleSubscriptions(mealWindow) {
  const now = new Date();

  const query = {
    status: "ACTIVE",
    autoOrderingEnabled: true,
    voucherExpiryDate: { $gt: now },
    $expr: { $lt: ["$vouchersUsed", "$totalVouchersIssued"] },
  };

  // Filter by meal type preference
  if (mealWindow === "LUNCH") {
    query.defaultMealType = { $in: ["LUNCH", "BOTH"] };
  } else if (mealWindow === "DINNER") {
    query.defaultMealType = { $in: ["DINNER", "BOTH"] };
  }

  return Subscription.find(query);
}

/**
 * Run auto-order batch for a meal window
 * Processes all eligible subscriptions and returns comprehensive results
 *
 * @param {string} mealWindow - LUNCH or DINNER
 * @param {boolean} dryRun - If true, don't create actual orders
 * @returns {Promise<Object>} Batch results with statistics
 */
export async function runAutoOrderBatch(mealWindow, dryRun = false) {
  const cronRunId = generateCronRunId(mealWindow);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log(
    `> Auto-order batch starting: ${mealWindow} (Run ID: ${cronRunId}, dryRun: ${dryRun})`
  );

  const subscriptions = await getEligibleSubscriptions(mealWindow);

  const results = {
    cronRunId,
    mealWindow,
    processedDate: today,
    startedAt: new Date(),
    completedAt: null,
    totalEligible: subscriptions.length,
    processed: 0,
    ordersCreated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    dryRun,
  };

  for (const subscription of subscriptions) {
    results.processed++;

    const result = await processAutoOrder(
      subscription,
      today,
      mealWindow,
      dryRun,
      cronRunId
    );

    if (result.success) {
      results.ordersCreated++;
    } else if (result.skipped) {
      results.skipped++;
    } else {
      results.failed++;
      results.errors.push({
        subscriptionId: subscription._id,
        userId: subscription.userId,
        error: result.error,
      });
    }
  }

  results.completedAt = new Date();
  const duration = (results.completedAt - results.startedAt) / 1000;

  console.log(
    `> Auto-order batch complete: ${mealWindow} - ${results.ordersCreated} orders, ${results.skipped} skipped, ${results.failed} failed (${duration.toFixed(2)}s)`
  );

  return results;
}

export default {
  processAutoOrder,
  getEligibleSubscriptions,
  runAutoOrderBatch,
};
