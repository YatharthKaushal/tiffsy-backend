import Subscription from "../schema/subscription.schema.js";
import Order from "../schema/order.schema.js";
import Kitchen from "../schema/kitchen.schema.js";
import MenuItem from "../schema/menuItem.schema.js";
import CustomerAddress from "../schema/customerAddress.schema.js";
import Voucher from "../schema/voucher.schema.js";
import { redeemVouchersWithTransaction } from "./voucher.service.js";

/**
 * Auto-Order Service
 * Handles the logic for automatically placing orders for subscriptions
 */

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
 * Get default kitchen for a subscription
 * Falls back to last ordered kitchen if not set
 * @param {Object} subscription - Subscription document
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Object|null>} Kitchen document
 */
async function getDefaultKitchen(subscription, userId) {
    // Use explicitly set default kitchen
    if (subscription.defaultKitchenId) {
        const kitchen = await Kitchen.findById(subscription.defaultKitchenId);
        if (kitchen && kitchen.status === "ACTIVE" && kitchen.isAcceptingOrders) {
            return kitchen;
        }
    }

    // Fallback: Find last ordered kitchen
    const lastOrder = await Order.findOne({
        userId,
        menuType: "MEAL_MENU",
        status: { $nin: ["CANCELLED", "REJECTED", "FAILED"] },
    })
        .sort({ placedAt: -1 })
        .select("kitchenId");

    if (lastOrder) {
        const kitchen = await Kitchen.findById(lastOrder.kitchenId);
        if (kitchen && kitchen.status === "ACTIVE" && kitchen.isAcceptingOrders) {
            return kitchen;
        }
    }

    return null;
}

/**
 * Get default address for a subscription
 * Falls back to primary address if not set
 * @param {Object} subscription - Subscription document
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Object|null>} Address document
 */
async function getDefaultAddress(subscription, userId) {
    // Use explicitly set default address
    if (subscription.defaultAddressId) {
        const address = await CustomerAddress.findOne({
            _id: subscription.defaultAddressId,
            userId,
            isDeleted: false,
            isServiceable: true,
        });
        if (address) return address;
    }

    // Fallback: Find primary/default address
    const address = await CustomerAddress.findOne({
        userId,
        isDeleted: false,
        isServiceable: true,
        isPrimary: true,
    });

    if (address) return address;

    // Last fallback: Any serviceable address
    return CustomerAddress.findOne({
        userId,
        isDeleted: false,
        isServiceable: true,
    });
}

/**
 * Get default menu item (Standard Thali or similar)
 * @param {ObjectId} kitchenId - Kitchen ID
 * @param {string} mealWindow - LUNCH or DINNER
 * @returns {Promise<Object|null>} Menu item document
 */
async function getDefaultMenuItem(kitchenId, mealWindow) {
    // Try to find a "Thali" or "Standard" menu item
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

    // Fallback: Any available main course
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
 * Process auto-order for a single subscription and meal window
 * @param {Object} subscription - Subscription with populated user
 * @param {Date} date - Date for the order
 * @param {string} mealWindow - LUNCH or DINNER
 * @param {boolean} dryRun - If true, don't actually create orders
 * @returns {Promise<Object>} Result { success, orderId, error }
 */
export async function processAutoOrder(subscription, date, mealWindow, dryRun = false) {
    const userId = subscription.userId;

    try {
        // Check if slot is skipped
        if (isSlotSkipped(subscription, date, mealWindow)) {
            return { success: false, skipped: true, reason: "Slot is skipped" };
        }

        // Check if subscription is paused
        if (subscription.isPaused) {
            if (!subscription.pausedUntil || subscription.pausedUntil > date) {
                return { success: false, skipped: true, reason: "Subscription is paused" };
            }
        }

        // Check voucher availability
        const availableVouchers = await Voucher.countDocuments({
            userId,
            status: { $in: ["AVAILABLE", "RESTORED"] },
            expiryDate: { $gt: new Date() },
        });

        if (availableVouchers < 1) {
            return { success: false, error: "No vouchers available" };
        }

        // Get kitchen
        const kitchen = await getDefaultKitchen(subscription, userId);
        if (!kitchen) {
            return { success: false, error: "No default kitchen found" };
        }

        // Get address
        const address = await getDefaultAddress(subscription, userId);
        if (!address) {
            return { success: false, error: "No default address found" };
        }

        // Check if kitchen serves the address zone
        if (!kitchen.zonesServed.some((z) => z.toString() === address.zoneId?.toString())) {
            return { success: false, error: "Kitchen does not serve address zone" };
        }

        // Get menu item
        const menuItem = await getDefaultMenuItem(kitchen._id, mealWindow);
        if (!menuItem) {
            return { success: false, error: "No menu item available" };
        }

        if (dryRun) {
            return {
                success: true,
                dryRun: true,
                kitchen: kitchen.name,
                menuItem: menuItem.name,
                address: address.addressLine1,
            };
        }

        // Redeem voucher
        const voucherResult = await redeemVouchersWithTransaction(
            userId,
            1,
            mealWindow,
            null, // Will be updated after order creation
            kitchen._id
        );

        if (!voucherResult.success) {
            return { success: false, error: voucherResult.error };
        }

        // Create order
        const orderNumber = Order.generateOrderNumber();
        const order = new Order({
            orderNumber,
            userId,
            kitchenId: kitchen._id,
            zoneId: address.zoneId,
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
                deliveryFee: 0, // Auto-orders typically have no additional fees
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
            paymentMethod: "VOUCHER",
            status: "PLACED",
            statusTimeline: [
                {
                    status: "PLACED",
                    timestamp: new Date(),
                    notes: "Auto-ordered by system",
                },
            ],
            specialInstructions: "Auto-order",
            placedAt: new Date(),
            isAutoOrder: true,
        });

        await order.save();

        console.log(`> Auto-order created: ${orderNumber} for user ${userId}`);

        return {
            success: true,
            orderId: order._id,
            orderNumber: order.orderNumber,
        };
    } catch (error) {
        console.error(`> Auto-order error for subscription ${subscription._id}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Get eligible subscriptions for auto-ordering
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

export default {
    processAutoOrder,
    getEligibleSubscriptions,
};
