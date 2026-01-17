# Kitchen Approval System - Backend Implementation Guide

## 📋 Overview

This document provides complete implementation details for the Kitchen Approval System backend APIs. The **frontend is already fully implemented** and is currently calling these endpoints. Your task is to implement the backend to match the frontend's expectations.

### Current Status

✅ **Frontend Implementation:** COMPLETE
- Kitchen Approvals Screen with pending list
- Detailed review modal with tabs
- Approve/Reject dialogs with validation
- All UI components and service layer ready

❌ **Backend Implementation:** REQUIRED
- Admin approval endpoints need to be created
- Kitchen schema may need enhancement
- Controller functions need to be implemented

---

## 🎯 What the Frontend is Calling

The frontend makes these API calls:

### 1. **Get Pending Kitchens**
```
GET /api/admin/kitchens/pending?page=1&limit=20
```
**Expected Response:**
```json
{
  "success": true,
  "message": "Pending kitchens retrieved",
  "data": {
    "kitchens": [
      {
        "_id": "kitchen_id_here",
        "name": "Kitchen Name",
        "code": "KIT-ABC123",
        "type": "PARTNER",
        "status": "PENDING_APPROVAL",
        "address": {
          "addressLine1": "123 Street",
          "locality": "Area Name",
          "city": "City",
          "state": "State",
          "pincode": "123456"
        },
        "contactPhone": "9876543210",
        "contactEmail": "kitchen@example.com",
        "ownerName": "Owner Name",
        "ownerPhone": "9876543211",
        "cuisineTypes": ["North Indian", "Chinese"],
        "zonesServed": ["zone_id_1", "zone_id_2"],
        "logo": "https://...",
        "description": "Kitchen description",
        "isAcceptingOrders": false,
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

### 2. **Approve Kitchen**
```
PATCH /api/admin/kitchens/:id/approve
```
**Expected Response:**
```json
{
  "success": true,
  "message": "Kitchen approved successfully",
  "data": {
    "kitchen": {
      "_id": "kitchen_id",
      "status": "ACTIVE",
      "approvedBy": "admin_user_id",
      "approvedAt": "2024-01-16T14:25:00.000Z",
      ...
    }
  }
}
```

### 3. **Reject Kitchen**
```
PATCH /api/admin/kitchens/:id/reject
Content-Type: application/json

{
  "reason": "Incomplete documentation. FSSAI license expired."
}
```
**Expected Response:**
```json
{
  "success": true,
  "message": "Kitchen rejected",
  "data": {
    "kitchen": {
      "_id": "kitchen_id",
      "status": "INACTIVE",
      "approvalDetails": {
        "rejectedBy": "admin_user_id",
        "rejectedAt": "2024-01-16T14:30:00.000Z",
        "rejectionReason": "Incomplete documentation. FSSAI license expired."
      },
      ...
    }
  }
}
```

### 4. **Get All Kitchens (with filters)**
```
GET /api/kitchens?status=ACTIVE&type=PARTNER&page=1&limit=20
```
**Note:** This endpoint likely already exists. Ensure it supports `status` and `type` query params.

---

## 🗄️ Database Schema Updates

### Option 1: Add Approval Details Field (RECOMMENDED)

**File:** `schema/kitchen.schema.js`

Add this field to the Kitchen schema (before the `status` field, around line 187):

```javascript
// Approval Details (separate from operational status)
approvalDetails: {
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  approvedAt: Date,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  rejectedAt: Date,
  rejectionReason: String,
},
```

**Why this is better:**
- Separates approval metadata from operational status
- Can track both approval and rejection history
- Matches the driver approval pattern

### Option 2: Use Existing Fields (SIMPLER)

Your schema likely already has:
```javascript
approvedBy: ObjectId (ref: "User")
approvedAt: Date
```

You can add:
```javascript
rejectedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
},
rejectedAt: Date,
rejectionReason: String,
```

### Status Enum Verification

Ensure your `status` field enum includes:
```javascript
status: {
  type: String,
  enum: {
    values: ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_APPROVAL", "DELETED"],
    message: "Invalid status",
  },
  default: "PENDING_APPROVAL", // For PARTNER kitchens
}
```

---

## 🛣️ Add Routes

**File:** `src/admin/admin.routes.js`

**Location:** After driver routes (around line 223)

```javascript
// Kitchen Approval Management
router.get("/kitchens/pending", adminController.getPendingKitchens);
router.patch("/kitchens/:id/approve", adminController.approveKitchen);
router.patch("/kitchens/:id/reject", adminController.rejectKitchen);
```

**Full context:**
```javascript
// After existing routes like:
// router.get("/drivers/pending", adminController.getPendingDrivers);
// router.patch("/drivers/:id/approve", adminController.approveDriver);

// Kitchen Approval Management
router.get("/kitchens/pending", adminController.getPendingKitchens);
router.patch("/kitchens/:id/approve", adminController.approveKitchen);
router.patch("/kitchens/:id/reject", adminController.rejectKitchen);
```

---

## 🎮 Controller Implementation

**File:** `src/admin/admin.controller.js`

**Location:** After driver approval functions (around line 602)

### Function 1: Get Pending Kitchens

```javascript
/**
 * Get pending kitchen registrations
 * @route GET /api/admin/kitchens/pending
 * @access Admin
 */
export async function getPendingKitchens(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = {
      status: "PENDING_APPROVAL",
    };

    const [kitchens, total] = await Promise.all([
      Kitchen.find(query)
        .populate("zonesServed", "name code")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Kitchen.countDocuments(query),
    ]);

    return sendResponse(res, 200, true, "Pending kitchens retrieved", {
      kitchens,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.log("Get pending kitchens error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve pending kitchens");
  }
}
```

### Function 2: Approve Kitchen

```javascript
/**
 * Approve a kitchen registration
 * @route PATCH /api/admin/kitchens/:id/approve
 * @access Admin
 */
export async function approveKitchen(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const kitchen = await Kitchen.findById(id);
    if (!kitchen) {
      return sendResponse(res, 404, false, "Kitchen not found");
    }

    if (kitchen.status === "ACTIVE") {
      return sendResponse(res, 400, false, "Kitchen is already approved");
    }

    // Update status and approval details
    kitchen.status = "ACTIVE";

    // Option 1: If using approvalDetails object
    kitchen.approvalDetails = {
      approvedBy: adminId,
      approvedAt: new Date(),
    };

    // Option 2: If using direct fields (comment out Option 1 and use this)
    // kitchen.approvedBy = adminId;
    // kitchen.approvedAt = new Date();

    await kitchen.save();

    // Log audit (if you have audit logging)
    // safeAuditCreate({
    //   action: "APPROVE_KITCHEN",
    //   entityType: "KITCHEN",
    //   entityId: kitchen._id,
    //   performedBy: adminId,
    //   details: { kitchenName: kitchen.name, type: kitchen.type },
    // });

    return sendResponse(res, 200, true, "Kitchen approved successfully", {
      kitchen,
    });
  } catch (error) {
    console.log("Approve kitchen error:", error);
    return sendResponse(res, 500, false, "Failed to approve kitchen");
  }
}
```

### Function 3: Reject Kitchen

```javascript
/**
 * Reject a kitchen registration
 * @route PATCH /api/admin/kitchens/:id/reject
 * @access Admin
 */
export async function rejectKitchen(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    // Validate reason
    if (!reason || reason.trim().length < 10) {
      return sendResponse(res, 400, false, "Rejection reason must be at least 10 characters");
    }

    if (reason.trim().length > 500) {
      return sendResponse(res, 400, false, "Rejection reason must not exceed 500 characters");
    }

    const kitchen = await Kitchen.findById(id);
    if (!kitchen) {
      return sendResponse(res, 404, false, "Kitchen not found");
    }

    if (kitchen.status === "DELETED") {
      return sendResponse(res, 400, false, "Kitchen is already deleted");
    }

    // Update status and rejection details
    kitchen.status = "INACTIVE"; // or "REJECTED" if you added that status

    // Option 1: If using approvalDetails object
    kitchen.approvalDetails = {
      ...(kitchen.approvalDetails || {}),
      rejectedBy: adminId,
      rejectedAt: new Date(),
      rejectionReason: reason.trim(),
    };

    // Option 2: If using direct fields (comment out Option 1 and use this)
    // kitchen.rejectedBy = adminId;
    // kitchen.rejectedAt = new Date();
    // kitchen.rejectionReason = reason.trim();

    await kitchen.save();

    // Log audit (if you have audit logging)
    // safeAuditCreate({
    //   action: "REJECT_KITCHEN",
    //   entityType: "KITCHEN",
    //   entityId: kitchen._id,
    //   performedBy: adminId,
    //   details: { kitchenName: kitchen.name, type: kitchen.type, reason: reason.trim() },
    // });

    return sendResponse(res, 200, true, "Kitchen rejected", {
      kitchen,
    });
  } catch (error) {
    console.log("Reject kitchen error:", error);
    return sendResponse(res, 500, false, "Failed to reject kitchen");
  }
}
```

---

## 🔐 Authentication & Authorization

**IMPORTANT:** Ensure your routes are protected with admin middleware.

Your admin routes file should have middleware like:

```javascript
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';

// Apply to all admin routes
router.use(authenticateToken);
router.use(requireAdmin);
```

Or apply to specific routes:
```javascript
router.get("/kitchens/pending", authenticateToken, requireAdmin, adminController.getPendingKitchens);
```

---

## 🧪 Testing the Implementation

### Step 1: Create Test Kitchen with PENDING_APPROVAL Status

**Option A: Via API (if you have kitchen creation endpoint)**
```bash
POST /api/kitchens
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "name": "Test Kitchen",
  "type": "PARTNER",
  "address": {
    "addressLine1": "123 Test Street",
    "locality": "Test Area",
    "city": "Bangalore",
    "pincode": "560001"
  },
  "contactPhone": "9876543210",
  "contactEmail": "test@kitchen.com",
  "ownerName": "Test Owner",
  "ownerPhone": "9876543211",
  "cuisineTypes": ["North Indian"],
  "zonesServed": ["<zone_id>"],
  "operatingHours": {
    "lunch": { "startTime": "11:00", "endTime": "15:00" },
    "dinner": { "startTime": "19:00", "endTime": "23:00" }
  }
}
```

**Option B: Via MongoDB Shell**
```javascript
db.kitchens.insertOne({
  name: "Test Kitchen",
  code: "KIT-TEST1",
  type: "PARTNER",
  status: "PENDING_APPROVAL",
  address: {
    addressLine1: "123 Test Street",
    locality: "Test Area",
    city: "Bangalore",
    pincode: "560001"
  },
  contactPhone: "9876543210",
  contactEmail: "test@kitchen.com",
  ownerName: "Test Owner",
  ownerPhone: "9876543211",
  cuisineTypes: ["North Indian"],
  zonesServed: [ObjectId("<zone_id>")],
  operatingHours: {
    lunch: { startTime: "11:00", endTime: "15:00" },
    dinner: { startTime: "19:00", endTime: "23:00" }
  },
  isAcceptingOrders: false,
  createdAt: new Date(),
  updatedAt: new Date()
});
```

### Step 2: Test Get Pending Kitchens

```bash
curl -X GET "http://localhost:5001/api/admin/kitchens/pending?page=1&limit=20" \
  -H "Authorization: Bearer <admin_token>"
```

**Expected:** Should return your test kitchen

### Step 3: Test Approve Kitchen

```bash
curl -X PATCH "http://localhost:5001/api/admin/kitchens/<kitchen_id>/approve" \
  -H "Authorization: Bearer <admin_token>"
```

**Expected:** Kitchen status should change to "ACTIVE"

### Step 4: Test Reject Kitchen

First, create another test kitchen, then:

```bash
curl -X PATCH "http://localhost:5001/api/admin/kitchens/<kitchen_id>/reject" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Test rejection reason for validation"}'
```

**Expected:** Kitchen status should change to "INACTIVE" and reason should be stored

### Step 5: Verify in Frontend

1. Open the app
2. Navigate to "Kitchen Approvals" in sidebar
3. You should see pending kitchens
4. Click "Review Details" to see full information
5. Click "Approve" or "Reject" and verify it works

---

## 🐛 Common Issues & Solutions

### Issue 1: "Kitchen not found" Error

**Cause:** Invalid ObjectId format or kitchen doesn't exist

**Solution:**
```javascript
// Add ObjectId validation
import mongoose from 'mongoose';

if (!mongoose.Types.ObjectId.isValid(id)) {
  return sendResponse(res, 400, false, "Invalid kitchen ID");
}
```

### Issue 2: "sendResponse is not defined"

**Cause:** Missing import

**Solution:**
```javascript
import { sendResponse } from '../utils/responseHelper.js';
// Or whatever your response helper is called
```

### Issue 3: "Kitchen model not imported"

**Solution:**
```javascript
import Kitchen from '../../schema/kitchen.schema.js';
// Adjust path based on your project structure
```

### Issue 4: "req.user is undefined"

**Cause:** Authentication middleware not working

**Solution:**
- Verify token is being sent: `Authorization: Bearer <token>`
- Check middleware order in routes file
- Verify `authenticateToken` middleware is setting `req.user`

### Issue 5: Populated fields not showing

**Cause:** Zone or User models not populating

**Solution:**
```javascript
// Make sure models are properly defined
.populate("zonesServed", "name code _id")
.populate("createdBy", "name email _id")
```

### Issue 6: Frontend shows "Network error"

**Debug steps:**
1. Check backend is running: `http://localhost:5001/health`
2. Check CORS is configured: Allow your frontend origin
3. Check route is registered: Add `console.log` in controller
4. Check request is reaching backend: Add `console.log(req.method, req.path)` in middleware

**CORS fix (if needed):**
```javascript
app.use(cors({
  origin: ['http://localhost:8081', 'exp://...'], // Add your expo dev server
  credentials: true
}));
```

---

## 📊 Database Queries for Debugging

### Check Pending Kitchens Count
```javascript
db.kitchens.count({ status: "PENDING_APPROVAL" })
```

### Find All Pending Kitchens
```javascript
db.kitchens.find({ status: "PENDING_APPROVAL" })
```

### Check Kitchen Status Values
```javascript
db.kitchens.distinct("status")
```

### Update Kitchen Status Manually
```javascript
db.kitchens.updateOne(
  { _id: ObjectId("<kitchen_id>") },
  { $set: { status: "PENDING_APPROVAL" } }
)
```

### Check if Admin User Exists
```javascript
db.users.findOne({ role: "ADMIN" })
```

---

## 🔄 Integration with Existing Kitchen Creation

If you have existing kitchen creation logic, ensure PARTNER kitchens automatically get `PENDING_APPROVAL` status:

**File:** `src/kitchen/kitchen.controller.js` (or wherever kitchen creation is)

```javascript
export async function createKitchen(req, res) {
  try {
    const { type, ...otherData } = req.body;

    // Auto-assign status based on type
    const status = type === "TIFFSY" ? "ACTIVE" : "PENDING_APPROVAL";

    const kitchen = new Kitchen({
      type,
      status,
      ...otherData
    });

    await kitchen.save();

    return sendResponse(res, 201, true, "Kitchen created", { kitchen });
  } catch (error) {
    console.error("Create kitchen error:", error);
    return sendResponse(res, 500, false, "Failed to create kitchen");
  }
}
```

---

## 📝 Audit Logging (Optional but Recommended)

If you have an audit logging system, track these actions:

```javascript
// Add after successful operations
await AuditLog.create({
  action: "APPROVE_KITCHEN", // or "REJECT_KITCHEN"
  entityType: "KITCHEN",
  entityId: kitchen._id,
  performedBy: req.user._id,
  details: {
    kitchenName: kitchen.name,
    kitchenType: kitchen.type,
    ...(reason && { rejectionReason: reason })
  },
  timestamp: new Date()
});
```

---

## ✅ Final Verification Checklist

Before marking as complete, verify:

- [ ] All three endpoints return correct response structure
- [ ] Pagination works correctly (try page=1, page=2)
- [ ] Authentication is enforced (try without token → should get 401)
- [ ] Authorization is enforced (try with non-admin token → should get 403)
- [ ] Approval changes status to ACTIVE and records admin ID + timestamp
- [ ] Rejection changes status to INACTIVE and stores reason
- [ ] Rejection reason validation works (min 10, max 500 chars)
- [ ] Can't approve already approved kitchen (returns 400)
- [ ] Can't reject deleted kitchen (returns 400)
- [ ] Frontend can successfully approve a kitchen
- [ ] Frontend can successfully reject a kitchen
- [ ] Frontend shows correct error messages on failures
- [ ] Database is updated correctly after operations
- [ ] Populated fields (zones, createdBy) are returned

---

## 🚀 Quick Start Summary

**Minimum steps to get working:**

1. ✅ Add 3 routes to `admin.routes.js`
2. ✅ Add 3 controller functions to `admin.controller.js`
3. ✅ Ensure Kitchen schema has `status` enum with `PENDING_APPROVAL`
4. ✅ (Optional) Add `approvalDetails` or rejection fields to schema
5. ✅ Create a test kitchen with `PENDING_APPROVAL` status
6. ✅ Test via Postman or frontend
7. ✅ Fix any errors using the debugging section

**Time estimate:** 30-60 minutes

---

## 📞 Support

If you encounter issues:

1. Check the "Common Issues & Solutions" section above
2. Run the database queries to verify data
3. Check backend console logs for errors
4. Verify routes are registered with: `console.log(router.stack.map(r => r.route?.path))`
5. Test endpoints with Postman before testing in frontend

**Frontend is ready and waiting for these APIs!** Once implemented, the entire Kitchen Approval feature will work seamlessly.

---

**Document Version:** 1.0
**Last Updated:** 2024-01-17
**Status:** Ready for Implementation
**Estimated Implementation Time:** 30-60 minutes
