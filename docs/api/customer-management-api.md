# Customer & User Management API

> **PROMPT**: Implement user management for the admin dashboard. Manage all user types: CUSTOMER, KITCHEN_STAFF, DRIVER, ADMIN. Admin can view users, create staff/drivers/admins, update profiles, activate/deactivate/suspend accounts, and reset passwords. Implement user listing with role/status filters, user detail view, staff creation form (with kitchen assignment for KITCHEN_STAFF), and account status management.

---

## Authentication

All admin endpoints require JWT token:

```
Authorization: Bearer <jwt_token>
```

---

## User Roles

| Role | Description | Created By |
|------|-------------|------------|
| CUSTOMER | App users who order food | Self-registration via Firebase OTP |
| KITCHEN_STAFF | Kitchen employees managing orders | Admin creates |
| DRIVER | Delivery personnel | Admin creates |
| ADMIN | System administrators | Admin creates |

---

## Endpoints

### 1. Get All Users

**GET** `/api/admin/users`

Fetch all users with filters.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| role | string | No | `CUSTOMER`, `KITCHEN_STAFF`, `DRIVER`, `ADMIN` |
| status | string | No | `ACTIVE`, `INACTIVE`, `SUSPENDED`, `DELETED` |
| kitchenId | string | No | Filter staff by kitchen |
| search | string | No | Search by name, phone, email |
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 20, max: 100) |

**Request:**
```
GET /api/admin/users?role=CUSTOMER&status=ACTIVE&page=1&limit=20
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "6789user123abc456789ab01",
        "phone": "9876543210",
        "role": "CUSTOMER",
        "name": "John Doe",
        "email": "john@example.com",
        "dietaryPreferences": ["VEG"],
        "profileImage": "https://cdn.tiffsy.com/users/john-profile.jpg",
        "status": "ACTIVE",
        "lastLoginAt": "2025-01-10T08:00:00.000Z",
        "createdAt": "2024-12-01T10:00:00.000Z"
      },
      {
        "_id": "6789user123abc456789ab02",
        "phone": "9876543211",
        "role": "CUSTOMER",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "dietaryPreferences": ["NON_VEG", "EGGETARIAN"],
        "profileImage": null,
        "status": "ACTIVE",
        "lastLoginAt": "2025-01-09T18:00:00.000Z",
        "createdAt": "2024-11-15T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1250,
      "page": 1,
      "limit": 20,
      "pages": 63
    }
  }
}
```

**Response for Staff:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "6789staff123abc456789ab01",
        "phone": "9876543220",
        "role": "KITCHEN_STAFF",
        "name": "Ramesh Kumar",
        "email": "ramesh@tiffsy.com",
        "kitchenId": {
          "_id": "6789def123abc456789def01",
          "name": "Tiffsy Central Kitchen",
          "code": "KIT-A2B3C"
        },
        "status": "ACTIVE",
        "lastLoginAt": "2025-01-10T06:00:00.000Z",
        "createdAt": "2024-06-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 20,
      "pages": 2
    }
  }
}
```

---

### 2. Get User by ID

**GET** `/api/admin/users/:id`

Fetch complete user details.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request:**
```
GET /api/admin/users/6789user123abc456789ab01
```

**Response (200) - Customer:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "6789user123abc456789ab01",
      "phone": "9876543210",
      "role": "CUSTOMER",
      "name": "John Doe",
      "email": "john@example.com",
      "dietaryPreferences": ["VEG"],
      "profileImage": "https://cdn.tiffsy.com/users/john-profile.jpg",
      "firebaseUid": "firebase_uid_123",
      "status": "ACTIVE",
      "lastLoginAt": "2025-01-10T08:00:00.000Z",
      "fcmTokens": ["fcm_token_1", "fcm_token_2"],
      "createdAt": "2024-12-01T10:00:00.000Z",
      "updatedAt": "2025-01-10T08:00:00.000Z"
    },
    "stats": {
      "totalOrders": 45,
      "completedOrders": 42,
      "cancelledOrders": 3,
      "activeSubscriptions": 1,
      "availableVouchers": 12,
      "totalSpent": 15600
    },
    "addresses": [
      {
        "_id": "6789addr123abc456789ab01",
        "label": "Home",
        "addressLine1": "123, Tower A",
        "locality": "Fort",
        "city": "Mumbai",
        "pincode": "400001",
        "isDefault": true
      }
    ]
  }
}
```

**Response (200) - Kitchen Staff:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "6789staff123abc456789ab01",
      "phone": "9876543220",
      "role": "KITCHEN_STAFF",
      "name": "Ramesh Kumar",
      "email": "ramesh@tiffsy.com",
      "kitchenId": {
        "_id": "6789def123abc456789def01",
        "name": "Tiffsy Central Kitchen",
        "code": "KIT-A2B3C",
        "status": "ACTIVE"
      },
      "status": "ACTIVE",
      "lastLoginAt": "2025-01-10T06:00:00.000Z",
      "createdAt": "2024-06-01T10:00:00.000Z"
    },
    "stats": {
      "ordersProcessedToday": 45,
      "ordersProcessedThisMonth": 1250
    }
  }
}
```

**Response (200) - Admin:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "6789admin123abc456789ab01",
      "phone": "9876543200",
      "role": "ADMIN",
      "name": "Admin User",
      "email": "admin@tiffsy.com",
      "username": "admin",
      "status": "ACTIVE",
      "lastLoginAt": "2025-01-10T09:00:00.000Z",
      "createdAt": "2024-01-01T10:00:00.000Z"
    }
  }
}
```

---

### 3. Create User (Staff/Driver/Admin)

**POST** `/api/admin/users`

Create new staff, driver, or admin user.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request (Kitchen Staff):**
```json
{
  "phone": "9876543225",
  "role": "KITCHEN_STAFF",
  "name": "Suresh Patel",
  "email": "suresh@tiffsy.com",
  "kitchenId": "6789def123abc456789def01"
}
```

**Request (Driver):**
```json
{
  "phone": "9876543230",
  "role": "DRIVER",
  "name": "Vijay Singh",
  "email": "vijay@tiffsy.com"
}
```

**Request (Admin):**
```json
{
  "phone": "9876543240",
  "role": "ADMIN",
  "name": "New Admin",
  "email": "newadmin@tiffsy.com",
  "username": "newadmin",
  "password": "SecurePass@123"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "6789staff123abc456789ab02",
      "phone": "9876543225",
      "role": "KITCHEN_STAFF",
      "name": "Suresh Patel",
      "email": "suresh@tiffsy.com",
      "kitchenId": "6789def123abc456789def01",
      "status": "ACTIVE",
      "createdAt": "2025-01-10T10:00:00.000Z"
    }
  },
  "message": "User created successfully"
}
```

**Validation Errors:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Kitchen ID is required for Kitchen Staff"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_ERROR",
    "message": "User with this phone number already exists"
  }
}
```

---

### 4. Update User

**PUT** `/api/admin/users/:id`

Update user details.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Suresh Patel - Updated",
  "email": "suresh.patel@tiffsy.com",
  "kitchenId": "6789def123abc456789def02"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "6789staff123abc456789ab02",
      "phone": "9876543225",
      "role": "KITCHEN_STAFF",
      "name": "Suresh Patel - Updated",
      "email": "suresh.patel@tiffsy.com",
      "kitchenId": "6789def123abc456789def02",
      "updatedAt": "2025-01-10T11:00:00.000Z"
    }
  },
  "message": "User updated successfully"
}
```

---

### 5. Activate User

**PATCH** `/api/admin/users/:id/activate`

Set user status to ACTIVE.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request:**
```
PATCH /api/admin/users/6789user123abc456789ab01/activate
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "6789user123abc456789ab01",
      "name": "John Doe",
      "status": "ACTIVE"
    }
  },
  "message": "User activated successfully"
}
```

---

### 6. Deactivate User

**PATCH** `/api/admin/users/:id/deactivate`

Set user status to INACTIVE.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "6789user123abc456789ab01",
      "name": "John Doe",
      "status": "INACTIVE"
    }
  },
  "message": "User deactivated successfully"
}
```

---

### 7. Suspend User

**PATCH** `/api/admin/users/:id/suspend`

Suspend user with reason.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "reason": "Repeated order cancellations and suspicious activity"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "6789user123abc456789ab01",
      "name": "John Doe",
      "status": "SUSPENDED",
      "suspensionReason": "Repeated order cancellations and suspicious activity",
      "suspendedAt": "2025-01-10T10:00:00.000Z",
      "suspendedBy": "6789admin123abc456789ab01"
    }
  },
  "message": "User suspended"
}
```

---

### 8. Delete User

**DELETE** `/api/admin/users/:id`

Soft delete user (sets status to DELETED).

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request:**
```
DELETE /api/admin/users/6789user123abc456789ab01
```

**Response (200):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

### 9. Reset Password (Admin Only)

**POST** `/api/admin/users/:id/reset-password`

Reset password for admin users.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "newPassword": "NewSecure@456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

### 10. Admin Dashboard

**GET** `/api/admin/dashboard`

Get admin dashboard statistics.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": {
      "totalCustomers": 12500,
      "activeCustomers": 11800,
      "newCustomersToday": 45,
      "newCustomersThisWeek": 320,
      "totalStaff": 25,
      "totalDrivers": 50
    },
    "orders": {
      "totalToday": 856,
      "pendingOrders": 45,
      "inProgressOrders": 120,
      "completedToday": 680,
      "cancelledToday": 11
    },
    "revenue": {
      "today": 125000,
      "thisWeek": 850000,
      "thisMonth": 3500000
    },
    "subscriptions": {
      "activeSubscriptions": 2500,
      "newSubscriptionsToday": 25,
      "expiringThisWeek": 150
    },
    "kitchens": {
      "totalActive": 12,
      "acceptingOrders": 10
    },
    "zones": {
      "totalActive": 45,
      "orderingEnabled": 42
    }
  }
}
```

---

## Data Model Reference

```typescript
interface User {
  _id: string;
  phone: string;                    // Unique, 10 digits
  role: "CUSTOMER" | "KITCHEN_STAFF" | "DRIVER" | "ADMIN";
  name?: string;
  email?: string;
  dietaryPreferences?: ("VEG" | "NON_VEG" | "VEGAN" | "JAIN" | "EGGETARIAN")[];
  profileImage?: string;
  firebaseUid?: string;             // For mobile app users
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DELETED";
  kitchenId?: string;               // Required for KITCHEN_STAFF
  username?: string;                // For ADMIN (web login)
  passwordHash?: string;            // For ADMIN (not returned in API)
  lastLoginAt?: string;
  fcmTokens: string[];              // Push notification tokens
  suspensionReason?: string;
  suspendedAt?: string;
  suspendedBy?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## UI Implementation Notes

1. **Users Table**: Columns - Name, Phone, Role, Status, Kitchen (for staff), Last Login, Actions
2. **Role Tabs/Filter**: All, Customers, Kitchen Staff, Drivers, Admins
3. **Status Badges**:
   - ACTIVE: Green
   - INACTIVE: Gray
   - SUSPENDED: Red
   - DELETED: Dark (strikethrough)
4. **User Detail View**:
   - Profile info
   - Role-specific details
   - Statistics (orders, subscriptions for customers)
   - Activity log
   - Status management actions
5. **Create User Form**:
   - Role selector (determines visible fields)
   - Phone (required for all)
   - Name, Email
   - Kitchen dropdown (for KITCHEN_STAFF only)
   - Username/Password (for ADMIN only)
6. **Bulk Actions**: Activate/Deactivate selected users
7. **Search**: By name, phone, or email
8. **Customer Stats Cards**: Total, Active, New Today
