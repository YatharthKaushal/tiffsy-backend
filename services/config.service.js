import SystemConfig from "../schema/systemConfig.schema.js";

/**
 * Config Service
 * Manages system configuration with in-memory caching
 * Loads config from DB on init and provides helper functions
 */

// In-memory cache for configs
let configCache = {
  cutoffTimes: {
    LUNCH: "11:00",
    DINNER: "21:00",
  },
  cancellation: {
    nonVoucherWindowMinutes: 10,
    allowAfterAccepted: false,
    feeTiers: {
      within5Min: 0,
      within10Min: 0,
      after10Min: 0,
    },
  },
  fees: {
    deliveryFee: 30,
    serviceFee: 5,
    packagingFee: 10,
    handlingFee: 0,
    taxRate: 0.05,
  },
};

let cacheLoaded = false;

/**
 * Initialize config cache from database
 * Should be called on server startup after DB connection
 * @returns {Promise<void>}
 */
export async function initializeConfigCache() {
  try {
    // Initialize default configs if not exists
    await SystemConfig.initializeDefaults();

    // Load all configs from DB
    const configs = await SystemConfig.getAllConfigs();
    configCache = { ...configCache, ...configs };
    cacheLoaded = true;
    console.log("> ConfigService: Config cache initialized from database");
  } catch (error) {
    console.log("> ConfigService: Failed to initialize config cache:", error.message);
  }
}

/**
 * Get config value by key
 * @param {string} key - Config key (cutoffTimes, cancellation, fees, etc.)
 * @returns {any} Config value
 */
export function getConfig(key) {
  return configCache[key] || null;
}

/**
 * Update config value (persists to DB and updates cache)
 * @param {string} key - Config key
 * @param {any} value - New value
 * @param {ObjectId} updatedBy - User ID who made the change
 * @returns {Promise<Object>} Updated config
 */
export async function updateConfig(key, value, updatedBy) {
  const config = await SystemConfig.setValue(key, value, updatedBy);
  configCache[key] = value;
  console.log(`> ConfigService: Updated ${key} config`);
  return config;
}

/**
 * Get cutoff times configuration
 * @returns {Object} { LUNCH: "HH:mm", DINNER: "HH:mm" }
 */
export function getCutoffTimes() {
  return configCache.cutoffTimes || { LUNCH: "11:00", DINNER: "21:00" };
}

/**
 * Get cancellation configuration
 * @returns {Object} Cancellation config
 */
export function getCancellationConfig() {
  return configCache.cancellation || {
    nonVoucherWindowMinutes: 10,
    allowAfterAccepted: false,
  };
}

/**
 * Get fees configuration
 * @returns {Object} Fees config
 */
export function getFeesConfig() {
  return configCache.fees || {
    deliveryFee: 30,
    serviceFee: 5,
    packagingFee: 10,
    handlingFee: 0,
    taxRate: 0.05,
  };
}

/**
 * Check if cutoff time has passed for a meal window
 * All times are in IST (Asia/Kolkata)
 * @param {string} mealWindow - LUNCH or DINNER
 * @returns {Object} { isPastCutoff, cutoffTime, currentTime, message }
 */
export function checkCutoffTime(mealWindow) {
  const cutoffTimes = getCutoffTimes();
  const cutoffTime = cutoffTimes[mealWindow];

  if (!cutoffTime) {
    return {
      isPastCutoff: true,
      cutoffTime: null,
      currentTime: null,
      message: `Invalid meal window: ${mealWindow}`,
    };
  }

  // Get current time in IST
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + istOffset);

  const [cutoffHour, cutoffMin] = cutoffTime.split(":").map(Number);
  const cutoffDate = new Date(istNow);
  cutoffDate.setHours(cutoffHour, cutoffMin, 0, 0);

  const isPastCutoff = istNow >= cutoffDate;
  const currentTimeStr = `${String(istNow.getHours()).padStart(2, "0")}:${String(istNow.getMinutes()).padStart(2, "0")}`;

  return {
    isPastCutoff,
    cutoffTime,
    currentTime: currentTimeStr,
    cutoffDate,
    message: isPastCutoff
      ? `${mealWindow} ordering closed. Cutoff was ${cutoffTime}.`
      : `${mealWindow} orders open until ${cutoffTime}`,
  };
}

/**
 * Get the current meal window based on time
 * @returns {Object} { currentWindow, nextWindow, cutoffInfo }
 */
export function getCurrentMealWindow() {
  const lunchCutoff = checkCutoffTime("LUNCH");
  const dinnerCutoff = checkCutoffTime("DINNER");

  if (!lunchCutoff.isPastCutoff) {
    return {
      currentWindow: "LUNCH",
      nextWindow: "DINNER",
      cutoffInfo: lunchCutoff,
    };
  } else if (!dinnerCutoff.isPastCutoff) {
    return {
      currentWindow: "DINNER",
      nextWindow: "TOMORROW_LUNCH",
      cutoffInfo: dinnerCutoff,
    };
  } else {
    return {
      currentWindow: null,
      nextWindow: "TOMORROW_LUNCH",
      cutoffInfo: {
        isPastCutoff: true,
        message: "All meal windows closed for today. Orders open tomorrow.",
      },
    };
  }
}

/**
 * Check if an order can be cancelled based on cancellation rules
 * @param {Object} order - Order document
 * @returns {Object} { canCancel, reason, shouldRestoreVouchers }
 */
export function checkCancellationEligibility(order) {
  const config = getCancellationConfig();
  const now = new Date();
  const orderAge = now - new Date(order.placedAt);
  const orderAgeMinutes = orderAge / (60 * 1000);

  // Check if order status allows cancellation
  const nonCancellableStatuses = [
    "PICKED_UP",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
    "FAILED",
    "REJECTED",
  ];

  if (nonCancellableStatuses.includes(order.status)) {
    return {
      canCancel: false,
      reason: `Order cannot be cancelled in ${order.status} status`,
      shouldRestoreVouchers: false,
    };
  }

  // Check if vouchers were used (meal menu order with vouchers)
  const hasVouchers = order.voucherUsage?.voucherCount > 0;

  if (hasVouchers) {
    // Voucher orders: Can cancel before meal window cutoff
    // Vouchers restored only if cancelled before cutoff
    const cutoffInfo = checkCutoffTime(order.mealWindow);

    if (cutoffInfo.isPastCutoff) {
      // After cutoff - can still cancel but vouchers NOT restored
      return {
        canCancel: true,
        reason: "Cancellation allowed but vouchers will not be restored (meal window closed)",
        shouldRestoreVouchers: false,
        warning: "Vouchers used for this order will NOT be restored as the meal window has closed.",
      };
    } else {
      // Before cutoff - can cancel and vouchers ARE restored
      return {
        canCancel: true,
        reason: "Cancellation allowed, vouchers will be restored",
        shouldRestoreVouchers: true,
      };
    }
  } else {
    // Non-voucher orders: Can cancel within configured time window
    const windowMinutes = config.nonVoucherWindowMinutes || 10;

    // If order is already accepted and allowAfterAccepted is false
    if (order.status === "ACCEPTED" && !config.allowAfterAccepted) {
      return {
        canCancel: false,
        reason: "Cannot cancel after kitchen has accepted the order",
        shouldRestoreVouchers: false,
      };
    }

    // If order is being prepared, cannot cancel
    if (order.status === "PREPARING") {
      return {
        canCancel: false,
        reason: "Cannot cancel order that is being prepared",
        shouldRestoreVouchers: false,
      };
    }

    // Check time window
    if (orderAgeMinutes > windowMinutes) {
      return {
        canCancel: false,
        reason: `Cancellation window of ${windowMinutes} minutes has passed`,
        shouldRestoreVouchers: false,
        orderAgeMinutes: Math.round(orderAgeMinutes),
        windowMinutes,
      };
    }

    return {
      canCancel: true,
      reason: "Cancellation allowed within time window",
      shouldRestoreVouchers: false, // No vouchers to restore
      remainingMinutes: Math.round(windowMinutes - orderAgeMinutes),
    };
  }
}

export default {
  initializeConfigCache,
  getConfig,
  updateConfig,
  getCutoffTimes,
  getCancellationConfig,
  getFeesConfig,
  checkCutoffTime,
  getCurrentMealWindow,
  checkCancellationEligibility,
};
