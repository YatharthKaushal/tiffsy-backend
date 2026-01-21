# Kitchen Approval Flow - Complete Documentation

## 📋 Overview

This document provides a complete guide to the Kitchen Approval System implementation, covering both the kitchen registration flow and admin approval process.

**Important Note:** Admin and Kitchen apps share the same backend. The dashboard that opens depends on the user's role:
- **ADMIN role** → Admin Dashboard (with kitchen approvals, user management, system config, etc.)
- **KITCHEN_STAFF role** → Kitchen Dashboard (with orders, batches, menu management, profile, analytics)

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    KITCHEN REGISTRATION FLOW                 │
└─────────────────────────────────────────────────────────────┘

1. Kitchen Owner (Mobile App)
   │
   ├─> Firebase OTP Authentication
   │   └─> Phone number verified
   │
   ├─> POST /api/auth/register-kitchen
   │   ├─ Kitchen details (name, cuisine, address, zones)
   │   ├─ Operating hours (lunch, dinner, on-demand)
   │   ├─ Contact info (phone, email, owner name)
   │   ├─ Images (logo, cover via Cloudinary)
   │   └─ Staff details (name, email)
   │
   ├─> Backend Creates:
   │   ├─ Kitchen document (status: PENDING_APPROVAL, type: PARTNER)
   │   └─ User document (role: KITCHEN_STAFF, linked to kitchen)
   │
   └─> Kitchen Staff Can Login Immediately
       ├─ POST /api/auth/sync
       ├─ Returns: user + kitchen with status
       └─ App shows "Pending Approval" screen

┌─────────────────────────────────────────────────────────────┐
│                    ADMIN APPROVAL FLOW                       │
└─────────────────────────────────────────────────────────────┘

2. Admin (Web Portal)
   │
   ├─> Login: POST /api/auth/admin/login
   │   └─> Returns JWT token + user with role: ADMIN
   │
   ├─> View Pending Kitchens
   │   ├─ GET /api/admin/kitchens/pending
   │   └─ Returns paginated list of PENDING_APPROVAL kitchens
   │
   ├─> Review Kitchen Details
   │   ├─ View: name, cuisine, address, zones, hours
   │   ├─ Check: images, contact info, owner details
   │   └─ Decide: Approve or Reject
   │
   ├─> APPROVE Kitchen
   │   ├─ PATCH /api/admin/kitchens/:id/approve
   │   ├─ Sets: status = ACTIVE
   │   ├─ Records: approvedBy, approvedAt
   │   ├─ Clears: any rejection details
   │   └─ Audit log created
   │
   └─> OR REJECT Kitchen
       ├─ PATCH /api/admin/kitchens/:id/reject
       ├─ Body: { reason: "..." } (10-500 chars)
       ├─ Sets: rejectionReason, rejectedBy, rejectedAt
       ├─ Status: remains PENDING_APPROVAL (for resubmission)
       └─ Audit log created

┌─────────────────────────────────────────────────────────────┐
│                  POST-APPROVAL KITCHEN FLOW                  │
└─────────────────────────────────────────────────────────────┘

3. After Approval
   │
   ├─> Kitchen Staff Login Again
   │   ├─ POST /api/auth/sync
   │   └─ Returns: kitchen with status: ACTIVE
   │
   └─> Kitchen Dashboard Opens with 5 Tabs:
       │
       ├─> 1. Dashboard Tab
       │   └─ GET /api/kitchens/dashboard
       │       ├─ Today's stats (orders, revenue)
       │       ├─ Batch status summary
       │       ├─ Menu statistics
       │       └─ Recent activity
       │
       ├─> 2. Orders Tab
       │   ├─ GET /api/orders/kitchen
       │   ├─ PATCH /api/orders/:id/accept
       │   ├─ PATCH /api/orders/:id/reject
       │   └─ PATCH /api/orders/:id/status
       │
       ├─> 3. Batch Management Tab
       │   ├─ GET /api/delivery/kitchen-batches
       │   └─ GET /api/delivery/batches/:id
       │
       ├─> 4. Menu Management Tab
       │   ├─ GET /api/menu?kitchenId=X
       │   ├─ POST /api/menu (create item)
       │   ├─ PUT /api/menu/:id (update item)
       │   ├─ DELETE /api/menu/:id (delete item)
       │   └─ GET /api/menu/my-kitchen/stats
       │
       └─> 5. Profile Tab
           ├─ GET /api/kitchens/my-kitchen
           └─ PATCH /api/kitchens/my-kitchen/images

┌─────────────────────────────────────────────────────────────┐
│                    REJECTION & RESUBMISSION                  │
└─────────────────────────────────────────────────────────────┘

4. If Rejected
   │
   ├─> Kitchen Staff Login
   │   ├─ POST /api/auth/sync
   │   └─ Returns: kitchen with rejectionReason
   │
   ├─> App Shows:
   │   ├─ "Your application was rejected"
   │   ├─ Rejection reason
   │   └─ "Edit and Resubmit" button
   │
   ├─> Kitchen Staff Edits Details
   │   └─ PATCH /api/auth/resubmit-kitchen
   │       ├─ Updates: any fields (name, address, zones, etc.)
   │       └─ Clears: rejectionReason, rejectedBy, rejectedAt
   │
   └─> Admin Reviews Again
       └─> (Back to step 2)
```

---

## 🎯 API Endpoints Reference

### Kitchen Registration (Mobile App)

#### 1. Register Kitchen
```http
POST /api/auth/register-kitchen
Authorization: Bearer <firebase_token>
Content-Type: application/json

{
  "name": "Spice Kitchen",
  "cuisineTypes": ["North Indian", "Chinese"],
  "address": {
    "addressLine1": "123 MG Road",
    "locality": "Indiranagar",
    "city": "Bangalore",
    "state": "Karnataka",
    "pincode": "560038",
    "coordinates": {
      "latitude": 12.9716,
      "longitude": 77.5946
    }
  },
  "zonesServed": ["zone_id_1", "zone_id_2"],
  "operatingHours": {
    "lunch": { "startTime": "11:00", "endTime": "15:00" },
    "dinner": { "startTime": "19:00", "endTime": "23:00" },
    "onDemand": { "startTime": "10:00", "endTime": "23:00", "isAlwaysOpen": false }
  },
  "contactPhone": "9876543210",
  "contactEmail": "spice@kitchen.com",
  "ownerName": "John Doe",
  "logo": "https://res.cloudinary.com/.../logo.png",
  "coverImage": "https://res.cloudinary.com/.../cover.jpg",
  "staffName": "Jane Smith",
  "staffEmail": "jane@spice.com"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Kitchen registration submitted for approval",
  "data": {
    "kitchen": { "_id": "...", "status": "PENDING_APPROVAL", ... },
    "user": { "_id": "...", "role": "KITCHEN_STAFF", ... }
  }
}
```

#### 2. Check Kitchen Status
```http
GET /api/auth/my-kitchen-status
Authorization: Bearer <user_token>
```

**Response (Pending):**
```json
{
  "success": true,
  "message": "Kitchen status retrieved",
  "data": {
    "status": "PENDING_APPROVAL",
    "kitchen": { "_id": "...", "name": "...", "createdAt": "..." }
  }
}
```

**Response (Rejected):**
```json
{
  "success": true,
  "message": "Kitchen status retrieved",
  "data": {
    "status": "PENDING_APPROVAL",
    "rejectionReason": "FSSAI license expired. Please upload valid license.",
    "rejectedBy": "admin_id",
    "rejectedAt": "2024-01-15T10:30:00.000Z",
    "kitchen": { ... }
  }
}
```

#### 3. Resubmit After Rejection
```http
PATCH /api/auth/resubmit-kitchen
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "name": "Spice Kitchen (Updated)",
  "cuisineTypes": ["North Indian", "Chinese", "Continental"],
  "logo": "https://res.cloudinary.com/.../new-logo.png"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Kitchen resubmitted for approval",
  "data": {
    "kitchen": { "_id": "...", "status": "PENDING_APPROVAL", ... }
  }
}
```

---

### Admin Approval (Web Portal)

#### 1. Get Pending Kitchens
```http
GET /api/admin/kitchens/pending?page=1&limit=20
Authorization: Bearer <admin_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Pending kitchens retrieved",
  "data": {
    "kitchens": [
      {
        "_id": "kitchen_id_1",
        "name": "Spice Kitchen",
        "code": "KIT-ABC123",
        "type": "PARTNER",
        "status": "PENDING_APPROVAL",
        "address": {
          "addressLine1": "123 MG Road",
          "locality": "Indiranagar",
          "city": "Bangalore",
          "pincode": "560038"
        },
        "contactPhone": "9876543210",
        "contactEmail": "spice@kitchen.com",
        "ownerName": "John Doe",
        "cuisineTypes": ["North Indian", "Chinese"],
        "zonesServed": [
          { "_id": "zone_1", "name": "Indiranagar", "code": "IND" }
        ],
        "logo": "https://...",
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

#### 2. Approve Kitchen
```http
PATCH /api/admin/kitchens/:kitchenId/approve
Authorization: Bearer <admin_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Kitchen approved successfully",
  "data": {
    "kitchen": {
      "_id": "kitchen_id",
      "status": "ACTIVE",
      "isAcceptingOrders": true,
      "approvedBy": "admin_user_id",
      "approvedAt": "2024-01-16T14:25:00.000Z",
      ...
    }
  }
}
```

#### 3. Reject Kitchen
```http
PATCH /api/admin/kitchens/:kitchenId/reject
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "reason": "FSSAI license has expired. Please upload a valid license and ensure all documents are up to date."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Kitchen registration rejected",
  "data": {
    "kitchen": {
      "_id": "kitchen_id",
      "status": "PENDING_APPROVAL",
      "rejectionReason": "FSSAI license has expired...",
      "rejectedBy": "admin_user_id",
      "rejectedAt": "2024-01-16T14:30:00.000Z",
      ...
    }
  }
}
```

---

### Kitchen Dashboard (After Approval)

#### 1. Dashboard Overview
```http
GET /api/kitchens/dashboard?date=2024-01-16
Authorization: Bearer <kitchen_staff_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Kitchen dashboard retrieved",
  "data": {
    "kitchen": {
      "name": "Spice Kitchen",
      "logo": "...",
      "status": "ACTIVE",
      "operatingHours": { ... }
    },
    "todayStats": {
      "ordersCount": 45,
      "ordersRevenue": 12500,
      "pendingOrders": 5,
      "acceptedOrders": 15,
      "preparingOrders": 10,
      "readyOrders": 8,
      "completedOrders": 7,
      "lunchOrders": 25,
      "lunchRevenue": 7500,
      "dinnerOrders": 20,
      "dinnerRevenue": 5000
    },
    "batchStats": {
      "collectingBatches": 2,
      "readyBatches": 1,
      "dispatchedBatches": 3,
      "completedBatches": 5
    },
    "menuStats": {
      "totalMenuItems": 25,
      "activeMenuItems": 22,
      "unavailableItems": 3
    },
    "recentOrders": [...]
  }
}
```

#### 2. Menu Statistics
```http
GET /api/menu/my-kitchen/stats
Authorization: Bearer <kitchen_staff_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Menu statistics retrieved",
  "data": {
    "totalItems": 25,
    "activeItems": 22,
    "availableItems": 20,
    "inactiveItems": 3,
    "byCategory": {
      "Main Course": 10,
      "Starters": 8,
      "Desserts": 5,
      "Beverages": 2
    },
    "byMenuType": {
      "MEAL_MENU": 2,
      "ON_DEMAND_MENU": 23
    },
    "mealMenuStatus": {
      "lunch": {
        "exists": true,
        "item": { "name": "Thali", "price": 150 },
        "isAvailable": true
      },
      "dinner": {
        "exists": true,
        "item": { "name": "Dinner Combo", "price": 180 },
        "isAvailable": true
      }
    }
  }
}
```

#### 3. Kitchen Analytics
```http
GET /api/kitchens/analytics?dateFrom=2024-01-01&dateTo=2024-01-31&groupBy=day
Authorization: Bearer <kitchen_staff_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Kitchen analytics retrieved",
  "data": {
    "summary": {
      "totalOrders": 450,
      "totalRevenue": 125000,
      "completionRate": 92.5,
      "cancelRate": 7.5,
      "avgOrderValue": 278
    },
    "timeline": [
      { "date": "2024-01-01", "orders": 15, "revenue": 4200 },
      { "date": "2024-01-02", "orders": 18, "revenue": 5100 },
      ...
    ],
    "topItems": [
      { "itemName": "Paneer Tikka", "orders": 85, "revenue": 12750 },
      { "itemName": "Butter Chicken", "orders": 72, "revenue": 14400 },
      ...
    ]
  }
}
```

---

## 🔐 Authentication Flow

### Mobile App (Kitchen Staff)

1. **Firebase OTP Login**
   ```
   User enters phone number → Firebase sends OTP
   → User enters OTP → Firebase verifies
   → App gets Firebase ID token
   ```

2. **Sync with Backend**
   ```http
   POST /api/auth/sync
   Authorization: Bearer <firebase_id_token>
   ```

3. **Backend Response**
   ```json
   {
     "success": true,
     "message": "User synced",
     "data": {
       "user": {
         "_id": "...",
         "role": "KITCHEN_STAFF",
         "kitchenId": "..."
       },
       "token": "jwt_token_here",
       "kitchen": {
         "status": "PENDING_APPROVAL | ACTIVE",
         "rejectionReason": "..." // if rejected
       }
     }
   }
   ```

4. **App Routing Logic**
   ```javascript
   if (user.role === 'KITCHEN_STAFF') {
     if (kitchen.status === 'PENDING_APPROVAL') {
       if (kitchen.rejectionReason) {
         // Show rejection screen with edit/resubmit option
         navigate('RejectionScreen');
       } else {
         // Show pending approval screen
         navigate('PendingApprovalScreen');
       }
     } else if (kitchen.status === 'ACTIVE') {
       // Show kitchen dashboard with 5 tabs
       navigate('KitchenDashboard');
     }
   }
   ```

### Web Portal (Admin)

1. **Admin Login**
   ```http
   POST /api/auth/admin/login
   Content-Type: application/json

   {
     "username": "admin",
     "password": "password"
   }
   ```

2. **Backend Response**
   ```json
   {
     "success": true,
     "message": "Login successful",
     "data": {
       "user": {
         "_id": "...",
         "role": "ADMIN",
         "name": "Admin User"
       },
       "token": "jwt_token_here"
     }
   }
   ```

3. **App Routing Logic**
   ```javascript
   if (user.role === 'ADMIN') {
     // Show admin dashboard with sidebar
     navigate('AdminDashboard');
     // Sidebar includes: Kitchen Approvals, Users, Orders, etc.
   }
   ```

---

## 🗄️ Database Schema

### Kitchen Schema
```javascript
{
  _id: ObjectId,
  name: String,
  code: String (unique),
  type: "TIFFSY" | "PARTNER",
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_APPROVAL" | "DELETED",

  // Address
  address: {
    addressLine1: String,
    addressLine2: String,
    locality: String,
    city: String,
    state: String,
    pincode: String,
    coordinates: { latitude: Number, longitude: Number }
  },

  // Contact
  contactPhone: String,
  contactEmail: String,
  ownerName: String,
  ownerPhone: String,

  // Operations
  cuisineTypes: [String],
  zonesServed: [ObjectId] (ref: Zone),
  operatingHours: {
    lunch: { startTime: String, endTime: String },
    dinner: { startTime: String, endTime: String },
    onDemand: { startTime: String, endTime: String, isAlwaysOpen: Boolean }
  },
  isAcceptingOrders: Boolean,

  // Branding
  logo: String (URL),
  coverImage: String (URL),
  description: String,

  // Approval Tracking
  approvedBy: ObjectId (ref: User),
  approvedAt: Date,
  rejectionReason: String,
  rejectedBy: ObjectId (ref: User),
  rejectedAt: Date,

  // Metadata
  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}
```

### User Schema (Kitchen Staff)
```javascript
{
  _id: ObjectId,
  role: "KITCHEN_STAFF",
  name: String,
  email: String,
  phone: String,
  kitchenId: ObjectId (ref: Kitchen),
  fcmTokens: [String],
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED",
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🧪 Testing Guide

### Step 1: Test Kitchen Registration

1. **Create Test Kitchen via Mobile App/Postman**
   ```bash
   POST https://tiffsy-backend.onrender.com/api/auth/register-kitchen
   Authorization: Bearer <firebase_token>
   Content-Type: application/json

   {
     "name": "Test Kitchen",
     "cuisineTypes": ["North Indian"],
     "address": {
       "addressLine1": "123 Test St",
       "locality": "Test Area",
       "city": "Bangalore",
       "pincode": "560001"
     },
     "zonesServed": ["<valid_zone_id>"],
     "operatingHours": {
       "lunch": { "startTime": "11:00", "endTime": "15:00" },
       "dinner": { "startTime": "19:00", "endTime": "23:00" }
     },
     "contactPhone": "9876543210",
     "contactEmail": "test@kitchen.com",
     "ownerName": "Test Owner",
     "logo": "https://via.placeholder.com/150",
     "staffName": "Test Staff"
   }
   ```

2. **Verify in Database**
   ```javascript
   db.kitchens.findOne({ name: "Test Kitchen" })
   // Should have status: "PENDING_APPROVAL"

   db.users.findOne({ phone: "9876543210" })
   // Should have role: "KITCHEN_STAFF", kitchenId: <kitchen_id>
   ```

### Step 2: Test Admin Approval

1. **Admin Login**
   ```bash
   POST https://tiffsy-backend.onrender.com/api/auth/admin/login
   Content-Type: application/json

   {
     "username": "admin",
     "password": "your_password"
   }
   ```
   Save the JWT token from response.

2. **Get Pending Kitchens**
   ```bash
   GET https://tiffsy-backend.onrender.com/api/admin/kitchens/pending
   Authorization: Bearer <admin_jwt_token>
   ```
   You should see your test kitchen in the list.

3. **Approve Kitchen**
   ```bash
   PATCH https://tiffsy-backend.onrender.com/api/admin/kitchens/<kitchen_id>/approve
   Authorization: Bearer <admin_jwt_token>
   ```

   Verify:
   ```javascript
   db.kitchens.findOne({ _id: ObjectId("<kitchen_id>") })
   // Should have: status: "ACTIVE", approvedBy: <admin_id>, approvedAt: Date
   ```

4. **Test Rejection (Create Another Test Kitchen)**
   ```bash
   PATCH https://tiffsy-backend.onrender.com/api/admin/kitchens/<kitchen_id>/reject
   Authorization: Bearer <admin_jwt_token>
   Content-Type: application/json

   {
     "reason": "Test rejection: Please update FSSAI license"
   }
   ```

   Verify:
   ```javascript
   db.kitchens.findOne({ _id: ObjectId("<kitchen_id>") })
   // Should have: status: "PENDING_APPROVAL", rejectionReason: "Test rejection...", rejectedBy, rejectedAt
   ```

### Step 3: Test Kitchen Dashboard (After Approval)

1. **Kitchen Staff Login**
   ```bash
   POST https://tiffsy-backend.onrender.com/api/auth/sync
   Authorization: Bearer <firebase_token>
   ```
   Should return kitchen with status: "ACTIVE"

2. **Test Dashboard Endpoint**
   ```bash
   GET https://tiffsy-backend.onrender.com/api/kitchens/dashboard
   Authorization: Bearer <kitchen_jwt_token>
   ```

3. **Test Menu Stats**
   ```bash
   GET https://tiffsy-backend.onrender.com/api/menu/my-kitchen/stats
   Authorization: Bearer <kitchen_jwt_token>
   ```

---

## 🚨 Troubleshooting

### Issue: "JSON Parse error: Unexpected character: <"

**Cause:** Server returning HTML instead of JSON (usually 404 or 500 error page)

**Solution:**
1. **Restart the backend server** to pick up new routes
   ```bash
   # Stop the server (Ctrl+C)
   # Start again
   npm start
   ```

2. Verify routes are registered:
   ```bash
   # Check if routes are exported
   grep -n "getPendingKitchens" src/admin/admin.controller.js

   # Should show:
   # - export function declaration
   # - function in default export object
   ```

3. Test with curl to see actual response:
   ```bash
   curl -i https://tiffsy-backend.onrender.com/api/admin/kitchens/pending \
     -H "Authorization: Bearer <token>"
   ```

### Issue: "Kitchen not found" When Approving

**Cause:** Invalid kitchen ID or kitchen doesn't exist

**Solution:**
```javascript
// Check if kitchen exists
db.kitchens.findOne({ _id: ObjectId("<kitchen_id>") })

// Check if ID is valid 24-char hex string
// Example: "507f1f77bcf86cd799439011"
```

### Issue: "Pending kitchens list is empty"

**Cause:** No kitchens with PENDING_APPROVAL status

**Solution:**
```javascript
// Check status distribution
db.kitchens.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } }
])

// Create test kitchen with correct status
db.kitchens.insertOne({
  name: "Test Kitchen",
  type: "PARTNER",
  status: "PENDING_APPROVAL",
  // ... other required fields
})
```

### Issue: Admin can't access endpoint (403 Forbidden)

**Cause:** User doesn't have ADMIN role

**Solution:**
```javascript
// Verify user has ADMIN role
db.users.findOne({ _id: ObjectId("<user_id>") })

// Update user role if needed
db.users.updateOne(
  { _id: ObjectId("<user_id>") },
  { $set: { role: "ADMIN" } }
)
```

---

## ✅ Implementation Checklist

### Backend Implementation
- [x] Kitchen schema with rejection fields (rejectionReason, rejectedBy, rejectedAt)
- [x] Kitchen registration endpoint (POST /api/auth/register-kitchen)
- [x] Kitchen resubmission endpoint (PATCH /api/auth/resubmit-kitchen)
- [x] Kitchen status endpoint (GET /api/auth/my-kitchen-status)
- [x] Admin pending kitchens endpoint (GET /api/admin/kitchens/pending)
- [x] Admin approve endpoint (PATCH /api/admin/kitchens/:id/approve)
- [x] Admin reject endpoint (PATCH /api/admin/kitchens/:id/reject)
- [x] Kitchen dashboard endpoint (GET /api/kitchens/dashboard)
- [x] Menu stats endpoint (GET /api/menu/my-kitchen/stats)
- [x] Kitchen analytics endpoint (GET /api/kitchens/analytics)
- [x] Validation schemas for all endpoints
- [x] Audit logging for approval/rejection actions
- [x] Access control (ADMIN only for approvals, KITCHEN_STAFF for dashboard)

### Testing
- [ ] Kitchen registration creates Kitchen + User atomically
- [ ] Zone validation works (no duplicate PARTNER per zone)
- [ ] Pending kitchens list shows correct kitchens
- [ ] Admin can approve kitchen (status changes to ACTIVE)
- [ ] Admin can reject kitchen (reason is stored, status stays PENDING_APPROVAL)
- [ ] Kitchen staff can login before approval (sees pending screen)
- [ ] Kitchen staff can see rejection reason
- [ ] Kitchen staff can resubmit after rejection
- [ ] After approval, kitchen dashboard loads with correct data
- [ ] Kitchen staff can only access their own kitchen data
- [ ] Admin can access any kitchen data

---

## 🎯 Key Business Rules

1. **Kitchen Types**
   - **TIFFSY**: Created by admin, immediately ACTIVE
   - **PARTNER**: Self-registered, requires admin approval (PENDING_APPROVAL)

2. **Zone Constraint**
   - Only ONE PARTNER kitchen allowed per zone
   - Multiple TIFFSY kitchens can serve same zone
   - Validated during registration

3. **Login States**
   - Kitchen staff CAN login before approval
   - PENDING_APPROVAL → Show "awaiting approval" screen
   - ACTIVE → Show full kitchen dashboard
   - Rejected → Show rejection reason + resubmit option

4. **Rejection Flow**
   - Kitchen status remains PENDING_APPROVAL (allows resubmission)
   - Rejection reason must be 10-500 characters
   - Kitchen staff can edit and resubmit unlimited times

5. **Approval Flow**
   - Sets status to ACTIVE
   - Enables order acceptance (isAcceptingOrders = true)
   - Clears any previous rejection details
   - Records admin ID and timestamp

---

## 📞 Support & Maintenance

### Common Admin Tasks

**Manually approve a kitchen (if needed):**
```javascript
db.kitchens.updateOne(
  { _id: ObjectId("<kitchen_id>") },
  {
    $set: {
      status: "ACTIVE",
      approvedBy: ObjectId("<admin_id>"),
      approvedAt: new Date(),
      isAcceptingOrders: true
    },
    $unset: {
      rejectionReason: "",
      rejectedBy: "",
      rejectedAt: ""
    }
  }
)
```

**Reset kitchen to pending (for testing):**
```javascript
db.kitchens.updateOne(
  { _id: ObjectId("<kitchen_id>") },
  {
    $set: {
      status: "PENDING_APPROVAL",
      isAcceptingOrders: false
    },
    $unset: {
      approvedBy: "",
      approvedAt: "",
      rejectionReason: "",
      rejectedBy: "",
      rejectedAt: ""
    }
  }
)
```

---

**Document Version:** 2.0
**Last Updated:** 2026-01-17
**Status:** Implementation Complete ✅
**Next Steps:** Restart server and test endpoints
