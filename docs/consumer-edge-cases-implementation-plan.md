# Consumer Edge Cases Implementation Plan

This document outlines the critical gaps and edge cases that need to be addressed before consumer app integration.

---

## CRITICAL PRIORITY (Must Fix Before Integration)

### 1. Idempotency for Order Creation

**Problem:** No protection against duplicate orders from network retries or double-taps.

**Solution:**
```
- Add idempotencyKey field to Order schema
- Client generates UUID and sends with order request
- Server checks for existing order with same idempotencyKey within 24 hours
- If found, return existing order instead of creating new one
- Index idempotencyKey field for fast lookup
```

**Files to Modify:**
- src/schemas/order.schema.js - Add idempotencyKey field
- src/order/order.validation.js - Add idempotencyKey to createOrderSchema
- src/order/order.controller.js - Check idempotency before creation

**Implementation:**
```javascript
// In order.schema.js
idempotencyKey: {
  type: String,
  index: true,
  sparse: true
}

// In order.controller.js createOrder()
if (idempotencyKey) {
  const existingOrder = await Order.findOne({
    userId: req.user._id,
    idempotencyKey,
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });
  if (existingOrder) {
    return sendResponse(res, 200, "Order already exists", { order: existingOrder });
  }
}
```

---

### 2. Cutoff Time Persistence and Configuration

**Problem:** Cutoff times are in-memory and lost on server restart. Hardcoded to IST.

**Solution:**
```
- Create SystemConfig model to persist cutoff times
- Load cutoff times from DB on server start
- Add timezone field to Zone schema
- Calculate cutoff based on zone timezone
- Cache cutoff config with TTL refresh
```

**Files to Create:**
- src/schemas/systemConfig.schema.js

**Files to Modify:**
- src/schemas/zone.schema.js - Add timezone field
- src/voucher/voucher.controller.js - Load from DB, check zone timezone
- src/order/order.controller.js - Use zone-aware cutoff check

**Implementation:**
```javascript
// systemConfig.schema.js
const SystemConfigSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" }
});

// Keys: "cutoffTimes", "fees", "batching", etc.

// zone.schema.js - Add:
timezone: {
  type: String,
  default: "Asia/Kolkata"
}

// Helper function
function isCutoffPassed(mealWindow, zoneTimezone) {
  const now = moment().tz(zoneTimezone);
  const cutoffTime = getCutoffTime(mealWindow); // From DB
  const [hours, minutes] = cutoffTime.split(':');
  const cutoff = now.clone().set({ hour: hours, minute: minutes, second: 0 });
  return now.isAfter(cutoff);
}
```

---

### 3. Concurrent Voucher Redemption Protection

**Problem:** Race condition if same user places multiple orders simultaneously depleting vouchers.

**Solution:**
```
- Add user-level mutex/lock during voucher redemption
- Use Redis distributed lock (or MongoDB findOneAndUpdate with version)
- Implement optimistic locking with retry
- Add version field to vouchers for optimistic concurrency
```

**Files to Modify:**
- src/schemas/voucher.schema.js - Add version field
- src/voucher/voucher.controller.js - Use optimistic locking
- src/order/order.controller.js - Handle concurrent redemption failures

**Implementation:**
```javascript
// voucher.schema.js
__v: { type: Number, select: false } // Already exists via Mongoose

// voucher.controller.js redeemVouchers()
// Use transactions for atomic voucher redemption
const session = await mongoose.startSession();
session.startTransaction();

try {
  const vouchers = await Voucher.find({
    userId,
    status: { $in: ["AVAILABLE", "RESTORED"] },
    expiryDate: { $gt: new Date() },
    $or: [{ mealType: mealWindow }, { mealType: "ANY" }]
  })
    .sort({ expiryDate: 1 })
    .limit(count)
    .session(session);

  if (vouchers.length < count) {
    await session.abortTransaction();
    return { success: false, error: "Insufficient vouchers" };
  }

  // Update all vouchers atomically
  const voucherIds = vouchers.map(v => v._id);
  const result = await Voucher.updateMany(
    { _id: { $in: voucherIds }, status: { $in: ["AVAILABLE", "RESTORED"] } },
    { $set: { status: "REDEEMED", redeemedAt: new Date(), orderId } },
    { session }
  );

  if (result.modifiedCount !== count) {
    await session.abortTransaction();
    return { success: false, error: "Voucher state changed" };
  }

  await session.commitTransaction();
  return { success: true, vouchers };
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

---

### 4. Order Cancellation Time Window

**Problem:** No time-based cancellation restrictions. Customer can cancel anytime before delivery.

**Solution:**
```
- Add cancellation window config (e.g., 30 minutes after order)
- Add cancellation deadline for meal orders (e.g., 1 hour before cutoff)
- Return clear error message with deadline time
- Store cancellation policy in order snapshot
```

**Files to Modify:**
- src/order/order.controller.js - Add time-based checks
- src/schemas/systemConfig.schema.js - Add cancellation config

**Implementation:**
```javascript
// In customerCancelOrder()
const cancellationConfig = await getSystemConfig("cancellation");
const orderAge = Date.now() - order.createdAt.getTime();
const maxCancellationWindow = cancellationConfig.maxMinutesAfterOrder * 60 * 1000;

if (orderAge > maxCancellationWindow) {
  return sendResponse(res, 400, "Cancellation window expired", null,
    `Orders can only be cancelled within ${cancellationConfig.maxMinutesAfterOrder} minutes of placing`
  );
}

// For MEAL_MENU orders, also check meal cutoff
if (order.menuType === "MEAL_MENU") {
  const mealCutoff = getMealCutoff(order.mealWindow, order.address.zone.timezone);
  const cancellationDeadline = mealCutoff - (cancellationConfig.hoursBeforeMealCutoff * 60 * 60 * 1000);

  if (Date.now() > cancellationDeadline) {
    return sendResponse(res, 400, "Too late to cancel", null,
      "Meal orders cannot be cancelled within 1 hour of meal cutoff"
    );
  }
}
```

---

### 5. Cancellation Fee Logic

**Problem:** No cancellation fee deduction for late cancellations.

**Solution:**
```
- Define cancellation fee tiers based on timing
- Deduct fee from refund amount
- Track cancellation fee in order
- Allow configurable fee structure
```

**Files to Modify:**
- src/schemas/order.schema.js - Add cancellationFee field
- src/order/order.controller.js - Calculate and apply fee

**Implementation:**
```javascript
// order.schema.js - Add to cancellation object
cancellation: {
  cancelledAt: Date,
  cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
  reason: String,
  type: { type: String, enum: ["CUSTOMER", "KITCHEN", "ADMIN", "SYSTEM"] },
  fee: { type: Number, default: 0 },
  feeReason: String
}

// Cancellation fee tiers (from config)
// 0-15 mins: 0%
// 15-30 mins: 10%
// 30+ mins: 25%
// After kitchen accepts: 50%

function calculateCancellationFee(order, config) {
  const orderAge = Date.now() - order.createdAt.getTime();
  const minutes = orderAge / (60 * 1000);

  let feePercent = 0;
  let feeReason = "No fee - cancelled within grace period";

  if (order.status === "ACCEPTED" || order.status === "PREPARING") {
    feePercent = config.afterAcceptedPercent || 50;
    feeReason = "Late cancellation - order already accepted";
  } else if (minutes > 30) {
    feePercent = config.after30MinPercent || 25;
    feeReason = "Cancellation after 30 minutes";
  } else if (minutes > 15) {
    feePercent = config.after15MinPercent || 10;
    feeReason = "Cancellation after 15 minutes";
  }

  const fee = Math.round(order.pricing.total * feePercent / 100);
  return { fee, feeReason, refundAmount: order.pricing.total - fee };
}
```

---

### 6. Payment Status Validation Before Order Placement

**Problem:** Orders marked as PAID without actual payment verification.

**Solution:**
```
- For non-voucher orders, require payment completion before order creation
- Add payment gateway callback/webhook handling
- Store payment transaction ID with order
- Add PAYMENT_PENDING status for orders awaiting payment
```

**Files to Modify:**
- src/schemas/order.schema.js - Add payment transaction fields
- src/order/order.controller.js - Validate payment before finalizing

**Implementation:**
```javascript
// order.schema.js - Enhance payment object
payment: {
  status: {
    type: String,
    enum: ["PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"],
    default: "PENDING"
  },
  method: String,
  transactionId: String,
  gatewayOrderId: String,
  paidAt: Date,
  paidAmount: Number,
  gatewayResponse: Schema.Types.Mixed
}

// New endpoint: POST /api/orders/initiate
// Returns gateway order ID for payment
// After payment callback, order status changes from PAYMENT_PENDING to PLACED

// order.controller.js - Two-phase order creation
exports.initiateOrder = async (req, res) => {
  // Validate cart, calculate pricing, reserve vouchers (if any)
  // Create order with status: "PAYMENT_PENDING"
  // Return payment gateway details
};

exports.confirmPayment = async (req, res) => {
  // Called by payment gateway webhook
  // Verify payment signature
  // Update order status to "PLACED"
  // Notify kitchen
};
```

---

### 7. Voucher Restoration on Failed Payment

**Problem:** If vouchers are redeemed but payment fails, vouchers are not restored.

**Solution:**
```
- Use reservation pattern - mark vouchers as RESERVED during payment
- Only change to REDEEMED after payment confirmation
- Auto-restore RESERVED vouchers after timeout (e.g., 10 minutes)
- Add scheduled job to cleanup stale reservations
```

**Files to Modify:**
- src/schemas/voucher.schema.js - Add RESERVED status
- src/voucher/voucher.controller.js - Add reservation logic
- src/cron/jobs.js - Add cleanup job

**Implementation:**
```javascript
// voucher.schema.js - Update status enum
status: {
  type: String,
  enum: ["AVAILABLE", "RESERVED", "REDEEMED", "EXPIRED", "RESTORED", "CANCELLED"],
  default: "AVAILABLE"
}

reservedAt: Date,
reservationExpiresAt: Date,
reservationOrderId: { type: Schema.Types.ObjectId, ref: "Order" }

// voucher.controller.js
exports.reserveVouchers = async (userId, count, mealWindow, orderId) => {
  // Mark vouchers as RESERVED with 10-minute expiry
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  // ... similar to redeem but with RESERVED status
};

exports.confirmVoucherRedemption = async (orderId) => {
  // Change RESERVED to REDEEMED for given order
};

exports.releaseReservedVouchers = async (orderId) => {
  // Change RESERVED back to AVAILABLE
};

// Cron job - every 5 minutes
exports.cleanupExpiredReservations = async () => {
  await Voucher.updateMany(
    { status: "RESERVED", reservationExpiresAt: { $lt: new Date() } },
    { $set: { status: "AVAILABLE" }, $unset: { reservedAt: 1, reservationExpiresAt: 1, reservationOrderId: 1 } }
  );
};
```

---

## HIGH PRIORITY (Should Fix Before Launch)

### 8. Address Serviceability Cache and Validation

**Problem:** Zone status checked on order but could be stale. No coordinate validation.

**Solution:**
```
- Cache zone serviceability with short TTL (5 minutes)
- Validate coordinates are within zone polygon
- Re-check serviceability at order creation time
- Add pincode format validation
```

**Files to Create:**
- utils/cache.utils.js - Simple in-memory cache with TTL

**Files to Modify:**
- src/address/address.controller.js - Add coordinate validation
- src/order/order.controller.js - Re-validate at order time

---

### 9. Order Status Transition Validation

**Problem:** No strict state machine for order status transitions.

**Solution:**
```
- Define valid status transitions
- Reject invalid transitions with clear error
- Log all status changes
```

**Implementation:**
```javascript
const VALID_TRANSITIONS = {
  "PLACED": ["ACCEPTED", "REJECTED", "CANCELLED"],
  "ACCEPTED": ["PREPARING", "CANCELLED"],
  "PREPARING": ["READY", "CANCELLED"],
  "READY": ["PICKED_UP", "CANCELLED"],
  "PICKED_UP": ["OUT_FOR_DELIVERY"],
  "OUT_FOR_DELIVERY": ["DELIVERED", "FAILED"],
  "DELIVERED": [], // Terminal
  "FAILED": [], // Terminal
  "REJECTED": [], // Terminal
  "CANCELLED": [] // Terminal
};

function canTransition(currentStatus, newStatus) {
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
}

// In status update controllers
if (!canTransition(order.status, newStatus)) {
  return sendResponse(res, 400, "Invalid status transition", null,
    `Cannot change from ${order.status} to ${newStatus}`
  );
}
```

---

### 10. Refund Processing Flow

**Problem:** Refunds created with PENDING status but no processing logic.

**Solution:**
```
- Add refund processing job
- Integrate with payment gateway refund API
- Handle partial refunds
- Track refund attempts and failures
```

**Files to Modify:**
- src/refund/refund.controller.js - Add processing logic
- src/cron/jobs.js - Add refund processing job

---

### 11. Duplicate Address Prevention

**Problem:** User can add identical addresses multiple times.

**Solution:**
```
- Hash address components for comparison
- Check for similar addresses before creating
- Suggest existing address if duplicate detected
```

**Implementation:**
```javascript
// address.controller.js
const addressHash = crypto.createHash('md5')
  .update(`${pincode}-${addressLine1.toLowerCase().trim()}`)
  .digest('hex');

const existing = await Address.findOne({
  userId: req.user._id,
  addressHash,
  status: { $ne: "DELETED" }
});

if (existing) {
  return sendResponse(res, 400, "Duplicate address", null,
    "This address already exists in your saved addresses"
  );
}
```

---

### 12. Rate Limiting

**Problem:** No rate limiting on sensitive endpoints.

**Solution:**
```
- Add rate limiting middleware
- Different limits for different endpoints
- Per-user and per-IP limits
```

**Files to Create:**
- middlewares/rateLimit.middleware.js

**Implementation:**
```javascript
// Using express-rate-limit or custom Redis-based limiter
const rateLimit = require('express-rate-limit');

const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 orders per minute per user
  keyGenerator: (req) => req.user?._id || req.ip,
  message: { message: "Too many orders", error: "Please wait before placing another order" }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: { message: "Too many attempts", error: "Please try again later" }
});

// Apply to routes
router.post('/orders', authMiddleware, orderLimiter, createOrder);
router.post('/auth/sync', authLimiter, syncUser);
```

---

## MEDIUM PRIORITY (Nice to Have Before Launch)

### 13. Order Notifications

**Problem:** FCM tokens collected but no push notification logic visible.

**Solution:**
```
- Create notification service
- Send notifications on order status changes
- Handle token invalidation
```

**Files to Create:**
- services/notification.service.js

---

### 14. Real-time Order Tracking

**Problem:** No WebSocket support for real-time updates.

**Solution:**
```
- Add Socket.io or similar
- Emit order status updates
- Support driver location updates
```

---

### 15. Structured Error Codes

**Problem:** Generic error messages, no error codes for client handling.

**Solution:**
```
- Define error code enum
- Return error codes with messages
- Document all error codes
```

**Implementation:**
```javascript
const ERROR_CODES = {
  VOUCHER_INSUFFICIENT: "E1001",
  CUTOFF_PASSED: "E1002",
  KITCHEN_UNAVAILABLE: "E1003",
  ADDRESS_NOT_SERVICEABLE: "E1004",
  ORDER_NOT_CANCELLABLE: "E1005",
  PAYMENT_FAILED: "E1006",
  // ... etc
};

// In controllers
return sendResponse(res, 400, "Cutoff time passed", null, {
  code: ERROR_CODES.CUTOFF_PASSED,
  message: "Cannot place meal order after cutoff",
  nextAvailableWindow: "DINNER"
});
```

---

### 16. Menu Item Stock/Availability

**Problem:** No stock tracking for menu items.

**Solution:**
```
- Add dailyStock field to menu items
- Decrement on order
- Auto-mark unavailable when stock depletes
- Reset stock daily
```

---

### 17. Partial Order Cancellation

**Problem:** Cannot cancel specific items from an order.

**Solution:**
```
- Add item-level cancellation
- Recalculate pricing on partial cancel
- Partial refund logic
```

---

### 18. Guest Checkout / Quick Order

**Problem:** Authentication required for all orders.

**Solution:**
```
- Allow guest orders with phone number
- Link to account if phone matches
- Limited features for guests
```

---

## IMPLEMENTATION ORDER

### Phase 1: Critical (Week 1-2)
1. Idempotency for order creation
2. Cutoff time persistence
3. Concurrent voucher protection
4. Cancellation time window
5. Cancellation fee logic

### Phase 2: Payment (Week 2-3)
6. Payment validation flow
7. Voucher reservation pattern
8. Refund processing flow

### Phase 3: Validation (Week 3-4)
9. Address serviceability improvements
10. Order status state machine
11. Duplicate address prevention
12. Rate limiting

### Phase 4: Enhancement (Week 4+)
13. Push notifications
14. Real-time tracking
15. Structured error codes
16. Menu stock management

---

## TESTING REQUIREMENTS

### Unit Tests Needed:
- Voucher redemption concurrency
- Cutoff time calculations across timezones
- Cancellation fee calculations
- Order status transitions
- Idempotency handling

### Integration Tests Needed:
- Full order flow (place -> accept -> deliver)
- Order cancellation at various stages
- Voucher redemption and restoration
- Refund creation and processing
- Payment timeout and recovery

### Load Tests Needed:
- Concurrent order placement
- Peak hour voucher redemption
- Rate limiter effectiveness

---

## DATABASE MIGRATIONS NEEDED

1. Add idempotencyKey index to orders collection
2. Add timezone field to zones collection
3. Create systemConfig collection with initial values
4. Add version index to vouchers for optimistic locking
5. Add RESERVED status to voucher status enum
6. Add cancellation fee fields to orders
7. Add addressHash to addresses collection

---

## CONFIG VALUES TO ADD

```javascript
// System configuration to persist in DB
{
  "cutoffTimes": {
    "BREAKFAST": "07:00",
    "LUNCH": "11:00",
    "DINNER": "21:00"
  },
  "cancellation": {
    "maxMinutesAfterOrder": 60,
    "hoursBeforeMealCutoff": 1,
    "gracePeriodMinutes": 15,
    "after15MinPercent": 10,
    "after30MinPercent": 25,
    "afterAcceptedPercent": 50
  },
  "voucher": {
    "reservationTimeoutMinutes": 10,
    "maxPerOrder": 10
  },
  "rateLimit": {
    "ordersPerMinute": 5,
    "authAttemptsPerHour": 20
  }
}
```

---

## NEXT STEPS

1. Review and approve this plan
2. Prioritize items based on launch timeline
3. Create tickets/tasks for each item
4. Implement Phase 1 items first
5. Create consumer API documentation after Phase 1 complete
