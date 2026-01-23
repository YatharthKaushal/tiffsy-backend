/**
 * Notification Templates Service
 * Centralized message templates for all notification types
 *
 * Template variables use {variableName} syntax
 * Call buildFromTemplate() to replace variables with actual values
 */

/**
 * Order status notification templates for customers
 */
export const ORDER_STATUS_TEMPLATES = {
  ACCEPTED: {
    title: "Order Confirmed!",
    body: "Your order #{orderNumber} has been accepted and is being prepared.",
  },
  PREPARING: {
    title: "Order Being Prepared",
    body: "Your order #{orderNumber} is now being prepared in the kitchen.",
  },
  READY: {
    title: "Order Ready!",
    body: "Your order #{orderNumber} is ready and will be picked up soon.",
  },
  PICKED_UP: {
    title: "Order Picked Up",
    body: "Your order #{orderNumber} has been picked up by the delivery partner.",
  },
  OUT_FOR_DELIVERY: {
    title: "On the Way!",
    body: "Your order #{orderNumber} is out for delivery. Get ready!",
  },
  DELIVERED: {
    title: "Order Delivered!",
    body: "Your order #{orderNumber} has been delivered. Enjoy your meal!",
  },
  CANCELLED: {
    title: "Order Cancelled",
    body: "Your order #{orderNumber} has been cancelled.{reason}",
  },
  REJECTED: {
    title: "Order Could Not Be Processed",
    body: "Sorry, your order #{orderNumber} could not be fulfilled.{reason}",
  },
  FAILED: {
    title: "Delivery Failed",
    body: "We couldn't deliver your order #{orderNumber}.{reason}",
  },
};

/**
 * Driver notification templates
 */
export const DRIVER_TEMPLATES = {
  BATCH_READY: {
    title: "New Batch Available!",
    body: "{orderCount} orders ready for pickup from {kitchenName}",
  },
  BATCH_ASSIGNED: {
    title: "Batch Assigned",
    body: "You have been assigned a batch with {orderCount} orders from {kitchenName}",
  },
  ORDER_READY_FOR_PICKUP: {
    title: "Orders Ready!",
    body: "{orderCount} order(s) ready for pickup at {kitchenName}",
  },
};

/**
 * Kitchen notification templates
 */
export const KITCHEN_TEMPLATES = {
  NEW_AUTO_ORDER: {
    title: "New Auto Order",
    body: "Auto order #{orderNumber} received for {mealWindow}",
  },
  NEW_MANUAL_ORDER: {
    title: "New Order Received!",
    body: "Order #{orderNumber} - {itemCount} item(s) for {mealWindow}",
  },
  NEW_AUTO_ACCEPTED_ORDER: {
    title: "Auto-Accepted Order #{orderNumber}",
    body: "Voucher order for {mealWindow} - {itemCount} item(s). Start preparation!",
  },
  BATCH_DISPATCHED: {
    title: "Batch Dispatched",
    body: "Batch with {orderCount} orders has been dispatched for delivery",
  },
};

/**
 * Voucher expiry notification templates
 */
export const VOUCHER_TEMPLATES = {
  EXPIRY_7_DAYS: {
    title: "Vouchers Expiring Soon!",
    body: "You have {count} voucher(s) expiring in 7 days. Use them before {expiryDate}!",
  },
  EXPIRY_3_DAYS: {
    title: "Vouchers Expiring Soon!",
    body: "Hurry! {count} voucher(s) will expire in 3 days. Order now!",
  },
  EXPIRY_1_DAY: {
    title: "Last Day for Vouchers!",
    body: "Your {count} voucher(s) expire tomorrow! Don't miss out!",
  },
  EXPIRY_TODAY: {
    title: "Vouchers Expire Today!",
    body: "Your {count} voucher(s) expire today! Use them now before midnight!",
  },
};

/**
 * Auto-order notification templates for customers
 */
export const AUTO_ORDER_TEMPLATES = {
  SUCCESS: {
    title: "Auto Order Placed!",
    body: "Your {mealWindow} order #{orderNumber} has been automatically placed from {kitchenName}.",
  },
  FAILED_NO_VOUCHERS: {
    title: "Auto Order Skipped",
    body: "Your {mealWindow} auto-order couldn't be placed - no vouchers available. Purchase more vouchers to continue auto-ordering.",
  },
  FAILED_NO_ADDRESS: {
    title: "Auto Order Skipped",
    body: "Your {mealWindow} auto-order couldn't be placed - please set a default delivery address in your profile.",
  },
  FAILED_NO_ZONE: {
    title: "Auto Order Skipped",
    body: "Your {mealWindow} auto-order couldn't be placed - your delivery area (pincode {pincode}) is not currently serviceable.",
  },
  FAILED_NO_KITCHEN: {
    title: "Auto Order Skipped",
    body: "Your {mealWindow} auto-order couldn't be placed - no kitchen is currently serving your area.",
  },
  FAILED_NO_MENU: {
    title: "Auto Order Skipped",
    body: "Your {mealWindow} auto-order couldn't be placed - no menu items available for this meal window.",
  },
  FAILED_GENERIC: {
    title: "Auto Order Failed",
    body: "Your {mealWindow} auto-order couldn't be placed. Please try ordering manually.",
  },
};

/**
 * Menu update notification templates
 */
export const MENU_TEMPLATES = {
  MENU_UPDATED: {
    title: "Menu Updated!",
    body: "Today's menu has been updated at {kitchenName}. Check it out!",
  },
  NEW_ITEM_ADDED: {
    title: "New Item Available!",
    body: "{itemName} is now available at {kitchenName}",
  },
  CUSTOM_ANNOUNCEMENT: {
    title: "{title}",
    body: "{message}",
  },
};

/**
 * Kitchen batch reminder templates
 */
export const BATCH_REMINDER_TEMPLATES = {
  CUTOFF_APPROACHING: {
    title: "Order Cutoff Approaching!",
    body: "{mealWindow} cutoff in {minutesRemaining} minutes. {pendingOrders} orders pending.",
  },
  PREPARE_ORDERS: {
    title: "Prepare {mealWindow} Orders",
    body: "You have {orderCount} orders to prepare before {cutoffTime}.",
  },
};

/**
 * Admin push notification templates (customizable)
 */
export const ADMIN_TEMPLATES = {
  PROMOTIONAL: {
    title: "{title}",
    body: "{body}",
  },
  ANNOUNCEMENT: {
    title: "{title}",
    body: "{body}",
  },
};

/**
 * Build notification content from template by replacing variables
 *
 * @param {Object} template - Template object with title and body
 * @param {Object} variables - Variables to replace (key-value pairs)
 * @returns {{title: string, body: string}} Processed notification content
 *
 * @example
 * const { title, body } = buildFromTemplate(ORDER_STATUS_TEMPLATES.ACCEPTED, {
 *   orderNumber: "ORD-123456"
 * });
 * // title: "Order Confirmed!"
 * // body: "Your order #ORD-123456 has been accepted and is being prepared."
 */
export function buildFromTemplate(template, variables = {}) {
  let title = template.title;
  let body = template.body;

  // Replace all variables in title and body
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    const replacement = value !== null && value !== undefined ? String(value) : "";
    title = title.split(placeholder).join(replacement);
    body = body.split(placeholder).join(replacement);
  }

  // Clean up any remaining unreplaced placeholders
  title = title.replace(/\{[^}]+\}/g, "").trim();
  body = body.replace(/\{[^}]+\}/g, "").trim();

  // Clean up double spaces
  title = title.replace(/\s+/g, " ").trim();
  body = body.replace(/\s+/g, " ").trim();

  return { title, body };
}

/**
 * Get order status template with common data transformations
 *
 * @param {string} status - Order status
 * @param {Object} order - Order document
 * @param {string} reason - Optional reason (for cancellation/rejection)
 * @returns {{title: string, body: string}|null} Notification content or null if no template
 */
export function getOrderStatusNotification(status, order, reason = "") {
  const template = ORDER_STATUS_TEMPLATES[status];
  if (!template) {
    return null;
  }

  const reasonText = reason ? ` ${reason}` : "";

  return buildFromTemplate(template, {
    orderNumber: order.orderNumber,
    reason: reasonText,
  });
}

/**
 * Get voucher expiry notification based on days until expiry
 *
 * @param {number} daysUntilExpiry - Days until voucher expires
 * @param {number} voucherCount - Number of expiring vouchers
 * @param {Date} expiryDate - Expiry date
 * @returns {{title: string, body: string}|null} Notification content or null
 */
export function getVoucherExpiryNotification(daysUntilExpiry, voucherCount, expiryDate) {
  let template = null;

  if (daysUntilExpiry <= 0) {
    template = VOUCHER_TEMPLATES.EXPIRY_TODAY;
  } else if (daysUntilExpiry <= 1) {
    template = VOUCHER_TEMPLATES.EXPIRY_1_DAY;
  } else if (daysUntilExpiry <= 3) {
    template = VOUCHER_TEMPLATES.EXPIRY_3_DAYS;
  } else if (daysUntilExpiry <= 7) {
    template = VOUCHER_TEMPLATES.EXPIRY_7_DAYS;
  }

  if (!template) {
    return null;
  }

  const formattedDate = expiryDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return buildFromTemplate(template, {
    count: voucherCount,
    expiryDate: formattedDate,
  });
}

export default {
  ORDER_STATUS_TEMPLATES,
  DRIVER_TEMPLATES,
  KITCHEN_TEMPLATES,
  VOUCHER_TEMPLATES,
  AUTO_ORDER_TEMPLATES,
  MENU_TEMPLATES,
  BATCH_REMINDER_TEMPLATES,
  ADMIN_TEMPLATES,
  buildFromTemplate,
  getOrderStatusNotification,
  getVoucherExpiryNotification,
};
