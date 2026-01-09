# Implementation Fixes Plan - Tiffsy Backend

## Overview

Review of schema, controller, and route files identifying edge cases missed, redundancy, and implementation gaps.

**SRS Reference:** docs/SRS v-1.1.md

---

## 0. SRS Alignment Summary

### Verified Aligned with SRS

- FR-AUTH-1 to FR-AUTH-6: Role-based auth (OTP + admin username/password) implemented correctly
- FR-MENU-TYPE-1 to FR-MENU-TYPE-4: Dual menu system (Meal Menu/On-Demand Menu) implemented
- FR-ORD-9: Vouchers blocked on On-Demand Menu (validation exists in order.validation.js)
- FR-ORD-10: Coupons allowed on On-Demand Menu only (validation exists)
- FR-VCH-2: Voucher 3-month expiry (voucherValidityDays defaults to 90)
- FR-VCH-6 to FR-VCH-8: Voucher redemption for main course only
- FR-SUB-1 to FR-SUB-2: Subscription plans 7/14/30/60 days with 2 vouchers/day
- FR-DLV-6 to FR-DLV-15: Auto-batching by zone/kitchen implemented
- FR-REF-1 to FR-REF-4: Refund system with voucher restoration
- FR-CAN-3 to FR-CAN-4: Voucher restoration on cancellation/rejection

### SRS Requirements Missing or Incomplete

**FR-GEO-5: One Partner Kitchen Per Zone**
- SRS: "each Zone has at most one listed Partner Kitchen at a time"
- Status: NOT ENFORCED in kitchen.controller.js
- Fix: Add validation in updateZonesServed() and createKitchen()

**FR-AUTH-7: Inactivity Timeout**
- SRS: "terminate authenticated sessions after a configurable inactivity timeout"
- Status: NOT IMPLEMENTED - JWT has no expiry validation
- Fix: Add configurable JWT expiry and token refresh logic

**FR-AUTH-8: Partner Kitchen Data Isolation**
- SRS: "prevent Partner Kitchen staff from accessing data belonging to other kitchens"
- Status: kitchenAccessMiddleware exists but not applied consistently
- Fix: Apply kitchenAccessMiddleware to all kitchen-specific routes

**FR-CUT-5: Timezone-Based Cutoff**
- SRS: "apply cutoff enforcement based on the timezone configured for the City/Zone"
- Status: Uses server timezone, not zone timezone
- Fix: Add zone.timezone field usage in cutoff calculation

**FR-CAN-6: Cancellation Notification**
- SRS: "notify the customer of cancellations and voucher restoration"
- Status: Notification service not integrated
- Fix: Add notification hooks (placeholder for future FCM integration)

**FR-DLV-9: Dispatch After Meal Window Only**
- SRS: "dispatch batches only after the meal time window ends"
- Status: dispatchBatches() has no meal window end time validation
- Fix: Add time check before allowing batch dispatch

**FR-CUT-1/FR-CUT-2: Default Cutoff Times**
- SRS: Lunch cutoff 11:00, Dinner cutoff 21:00
- Status: Verify defaults match SRS values
- Fix: Ensure CUTOFF_TIMES defaults to { lunch: "11:00", dinner: "21:00" }

**FR-VCH-9: Future Add-on Entitlement**
- SRS: "support a future rule configuration where a plan may include add-on entitlement per voucher"
- Status: subscriptionPlan.coverageRules.addonValuePerVoucher exists but unused
- Fix: Document as future feature, ensure schema supports it

---

## 1. Schema Issues

### 1.1 user.schema.js

**Issues:**
- No compound index for role-based queries with status
- `suspendedAt` field referenced in admin.controller.js but not defined in schema
- No validation that ADMIN users must have `username` and `passwordHash`

**Fixes:**
- Add `suspendedAt` field to schema
- Add pre-save validation for ADMIN role requiring username
- Add compound index `{ role: 1, status: 1 }`

### 1.2 voucher.schema.js

**Issues:**
- Schema uses `mealType` field with values `LUNCH/DINNER/ANY`
- Controller (order.controller.js:264) references `restrictions.mealWindows` which does not exist
- Status enum has `AVAILABLE` but some code checks for `ACTIVE`
- Missing `redemptionHistory` array referenced in restoreVouchers function

**Fixes:**
- Either add `restrictions.mealWindows` field or update controller to use `mealType`
- Standardize status checking to use `AVAILABLE` consistently
- Add `redemptionHistory` array field if needed for audit trail

### 1.3 order.schema.js

**Issues:**
- Missing validation that `menuType: ON_DEMAND_MENU` should have null `mealWindow`
- `rejectedAt` timestamp set but `rejectionReason` assignment happens before status update
- No index on `{ menuType: 1, status: 1 }` for filtered queries

**Fixes:**
- Add pre-save validation to null mealWindow for ON_DEMAND_MENU
- Add index `{ menuType: 1, status: 1 }`
- Add index `{ paymentStatus: 1 }` for refund queries

### 1.4 refund.schema.js

**Issues:**
- Controller uses fields not verified in schema: `refundNumber`, `initiatedBy`, `approvedBy`, `approvedAt`, `cancelledAt`, `cancellationReason`, `nextRetryAt`, `vouchersRestored`, `notes`
- Missing `refundGatewayId` field used in processRefund

**Fixes:**
- Verify schema has all fields used in controller
- Add missing fields if not present

### 1.5 deliveryAssignment.schema.js

**Issues:**
- Controller calls methods `generateOtp()`, `verifyOtp()`, `updateStatus()` - need verification these exist
- `proofOfDelivery` nested structure may not match controller expectations

**Fixes:**
- Verify instance methods exist on schema
- Align proofOfDelivery structure between schema and controller

### 1.6 subscription.schema.js

**Issues:**
- Missing `PAUSED` status handling in controllers
- No validation preventing multiple active subscriptions for same plan

**Fixes:**
- Add unique compound index `{ userId: 1, planId: 1, status: 1 }` with partial filter for ACTIVE
- Or add pre-save validation

---

## 2. Controller Edge Cases

### 2.1 order.controller.js

**Missing Edge Cases:**

**2.1.1 Race Condition on Voucher Redemption**
- Location: createOrder() lines 440-446
- Issue: Multiple concurrent orders can redeem same vouchers
- Fix: Use MongoDB transactions or atomic operations with `$inc` and `$cond`

**2.1.2 Empty Items After Validation**
- Location: createOrder() line 424
- Issue: No check if all items failed validation leaving empty array
- Fix: Add check `validatedItems.length === 0`

**2.1.3 Minimum Order Value**
- Location: createOrder()
- Issue: No minimum order value enforcement
- Fix: Add config-driven minimum order check

**2.1.4 Kitchen Operating Hours**
- Location: createOrder() lines 403-420
- Issue: No check if kitchen is within operating hours
- Fix: Add operating hours validation from kitchen schema

**2.1.5 Cutoff Time Timezone**
- Location: isCutoffPassed() lines 44-50
- Issue: Uses local server timezone, not user timezone
- Fix: Store timezone in zone or use UTC with offset

**2.1.6 Coupon Already Used Check**
- Location: createOrder() lines 450-470
- Issue: No check if user already used single-use coupon
- Fix: Add user usage tracking on coupon application

**2.1.7 Customer Self-Cancellation Missing**
- Issue: No endpoint for customer to cancel their own order
- Fix: Add customer cancel route with time window restriction

### 2.2 delivery.controller.js

**Missing Edge Cases:**

**2.2.1 Batch.isNew Check**
- Location: autoBatchOrders() line 260
- Issue: `batch.isNew` is false after save, always shows updated
- Fix: Track new batch creation separately before save

**2.2.2 Driver Already Has Active Batch**
- Location: acceptBatch()
- Issue: No check if driver already has an active batch
- Fix: Add validation before batch assignment

**2.2.3 Batch Order Removal**
- Issue: No endpoint to remove single order from batch
- Fix: Add removeOrderFromBatch admin endpoint

**2.2.4 Stale Batch Detection**
- Issue: Batches can become stale if orders are cancelled after batching
- Fix: Add periodic batch refresh/validation

### 2.3 refund.controller.js

**Missing Edge Cases:**

**2.3.1 Concurrent Refund Initiation**
- Location: initiateRefund() line 168
- Issue: Race condition between check and create
- Fix: Use findOneAndUpdate with upsert or add unique index on `{ orderId: 1, status: { $in: pending_statuses } }`

**2.3.2 Partial Refund Total Exceeds Paid**
- Location: initiateRefund() line 186
- Issue: Multiple partial refunds could exceed total paid
- Fix: Lock check with transaction

**2.3.3 Voucher Double Restoration**
- Location: initiateRefund() lines 192, 228
- Issue: Vouchers restored twice - once for voucher-only orders, again for regular orders
- Fix: Consolidate restoration logic

### 2.4 subscription.controller.js

**Missing Edge Cases:**

**2.4.1 Duplicate Active Subscription**
- Issue: User can purchase same plan multiple times while active
- Fix: Check for existing active subscription to same plan

**2.4.2 Voucher Issuance Failure Handling**
- Issue: If voucher issuance fails after payment, subscription is in bad state
- Fix: Use transaction, rollback subscription on voucher failure

**2.4.3 Plan Price Changed During Checkout**
- Issue: Plan price could change between view and purchase
- Fix: Pass expected price in request, validate matches

### 2.5 voucher.controller.js

**Missing Edge Cases:**

**2.5.1 Voucher Mealtype vs MealWindow Mismatch**
- Location: redeemVouchers()
- Issue: Schema has `mealType`, query uses `restrictions.mealWindows`
- Fix: Align schema field name with controller usage

**2.5.2 Already Redeemed Check in Same Transaction**
- Issue: Check and redeem not atomic
- Fix: Use findOneAndUpdate with status condition

### 2.6 admin.controller.js

**Missing Edge Cases:**

**2.6.1 In-Memory Config Loss**
- Location: SYSTEM_CONFIG and GUIDELINES variables
- Issue: Config lost on server restart
- Fix: Store in database or config collection

**2.6.2 Admin Self-Deletion**
- Issue: Admin can delete their own account
- Fix: Add check to prevent self-deletion

**2.6.3 Last Admin Protection**
- Issue: Can delete/deactivate last admin
- Fix: Check admin count before deactivation/deletion

---

## 3. Validation Issues

### 3.1 Missing Validations

**3.1.1 Duplicate Items in Order**
- Location: order.validation.js createOrderSchema
- Issue: Same menuItemId can appear multiple times
- Fix: Add `.unique()` validation or merge quantities in controller

**3.1.2 Date Range Validation**
- Location: Multiple query schemas
- Issue: dateTo can be before dateFrom
- Fix: Add `.greater(Joi.ref('dateFrom'))` on dateTo fields

**3.1.3 Password Complexity**
- Location: admin.validation.js resetPasswordSchema
- Issue: Only min length, no complexity requirements
- Fix: Add pattern for uppercase, lowercase, number, special char

**3.1.4 Coordinates Validation**
- Location: address.validation.js, kitchen.validation.js
- Issue: Both lat/long should be required together or neither
- Fix: Add `.and('latitude', 'longitude')` validation

### 3.2 Inconsistent Validations

**3.2.1 Phone Number Format**
- Issue: Different patterns across files
  - user.schema.js: `/^\+?[0-9]{10,15}$/`
  - admin.validation.js: `/^[6-9]\d{9}$/`
- Fix: Create shared phone validation pattern

**3.2.2 ObjectId Length**
- Issue: Some use `.length(24)`, some don't validate length
- Fix: Standardize ObjectId validation

---

## 4. Route Issues

### 4.1 Inconsistent Imports

**Issue:**
- auth.routes.js: `../middlewares/auth.middleware.js`
- order.routes.js: `../middleware/auth.middleware.js`

**Fix:**
- Standardize to single middleware folder path
- Update all route imports

### 4.2 Missing Routes

**4.2.1 Customer Order Cancellation**
- Location: order.routes.js
- Issue: No customer-facing cancel route
- Fix: Add `POST /:id/customer-cancel` with customer role

**4.2.2 Customer Request Refund**
- Location: refund.routes.js
- Issue: No customer-facing refund request
- Fix: Add `POST /request` for customer refund requests

**4.2.3 Driver Reject Batch**
- Location: delivery.routes.js
- Issue: Driver cannot reject/return a batch
- Fix: Add `POST /batches/:batchId/reject`

### 4.3 Authorization Gaps

**4.3.1 Refund Initiate**
- Location: refund.routes.js line 27-32
- Issue: Only authMiddleware, no role check
- Fix: Add internal middleware or role restriction

**4.3.2 Coupon Apply**
- Location: coupon.routes.js line 49-54
- Issue: Any authenticated user can apply coupons
- Fix: Add CUSTOMER role restriction

---

## 5. Security Issues

### 5.1 Timing Attack on API Keys

**Location:** middlewares/auth.middleware.js lines 151, 184

**Issue:** Direct string comparison vulnerable to timing attacks

**Fix:**
```javascript
const crypto = require('crypto');
const isEqual = crypto.timingSafeEqual(
  Buffer.from(internalKey),
  Buffer.from(expectedKey)
);
```

### 5.2 Missing Rate Limiting

**Issue:** No rate limiting on sensitive endpoints

**Affected Routes:**
- POST /api/auth/admin/login
- POST /api/refunds/initiate
- POST /api/orders

**Fix:** Add express-rate-limit middleware to sensitive routes

### 5.3 ObjectId Injection

**Issue:** Hex validation allows injection of valid-looking but malformed IDs

**Fix:** Add explicit ObjectId validation in controller:
```javascript
if (!mongoose.Types.ObjectId.isValid(id)) {
  return sendResponse(res, 400, false, "Invalid ID format");
}
```

---

## 6. Redundancy

### 6.1 Duplicate Functions

**6.1.1 restoreVouchers**
- Locations: order.controller.js:298, refund.controller.js:90
- Fix: Extract to shared voucher.service.js

**6.1.2 getStatusDisplay**
- Locations: order.controller.js:715, refund.controller.js:123
- Fix: Extract to shared utils/status.utils.js

**6.1.3 calculateRefundableAmount**
- Duplicated logic in refund controller and potentially order controller
- Fix: Single source in refund.service.js

### 6.2 Repeated Patterns

**6.2.1 Pagination Logic**
```javascript
const skip = (page - 1) * limit;
// ... query ...
pagination: {
  page: parseInt(page),
  limit: parseInt(limit),
  total,
  pages: Math.ceil(total / limit),
}
```

**Fix:** Create pagination utility:
```javascript
// utils/pagination.utils.js
export function getPagination(page, limit, total) { ... }
export function getSkip(page, limit) { ... }
```

**6.2.2 Audit Log Creation**
- Repeated pattern across admin, delivery, refund controllers
- Fix: Create audit.service.js with standardized logging

### 6.3 Similar Query Patterns

**Issue:** Kitchen/Zone status checking repeated in multiple controllers

**Fix:** Create service layer:
- kitchen.service.js: validateKitchenActive(), checkKitchenServesZone()
- zone.service.js: validateZoneServiceable()

---

## 7. Missing Features

### 7.1 Soft Delete Consistency

**Issue:** Some entities use `isDeleted` flag, some use status `DELETED`

**Affected:**
- User: status DELETED
- CustomerAddress: isDeleted flag
- Kitchen: no soft delete
- MenuItem: status DELETED

**Fix:** Standardize approach across all entities

### 7.2 Audit Trail Gaps

**Missing Audit Logs:**
- Voucher redemption/restoration
- Order status changes by kitchen
- Subscription purchases
- Customer address changes

**Fix:** Add AuditLog.create() calls to these operations

### 7.3 Webhook/Notification Hooks

**Issue:** No notification triggers for key events

**Missing:**
- Order status change notifications
- Refund completion notification
- Subscription expiry warning

**Fix:** Add notification service integration points

---

## 8. Implementation Priority

### Phase 1 - Critical (Security/Data Integrity)
1. Fix voucher race condition (2.1.1)
2. Fix timing attack vulnerability (5.1)
3. Add concurrent refund protection (2.3.1)
4. Align voucher schema with controller (1.2)
5. Add missing schema fields for refund (1.4)
6. FR-GEO-5: Enforce one partner kitchen per zone
7. FR-AUTH-8: Apply kitchenAccessMiddleware consistently

### Phase 2 - High (Functional Gaps / SRS Compliance)
1. Add customer order cancellation (4.2.1)
2. Fix batch.isNew tracking (2.2.1)
3. Add duplicate subscription check (2.4.1)
4. FR-DLV-9: Add meal window end time check before dispatch
5. FR-CUT-5: Implement timezone-aware cutoff calculation
6. Standardize middleware imports (4.1)
7. Add authorization to refund initiate route (4.3.1)

### Phase 3 - Medium (Code Quality / SRS Defaults)
1. Extract shared services (voucher.service.js, audit.service.js)
2. Create pagination utility (6.2.1)
3. Standardize status display functions (6.1.2)
4. Add missing indexes (1.3)
5. FR-CUT-1/FR-CUT-2: Verify cutoff defaults (11:00/21:00)
6. FR-AUTH-7: Add JWT expiry configuration

### Phase 4 - Low (Enhancements / Future SRS)
1. Persist system config to database (2.6.1)
2. Add comprehensive audit logging (7.2)
3. Add rate limiting (5.2)
4. Standardize soft delete approach (7.1)
5. FR-CAN-6: Add notification hooks (placeholder)
6. FR-VCH-9: Document add-on entitlement as future feature

---

## 9. File Change Summary

### Schema Changes
- schema/user.schema.js - Add suspendedAt, indexes
- schema/voucher.schema.js - Add restrictions or fix mealType usage
- schema/order.schema.js - Add indexes
- schema/refund.schema.js - Add missing fields

### Controller Changes
- src/order/order.controller.js - Fix race conditions, add validations
- src/delivery/delivery.controller.js - Fix batch tracking
- src/refund/refund.controller.js - Fix concurrent issues
- src/voucher/voucher.controller.js - Fix mealType query
- src/admin/admin.controller.js - Persist config to DB

### Route Changes
- src/order/order.routes.js - Add customer cancel
- src/refund/refund.routes.js - Add authorization
- src/coupon/coupon.routes.js - Add role check

### New Files
- utils/pagination.utils.js
- utils/status.utils.js
- services/voucher.service.js
- services/audit.service.js

### Validation Changes
- All validation files - Add date range validation
- admin.validation.js - Add password complexity

### Middleware Changes
- middlewares/auth.middleware.js - Fix timing attack

---

## 10. Testing Checklist

After implementing fixes, verify:

### Data Integrity Tests
- [ ] Concurrent order placement with same vouchers
- [ ] Concurrent refund requests for same order
- [ ] Partial refund exceeding paid amount
- [ ] Duplicate subscription purchase attempt
- [ ] Invalid ObjectId handling

### Order Flow Tests
- [ ] Order cancellation within allowed window
- [ ] Order cancellation outside allowed window
- [ ] Voucher redemption at cutoff boundary (11:00/21:00)
- [ ] Voucher redemption after cutoff - should fail
- [ ] On-Demand order with voucher - should fail (FR-ORD-9)
- [ ] Meal Menu order with coupon - should fail
- [ ] On-Demand order with coupon - should succeed (FR-ORD-10)

### Delivery/Batch Tests
- [ ] Batch assignment with driver already having batch
- [ ] Batch dispatch before meal window ends - should fail (FR-DLV-9)
- [ ] Batch dispatch after meal window ends - should succeed
- [ ] Cross-zone batching attempt - should fail (FR-DLV-14)

### Authorization Tests
- [ ] Partner kitchen staff accessing other kitchen data - should fail (FR-AUTH-8)
- [ ] Second partner kitchen in same zone - should fail (FR-GEO-5)
- [ ] Admin self-deletion attempt
- [ ] Last admin deactivation attempt

### Validation Tests
- [ ] Date range query with invalid range (dateTo before dateFrom)
- [ ] Cutoff time in correct timezone (FR-CUT-5)
- [ ] Default cutoff times match SRS (11:00 lunch, 21:00 dinner)

### SRS Compliance Verification
- [ ] Voucher expiry is 90 days from purchase (FR-VCH-2)
- [ ] Subscription plans support 7/14/30/60 days (FR-SUB-1)
- [ ] 2 vouchers issued per day by default (FR-SUB-2)
- [ ] Voucher restoration on order rejection (FR-CAN-4)
- [ ] Voucher restoration on order cancellation (FR-CAN-3)
