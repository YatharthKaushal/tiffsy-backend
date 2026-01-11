import mongoose from "mongoose";
import Order from "../../schema/order.schema.js";
import Kitchen from "../../schema/kitchen.schema.js";
import MenuItem from "../../schema/menuItem.schema.js";
import Addon from "../../schema/addon.schema.js";
import CustomerAddress from "../../schema/customerAddress.schema.js";
import Voucher from "../../schema/voucher.schema.js";
import Coupon from "../../schema/coupon.schema.js";
import Refund from "../../schema/refund.schema.js";
import { sendResponse } from "../../utils/response.utils.js";
import { safeAuditCreate } from "../../utils/audit.utils.js";
import { createLogger } from "../../utils/logger.utils.js";
import {
  checkCutoffTime,
  getFeesConfig,
  checkCancellationEligibility,
} from "../../services/config.service.js";
import {
  redeemVouchersWithTransaction,
  restoreVouchersForOrder,
  getAvailableVoucherCount,
} from "../../services/voucher.service.js";

// Create logger instance for this controller
const log = createLogger("OrderController");

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Check if cutoff time has passed for a meal window
 * Uses the config service for DB-persisted cutoff times
 * @param {string} mealWindow - LUNCH or DINNER
 * @returns {boolean}
 */
function isCutoffPassed(mealWindow) {
  const cutoffInfo = checkCutoffTime(mealWindow);
  return cutoffInfo.isPastCutoff;
}

/**
 * Validate order items against menu and kitchen
 * @param {Array} items - Order items
 * @param {string} kitchenId - Kitchen ID
 * @param {string} menuType - MEAL_MENU or ON_DEMAND_MENU
 * @param {string} mealWindow - LUNCH or DINNER (for MEAL_MENU)
 * @returns {Promise<{valid: boolean, error: string|null, validatedItems: Array}>}
 */
async function validateOrderItems(items, kitchenId, menuType, mealWindow) {
  const validatedItems = [];

  for (const item of items) {
    // Fetch menu item
    const menuItem = await MenuItem.findById(item.menuItemId);
    if (!menuItem) {
      return {
        valid: false,
        error: `Menu item not found: ${item.menuItemId}`,
        validatedItems: [],
      };
    }

    // Verify kitchen ownership
    if (menuItem.kitchenId.toString() !== kitchenId) {
      return {
        valid: false,
        error: `Menu item ${menuItem.name} does not belong to this kitchen`,
        validatedItems: [],
      };
    }

    // Verify menu type
    if (menuItem.menuType !== menuType) {
      return {
        valid: false,
        error: `Menu item ${menuItem.name} is not available for ${menuType}`,
        validatedItems: [],
      };
    }

    // Verify meal window for MEAL_MENU
    if (menuType === "MEAL_MENU" && menuItem.mealWindow !== mealWindow) {
      return {
        valid: false,
        error: `Menu item ${menuItem.name} is not available for ${mealWindow}`,
        validatedItems: [],
      };
    }

    // Verify availability
    if (!menuItem.isAvailable || menuItem.status !== "ACTIVE") {
      return {
        valid: false,
        error: `Menu item ${menuItem.name} is not available`,
        validatedItems: [],
      };
    }

    // Validate addons
    const validatedAddons = [];
    if (item.addons && item.addons.length > 0) {
      for (const addon of item.addons) {
        const addonDoc = await Addon.findById(addon.addonId);
        if (!addonDoc) {
          return {
            valid: false,
            error: `Addon not found: ${addon.addonId}`,
            validatedItems: [],
          };
        }

        if (addonDoc.kitchenId.toString() !== kitchenId) {
          return {
            valid: false,
            error: `Addon ${addonDoc.name} does not belong to this kitchen`,
            validatedItems: [],
          };
        }

        if (!addonDoc.isAvailable || addonDoc.status !== "ACTIVE") {
          return {
            valid: false,
            error: `Addon ${addonDoc.name} is not available`,
            validatedItems: [],
          };
        }

        // Check quantity limits
        if (
          addon.quantity < addonDoc.minQuantity ||
          addon.quantity > addonDoc.maxQuantity
        ) {
          return {
            valid: false,
            error: `Addon ${addonDoc.name} quantity must be between ${addonDoc.minQuantity} and ${addonDoc.maxQuantity}`,
            validatedItems: [],
          };
        }

        validatedAddons.push({
          addonId: addonDoc._id,
          name: addonDoc.name,
          quantity: addon.quantity,
          unitPrice: addonDoc.price,
          totalPrice: addonDoc.price * addon.quantity,
        });
      }
    }

    validatedItems.push({
      menuItemId: menuItem._id,
      name: menuItem.name,
      quantity: item.quantity,
      unitPrice: menuItem.discountedPrice || menuItem.price,
      totalPrice: (menuItem.discountedPrice || menuItem.price) * item.quantity,
      isMainCourse: menuItem.category === "MAIN_COURSE",
      addons: validatedAddons,
    });
  }

  return { valid: true, error: null, validatedItems };
}

/**
 * Calculate order pricing
 * Uses DB-persisted fees config
 * @param {Array} items - Validated items
 * @param {number} voucherCount - Number of vouchers to use
 * @param {Object|null} couponDiscount - Coupon discount info
 * @param {string} menuType - Menu type
 * @returns {Object} Pricing breakdown
 */
function calculateOrderPricing(items, voucherCount, couponDiscount, menuType) {
  // Get fees from config service
  const fees = getFeesConfig();

  // Calculate items subtotal
  let subtotal = 0;
  let mainCoursesCount = 0;
  let mainCoursesValue = 0;

  for (const item of items) {
    subtotal += item.totalPrice;
    const addonsTotal = item.addons.reduce((sum, a) => sum + a.totalPrice, 0);
    subtotal += addonsTotal;

    if (item.isMainCourse) {
      mainCoursesCount += item.quantity;
      mainCoursesValue += item.totalPrice;
    }
  }

  // Calculate charges using DB-persisted fees
  const charges = {
    deliveryFee: fees.deliveryFee,
    serviceFee: fees.serviceFee,
    packagingFee: fees.packagingFee,
    handlingFee: fees.handlingFee,
    taxAmount: 0,
    taxBreakdown: [],
  };

  // Calculate tax on subtotal + charges (excluding delivery)
  const taxableAmount = subtotal + charges.serviceFee + charges.packagingFee;
  charges.taxAmount = Math.round(taxableAmount * fees.taxRate * 100) / 100;
  charges.taxBreakdown.push({
    taxType: "GST",
    rate: fees.taxRate * 100,
    amount: charges.taxAmount,
  });

  // Calculate voucher coverage (MEAL_MENU only)
  let voucherCoverage = 0;
  let mainCoursesCovered = 0;
  if (menuType === "MEAL_MENU" && voucherCount > 0) {
    // Each voucher covers one main course
    mainCoursesCovered = Math.min(voucherCount, mainCoursesCount);
    // Calculate average price per main course
    const avgMainCoursePrice =
      mainCoursesCount > 0 ? mainCoursesValue / mainCoursesCount : 0;
    voucherCoverage = avgMainCoursePrice * mainCoursesCovered;
  }

  // Calculate coupon discount (ON_DEMAND_MENU only)
  let discountAmount = 0;
  if (menuType === "ON_DEMAND_MENU" && couponDiscount) {
    if (couponDiscount.discountType === "FREE_DELIVERY") {
      charges.deliveryFee = 0;
    } else {
      discountAmount = couponDiscount.discountAmount || 0;
    }
  }

  // Calculate grand total
  const totalCharges =
    charges.deliveryFee +
    charges.serviceFee +
    charges.packagingFee +
    charges.handlingFee +
    charges.taxAmount;
  const grandTotal = subtotal + totalCharges - discountAmount;
  const amountToPay = Math.max(0, grandTotal - voucherCoverage);

  return {
    subtotal,
    charges,
    discount: couponDiscount
      ? {
          couponCode: couponDiscount.couponCode,
          discountType: couponDiscount.discountType,
          discountAmount,
        }
      : null,
    voucherCoverage: {
      voucherCount,
      mainCoursesCovered,
      value: voucherCoverage,
    },
    grandTotal,
    amountToPay,
  };
}

/**
 * Snapshot delivery address
 * @param {string} addressId - Address ID
 * @returns {Promise<Object>} Address snapshot
 */
async function snapshotAddress(addressId) {
  const address = await CustomerAddress.findById(addressId);
  if (!address) return null;

  return {
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    landmark: address.landmark,
    locality: address.locality,
    city: address.city,
    pincode: address.pincode,
    contactName: address.contactName,
    contactPhone: address.contactPhone,
    coordinates: address.coordinates,
  };
}

// Note: Voucher redemption now uses redeemVouchersWithTransaction from voucher.service.js
// which provides proper MongoDB transaction support for atomic operations

// Note: Voucher restoration now uses restoreVouchersForOrder from voucher.service.js
// which handles expiry checks and proper restoration logic

/**
 * Process refund for order
 * @param {Object} order - Order document
 * @param {string} reason - Refund reason
 * @param {string} initiatedBy - Who initiated the refund
 * @returns {Promise<Object|null>} Refund document or null
 */
async function processRefund(order, reason, initiatedBy) {
  if (order.amountPaid <= 0) return null;

  const refund = new Refund({
    orderId: order._id,
    userId: order.userId,
    amount: order.amountPaid,
    reason,
    status: "PENDING",
    initiatedBy,
    paymentId: order.paymentId,
  });

  await refund.save();
  return refund;
}

/**
 * Get next valid status for order
 * @param {string} currentStatus - Current order status
 * @returns {Array<string>} Valid next statuses
 */
function getNextValidStatuses(currentStatus) {
  const transitions = {
    PLACED: ["ACCEPTED", "REJECTED", "CANCELLED"],
    ACCEPTED: ["PREPARING", "CANCELLED"],
    PREPARING: ["READY", "CANCELLED"],
    READY: ["PICKED_UP"],
    PICKED_UP: ["OUT_FOR_DELIVERY", "DELIVERED", "FAILED"],
    OUT_FOR_DELIVERY: ["DELIVERED", "FAILED"],
  };
  return transitions[currentStatus] || [];
}

/**
 * ============================================================================
 * CUSTOMER - ORDER PLACEMENT
 * ============================================================================
 */

/**
 * Create a new order
 * @route POST /api/orders
 * @access Authenticated Customer
 */
export async function createOrder(req, res) {
  const startTime = Date.now();
  try {
    const userId = req.user._id;
    const {
      kitchenId,
      menuType,
      mealWindow,
      deliveryAddressId,
      items,
      voucherCount = 0,
      couponCode,
      specialInstructions,
      deliveryNotes,
      paymentMethod,
    } = req.body;

    log.request(req, "createOrder");
    log.info("createOrder", "Starting order creation", {
      userId: userId.toString(),
      kitchenId,
      menuType,
      mealWindow,
      itemCount: items?.length,
      voucherCount,
      couponCode: couponCode || "none",
    });

    // Validate delivery address
    const address = await CustomerAddress.findOne({
      _id: deliveryAddressId,
      userId,
      isDeleted: false,
    });
    if (!address) {
      log.warn("createOrder", "Address not found", { deliveryAddressId, userId: userId.toString() });
      return sendResponse(
        res,
        404,
        false,
        "Delivery address not found or not owned by user"
      );
    }

    if (!address.isServiceable) {
      log.warn("createOrder", "Address not serviceable", { deliveryAddressId, zoneId: address.zoneId?.toString() });
      return sendResponse(
        res,
        400,
        false,
        "Delivery address is not serviceable"
      );
    }

    // Validate kitchen
    const kitchen = await Kitchen.findById(kitchenId);
    if (!kitchen) {
      log.warn("createOrder", "Kitchen not found", { kitchenId });
      return sendResponse(res, 404, false, "Kitchen not found");
    }

    if (kitchen.status !== "ACTIVE") {
      log.warn("createOrder", "Kitchen not active", { kitchenId, status: kitchen.status });
      return sendResponse(res, 400, false, "Kitchen is not active");
    }

    if (!kitchen.isAcceptingOrders) {
      log.warn("createOrder", "Kitchen not accepting orders", { kitchenId });
      return sendResponse(res, 400, false, "Kitchen is not accepting orders");
    }

    // Verify kitchen serves the zone
    if (
      !kitchen.zonesServed.some(
        (z) => z.toString() === address.zoneId.toString()
      )
    ) {
      log.warn("createOrder", "Kitchen does not serve zone", { kitchenId, zoneId: address.zoneId?.toString() });
      return sendResponse(res, 400, false, "Kitchen does not serve your area");
    }

    log.debug("createOrder", "Validation passed", { kitchenId, zoneId: address.zoneId?.toString() });

    // Validate order items
    const itemValidation = await validateOrderItems(
      items,
      kitchenId,
      menuType,
      mealWindow
    );
    if (!itemValidation.valid) {
      log.warn("createOrder", "Item validation failed", { error: itemValidation.error });
      return sendResponse(res, 400, false, itemValidation.error);
    }

    log.debug("createOrder", "Items validated", { itemCount: itemValidation.validatedItems.length });

    // Check cutoff time for MEAL_MENU voucher orders
    if (
      menuType === "MEAL_MENU" &&
      voucherCount > 0 &&
      isCutoffPassed(mealWindow)
    ) {
      log.warn("createOrder", "Voucher cutoff passed", { mealWindow, voucherCount });
      return sendResponse(
        res,
        400,
        false,
        `Cutoff time for ${mealWindow} orders has passed. Vouchers cannot be used.`
      );
    }

    // Handle voucher redemption (MEAL_MENU only)
    // Using MongoDB transactions for atomic operation
    let redeemedVouchers = [];
    if (menuType === "MEAL_MENU" && voucherCount > 0) {
      log.info("createOrder", "Redeeming vouchers", { userId: userId.toString(), voucherCount, mealWindow });

      // Generate order number first so we can associate vouchers with order
      const orderNumber = Order.generateOrderNumber();

      const voucherResult = await redeemVouchersWithTransaction(
        userId,
        voucherCount,
        mealWindow,
        null, // orderId not yet available - will be updated after order creation
        kitchenId
      );
      if (!voucherResult.success) {
        log.warn("createOrder", "Voucher redemption failed", { error: voucherResult.error });
        return sendResponse(res, 400, false, voucherResult.error);
      }
      redeemedVouchers = voucherResult.vouchers;
      log.info("createOrder", "Vouchers redeemed", { count: redeemedVouchers.length });
    }

    // Handle coupon validation (ON_DEMAND_MENU only)
    let couponDiscount = null;
    if (menuType === "ON_DEMAND_MENU" && couponCode) {
      log.debug("createOrder", "Validating coupon", { couponCode });
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
      if (coupon && coupon.isValid()) {
        const subtotal = itemValidation.validatedItems.reduce((sum, item) => {
          const addonsTotal = item.addons.reduce(
            (a, addon) => a + addon.totalPrice,
            0
          );
          return sum + item.totalPrice + addonsTotal;
        }, 0);

        if (subtotal >= coupon.minOrderValue) {
          couponDiscount = {
            couponId: coupon._id,
            couponCode: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discountAmount: coupon.calculateDiscount(subtotal),
          };
          // Increment coupon usage
          await coupon.incrementUsage();
          log.info("createOrder", "Coupon applied", { couponCode: coupon.code, discount: couponDiscount.discountAmount });
        } else {
          log.debug("createOrder", "Coupon min order not met", { minOrderValue: coupon.minOrderValue, subtotal });
        }
      } else {
        log.debug("createOrder", "Coupon invalid or not found", { couponCode });
      }
    }

    // Calculate pricing
    const pricing = calculateOrderPricing(
      itemValidation.validatedItems,
      voucherCount,
      couponDiscount,
      menuType
    );

    // Snapshot address
    const addressSnapshot = await snapshotAddress(deliveryAddressId);

    // Generate order number
    const orderNumber = Order.generateOrderNumber();

    // Determine payment status
    // In non-production environments, auto-confirm payments for testing
    const isDevMode = process.env.NODE_ENV !== "production";
    let paymentStatus = "PENDING";

    if (pricing.amountToPay === 0) {
      paymentStatus = "PAID"; // Fully covered by vouchers
    } else if (isDevMode) {
      paymentStatus = "PAID"; // Auto-confirm in dev mode (no payment gateway)
      log.info("createOrder", "Auto-confirming payment (dev mode)", {
        amountToPay: pricing.amountToPay,
        environment: process.env.NODE_ENV || "development",
      });
    }

    // Create order
    const order = new Order({
      orderNumber,
      userId,
      kitchenId,
      zoneId: address.zoneId,
      deliveryAddressId,
      deliveryAddress: addressSnapshot,
      menuType,
      mealWindow,
      items: itemValidation.validatedItems,
      subtotal: pricing.subtotal,
      charges: pricing.charges,
      discount: couponDiscount
        ? {
            couponId: couponDiscount.couponId,
            couponCode: couponDiscount.couponCode,
            discountAmount: couponDiscount.discountAmount,
            discountType: couponDiscount.discountType,
          }
        : undefined,
      grandTotal: pricing.grandTotal,
      voucherUsage: {
        voucherIds: redeemedVouchers,
        voucherCount: redeemedVouchers.length,
        mainCoursesCovered: pricing.voucherCoverage.mainCoursesCovered,
      },
      amountPaid: pricing.amountToPay,
      paymentStatus,
      paymentMethod: paymentMethod || "OTHER",
      status: "PLACED",
      statusTimeline: [
        {
          status: "PLACED",
          timestamp: new Date(),
          updatedBy: userId,
        },
      ],
      specialInstructions,
      placedAt: new Date(),
    });

    // Add delivery notes if provided
    if (deliveryNotes) {
      order.deliveryNotes = deliveryNotes;
    }

    await order.save();

    const duration = Date.now() - startTime;
    const paymentAutoConfirmed = isDevMode && pricing.amountToPay > 0;

    log.event("ORDER_CREATED", "New order placed successfully", {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      userId: userId.toString(),
      kitchenId,
      menuType,
      mealWindow,
      grandTotal: pricing.grandTotal,
      amountToPay: pricing.amountToPay,
      vouchersUsed: redeemedVouchers.length,
      couponApplied: couponDiscount?.couponCode || null,
      paymentAutoConfirmed,
      duration: `${duration}ms`,
    });
    log.response("createOrder", 201, true, duration);

    return sendResponse(res, 201, true, "Order placed successfully", {
      order,
      vouchersUsed: redeemedVouchers.length,
      amountToPay: pricing.amountToPay,
      paymentRequired: !isDevMode && pricing.amountToPay > 0,
      paymentAutoConfirmed,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("createOrder", "Failed to place order", { error, duration: `${duration}ms` });
    return sendResponse(res, 500, false, "Failed to place order");
  }
}

/**
 * Calculate order pricing before placement (cart preview)
 * @route POST /api/orders/calculate-pricing
 * @access Authenticated Customer
 */
export async function getOrderPricing(req, res) {
  const startTime = Date.now();
  try {
    const userId = req.user._id;
    const {
      kitchenId,
      menuType,
      mealWindow,
      items,
      voucherCount = 0,
      couponCode,
      deliveryAddressId,
    } = req.body;

    log.request(req, "getOrderPricing");
    log.debug("getOrderPricing", "Calculating pricing", { kitchenId, menuType, itemCount: items?.length });

    // Validate items
    const itemValidation = await validateOrderItems(
      items,
      kitchenId,
      menuType,
      mealWindow
    );
    if (!itemValidation.valid) {
      return sendResponse(res, 400, false, itemValidation.error);
    }

    // Check voucher eligibility using service functions
    let voucherEligibility = {
      available: 0,
      canUse: 0,
      cutoffPassed: false,
      cutoffInfo: null,
    };

    if (menuType === "MEAL_MENU") {
      // Use voucher service for available count
      const availableVouchers = await getAvailableVoucherCount(
        userId,
        mealWindow
      );
      const cutoffInfo = checkCutoffTime(mealWindow);

      voucherEligibility.available = availableVouchers;
      voucherEligibility.cutoffPassed = cutoffInfo.isPastCutoff;
      voucherEligibility.cutoffInfo = {
        cutoffTime: cutoffInfo.cutoffTime,
        currentTime: cutoffInfo.currentTime,
        message: cutoffInfo.message,
      };
      voucherEligibility.canUse = cutoffInfo.isPastCutoff
        ? 0
        : Math.min(voucherCount, availableVouchers);
    }

    // Handle coupon validation
    let couponDiscount = null;
    if (menuType === "ON_DEMAND_MENU" && couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
      const subtotal = itemValidation.validatedItems.reduce((sum, item) => {
        const addonsTotal = item.addons.reduce(
          (a, addon) => a + addon.totalPrice,
          0
        );
        return sum + item.totalPrice + addonsTotal;
      }, 0);

      if (coupon && coupon.isValid() && subtotal >= coupon.minOrderValue) {
        couponDiscount = {
          couponCode: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          discountAmount: coupon.calculateDiscount(subtotal),
        };
      }
    }

    // Calculate pricing
    const pricing = calculateOrderPricing(
      itemValidation.validatedItems,
      voucherEligibility.canUse,
      couponDiscount,
      menuType
    );

    const duration = Date.now() - startTime;
    log.response("getOrderPricing", 200, true, duration);

    return sendResponse(res, 200, true, "Pricing calculated", {
      breakdown: {
        items: itemValidation.validatedItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.totalPrice,
          addons: item.addons,
        })),
        subtotal: pricing.subtotal,
        charges: pricing.charges,
        discount: pricing.discount,
        voucherCoverage: pricing.voucherCoverage,
        grandTotal: pricing.grandTotal,
        amountToPay: pricing.amountToPay,
      },
      voucherEligibility,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("getOrderPricing", "Failed to calculate pricing", { error, duration: `${duration}ms` });
    return sendResponse(res, 500, false, "Failed to calculate pricing");
  }
}

/**
 * ============================================================================
 * CUSTOMER - ORDER TRACKING
 * ============================================================================
 */

/**
 * Get customer's orders
 * @route GET /api/orders/my-orders
 * @access Authenticated Customer
 */
export async function getMyOrders(req, res) {
  try {
    const userId = req.user._id;
    const {
      status,
      menuType,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = req.query;

    const query = { userId };

    if (status) query.status = status;
    if (menuType) query.menuType = menuType;
    if (dateFrom || dateTo) {
      query.placedAt = {};
      if (dateFrom) query.placedAt.$gte = new Date(dateFrom);
      if (dateTo) query.placedAt.$lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("kitchenId", "name logo")
        .sort({ placedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(query),
    ]);

    // Get active orders
    const activeStatuses = [
      "PLACED",
      "ACCEPTED",
      "PREPARING",
      "READY",
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
    ];
    const activeOrders = orders.filter((o) =>
      activeStatuses.includes(o.status)
    );

    // Add computed fields
    const ordersWithMeta = orders.map((order) => ({
      ...order.toObject(),
      kitchen: order.kitchenId,
      statusDisplay: getStatusDisplay(order.status),
      canCancel: order.canBeCancelled(),
      canRate: order.status === "DELIVERED" && !order.rating?.stars,
    }));

    return sendResponse(res, 200, true, "Orders retrieved", {
      orders: ordersWithMeta,
      activeOrders: activeOrders.map((o) => o._id),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.log("Get my orders error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve orders");
  }
}

/**
 * Get human-readable status display
 */
function getStatusDisplay(status) {
  const displays = {
    PLACED: "Order Placed",
    ACCEPTED: "Order Accepted",
    REJECTED: "Order Rejected",
    PREPARING: "Being Prepared",
    READY: "Ready for Pickup",
    PICKED_UP: "Picked Up",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    FAILED: "Delivery Failed",
  };
  return displays[status] || status;
}

/**
 * Get order by ID
 * @route GET /api/orders/:id
 * @access Authenticated (Customer owner, Kitchen Staff, Driver, Admin)
 */
export async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const order = await Order.findById(id)
      .populate("kitchenId", "name logo address phone")
      .populate("driverId", "name phone");

    if (!order) {
      return sendResponse(res, 404, false, "Order not found");
    }

    // Access control
    const isOwner = order.userId.toString() === user._id.toString();
    const isKitchenStaff =
      user.role === "KITCHEN_STAFF" &&
      user.kitchenId?.toString() === order.kitchenId._id.toString();
    const isDriver =
      user.role === "DRIVER" &&
      order.driverId?._id?.toString() === user._id.toString();
    const isAdmin = user.role === "ADMIN";

    if (!isOwner && !isKitchenStaff && !isDriver && !isAdmin) {
      return sendResponse(res, 403, false, "Not authorized to view this order");
    }

    // Get voucher details if used
    let vouchersUsed = [];
    if (order.voucherUsage?.voucherIds?.length > 0) {
      vouchersUsed = await Voucher.find({
        _id: { $in: order.voucherUsage.voucherIds },
      }).select("voucherCode valueType value");
    }

    return sendResponse(res, 200, true, "Order retrieved", {
      order,
      kitchen: order.kitchenId,
      statusTimeline: order.statusTimeline,
      delivery: {
        driver: order.driverId,
        batch: order.batchId,
        estimatedTime: order.estimatedDeliveryTime,
      },
      vouchersUsed,
      couponApplied: order.discount?.couponCode
        ? {
            code: order.discount.couponCode,
            discount: order.discount.discountAmount,
          }
        : null,
    });
  } catch (error) {
    console.log("Get order by ID error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve order");
  }
}

/**
 * Track order in real-time
 * @route GET /api/orders/:id/track
 * @access Authenticated Customer (owner)
 */
export async function trackOrder(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const order = await Order.findOne({ _id: id, userId })
      .populate("driverId", "name phone")
      .populate("kitchenId", "name phone");

    if (!order) {
      return sendResponse(res, 404, false, "Order not found");
    }

    return sendResponse(res, 200, true, "Order tracking info", {
      status: order.status,
      statusMessage: getStatusDisplay(order.status),
      timeline: order.statusTimeline,
      driver: order.driverId
        ? {
            name: order.driverId.name,
            phone: order.driverId.phone,
          }
        : null,
      estimatedDelivery: order.estimatedDeliveryTime,
      canContactDriver: order.status === "OUT_FOR_DELIVERY" && order.driverId,
      canContactKitchen: ["PLACED", "ACCEPTED", "PREPARING"].includes(
        order.status
      ),
    });
  } catch (error) {
    console.log("Track order error:", error);
    return sendResponse(res, 500, false, "Failed to track order");
  }
}

/**
 * Rate an order
 * @route POST /api/orders/:id/rate
 * @access Authenticated Customer (owner)
 */
export async function rateOrder(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { stars, comment } = req.body;

    const order = await Order.findOne({ _id: id, userId });
    if (!order) {
      return sendResponse(res, 404, false, "Order not found");
    }

    if (order.status !== "DELIVERED") {
      return sendResponse(res, 400, false, "Can only rate delivered orders");
    }

    if (order.rating?.stars) {
      return sendResponse(res, 400, false, "Order already rated");
    }

    order.rating = {
      stars,
      comment,
      ratedAt: new Date(),
    };

    await order.save();

    return sendResponse(res, 200, true, "Order rated successfully", { order });
  } catch (error) {
    console.log("Rate order error:", error);
    return sendResponse(res, 500, false, "Failed to rate order");
  }
}

/**
 * Customer cancel their own order
 * Implements new cancellation rules:
 * - Non-voucher orders: Within 10 minutes (configurable by admin)
 * - Voucher orders: Anytime before delivery, but vouchers only restored if before meal window cutoff
 * @route PATCH /api/orders/:id/customer-cancel
 * @access Authenticated Customer (owner)
 */
export async function customerCancelOrder(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { reason } = req.body;

    const order = await Order.findOne({ _id: id, userId });
    if (!order) {
      return sendResponse(res, 404, false, "Order not found");
    }

    // Use config service to check cancellation eligibility
    const eligibility = checkCancellationEligibility(order);

    if (!eligibility.canCancel) {
      return sendResponse(res, 400, false, eligibility.reason, {
        orderAgeMinutes: eligibility.orderAgeMinutes,
        windowMinutes: eligibility.windowMinutes,
      });
    }

    // Update order status
    order.cancellationReason = reason || "Cancelled by customer";
    order.cancelledBy = "CUSTOMER";
    await order.updateStatus(
      "CANCELLED",
      userId,
      reason || "Cancelled by customer"
    );

    // Restore vouchers only if eligibility says so
    // (voucher orders: only before meal window cutoff; non-voucher: no vouchers to restore)
    let vouchersRestored = 0;
    let voucherWarning = null;

    if (order.voucherUsage?.voucherIds?.length > 0) {
      if (eligibility.shouldRestoreVouchers) {
        // Before cutoff - restore vouchers
        const restoreResult = await restoreVouchersForOrder(
          order.voucherUsage.voucherIds,
          "Order cancelled by customer"
        );
        vouchersRestored = restoreResult.count;
      } else {
        // After cutoff - vouchers NOT restored
        voucherWarning =
          eligibility.warning ||
          "Vouchers used for this order will not be restored as the meal window has closed.";
      }
    }

    // Process refund if payment was made (for non-voucher portion)
    let refundInitiated = false;
    if (order.amountPaid > 0 && order.paymentStatus === "PAID") {
      await processRefund(order, "ORDER_CANCELLED_BY_CUSTOMER", "CUSTOMER");
      refundInitiated = true;
    }

    // Build response message
    let message;
    if (voucherWarning) {
      message = voucherWarning;
    } else if (refundInitiated) {
      message = "Your refund will be processed within 5-7 business days.";
    } else if (vouchersRestored > 0) {
      message = `${vouchersRestored} voucher(s) have been restored to your account.`;
    }

    return sendResponse(res, 200, true, "Order cancelled successfully", {
      order,
      refundInitiated,
      vouchersRestored,
      voucherWarning,
      message,
    });
  } catch (error) {
    console.log("Customer cancel order error:", error);
    return sendResponse(res, 500, false, "Failed to cancel order");
  }
}

/**
 * ============================================================================
 * KITCHEN STAFF - ORDER OPERATIONS
 * ============================================================================
 */

/**
 * Get orders for kitchen
 * @route GET /api/orders/kitchen
 * @access Kitchen Staff
 */
export async function getKitchenOrders(req, res) {
  try {
    const kitchenId = req.user.kitchenId;
    const { status, mealWindow, date, page = 1, limit = 50 } = req.query;

    if (!kitchenId) {
      return sendResponse(res, 403, false, "Not associated with a kitchen");
    }

    // Build query for today's orders by default
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const query = {
      kitchenId,
      placedAt: { $gte: startOfDay, $lte: endOfDay },
    };

    if (status) query.status = status;
    if (mealWindow) query.mealWindow = mealWindow;

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("userId", "name phone")
        .sort({ placedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(query),
    ]);

    // Get summary counts
    const summary = {
      pending: await Order.countDocuments({ ...query, status: "PLACED" }),
      accepted: await Order.countDocuments({ ...query, status: "ACCEPTED" }),
      preparing: await Order.countDocuments({ ...query, status: "PREPARING" }),
      ready: await Order.countDocuments({ ...query, status: "READY" }),
    };

    return sendResponse(res, 200, true, "Kitchen orders retrieved", {
      orders,
      summary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.log("Get kitchen orders error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve kitchen orders");
  }
}

/**
 * Accept an order
 * @route PATCH /api/orders/:id/accept
 * @access Kitchen Staff
 */
export async function acceptOrder(req, res) {
  const startTime = Date.now();
  try {
    const { id } = req.params;
    const { estimatedPrepTime } = req.body;
    const kitchenId = req.user.kitchenId;
    const staffId = req.user._id;

    log.request(req, "acceptOrder");

    const order = await Order.findById(id);
    if (!order) {
      log.warn("acceptOrder", "Order not found", { orderId: id });
      return sendResponse(res, 404, false, "Order not found");
    }

    if (order.kitchenId.toString() !== kitchenId.toString()) {
      log.warn("acceptOrder", "Kitchen mismatch", { orderId: id, orderKitchen: order.kitchenId.toString(), staffKitchen: kitchenId.toString() });
      return sendResponse(
        res,
        403,
        false,
        "Order does not belong to your kitchen"
      );
    }

    if (order.status !== "PLACED") {
      log.warn("acceptOrder", "Invalid status for accept", { orderId: id, currentStatus: order.status });
      return sendResponse(
        res,
        400,
        false,
        "Can only accept orders with PLACED status"
      );
    }

    await order.updateStatus("ACCEPTED", staffId, "Order accepted by kitchen");

    if (estimatedPrepTime) {
      order.estimatedPrepTime = estimatedPrepTime;
      await order.save();
    }

    const duration = Date.now() - startTime;
    log.event("ORDER_ACCEPTED", "Order accepted by kitchen", {
      orderId: id,
      orderNumber: order.orderNumber,
      kitchenId: kitchenId.toString(),
      staffId: staffId.toString(),
      estimatedPrepTime,
    });
    log.response("acceptOrder", 200, true, duration);

    return sendResponse(res, 200, true, "Order accepted", { order });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("acceptOrder", "Failed to accept order", { error, duration: `${duration}ms` });
    return sendResponse(res, 500, false, "Failed to accept order");
  }
}

/**
 * Reject an order
 * @route PATCH /api/orders/:id/reject
 * @access Kitchen Staff
 */
export async function rejectOrder(req, res) {
  const startTime = Date.now();
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const kitchenId = req.user.kitchenId;
    const staffId = req.user._id;

    log.request(req, "rejectOrder");

    const order = await Order.findById(id);
    if (!order) {
      log.warn("rejectOrder", "Order not found", { orderId: id });
      return sendResponse(res, 404, false, "Order not found");
    }

    if (order.kitchenId.toString() !== kitchenId.toString()) {
      log.warn("rejectOrder", "Kitchen mismatch", { orderId: id });
      return sendResponse(
        res,
        403,
        false,
        "Order does not belong to your kitchen"
      );
    }

    if (order.status !== "PLACED") {
      log.warn("rejectOrder", "Invalid status for reject", { orderId: id, currentStatus: order.status });
      return sendResponse(
        res,
        400,
        false,
        "Can only reject orders with PLACED status"
      );
    }

    // Update order status
    order.rejectionReason = reason;
    await order.updateStatus("REJECTED", staffId, reason);

    // Restore vouchers if used (kitchen rejection always restores vouchers)
    let vouchersRestored = 0;
    if (order.voucherUsage?.voucherIds?.length > 0) {
      const restoreResult = await restoreVouchersForOrder(
        order.voucherUsage.voucherIds,
        "Order rejected by kitchen"
      );
      vouchersRestored = restoreResult.count;
      log.info("rejectOrder", "Vouchers restored", { orderId: id, count: vouchersRestored });
    }

    // Process refund if payment was made
    let refundInitiated = false;
    if (order.amountPaid > 0 && order.paymentStatus === "PAID") {
      await processRefund(order, "Order rejected by kitchen", "KITCHEN");
      refundInitiated = true;
      log.info("rejectOrder", "Refund initiated", { orderId: id, amount: order.amountPaid });
    }

    const duration = Date.now() - startTime;
    log.event("ORDER_REJECTED", "Order rejected by kitchen", {
      orderId: id,
      orderNumber: order.orderNumber,
      reason,
      vouchersRestored,
      refundInitiated,
    });
    log.response("rejectOrder", 200, true, duration);

    return sendResponse(res, 200, true, "Order rejected", {
      order,
      refundInitiated,
      vouchersRestored,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("rejectOrder", "Failed to reject order", { error, duration: `${duration}ms` });
    return sendResponse(res, 500, false, "Failed to reject order");
  }
}

/**
 * Cancel an accepted order
 * @route PATCH /api/orders/:id/cancel
 * @access Kitchen Staff
 */
export async function cancelOrder(req, res) {
  const startTime = Date.now();
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const kitchenId = req.user.kitchenId;
    const staffId = req.user._id;

    log.request(req, "cancelOrder");

    const order = await Order.findById(id);
    if (!order) {
      log.warn("cancelOrder", "Order not found", { orderId: id });
      return sendResponse(res, 404, false, "Order not found");
    }

    if (order.kitchenId.toString() !== kitchenId.toString()) {
      log.warn("cancelOrder", "Kitchen mismatch", { orderId: id });
      return sendResponse(
        res,
        403,
        false,
        "Order does not belong to your kitchen"
      );
    }

    if (!["ACCEPTED", "PREPARING"].includes(order.status)) {
      log.warn("cancelOrder", "Invalid status for cancel", { orderId: id, currentStatus: order.status });
      return sendResponse(
        res,
        400,
        false,
        "Can only cancel orders that are ACCEPTED or PREPARING"
      );
    }

    // Update order status
    order.cancellationReason = reason;
    order.cancelledBy = "KITCHEN";
    await order.updateStatus("CANCELLED", staffId, reason);

    // Restore vouchers if used (kitchen cancellation always restores vouchers)
    let vouchersRestored = 0;
    if (order.voucherUsage?.voucherIds?.length > 0) {
      const restoreResult = await restoreVouchersForOrder(
        order.voucherUsage.voucherIds,
        "Order cancelled by kitchen"
      );
      vouchersRestored = restoreResult.count;
      log.info("cancelOrder", "Vouchers restored", { orderId: id, count: vouchersRestored });
    }

    // Process refund if payment was made
    let refundInitiated = false;
    if (order.amountPaid > 0 && order.paymentStatus === "PAID") {
      await processRefund(order, "Order cancelled by kitchen", "KITCHEN");
      refundInitiated = true;
      log.info("cancelOrder", "Refund initiated", { orderId: id, amount: order.amountPaid });
    }

    const duration = Date.now() - startTime;
    log.event("ORDER_CANCELLED", "Order cancelled by kitchen", {
      orderId: id,
      orderNumber: order.orderNumber,
      reason,
      previousStatus: order.status,
      vouchersRestored,
      refundInitiated,
    });
    log.response("cancelOrder", 200, true, duration);

    return sendResponse(res, 200, true, "Order cancelled", {
      order,
      refundInitiated,
      vouchersRestored,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("cancelOrder", "Failed to cancel order", { error, duration: `${duration}ms` });
    return sendResponse(res, 500, false, "Failed to cancel order");
  }
}

/**
 * Update order status (PREPARING, READY)
 * @route PATCH /api/orders/:id/status
 * @access Kitchen Staff
 */
export async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const kitchenId = req.user.kitchenId;
    const staffId = req.user._id;

    const order = await Order.findById(id);
    if (!order) {
      return sendResponse(res, 404, false, "Order not found");
    }

    if (order.kitchenId.toString() !== kitchenId.toString()) {
      return sendResponse(
        res,
        403,
        false,
        "Order does not belong to your kitchen"
      );
    }

    // Validate status transition
    const validNextStatuses = getNextValidStatuses(order.status);
    if (!validNextStatuses.includes(status)) {
      return sendResponse(
        res,
        400,
        false,
        `Cannot transition from ${order.status} to ${status}`
      );
    }

    await order.updateStatus(status, staffId, notes);

    return sendResponse(res, 200, true, "Order status updated", { order });
  } catch (error) {
    console.log("Update order status error:", error);
    return sendResponse(res, 500, false, "Failed to update order status");
  }
}

/**
 * ============================================================================
 * DRIVER - ORDER OPERATIONS
 * ============================================================================
 */

/**
 * Get driver's assigned orders
 * @route GET /api/orders/driver
 * @access Driver
 */
export async function getDriverOrders(req, res) {
  try {
    const driverId = req.user._id;

    const orders = await Order.find({
      driverId,
      status: { $in: ["PICKED_UP", "OUT_FOR_DELIVERY"] },
    })
      .populate("kitchenId", "name address")
      .sort({ pickedUpAt: -1 });

    return sendResponse(res, 200, true, "Driver orders retrieved", { orders });
  } catch (error) {
    console.log("Get driver orders error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve driver orders");
  }
}

/**
 * Update delivery status
 * @route PATCH /api/orders/:id/delivery-status
 * @access Driver (assigned)
 */
export async function updateDeliveryStatus(req, res) {
  const startTime = Date.now();
  try {
    const { id } = req.params;
    const { status, notes, proofOfDelivery } = req.body;
    const driverId = req.user._id;

    log.request(req, "updateDeliveryStatus");

    const order = await Order.findById(id);
    if (!order) {
      log.warn("updateDeliveryStatus", "Order not found", { orderId: id });
      return sendResponse(res, 404, false, "Order not found");
    }

    if (order.driverId?.toString() !== driverId.toString()) {
      log.warn("updateDeliveryStatus", "Driver not assigned", { orderId: id, driverId: driverId.toString() });
      return sendResponse(res, 403, false, "Not assigned to this order");
    }

    // Validate status transition
    const validNextStatuses = getNextValidStatuses(order.status);
    if (!validNextStatuses.includes(status)) {
      log.warn("updateDeliveryStatus", "Invalid status transition", { orderId: id, from: order.status, to: status });
      return sendResponse(
        res,
        400,
        false,
        `Cannot transition from ${order.status} to ${status}`
      );
    }

    const previousStatus = order.status;

    // Handle proof of delivery for DELIVERED status
    if (status === "DELIVERED" && proofOfDelivery) {
      order.proofOfDelivery = {
        type: proofOfDelivery.type,
        value: proofOfDelivery.value,
        verifiedAt: new Date(),
      };
    }

    await order.updateStatus(status, driverId, notes);

    const duration = Date.now() - startTime;
    log.event("DELIVERY_STATUS_UPDATED", `Order ${status.toLowerCase()}`, {
      orderId: id,
      orderNumber: order.orderNumber,
      previousStatus,
      newStatus: status,
      driverId: driverId.toString(),
      hasProofOfDelivery: !!proofOfDelivery,
    });
    log.response("updateDeliveryStatus", 200, true, duration);

    return sendResponse(res, 200, true, "Delivery status updated", { order });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("updateDeliveryStatus", "Failed to update delivery status", { error, duration: `${duration}ms` });
    return sendResponse(res, 500, false, "Failed to update delivery status");
  }
}

/**
 * ============================================================================
 * ADMIN - ORDER MANAGEMENT
 * ============================================================================
 */

/**
 * Get all orders (Admin view)
 * @route GET /api/orders/admin/all
 * @access Admin
 */
export async function getAllOrders(req, res) {
  try {
    const {
      userId,
      kitchenId,
      zoneId,
      status,
      menuType,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    if (userId) query.userId = userId;
    if (kitchenId) query.kitchenId = kitchenId;
    if (zoneId) query.zoneId = zoneId;
    if (status) query.status = status;
    if (menuType) query.menuType = menuType;
    if (dateFrom || dateTo) {
      query.placedAt = {};
      if (dateFrom) query.placedAt.$gte = new Date(dateFrom);
      if (dateTo) query.placedAt.$lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("userId", "name phone")
        .populate("kitchenId", "name")
        .populate("zoneId", "name")
        .sort({ placedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(query),
    ]);

    return sendResponse(res, 200, true, "All orders retrieved", {
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.log("Get all orders error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve orders");
  }
}

/**
 * Admin cancel order
 * @route PATCH /api/orders/:id/admin-cancel
 * @access Admin
 */
export async function adminCancelOrder(req, res) {
  try {
    const { id } = req.params;
    const {
      reason,
      issueRefund = true,
      restoreVouchers: shouldRestoreVouchers = true,
    } = req.body;
    const adminId = req.user._id;

    const order = await Order.findById(id);
    if (!order) {
      return sendResponse(res, 404, false, "Order not found");
    }

    if (!order.canBeCancelled()) {
      return sendResponse(
        res,
        400,
        false,
        "Order cannot be cancelled in current status"
      );
    }

    // Update order status
    order.cancellationReason = reason;
    order.cancelledBy = "ADMIN";
    await order.updateStatus("CANCELLED", adminId, reason);

    // Restore vouchers if requested (admin can force restore regardless of expiry)
    let vouchersRestored = 0;
    if (shouldRestoreVouchers && order.voucherUsage?.voucherIds?.length > 0) {
      const restoreResult = await restoreVouchersForOrder(
        order.voucherUsage.voucherIds,
        "Order cancelled by admin",
        true // forceRestore - admin can restore even expired vouchers
      );
      vouchersRestored = restoreResult.count;
    }

    // Process refund if requested
    let refundInitiated = false;
    if (issueRefund && order.amountPaid > 0 && order.paymentStatus === "PAID") {
      await processRefund(order, reason, "ADMIN");
      refundInitiated = true;
    }

    // Log audit
    safeAuditCreate({
      action: "CANCEL_ORDER",
      entityType: "ORDER",
      entityId: order._id,
      performedBy: adminId,
      details: { reason, refundInitiated, vouchersRestored },
    });

    return sendResponse(res, 200, true, "Order cancelled by admin", {
      order,
      refundInitiated,
      vouchersRestored,
    });
  } catch (error) {
    console.log("Admin cancel order error:", error);
    return sendResponse(res, 500, false, "Failed to cancel order");
  }
}

/**
 * Get order statistics
 * @route GET /api/orders/admin/stats
 * @access Admin
 */
export async function getOrderStats(req, res) {
  try {
    const { dateFrom, dateTo, kitchenId, zoneId } = req.query;

    const matchQuery = {};
    if (dateFrom || dateTo) {
      matchQuery.placedAt = {};
      if (dateFrom) matchQuery.placedAt.$gte = new Date(dateFrom);
      if (dateTo) matchQuery.placedAt.$lte = new Date(dateTo);
    }
    if (kitchenId) matchQuery.kitchenId = kitchenId;
    if (zoneId) matchQuery.zoneId = zoneId;

    const stats = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$grandTotal" },
          totalVouchersUsed: { $sum: "$voucherUsage.voucherCount" },
          avgOrderValue: { $avg: "$grandTotal" },
          byStatus: {
            $push: "$status",
          },
          byMenuType: {
            $push: "$menuType",
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      totalVouchersUsed: 0,
      avgOrderValue: 0,
    };

    // Count by status
    const statusCounts = {};
    if (result.byStatus) {
      result.byStatus.forEach((s) => {
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });
    }

    // Count by menu type
    const menuTypeCounts = {};
    if (result.byMenuType) {
      result.byMenuType.forEach((m) => {
        menuTypeCounts[m] = (menuTypeCounts[m] || 0) + 1;
      });
    }

    return sendResponse(res, 200, true, "Order statistics", {
      totalOrders: result.totalOrders,
      totalRevenue: Math.round(result.totalRevenue * 100) / 100,
      totalVouchersUsed: result.totalVouchersUsed,
      avgOrderValue: Math.round(result.avgOrderValue * 100) / 100,
      byStatus: statusCounts,
      byMenuType: menuTypeCounts,
    });
  } catch (error) {
    console.log("Get order stats error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve order statistics");
  }
}

export default {
  createOrder,
  getOrderPricing,
  getMyOrders,
  getOrderById,
  trackOrder,
  rateOrder,
  customerCancelOrder,
  getKitchenOrders,
  acceptOrder,
  rejectOrder,
  cancelOrder,
  updateOrderStatus,
  getDriverOrders,
  updateDeliveryStatus,
  getAllOrders,
  adminCancelOrder,
  getOrderStats,
};
