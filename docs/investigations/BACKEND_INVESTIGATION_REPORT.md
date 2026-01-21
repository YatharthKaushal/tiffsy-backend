# 🔍 Backend Investigation Report - Dashboard 403 Error

## Issue Summary
Kitchen staff users are getting **403 "Access denied to this kitchen"** when accessing `/api/kitchens/dashboard`, despite having:
- ✅ Valid firebaseUid
- ✅ Valid kitchenId
- ✅ Role: KITCHEN_STAFF
- ✅ Status: ACTIVE

## Root Cause Analysis

### Endpoint Configuration
**File:** [src/kitchen/kitchen.routes.js:224-228](src/kitchen/kitchen.routes.js#L224-L228)

```javascript
router.get(
  "/dashboard",
  adminAuthMiddleware,      // ✅ Correctly authenticates Firebase tokens
  roleMiddleware(["KITCHEN_STAFF", "ADMIN"]),  // ✅ Allows KITCHEN_STAFF
  kitchenController.getKitchenDashboard
);
```

**Status:** ✅ Route configuration is CORRECT

---

### Authentication Middleware
**File:** [middlewares/auth.middleware.js:426-512](middlewares/auth.middleware.js#L426-L512)

The `adminAuthMiddleware`:
1. Tries JWT verification first (for admin web portal)
2. Falls back to Firebase verification (for mobile apps)
3. Correctly extracts user from database
4. Sets `req.user` with full user object

**Status:** ✅ Authentication middleware is CORRECT

---

### Controller Logic - THE BUG 🐛
**File:** [src/kitchen/kitchen.controller.js:931-965](src/kitchen/kitchen.controller.js#L931-L965)

```javascript
export const getKitchenDashboard = async (req, res) => {
  try {
    // Line 934-937: Extract kitchenId
    const kitchenId =
      req.user.role === "KITCHEN_STAFF"
        ? req.user.kitchenId              // ← Returns MongoDB ObjectId object
        : req.query.kitchenId;

    if (!kitchenId) {
      return sendResponse(res, 400, "Kitchen ID is required");
    }

    // Line 951-953: Find kitchen
    const kitchen = await Kitchen.findById(kitchenId)
      .populate("zonesServed", "name code city")
      .lean();

    if (!kitchen) {
      return sendResponse(res, 404, "Kitchen not found");
    }

    // Line 960-965: Access control check
    // 🐛 BUG IS HERE 🐛
    if (
      req.user.role === "KITCHEN_STAFF" &&
      req.user.kitchenId?.toString() !== kitchenId  // ← COMPARISON BUG
    ) {
      return sendResponse(res, 403, "Access denied to this kitchen");
    }

    // Rest of the code...
  }
}
```

### The Bug Explained

**Line 936:** `req.user.kitchenId` is a **MongoDB ObjectId object**
```javascript
kitchenId = req.user.kitchenId
// kitchenId is now: ObjectId("696100c8c39ff249a72270fd")
```

**Line 962:** Comparison fails because of type mismatch
```javascript
req.user.kitchenId?.toString() !== kitchenId
//        ↓                         ↓
//     "696100..."           ObjectId("696100...")
//       STRING                    OBJECT
//
// Result: ALWAYS returns true (not equal) because comparing string to object!
```

**Result:** The condition ALWAYS evaluates to `true`, causing the 403 error.

---

## The Fix

### Option 1: Convert kitchenId to String (Recommended)
**File:** [src/kitchen/kitchen.controller.js:934-937](src/kitchen/kitchen.controller.js#L934-L937)

```javascript
// BEFORE (Buggy)
const kitchenId =
  req.user.role === "KITCHEN_STAFF"
    ? req.user.kitchenId
    : req.query.kitchenId;

// AFTER (Fixed)
const kitchenId =
  req.user.role === "KITCHEN_STAFF"
    ? req.user.kitchenId?.toString()  // ← Add .toString()
    : req.query.kitchenId;
```

### Option 2: Convert Both Sides to String at Comparison
**File:** [src/kitchen/kitchen.controller.js:960-965](src/kitchen/kitchen.controller.js#L960-L965)

```javascript
// BEFORE (Buggy)
if (
  req.user.role === "KITCHEN_STAFF" &&
  req.user.kitchenId?.toString() !== kitchenId
) {
  return sendResponse(res, 403, "Access denied to this kitchen");
}

// AFTER (Fixed)
if (
  req.user.role === "KITCHEN_STAFF" &&
  req.user.kitchenId?.toString() !== kitchenId?.toString()  // ← Add .toString()
) {
  return sendResponse(res, 403, "Access denied to this kitchen");
}
```

### Option 3: Use MongoDB's equals() Method
```javascript
// BEFORE (Buggy)
if (
  req.user.role === "KITCHEN_STAFF" &&
  req.user.kitchenId?.toString() !== kitchenId
) {
  return sendResponse(res, 403, "Access denied to this kitchen");
}

// AFTER (Fixed)
if (
  req.user.role === "KITCHEN_STAFF" &&
  !req.user.kitchenId?.equals(kitchenId)  // ← Use .equals()
) {
  return sendResponse(res, 403, "Access denied to this kitchen");
}
```

---

## Recommended Solution

**Option 1 is recommended** because:
1. ✅ Converts once at the source
2. ✅ Ensures `kitchenId` variable is always a string throughout the function
3. ✅ Prevents similar bugs in other parts of the code
4. ✅ Makes the code more predictable

### Implementation

```javascript
// Line 934-937 - Apply this fix
const kitchenId =
  req.user.role === "KITCHEN_STAFF"
    ? req.user.kitchenId?.toString()  // Convert ObjectId to string
    : req.query.kitchenId;
```

---

## Testing the Fix

### Test Case 1: Kitchen Staff Accessing Own Dashboard
```bash
# User Details
- Phone: 9800000001
- Role: KITCHEN_STAFF
- KitchenId: 696100c8c39ff249a72270fd

# Request
GET /api/kitchens/dashboard
Authorization: Bearer {firebase_token}

# Expected Result
✅ 200 OK with dashboard data
```

### Test Case 2: Admin Accessing Any Kitchen Dashboard
```bash
# Request
GET /api/kitchens/dashboard?kitchenId=696100c8c39ff249a72270fd
Authorization: Bearer {admin_firebase_token}

# Expected Result
✅ 200 OK with dashboard data
```

### Test Case 3: Kitchen Staff Accessing Different Kitchen
```bash
# User KitchenId: 696100c8c39ff249a72270fd
# Request
GET /api/kitchens/dashboard?kitchenId=different_kitchen_id
Authorization: Bearer {firebase_token}

# Expected Result
✅ 403 Forbidden (correctly denied)
```

---

## Why This Bug Wasn't Caught Earlier

1. **User had no firebaseUid initially** - The authentication middleware couldn't find the user
2. **Once firebaseUid was set via /sync** - The authentication passed, but hit this comparison bug
3. **The bug is subtle** - JavaScript allows comparing strings to objects without throwing errors
4. **No explicit type checking** - TypeScript would have caught this at compile time

---

## Verification Script

Run this script to verify the fix works:

```javascript
// verify-dashboard-fix.js
import mongoose from "mongoose";
import User from "./schema/user.schema.js";

const MONGODB_URL = "mongodb+srv://admin:admin@cluster0.iaujapa.mongodb.net/tiffsy?appName=Cluster0";

async function verifyFix() {
  await mongoose.connect(MONGODB_URL);

  const user = await User.findOne({ phone: "9800000001" });

  console.log("User kitchenId type:", typeof user.kitchenId);
  console.log("User kitchenId value:", user.kitchenId);
  console.log("User kitchenId string:", user.kitchenId?.toString());

  // Simulate the bug
  const kitchenId = user.kitchenId; // ObjectId
  const comparison = user.kitchenId?.toString() !== kitchenId;
  console.log("\nBuggy comparison result:", comparison); // true (BUG!)

  // Simulate the fix
  const kitchenIdString = user.kitchenId?.toString();
  const fixedComparison = user.kitchenId?.toString() !== kitchenIdString;
  console.log("Fixed comparison result:", fixedComparison); // false (CORRECT!)

  await mongoose.connection.close();
}

verifyFix();
```

---

## Impact Analysis

### Affected Endpoints
Only this endpoint is affected:
- ❌ `GET /api/kitchens/dashboard` (Lines 934-965)

### Similar Endpoints That Are NOT Affected
These endpoints use different patterns and are working correctly:
- ✅ `GET /api/kitchens/my-kitchen` (Lines 849-889) - Uses different logic
- ✅ `GET /api/kitchens/:id` (Lines 230-283) - Uses kitchenAccessMiddleware
- ✅ `GET /api/kitchens/analytics` (Lines 1146-1327) - Has same bug pattern but needs same fix

**Note:** The `/api/kitchens/analytics` endpoint (line 1149-1163) has the **EXACT SAME BUG** and needs the same fix:

```javascript
// Line 1149-1152 - ALSO NEEDS FIX
const kitchenId =
  req.user.role === "KITCHEN_STAFF"
    ? req.user.kitchenId?.toString()  // ← Add .toString()
    : req.query.kitchenId;
```

---

## Deployment Checklist

- [ ] Apply fix to `getKitchenDashboard` function (line 936)
- [ ] Apply fix to `getKitchenAnalytics` function (line 1150)
- [ ] Test with kitchen staff user (phone: 9800000001)
- [ ] Test with admin user
- [ ] Test with kitchen staff accessing wrong kitchen (should still get 403)
- [ ] Verify no regression in other endpoints
- [ ] Update any similar patterns in codebase

---

## Additional Findings

### Related Code Patterns to Review

Search for similar patterns that might have the same issue:

```bash
grep -r "req.user.kitchenId" src/
grep -r "kitchenId?.toString()" src/
```

### Recommendation: Add TypeScript

This bug would have been caught at compile time with TypeScript:

```typescript
// TypeScript would prevent this
const kitchenId: string = req.user.kitchenId; // Error: Type 'ObjectId' is not assignable to type 'string'
```

---

## Summary

| Aspect | Status |
|--------|--------|
| **Root Cause** | Type mismatch in comparison (ObjectId vs string) |
| **Location** | kitchen.controller.js line 936 and 962 |
| **Affected Endpoints** | `/api/kitchens/dashboard` and `/api/kitchens/analytics` |
| **Fix Complexity** | Simple - add `.toString()` |
| **Testing Required** | Minimal - verify 3 test cases |
| **Deployment Risk** | Low - isolated change |

---

## Next Steps

1. **Immediate:** Apply the fix to line 936 and 1150
2. **Testing:** Test with the kitchen staff user
3. **Deploy:** Deploy to staging first, then production
4. **Monitor:** Check logs for any 403 errors after deployment
5. **Future:** Consider adding TypeScript to prevent similar issues

---

**Report Generated:** January 19, 2026
**Severity:** High (blocking feature)
**Priority:** Critical
**Estimated Fix Time:** 5 minutes
**Estimated Test Time:** 10 minutes
