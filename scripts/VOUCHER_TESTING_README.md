# Voucher Expiry Testing Guide

Complete guide for testing the voucher expiry system end-to-end.

## 📋 Prerequisites

- Node.js installed
- MongoDB connection configured in `.env`
- Backend dependencies installed (`npm install`)

---

## 🚀 Quick Start (3 Steps)

### Step 1: Find User & Subscription IDs

```bash
# Option A: Search by phone number
node scripts/find-user-for-testing.js 9876543210

# Option B: Show first 5 users
node scripts/find-user-for-testing.js
```

**Output:**
- User ID (e.g., `507f1f77bcf86cd799439011`)
- Subscription ID (e.g., `507f1f77bcf86cd799439012`)
- Ready-to-use commands

### Step 2: Create Test Vouchers

```bash
node scripts/create-test-vouchers.js <userId> <subscriptionId>
```

**Example:**
```bash
node scripts/create-test-vouchers.js 507f1f77bcf86cd799439011 507f1f77bcf86cd799439012
```

**What it creates:**
- 10 test vouchers with different expiry dates:
  - 2 already expired (2 days ago, yesterday)
  - 1 expires today
  - 1 expires tomorrow
  - 1 expires in 3 days
  - 1 expires in 7 days
  - 1 expires in 14 days
  - 1 expires in 30 days
  - 2 RESTORED vouchers (1 expired, 1 valid)

### Step 3: Run Tests

```bash
node scripts/test-voucher-expiry.js <userId>
```

**Example:**
```bash
node scripts/test-voucher-expiry.js 507f1f77bcf86cd799439011
```

**What it tests:**
- ✅ Expired voucher detection
- ✅ Auto-expiry function execution
- ✅ Status update verification
- ✅ Available vouchers query filtering
- ✅ `canRedeem()` validation
- ✅ Notification system
- ✅ Status distribution
- ✅ Expiring vouchers detection (7-day window)

---

## 📊 Detailed Test Scenarios

### Test Scenario 1: Manual Expiry Trigger

**Via Admin API:**
```bash
curl -X POST http://localhost:3000/api/vouchers/admin/expire \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json"
```

**Via Script:**
```bash
node scripts/voucher-expiry-cron.js
```

**Expected Result:**
- All expired vouchers status changed from `AVAILABLE` → `EXPIRED`
- Returns count of expired vouchers

### Test Scenario 2: Verify Database State

**MongoDB Queries:**

```javascript
// Connect to MongoDB shell
mongosh "your-connection-string"

use tiffsy;

// 1. Count expired vouchers by status
db.vouchers.aggregate([
  { $match: { userId: ObjectId("YOUR_USER_ID") } },
  { $group: { _id: "$status", count: { $sum: 1 } } }
]);

// 2. Find vouchers that should be expired but aren't
db.vouchers.find({
  expiryDate: { $lt: new Date() },
  status: { $ne: "EXPIRED" }
});

// 3. Verify available vouchers exclude expired
db.vouchers.find({
  userId: ObjectId("YOUR_USER_ID"),
  status: { $in: ["AVAILABLE", "RESTORED"] },
  expiryDate: { $gte: new Date() }
});
```

### Test Scenario 3: Try Using Expired Voucher

**API Request:**
```bash
curl -X POST http://localhost:3000/api/orders/calculate-pricing \
  -H "Authorization: Bearer <user_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "kitchenId": "...",
    "menuType": "MEAL_MENU",
    "mealWindow": "LUNCH",
    "items": [...],
    "voucherCount": 1
  }'
```

**Expected Result:**
- If user has expired vouchers: They should NOT be counted
- `voucherEligibility.available` should exclude expired ones
- Order placement should fail if trying to use expired voucher

### Test Scenario 4: Notification Testing

**Trigger notification for user:**
```javascript
// In Node.js REPL or script
import { checkVoucherExpiryForUser } from "./services/voucher-expiry.service.js";

await checkVoucherExpiryForUser("YOUR_USER_ID");
// Returns: { notified: true/false, reason: "...", voucherCount: X, daysUntilExpiry: Y }
```

**Check notifications in database:**
```javascript
db.notifications.find({
  userId: ObjectId("YOUR_USER_ID"),
  type: "VOUCHER_EXPIRY_REMINDER"
}).sort({ createdAt: -1 }).limit(5);
```

**Expected notifications:**
- 7 days before expiry
- 3 days before expiry
- 1 day before expiry
- On expiry day (0 days)

---

## 🧪 Edge Cases to Test

### Edge Case 1: Voucher Expires During Order Placement

```javascript
// Create voucher expiring in 5 seconds
const voucher = await Voucher.create({
  userId: testUserId,
  subscriptionId: testSubId,
  voucherCode: "TEST-EXPIRES-NOW",
  expiryDate: new Date(Date.now() + 5000), // 5 seconds from now
  status: "AVAILABLE",
  mealType: "ANY"
});

// Wait 6 seconds
await new Promise(resolve => setTimeout(resolve, 6000));

// Try to place order - should fail
```

### Edge Case 2: RESTORED Voucher That's Expired

```javascript
// Update voucher to RESTORED with past expiry
db.vouchers.updateOne(
  { _id: ObjectId("VOUCHER_ID") },
  {
    $set: {
      status: "RESTORED",
      expiryDate: new Date("2026-01-20") // Past date
    }
  }
);

// Try to use it - should fail validation
```

### Edge Case 3: Duplicate Notification Prevention

```bash
# Run twice in same day
node scripts/test-voucher-expiry.js <userId>
node scripts/test-voucher-expiry.js <userId>

# Second run should show: { notified: false, reason: "already_sent_today" }
```

---

## 📈 Monitoring Queries

### Real-time Status Check

```javascript
// Count by status
db.vouchers.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } }
]);

// Expected:
// { _id: "AVAILABLE", count: 50 }
// { _id: "EXPIRED", count: 10 }
// { _id: "REDEEMED", count: 20 }
// { _id: "RESTORED", count: 5 }
```

### Find Issues

```javascript
// Vouchers that should be expired but aren't
db.vouchers.find({
  expiryDate: { $lt: new Date() },
  status: { $in: ["AVAILABLE", "RESTORED"] }
});
// Should return: 0 results (after cron runs)

// Vouchers expiring soon (next 7 days)
db.vouchers.find({
  expiryDate: {
    $gte: new Date(),
    $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  },
  status: { $in: ["AVAILABLE", "RESTORED"] }
});
```

### Notification History

```javascript
// Notifications sent today
db.notifications.find({
  type: "VOUCHER_EXPIRY_REMINDER",
  createdAt: {
    $gte: new Date(new Date().setHours(0, 0, 0, 0))
  }
}).count();

// Notification performance by day
db.notifications.aggregate([
  { $match: { type: "VOUCHER_EXPIRY_REMINDER" } },
  {
    $group: {
      _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
      count: { $sum: 1 }
    }
  },
  { $sort: { _id: -1 } },
  { $limit: 7 }
]);
```

---

## 🔄 Complete Test Workflow

```bash
# 1. Find user
node scripts/find-user-for-testing.js 9876543210

# 2. Create test vouchers (copy userId and subscriptionId from step 1)
node scripts/create-test-vouchers.js 67890abcdef1234567890abc 67890abcdef1234567890def

# 3. Verify vouchers were created
mongosh "your-connection-string" --eval "
  use tiffsy;
  db.vouchers.find({ userId: ObjectId('67890abcdef1234567890abc') }).count();
"

# 4. Run comprehensive tests
node scripts/test-voucher-expiry.js 67890abcdef1234567890abc

# 5. Run expiry cron manually
node scripts/voucher-expiry-cron.js

# 6. Verify expiry worked
mongosh "your-connection-string" --eval "
  use tiffsy;
  print('Expired but AVAILABLE:', db.vouchers.count({
    expiryDate: { \$lt: new Date() },
    status: 'AVAILABLE'
  }));
  print('Correctly EXPIRED:', db.vouchers.count({
    expiryDate: { \$lt: new Date() },
    status: 'EXPIRED'
  }));
"
```

---

## ✅ Expected Test Results

After running all tests, you should see:

| Test | Expected Result |
|------|-----------------|
| **Expired Detection** | ✅ Found 2-3 expired vouchers with AVAILABLE status |
| **Run Expiry** | ✅ Expired 2-3 vouchers |
| **Verify Status** | ✅ 0 expired vouchers remain AVAILABLE |
| **EXPIRED Count** | ✅ 2-3 vouchers have EXPIRED status |
| **Available Query** | ✅ Query excludes expired vouchers |
| **canRedeem()** | ✅ Returns false for expired vouchers |
| **Notifications** | ✅ System runs, sends if vouchers expiring soon |
| **Status Distribution** | ✅ Shows breakdown by status |
| **Expiring Detection** | ✅ Finds vouchers expiring in next 7 days |

**Overall:** 9/9 tests should pass ✅

---

## 🐛 Troubleshooting

### Issue: "No expired vouchers found"

**Solution:** Check if test vouchers were created properly:
```bash
db.vouchers.find({ userId: ObjectId("YOUR_USER_ID") }).count();
```

### Issue: "Cannot find module"

**Solution:** Ensure you're in the backend directory:
```bash
cd /path/to/backend
npm install
```

### Issue: "MONGODB_URL not set"

**Solution:** Ensure `.env` file exists with:
```
MONGODB_URL=mongodb://...
```

### Issue: Tests fail after first run

**Solution:** Test vouchers already expired. Clean up and recreate:
```javascript
// Delete test vouchers
db.vouchers.deleteMany({
  userId: ObjectId("YOUR_USER_ID"),
  voucherCode: { $regex: /^VCH-/ }
});

// Re-run creation script
node scripts/create-test-vouchers.js <userId> <subscriptionId>
```

---

## 📝 Clean Up After Testing

```javascript
// Delete all test vouchers for a user
db.vouchers.deleteMany({
  userId: ObjectId("YOUR_USER_ID")
});

// Or delete only test vouchers (with specific pattern)
db.vouchers.deleteMany({
  userId: ObjectId("YOUR_USER_ID"),
  createdAt: { $gte: new Date("2026-01-26") } // Today's date
});
```

---

## 🎯 Production Checklist

Before deploying to production:

- [ ] Expiry cron scheduled daily at 8 AM IST
- [ ] Cron secret configured in environment
- [ ] Notification service tested
- [ ] MongoDB indexes verified
- [ ] Error handling tested
- [ ] Logs configured
- [ ] Monitoring alerts set up
- [ ] All edge cases tested

---

## 📞 Support

If you encounter issues:

1. Check logs: `tail -f logs/voucher-expiry.log`
2. Verify MongoDB connection
3. Check cron execution history
4. Review notification delivery status
5. Validate environment variables

---

**Last Updated:** 2026-01-26
**Version:** 1.0.0
