# Voucher Expiry Testing - Quick Start

## 🚀 3 Commands to Test Everything

### Option A: Complete Automated Test (Recommended)

```bash
# Step 1: Find user and subscription IDs
node scripts/find-user-for-testing.js

# Step 2: Copy the command from output and run it
# It will look like this:
node scripts/run-complete-voucher-test.js 67890abcdef1234567890abc 67890abcdef1234567890def
```

**That's it!** This runs everything automatically:
- ✅ Creates 10 test vouchers
- ✅ Runs 9 comprehensive tests
- ✅ Shows detailed results

---

### Option B: Step-by-Step Testing

```bash
# Step 1: Find user ID
node scripts/find-user-for-testing.js 9876543210

# Step 2: Create test vouchers
node scripts/create-test-vouchers.js <userId> <subscriptionId>

# Step 3: Run tests
node scripts/test-voucher-expiry.js <userId>
```

---

## 📝 Real Example

```bash
# 1. Find user (shows first 5 users)
$ node scripts/find-user-for-testing.js

# Output shows:
# User ID: 67890abcdef1234567890abc
# Subscription ID: 67890abcdef1234567890def
# Command: node scripts/create-test-vouchers.js 67890abcdef1234567890abc 67890abcdef1234567890def

# 2. Copy and run the command
$ node scripts/create-test-vouchers.js 67890abcdef1234567890abc 67890abcdef1234567890def

# Output: ✅ Created 10 test vouchers

# 3. Run tests
$ node scripts/test-voucher-expiry.js 67890abcdef1234567890abc

# Output: ✅ ALL TESTS PASSED (9/9)
```

---

## ✅ What Gets Tested

| # | Test | What It Checks |
|---|------|----------------|
| 1 | Expired Detection | Finds vouchers past expiry date |
| 2 | Run Expiry | Marks expired vouchers as EXPIRED |
| 3 | Status Verification | No expired vouchers remain AVAILABLE |
| 4 | EXPIRED Count | Vouchers have correct status |
| 5 | Available Query | Query excludes expired vouchers |
| 6 | canRedeem() | Returns false for expired |
| 7 | Notifications | System sends expiry reminders |
| 8 | Status Distribution | Shows breakdown by status |
| 9 | Expiring Detection | Finds vouchers expiring soon |

---

## 🎯 Expected Results

After running tests, you should see:

```
✅ ALL TESTS PASSED
   Total Tests: 9
   ✅ Passed: 9
   ❌ Failed: 0
   Duration: ~2000ms
```

**Voucher Status:**
- AVAILABLE: 6 (valid, not expired)
- EXPIRED: 4 (past expiry date)
- RESTORED: 0-2 (depending on test scenario)

---

## 🐛 Troubleshooting

### "No users found"
```bash
# Create a test user or use existing customer
# Check: db.users.find({ role: "CUSTOMER" }).limit(1)
```

### "Invalid ObjectId format"
```bash
# Make sure to copy the full ID
# Should look like: 507f1f77bcf86cd799439011 (24 hex characters)
```

### "Connection refused"
```bash
# Check MongoDB is running
# Verify MONGODB_URL in .env file
```

---

## 🧹 Cleanup

After testing, remove test vouchers:

```javascript
// In MongoDB shell
db.vouchers.deleteMany({
  userId: ObjectId("YOUR_USER_ID"),
  createdAt: { $gte: new Date("2026-01-26") }
});
```

---

## 📖 Full Documentation

See [VOUCHER_TESTING_README.md](./VOUCHER_TESTING_README.md) for:
- Detailed test scenarios
- Edge cases
- MongoDB queries
- Production checklist
- API testing examples

---

## 🆘 Need Help?

1. Check logs: `tail -f logs/app.log`
2. Verify environment: `cat .env | grep MONGODB_URL`
3. Test connection: `mongosh $MONGODB_URL --eval "db.stats()"`

---

**Last Updated:** 2026-01-26
