# Tiffsy Admin API Documentation

Base URL: `/api`

All admin endpoints require JWT authentication via the Authorization header.

---

## Authentication

### Admin Login

Authenticate admin user and receive JWT token.

**Endpoint:** `POST /api/auth/admin/login`

**Authentication:** None (public endpoint)

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "admin",
  "password": "SecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "phone": "9876543210",
      "role": "ADMIN",
      "name": "Admin User",
      "email": "admin@tiffsy.com",
      "username": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  }
}
```

---

### Admin Change Password

Change the currently authenticated admin's password.

**Endpoint:** `POST /api/auth/admin/change-password`

**Authentication:** Required (JWT)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request Body:**
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewSecurePassword456",
  "confirmPassword": "NewSecurePassword456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### Admin Refresh Token

Refresh the JWT token before it expires.

**Endpoint:** `POST /api/auth/admin/refresh`

**Authentication:** Required (JWT)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:** None

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  }
}
```

---

## Dashboard

### Get Admin Dashboard

Retrieve dashboard overview with key metrics.

**Endpoint:** `GET /api/admin/dashboard`

**Authentication:** Required (JWT, Admin role)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:** None

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Dashboard retrieved",
  "data": {
    "overview": {
      "totalOrders": 15420,
      "totalRevenue": 2845600,
      "activeCustomers": 3250,
      "activeKitchens": 12
    },
    "today": {
      "orders": 145,
      "revenue": 28750,
      "newCustomers": 23
    },
    "pendingActions": {
      "pendingOrders": 18,
      "pendingRefunds": 3,
      "pendingKitchenApprovals": 2
    },
    "recentActivity": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "action": "CREATE",
        "entityType": "USER",
        "performedBy": {
          "name": "Admin User",
          "role": "ADMIN"
        },
        "createdAt": "2025-01-07T10:30:00.000Z"
      }
    ]
  }
}
```

---

## System Configuration

### Get System Configuration

**Endpoint:** `GET /api/admin/config`

**Authentication:** Required (JWT, Admin role)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "System configuration",
  "data": {
    "config": {
      "cutoffTimes": { "lunch": "11:00", "dinner": "21:00" },
      "batching": { "maxBatchSize": 15, "failedOrderPolicy": "NO_RETURN", "autoDispatchDelay": 0 },
      "fees": { "deliveryFee": 30, "serviceFee": 5, "packagingFee": 10, "handlingFee": 0 },
      "taxes": [{ "name": "GST", "rate": 5, "enabled": true }],
      "refund": { "maxRetries": 3, "autoProcessDelay": 0 }
    }
  }
}
```

---

### Update System Configuration

**Endpoint:** `PUT /api/admin/config`

**Authentication:** Required (JWT, Admin role)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request Body:**
```json
{
  "cutoffTimes": { "lunch": "10:30", "dinner": "20:30" },
  "batching": { "maxBatchSize": 20, "failedOrderPolicy": "RETURN_TO_KITCHEN", "autoDispatchDelay": 5 },
  "fees": { "deliveryFee": 35, "serviceFee": 10, "packagingFee": 15, "handlingFee": 5 },
  "taxes": [{ "name": "GST", "rate": 5, "enabled": true }],
  "refund": { "maxRetries": 5, "autoProcessDelay": 10 }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Configuration updated",
  "data": { "config": { ... } }
}
```

---

## Guidelines

### Get Guidelines

**Endpoint:** `GET /api/admin/guidelines`

**Authentication:** Required (JWT, Admin or Kitchen Staff role)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Guidelines retrieved",
  "data": {
    "guidelines": {
      "menuGuidelines": "All food items must be freshly prepared...",
      "kitchenGuidelines": "Kitchen must maintain FSSAI standards...",
      "qualityPolicy": "Quality checks must be performed before dispatch..."
    }
  }
}
```

---

### Update Guidelines

**Endpoint:** `PUT /api/admin/guidelines`

**Authentication:** Required (JWT, Admin role)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request Body:**
```json
{
  "menuGuidelines": "All food items must be freshly prepared...",
  "kitchenGuidelines": "Kitchen must maintain FSSAI standards...",
  "qualityPolicy": "Quality checks must be performed before dispatch..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Guidelines updated",
  "data": { "guidelines": { ... } }
}
```

---

## User Management

### Create User

**Endpoint:** `POST /api/admin/users`

**Authentication:** Required (JWT, Admin role)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request Body (Kitchen Staff):**
```json
{
  "phone": "9876543210",
  "role": "KITCHEN_STAFF",
  "name": "Ramesh Kumar",
  "email": "ramesh@kitchen.com",
  "kitchenId": "507f1f77bcf86cd799439011"
}
```

**Request Body (Driver):**
```json
{
  "phone": "9876543211",
  "role": "DRIVER",
  "name": "Suresh Singh",
  "email": "suresh@driver.com"
}
```

**Request Body (Admin):**
```json
{
  "phone": "9876543212",
  "role": "ADMIN",
  "name": "Priya Sharma",
  "email": "priya@admin.com",
  "username": "priya_admin",
  "password": "SecurePassword123"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439013",
      "phone": "9876543210",
      "role": "KITCHEN_STAFF",
      "name": "Ramesh Kumar",
      "email": "ramesh@kitchen.com",
      "status": "ACTIVE",
      "kitchenId": "507f1f77bcf86cd799439011",
      "createdAt": "2025-01-07T10:30:00.000Z"
    }
  }
}
```

---

### Get All Users

**Endpoint:** `GET /api/admin/users`

**Authentication:** Required (JWT, Admin role)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Query Parameters:**
- `role`: CUSTOMER, KITCHEN_STAFF, DRIVER, ADMIN
- `status`: ACTIVE, INACTIVE, SUSPENDED, DELETED
- `kitchenId`: Filter by kitchen ID
- `search`: Search by name or phone
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Users retrieved",
  "data": {
    "users": [
      {
        "_id": "507f1f77bcf86cd799439013",
        "phone": "9876543210",
        "role": "KITCHEN_STAFF",
        "name": "Ramesh Kumar",
        "status": "ACTIVE",
        "kitchenId": { "_id": "507f1f77bcf86cd799439011", "name": "Fresh Kitchen" }
      }
    ],
    "counts": { "total": 150, "active": 120, "inactive": 30, "byRole": { "CUSTOMER": 100, "KITCHEN_STAFF": 25, "DRIVER": 20, "ADMIN": 5 } },
    "pagination": { "page": 1, "limit": 20, "total": 150, "pages": 8 }
  }
}
```

---

### Get User by ID

**Endpoint:** `GET /api/admin/users/:id`

**Authentication:** Required (JWT, Admin role)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User retrieved",
  "data": {
    "user": { "_id": "507f1f77bcf86cd799439013", "phone": "9876543210", "role": "KITCHEN_STAFF", "name": "Ramesh Kumar", "status": "ACTIVE" },
    "kitchen": { ... },
    "activity": { "lastLogin": "2025-01-07T08:00:00.000Z", "ordersHandled": 450, "deliveriesCompleted": 0 }
  }
}
```

---

### Update User

**Endpoint:** `PUT /api/admin/users/:id`

**Authentication:** Required (JWT, Admin role)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Ramesh Kumar Updated",
  "email": "ramesh.new@kitchen.com",
  "kitchenId": "507f1f77bcf86cd799439012"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": { "user": { ... } }
}
```

---

### Activate User

**Endpoint:** `PATCH /api/admin/users/:id/activate`

**Authentication:** Required (JWT, Admin role)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:** None

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User activated",
  "data": { "user": { "_id": "507f1f77bcf86cd799439013", "status": "ACTIVE" } }
}
```

---

### Deactivate User

**Endpoint:** `PATCH /api/admin/users/:id/deactivate`

**Authentication:** Required (JWT, Admin role)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:** None

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User deactivated",
  "data": { "user": { "_id": "507f1f77bcf86cd799439013", "status": "INACTIVE" } }
}
```

---

### Suspend User

**Endpoint:** `PATCH /api/admin/users/:id/suspend`

**Authentication:** Required (JWT, Admin role)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "Policy violation - multiple customer complaints"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User suspended",
  "data": { "user": { "_id": "507f1f77bcf86cd799439013", "status": "SUSPENDED", "suspensionReason": "Policy violation - multiple customer complaints", "suspendedAt": "2025-01-07T10:30:00.000Z" } }
}
```

---

### Delete User

**Endpoint:** `DELETE /api/admin/users/:id`

**Authentication:** Required (JWT, Admin role)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User deleted"
}
```

---

### Reset User Password

**Endpoint:** `POST /api/admin/users/:id/reset-password`

**Authentication:** Required (JWT, Admin role)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request Body:**
```json
{
  "newPassword": "NewSecurePassword789"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

## Audit Logs

### Get Audit Logs

**Endpoint:** `GET /api/admin/audit-logs`

**Authentication:** Required (JWT, Admin role)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Query Parameters:**
- `userId`: Filter by user who performed the action
- `action`: CREATE, UPDATE, DELETE, ACTIVATE, DEACTIVATE
- `entityType`: USER, KITCHEN, ORDER, ZONE, etc.
- `entityId`: Filter by specific entity ID
- `dateFrom`: Start date filter
- `dateTo`: End date filter
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Audit logs retrieved",
  "data": {
    "logs": [{ "_id": "507f1f77bcf86cd799439014", "action": "CREATE", "entityType": "USER", "entityId": "507f1f77bcf86cd799439013", "performedBy": { "name": "Admin User", "role": "ADMIN" }, "details": { ... }, "createdAt": "2025-01-07T10:30:00.000Z" }],
    "pagination": { "page": 1, "limit": 50, "total": 245, "pages": 5 }
  }
}
```

---

### Get Audit Log by ID

**Endpoint:** `GET /api/admin/audit-logs/:id`

**Authentication:** Required (JWT, Admin role)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Audit log retrieved",
  "data": { "log": { "_id": "507f1f77bcf86cd799439014", "action": "CREATE", "entityType": "USER", "entityId": "507f1f77bcf86cd799439013", "performedBy": { "name": "Admin User", "role": "ADMIN", "phone": "9876543200" }, "details": { ... }, "createdAt": "2025-01-07T10:30:00.000Z" } }
}
```

---

## Reports

### Get Reports

**Endpoint:** `GET /api/admin/reports`

**Authentication:** Required (JWT, Admin role)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Query Parameters:**
- `type` (required): ORDERS, REVENUE, VOUCHERS, REFUNDS
- `segmentBy`: CITY, ZONE, KITCHEN
- `dateFrom`: Start date filter
- `dateTo`: End date filter
- `kitchenId`: Filter by kitchen
- `zoneId`: Filter by zone

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Report generated",
  "data": { "report": { "type": "ORDERS", "segmentBy": "KITCHEN", "data": [{ "_id": "507f1f77bcf86cd799439011", "totalOrders": 450, "totalValue": 112500, "entity": { "name": "Fresh Kitchen", "code": "FK001" } }] } }
}
```

---

### Export Report

**Endpoint:** `GET /api/admin/reports/export`

**Authentication:** Required (JWT, Admin role)

**Query Parameters:**
- `type` (required): ORDERS, REVENUE, VOUCHERS, REFUNDS
- `segmentBy`: CITY, ZONE, KITCHEN
- `dateFrom`: Start date filter
- `dateTo`: End date filter
- `format`: CSV, EXCEL (default: CSV)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Report exported",
  "data": { "format": "CSV", "data": "..." }
}
```

---

## Kitchen Management

### Create Kitchen

**Endpoint:** `POST /api/kitchens`

**Authentication:** Required (JWT, Admin role)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Fresh Home Kitchen",
  "type": "TIFFSY",
  "authorizedFlag": true,
  "premiumFlag": false,
  "gourmetFlag": false,
  "logo": "https://example.com/logo.png",
  "coverImage": "https://example.com/cover.png",
  "description": "Authentic home-style cooking",
  "cuisineTypes": ["North Indian", "South Indian"],
  "address": { "addressLine1": "123 Main Street", "locality": "Andheri West", "city": "Mumbai", "state": "Maharashtra", "pincode": "400053" },
  "zonesServed": ["507f1f77bcf86cd799439020"],
  "operatingHours": { "lunch": { "startTime": "11:00", "endTime": "14:00" }, "dinner": { "startTime": "19:00", "endTime": "22:00" } },
  "contactPhone": "9876543210",
  "contactEmail": "kitchen@freshfood.com",
  "ownerName": "Rajesh Sharma",
  "ownerPhone": "9876543211"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Kitchen created successfully",
  "data": { "kitchen": { "_id": "507f1f77bcf86cd799439015", "name": "Fresh Home Kitchen", "code": "FHK001", "type": "TIFFSY", "status": "ACTIVE" } }
}
```

---

### Get All Kitchens

**Endpoint:** `GET /api/kitchens`

**Authentication:** Required (JWT, Admin or Kitchen Staff role)

**Query Parameters:**
- `type`: TIFFSY, PARTNER
- `status`: ACTIVE, INACTIVE, PENDING_APPROVAL, SUSPENDED
- `zoneId`: Filter by zone served
- `search`: Search by name or code
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Kitchens retrieved",
  "data": { "kitchens": [ ... ], "pagination": { ... } }
}
```

---

### Get Kitchen by ID

**Endpoint:** `GET /api/kitchens/:id`

**Authentication:** Required (JWT, Admin or Kitchen Staff role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Kitchen details",
  "data": { "kitchen": { ... }, "staff": [ ... ], "statistics": { "totalOrders": 1250, "activeOrders": 8, "averageRating": 4.5, "totalMenuItems": 24 } }
}
```

---

### Update Kitchen

**Endpoint:** `PUT /api/kitchens/:id`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "name": "Fresh Home Kitchen - Updated",
  "description": "Updated description",
  "cuisineTypes": ["North Indian", "South Indian", "Chinese"],
  "contactPhone": "9876543222"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Kitchen updated successfully",
  "data": { "kitchen": { ... } }
}
```

---

### Update Kitchen Type

**Endpoint:** `PATCH /api/kitchens/:id/type`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "type": "PARTNER"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Kitchen type updated",
  "data": { "kitchen": { ... } }
}
```

---

### Update Kitchen Flags

**Endpoint:** `PATCH /api/kitchens/:id/flags`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "authorizedFlag": true,
  "premiumFlag": true,
  "gourmetFlag": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Kitchen flags updated",
  "data": { "kitchen": { ... } }
}
```

---

### Update Zones Served

**Endpoint:** `PATCH /api/kitchens/:id/zones`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "zonesServed": ["507f1f77bcf86cd799439020", "507f1f77bcf86cd799439021"]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Zones updated",
  "data": { "kitchen": { ... } }
}
```

---

### Activate Kitchen

**Endpoint:** `PATCH /api/kitchens/:id/activate`

**Authentication:** Required (JWT, Admin role)

**Request Body:** None

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Kitchen activated",
  "data": { "kitchen": { ... } }
}
```

---

### Deactivate Kitchen

**Endpoint:** `PATCH /api/kitchens/:id/deactivate`

**Authentication:** Required (JWT, Admin role)

**Request Body:** None

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Kitchen deactivated",
  "data": { "kitchen": { ... }, "warning": "Kitchen has 5 pending order(s)" }
}
```

---

### Suspend Kitchen

**Endpoint:** `PATCH /api/kitchens/:id/suspend`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "reason": "Multiple hygiene violations reported"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Kitchen suspended",
  "data": { "kitchen": { ... } }
}
```

---

### Delete Kitchen

**Endpoint:** `DELETE /api/kitchens/:id`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Kitchen deleted successfully"
}
```

---

## Zone Management

### Create Zone

**Endpoint:** `POST /api/zones`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "pincode": "400053",
  "name": "Andheri West",
  "city": "Mumbai",
  "state": "Maharashtra",
  "timezone": "Asia/Kolkata",
  "status": "ACTIVE",
  "orderingEnabled": true,
  "displayOrder": 1
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Zone created successfully",
  "data": { "zone": { ... } }
}
```

---

### Get All Zones

**Endpoint:** `GET /api/zones`

**Authentication:** Required (JWT, Admin or Kitchen Staff role)

**Query Parameters:**
- `city`: Filter by city
- `status`: ACTIVE, INACTIVE
- `orderingEnabled`: true, false
- `search`: Search by name or pincode
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Zones retrieved",
  "data": { "zones": [ ... ], "pagination": { ... } }
}
```

---

### Get Zone by ID

**Endpoint:** `GET /api/zones/:id`

**Authentication:** Required (JWT, Admin or Kitchen Staff role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Zone retrieved",
  "data": { "zone": { ... }, "kitchens": [ ... ] }
}
```

---

### Update Zone

**Endpoint:** `PUT /api/zones/:id`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "name": "Andheri West - Updated",
  "displayOrder": 2
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Zone updated successfully",
  "data": { "zone": { ... } }
}
```

---

### Activate Zone

**Endpoint:** `PATCH /api/zones/:id/activate`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Zone activated successfully",
  "data": { "zone": { ... }, "warning": "No active kitchens serve this zone" }
}
```

---

### Deactivate Zone

**Endpoint:** `PATCH /api/zones/:id/deactivate`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Zone deactivated successfully",
  "data": { "zone": { ... }, "warning": "5 pending orders in this zone" }
}
```

---

### Toggle Zone Ordering

**Endpoint:** `PATCH /api/zones/:id/ordering`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "orderingEnabled": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Zone ordering updated",
  "data": { "orderingEnabled": false }
}
```

---

### Delete Zone

**Endpoint:** `DELETE /api/zones/:id`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Zone deleted successfully"
}
```

---

## Coupon Management

### Create Coupon

**Endpoint:** `POST /api/coupons`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "code": "WELCOME50",
  "name": "Welcome Discount",
  "description": "50% off on your first order",
  "discountType": "PERCENTAGE",
  "discountValue": 50,
  "maxDiscountAmount": 100,
  "minOrderValue": 200,
  "minItems": 1,
  "totalUsageLimit": 1000,
  "perUserLimit": 1,
  "targetUserType": "NEW_USERS",
  "isFirstOrderOnly": true,
  "validFrom": "2025-01-01T00:00:00.000Z",
  "validTill": "2025-03-31T23:59:59.000Z",
  "status": "ACTIVE",
  "isVisible": true,
  "displayOrder": 1,
  "termsAndConditions": "Valid on first order only. Maximum discount Rs. 100."
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Coupon created successfully",
  "data": { "coupon": { ... } }
}
```

---

### Get All Coupons

**Endpoint:** `GET /api/coupons`

**Authentication:** Required (JWT, Admin role)

**Query Parameters:**
- `status`: ACTIVE, INACTIVE, EXPIRED, EXHAUSTED
- `discountType`: PERCENTAGE, FLAT, FREE_DELIVERY
- `search`: Search by code or name
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Coupons retrieved",
  "data": { "coupons": [ ... ], "pagination": { ... } }
}
```

---

### Get Coupon by ID

**Endpoint:** `GET /api/coupons/:id`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Coupon retrieved",
  "data": { "coupon": { ... }, "usageStats": { "totalUsed": 250, "uniqueUsers": 250, "totalDiscountGiven": 22500, "remainingUses": 750 }, "recentUsage": [ ... ] }
}
```

---

### Update Coupon

**Endpoint:** `PUT /api/coupons/:id`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "name": "Welcome Discount - Extended",
  "discountValue": 60,
  "maxDiscountAmount": 150,
  "validTill": "2025-06-30T23:59:59.000Z"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Coupon updated successfully",
  "data": { "coupon": { ... } }
}
```

---

### Activate Coupon

**Endpoint:** `PATCH /api/coupons/:id/activate`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Coupon activated",
  "data": { "coupon": { ... } }
}
```

---

### Deactivate Coupon

**Endpoint:** `PATCH /api/coupons/:id/deactivate`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Coupon deactivated",
  "data": { "coupon": { ... } }
}
```

---

### Delete Coupon

**Endpoint:** `DELETE /api/coupons/:id`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Coupon deleted successfully"
}
```

---

### Expire Coupons

**Endpoint:** `POST /api/coupons/expire`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Coupons expired",
  "data": { "expiredCount": 5 }
}
```

---

## Voucher Management

### Get All Vouchers

**Endpoint:** `GET /api/vouchers/admin/all`

**Authentication:** Required (JWT, Admin role)

**Query Parameters:**
- `userId`: Filter by user ID
- `subscriptionId`: Filter by subscription ID
- `status`: AVAILABLE, REDEEMED, EXPIRED, RESTORED, CANCELLED
- `dateFrom`: Start date filter
- `dateTo`: End date filter
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Vouchers retrieved",
  "data": { "vouchers": [ ... ], "pagination": { ... } }
}
```

---

### Get Voucher Statistics

**Endpoint:** `GET /api/vouchers/admin/stats`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Voucher stats retrieved",
  "data": { "stats": { "totalVouchers": 5000, "availableVouchers": 3500, "redeemedVouchers": 1200, "expiredVouchers": 300 } }
}
```

---

### Expire Vouchers

**Endpoint:** `POST /api/vouchers/admin/expire`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Vouchers expired",
  "data": { "expiredCount": 45 }
}
```

---

### Admin Restore Vouchers

**Endpoint:** `POST /api/vouchers/admin/restore`

**Authentication:** Required (JWT, Admin role)

**Request Body (by voucher IDs):**
```json
{
  "voucherIds": ["507f1f77bcf86cd799439040", "507f1f77bcf86cd799439041"],
  "reason": "Order was cancelled due to kitchen issue"
}
```

**Request Body (by order ID):**
```json
{
  "orderId": "507f1f77bcf86cd799439050",
  "reason": "Order was cancelled due to delivery failure"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Vouchers restored",
  "data": { "restoredCount": 2 }
}
```

---

### Update Cutoff Times

**Endpoint:** `PUT /api/vouchers/cutoff-times`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "lunch": { "cutoffTime": "10:30" },
  "dinner": { "cutoffTime": "18:30" }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Cutoff times updated",
  "data": { "cutoffTimes": { ... } }
}
```

---

## Refund Management

### Get All Refunds

**Endpoint:** `GET /api/refunds/admin/all`

**Authentication:** Required (JWT, Admin role)

**Query Parameters:**
- `userId`: Filter by user ID
- `orderId`: Filter by order ID
- `status`: INITIATED, PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED
- `reason`: ORDER_REJECTED, ORDER_CANCELLED_BY_KITCHEN, ORDER_CANCELLED_BY_CUSTOMER, DELIVERY_FAILED, QUALITY_ISSUE, WRONG_ORDER, ADMIN_INITIATED, OTHER
- `dateFrom`: Start date filter
- `dateTo`: End date filter
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Refunds retrieved",
  "data": { "refunds": [ ... ], "pagination": { ... } }
}
```

---

### Get Refund Statistics

**Endpoint:** `GET /api/refunds/admin/stats`

**Authentication:** Required (JWT, Admin role)

**Query Parameters:**
- `dateFrom`: Start date filter
- `dateTo`: End date filter

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Refund stats retrieved",
  "data": { "stats": { "totalRefunds": 150, "pendingRefunds": 12, "completedRefunds": 130, "failedRefunds": 8, "totalAmountRefunded": 45000 } }
}
```

---

### Initiate Manual Refund

**Endpoint:** `POST /api/refunds/admin/manual`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "orderId": "507f1f77bcf86cd799439050",
  "amount": 200,
  "reason": "QUALITY_ISSUE",
  "reasonDetails": "Customer reported food was not fresh",
  "notes": "Partial refund for quality issue"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Refund initiated",
  "data": { "refund": { ... } }
}
```

---

### Process Refund

**Endpoint:** `POST /api/refunds/:id/process`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Refund processed",
  "data": { "refund": { ... } }
}
```

---

### Approve Refund

**Endpoint:** `PATCH /api/refunds/:id/approve`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Refund approved",
  "data": { "refund": { ... } }
}
```

---

### Cancel Refund

**Endpoint:** `PATCH /api/refunds/:id/cancel`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "reason": "Duplicate refund request"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Refund cancelled",
  "data": { "refund": { ... } }
}
```

---

### Retry Refund

**Endpoint:** `POST /api/refunds/:id/retry`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Refund retry initiated",
  "data": { "refund": { ... } }
}
```

---

### Process Failed Refunds

**Endpoint:** `POST /api/refunds/process-failed`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Failed refunds processed",
  "data": { "processedCount": 3, "successCount": 2, "failedCount": 1 }
}
```

---

## Order Management

### Get All Orders

**Endpoint:** `GET /api/orders/admin/all`

**Authentication:** Required (JWT, Admin role)

**Query Parameters:**
- `userId`: Filter by user ID
- `kitchenId`: Filter by kitchen ID
- `zoneId`: Filter by zone ID
- `status`: PLACED, ACCEPTED, REJECTED, PREPARING, READY, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, FAILED
- `menuType`: MEAL_MENU, ON_DEMAND_MENU
- `dateFrom`: Start date filter
- `dateTo`: End date filter
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Orders retrieved",
  "data": { "orders": [ ... ], "pagination": { ... } }
}
```

---

### Get Order Statistics

**Endpoint:** `GET /api/orders/admin/stats`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Order stats retrieved",
  "data": { "stats": { "totalOrders": 15420, "todayOrders": 145, "pendingOrders": 18, "deliveredOrders": 14500, "cancelledOrders": 720, "totalRevenue": 2845600 } }
}
```

---

### Admin Cancel Order

**Endpoint:** `PATCH /api/orders/:id/admin-cancel`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "reason": "Kitchen is unable to fulfill the order",
  "issueRefund": true,
  "restoreVouchers": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Order cancelled",
  "data": { "order": { ... }, "refund": { ... }, "vouchersRestored": 2 }
}
```

---

## Delivery Management

### Auto-Batch Orders

**Endpoint:** `POST /api/delivery/auto-batch`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "mealWindow": "LUNCH",
  "kitchenId": "507f1f77bcf86cd799439015"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Orders batched",
  "data": { "batchesCreated": 3, "ordersProcessed": 35 }
}
```

---

### Dispatch Batches

**Endpoint:** `POST /api/delivery/dispatch`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "mealWindow": "LUNCH"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Batches dispatched",
  "data": { "batchesDispatched": 5 }
}
```

---

### Get All Batches

**Endpoint:** `GET /api/delivery/admin/batches`

**Authentication:** Required (JWT, Admin role)

**Query Parameters:**
- `kitchenId`: Filter by kitchen ID
- `zoneId`: Filter by zone ID
- `driverId`: Filter by driver ID
- `status`: COLLECTING, READY_FOR_DISPATCH, DISPATCHED, IN_PROGRESS, COMPLETED, PARTIAL_COMPLETE, CANCELLED
- `dateFrom`: Start date filter
- `dateTo`: End date filter
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Batches retrieved",
  "data": { "batches": [ ... ], "pagination": { ... } }
}
```

---

### Get Delivery Statistics

**Endpoint:** `GET /api/delivery/admin/stats`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Delivery stats retrieved",
  "data": { "stats": { "totalBatches": 850, "activeBatches": 12, "completedBatches": 820, "failedDeliveries": 18, "avgDeliveryTime": 28 } }
}
```

---

### Update Batch Configuration

**Endpoint:** `PUT /api/delivery/config`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "maxBatchSize": 20,
  "failedOrderPolicy": "RETURN_TO_KITCHEN",
  "autoDispatchDelay": 10
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Batch config updated",
  "data": { "config": { ... } }
}
```

---

### Get Batch Configuration

**Endpoint:** `GET /api/delivery/config`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Batch config retrieved",
  "data": { "config": { "maxBatchSize": 15, "failedOrderPolicy": "NO_RETURN", "autoDispatchDelay": 0 } }
}
```

---

### Reassign Batch

**Endpoint:** `PATCH /api/delivery/batches/:batchId/reassign`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "driverId": "507f1f77bcf86cd799439085",
  "reason": "Original driver unavailable"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Batch reassigned",
  "data": { "batch": { ... } }
}
```

---

### Cancel Batch

**Endpoint:** `PATCH /api/delivery/batches/:batchId/cancel`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "reason": "Kitchen closed unexpectedly"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Batch cancelled",
  "data": { "batch": { ... } }
}
```

---

## Menu Management

### Disable Menu Item

**Endpoint:** `PATCH /api/menu/:id/disable`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "reason": "Item contains misleading information"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Menu item disabled",
  "data": { "menuItem": { "_id": "507f1f77bcf86cd799439090", "status": "DISABLED_BY_ADMIN" } }
}
```

---

### Enable Menu Item

**Endpoint:** `PATCH /api/menu/:id/enable`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Menu item enabled",
  "data": { "menuItem": { "_id": "507f1f77bcf86cd799439090", "status": "ACTIVE" } }
}
```

---

## Subscription Plan Management

### Create Plan

**Endpoint:** `POST /api/subscriptions/plans`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "name": "Monthly Meal Plan",
  "description": "30 days of delicious home-style meals",
  "durationDays": 30,
  "vouchersPerDay": 2,
  "voucherValidityDays": 90,
  "price": 2999,
  "originalPrice": 3499,
  "coverageRules": { "includesAddons": false, "addonValuePerVoucher": 50, "mealTypes": ["BOTH"] },
  "applicableZoneIds": ["507f1f77bcf86cd799439020"],
  "displayOrder": 1,
  "badge": "POPULAR",
  "features": ["60 meal vouchers", "Valid for 90 days"],
  "status": "ACTIVE"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Plan created successfully",
  "data": { "plan": { ... } }
}
```

---

### Get All Plans

**Endpoint:** `GET /api/subscriptions/plans`

**Authentication:** Required (JWT, Admin role)

**Query Parameters:**
- `status`: ACTIVE, INACTIVE, ARCHIVED
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Plans retrieved",
  "data": { "plans": [ ... ], "pagination": { ... } }
}
```

---

### Update Plan

**Endpoint:** `PUT /api/subscriptions/plans/:id`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "name": "Monthly Meal Plan - Premium",
  "price": 2799,
  "features": [ ... ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Plan updated successfully",
  "data": { "plan": { ... } }
}
```

---

### Activate Plan

**Endpoint:** `PATCH /api/subscriptions/plans/:id/activate`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Plan activated",
  "data": { "plan": { ... } }
}
```

---

### Deactivate Plan

**Endpoint:** `PATCH /api/subscriptions/plans/:id/deactivate`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Plan deactivated",
  "data": { "plan": { ... } }
}
```

---

### Archive Plan

**Endpoint:** `PATCH /api/subscriptions/plans/:id/archive`

**Authentication:** Required (JWT, Admin role)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Plan archived",
  "data": { "plan": { ... } }
}
```

---

### Get All Subscriptions

**Endpoint:** `GET /api/subscriptions/admin/all`

**Authentication:** Required (JWT, Admin role)

**Query Parameters:**
- `userId`: Filter by user ID
- `planId`: Filter by plan ID
- `status`: ACTIVE, EXPIRED, CANCELLED
- `dateFrom`: Start date filter
- `dateTo`: End date filter
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Subscriptions retrieved",
  "data": { "subscriptions": [ ... ], "pagination": { ... } }
}
```

---

### Admin Cancel Subscription

**Endpoint:** `POST /api/subscriptions/:id/admin-cancel`

**Authentication:** Required (JWT, Admin role)

**Request Body:**
```json
{
  "reason": "Customer requested cancellation",
  "issueRefund": true,
  "refundAmount": 1500
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Subscription cancelled",
  "data": { "subscription": { ... }, "refund": { ... } }
}
```

---

## Error Responses

All endpoints may return:

**400 Bad Request:**
```json
{
  "success": false,
  "message": "Validation error message"
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "message": "Access denied"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Resource not found"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "message": "Server error"
}
```
