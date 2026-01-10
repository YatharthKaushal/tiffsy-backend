# Subscription Plan Management API

> **PROMPT**: Implement subscription plan management for the admin dashboard. Plans define voucher packages that customers can purchase (e.g., 7-day, 14-day, 30-day plans). Admin can create plans, set pricing, configure voucher rules, manage display order, and activate/deactivate/archive plans. Also view all customer subscriptions. Implement plan listing with status filters, plan creation form with pricing/voucher config, and subscription monitoring.

---

## Authentication

All admin endpoints require JWT token:

```
Authorization: Bearer <jwt_token>
```

---

## Endpoints

### 1. Get All Plans (Admin)

**GET** `/api/subscriptions/plans`

Fetch all subscription plans with filters.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | No | `ACTIVE`, `INACTIVE`, `ARCHIVED` |
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 20, max: 100) |

**Request:**
```
GET /api/subscriptions/plans?status=ACTIVE&page=1&limit=20
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "_id": "6789plan123abc456789ab01",
        "name": "Weekly Starter",
        "description": "Perfect for trying out Tiffsy meals",
        "durationDays": 7,
        "vouchersPerDay": 2,
        "voucherValidityDays": 90,
        "price": 699,
        "originalPrice": 999,
        "totalVouchers": 14,
        "coverageRules": {
          "includesAddons": false,
          "addonValuePerVoucher": null,
          "mealTypes": ["BOTH"]
        },
        "applicableZoneIds": [],
        "displayOrder": 1,
        "badge": "STARTER",
        "features": [
          "14 meal vouchers",
          "Valid for 90 days",
          "Lunch & Dinner"
        ],
        "status": "ACTIVE",
        "validFrom": null,
        "validTill": null,
        "createdBy": "6789abc123def456789abc12",
        "createdAt": "2025-01-01T10:00:00.000Z",
        "updatedAt": "2025-01-10T10:00:00.000Z"
      },
      {
        "_id": "6789plan123abc456789ab02",
        "name": "Monthly Value",
        "description": "Best value for regular meals",
        "durationDays": 30,
        "vouchersPerDay": 2,
        "voucherValidityDays": 90,
        "price": 2499,
        "originalPrice": 3499,
        "totalVouchers": 60,
        "coverageRules": {
          "includesAddons": true,
          "addonValuePerVoucher": 30,
          "mealTypes": ["BOTH"]
        },
        "applicableZoneIds": [],
        "displayOrder": 2,
        "badge": "BEST VALUE",
        "features": [
          "60 meal vouchers",
          "Valid for 90 days",
          "Includes addons worth Rs 30"
        ],
        "status": "ACTIVE",
        "validFrom": null,
        "validTill": null,
        "createdAt": "2025-01-01T10:00:00.000Z",
        "updatedAt": "2025-01-10T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

---

### 2. Create Plan

**POST** `/api/subscriptions/plans`

Create a new subscription plan.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Bi-Weekly Plan",
  "description": "Two weeks of delicious meals",
  "durationDays": 14,
  "vouchersPerDay": 2,
  "voucherValidityDays": 90,
  "price": 1299,
  "originalPrice": 1799,
  "coverageRules": {
    "includesAddons": false,
    "addonValuePerVoucher": null,
    "mealTypes": ["BOTH"]
  },
  "applicableZoneIds": [],
  "displayOrder": 2,
  "badge": "POPULAR",
  "features": [
    "28 meal vouchers",
    "Valid for 90 days",
    "Lunch & Dinner options"
  ],
  "status": "INACTIVE",
  "validFrom": null,
  "validTill": null
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "plan": {
      "_id": "6789plan123abc456789ab03",
      "name": "Bi-Weekly Plan",
      "description": "Two weeks of delicious meals",
      "durationDays": 14,
      "vouchersPerDay": 2,
      "voucherValidityDays": 90,
      "price": 1299,
      "originalPrice": 1799,
      "totalVouchers": 28,
      "coverageRules": {
        "includesAddons": false,
        "addonValuePerVoucher": null,
        "mealTypes": ["BOTH"]
      },
      "displayOrder": 2,
      "badge": "POPULAR",
      "features": [
        "28 meal vouchers",
        "Valid for 90 days",
        "Lunch & Dinner options"
      ],
      "status": "INACTIVE",
      "createdBy": "6789abc123def456789abc12",
      "createdAt": "2025-01-10T10:00:00.000Z",
      "updatedAt": "2025-01-10T10:00:00.000Z"
    }
  },
  "message": "Plan created successfully"
}
```

**Validation Errors:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Duration must be 7, 14, 30, or 60 days"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Original price must be greater than discounted price"
  }
}
```

---

### 3. Get Plan by ID

**GET** `/api/subscriptions/plans/:id`

Fetch single plan details.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request:**
```
GET /api/subscriptions/plans/6789plan123abc456789ab01
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "plan": {
      "_id": "6789plan123abc456789ab01",
      "name": "Weekly Starter",
      "description": "Perfect for trying out Tiffsy meals",
      "durationDays": 7,
      "vouchersPerDay": 2,
      "voucherValidityDays": 90,
      "price": 699,
      "originalPrice": 999,
      "totalVouchers": 14,
      "coverageRules": {
        "includesAddons": false,
        "addonValuePerVoucher": null,
        "mealTypes": ["BOTH"]
      },
      "applicableZoneIds": [],
      "displayOrder": 1,
      "badge": "STARTER",
      "features": [
        "14 meal vouchers",
        "Valid for 90 days",
        "Lunch & Dinner"
      ],
      "status": "ACTIVE",
      "validFrom": null,
      "validTill": null,
      "createdBy": {
        "_id": "6789abc123def456789abc12",
        "name": "Admin User"
      },
      "createdAt": "2025-01-01T10:00:00.000Z",
      "updatedAt": "2025-01-10T10:00:00.000Z"
    }
  }
}
```

---

### 4. Update Plan

**PUT** `/api/subscriptions/plans/:id`

Update plan details (cannot change durationDays or vouchersPerDay after creation).

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Weekly Starter - Updated",
  "description": "Perfect for first-time Tiffsy customers",
  "price": 649,
  "originalPrice": 999,
  "displayOrder": 1,
  "badge": "NEW USER",
  "features": [
    "14 meal vouchers",
    "Valid for 90 days",
    "Lunch & Dinner",
    "Free delivery"
  ],
  "validFrom": "2025-01-15T00:00:00.000Z",
  "validTill": "2025-03-31T23:59:59.000Z"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "plan": {
      "_id": "6789plan123abc456789ab01",
      "name": "Weekly Starter - Updated",
      "description": "Perfect for first-time Tiffsy customers",
      "price": 649,
      "originalPrice": 999,
      "badge": "NEW USER",
      "validFrom": "2025-01-15T00:00:00.000Z",
      "validTill": "2025-03-31T23:59:59.000Z",
      "updatedAt": "2025-01-10T11:00:00.000Z"
    }
  },
  "message": "Plan updated successfully"
}
```

---

### 5. Activate Plan

**PATCH** `/api/subscriptions/plans/:id/activate`

Set plan status to ACTIVE (visible to customers).

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request:**
```
PATCH /api/subscriptions/plans/6789plan123abc456789ab03/activate
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "plan": {
      "_id": "6789plan123abc456789ab03",
      "name": "Bi-Weekly Plan",
      "status": "ACTIVE"
    }
  },
  "message": "Plan activated successfully"
}
```

---

### 6. Deactivate Plan

**PATCH** `/api/subscriptions/plans/:id/deactivate`

Set plan status to INACTIVE (hidden from customers).

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "plan": {
      "_id": "6789plan123abc456789ab03",
      "name": "Bi-Weekly Plan",
      "status": "INACTIVE"
    }
  },
  "message": "Plan deactivated successfully"
}
```

---

### 7. Archive Plan

**PATCH** `/api/subscriptions/plans/:id/archive`

Archive plan (permanent, cannot be reactivated).

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "plan": {
      "_id": "6789plan123abc456789ab03",
      "name": "Bi-Weekly Plan",
      "status": "ARCHIVED"
    }
  },
  "message": "Plan archived successfully"
}
```

---

### 8. Get Active Plans (Public)

**GET** `/api/subscriptions/plans/active`

Get purchasable plans for customers.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| zoneId | string | No | Filter by applicable zone |

**Request:**
```
GET /api/subscriptions/plans/active
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "_id": "6789plan123abc456789ab01",
        "name": "Weekly Starter",
        "description": "Perfect for trying out Tiffsy meals",
        "durationDays": 7,
        "vouchersPerDay": 2,
        "totalVouchers": 14,
        "price": 699,
        "originalPrice": 999,
        "badge": "STARTER",
        "features": [
          "14 meal vouchers",
          "Valid for 90 days",
          "Lunch & Dinner"
        ]
      },
      {
        "_id": "6789plan123abc456789ab02",
        "name": "Monthly Value",
        "description": "Best value for regular meals",
        "durationDays": 30,
        "vouchersPerDay": 2,
        "totalVouchers": 60,
        "price": 2499,
        "originalPrice": 3499,
        "badge": "BEST VALUE",
        "features": [
          "60 meal vouchers",
          "Valid for 90 days",
          "Includes addons worth Rs 30"
        ]
      }
    ]
  }
}
```

---

### 9. Get All Subscriptions (Admin)

**GET** `/api/subscriptions/admin/all`

View all customer subscriptions.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | No | Filter by customer ID |
| planId | string | No | Filter by plan ID |
| status | string | No | `ACTIVE`, `EXPIRED`, `CANCELLED` |
| dateFrom | date | No | Subscriptions after this date |
| dateTo | date | No | Subscriptions before this date |
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 20) |

**Request:**
```
GET /api/subscriptions/admin/all?status=ACTIVE&page=1&limit=20
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscriptions": [
      {
        "_id": "6789sub123abc456789ab001",
        "userId": {
          "_id": "6789user123abc456789ab01",
          "name": "John Doe",
          "phone": "9876543210"
        },
        "planId": {
          "_id": "6789plan123abc456789ab01",
          "name": "Weekly Starter",
          "durationDays": 7
        },
        "status": "ACTIVE",
        "purchasedAt": "2025-01-05T10:00:00.000Z",
        "expiresAt": "2025-04-05T10:00:00.000Z",
        "vouchersIssued": 14,
        "vouchersUsed": 5,
        "vouchersRemaining": 9,
        "amountPaid": 699,
        "paymentId": "pay_ABC123XYZ",
        "paymentMethod": "UPI"
      },
      {
        "_id": "6789sub123abc456789ab002",
        "userId": {
          "_id": "6789user123abc456789ab02",
          "name": "Jane Smith",
          "phone": "9876543211"
        },
        "planId": {
          "_id": "6789plan123abc456789ab02",
          "name": "Monthly Value",
          "durationDays": 30
        },
        "status": "ACTIVE",
        "purchasedAt": "2025-01-01T10:00:00.000Z",
        "expiresAt": "2025-04-01T10:00:00.000Z",
        "vouchersIssued": 60,
        "vouchersUsed": 20,
        "vouchersRemaining": 40,
        "amountPaid": 2499,
        "paymentId": "pay_DEF456UVW",
        "paymentMethod": "CARD"
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "pages": 8
    }
  }
}
```

---

### 10. Get Subscription by ID

**GET** `/api/subscriptions/:id`

Get subscription details.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request:**
```
GET /api/subscriptions/6789sub123abc456789ab001
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "_id": "6789sub123abc456789ab001",
      "userId": {
        "_id": "6789user123abc456789ab01",
        "name": "John Doe",
        "phone": "9876543210",
        "email": "john@example.com"
      },
      "planId": {
        "_id": "6789plan123abc456789ab01",
        "name": "Weekly Starter",
        "durationDays": 7,
        "vouchersPerDay": 2
      },
      "status": "ACTIVE",
      "purchasedAt": "2025-01-05T10:00:00.000Z",
      "expiresAt": "2025-04-05T10:00:00.000Z",
      "vouchersIssued": 14,
      "vouchersUsed": 5,
      "vouchersRemaining": 9,
      "voucherDetails": [
        {
          "_id": "6789vouch123abc45678901",
          "status": "USED",
          "usedAt": "2025-01-06T12:00:00.000Z",
          "orderId": "6789ord123abc456789ab01"
        },
        {
          "_id": "6789vouch123abc45678902",
          "status": "AVAILABLE",
          "expiresAt": "2025-04-05T10:00:00.000Z"
        }
      ],
      "amountPaid": 699,
      "paymentId": "pay_ABC123XYZ",
      "paymentMethod": "UPI",
      "createdAt": "2025-01-05T10:00:00.000Z"
    }
  }
}
```

---

### 11. Admin Cancel Subscription

**POST** `/api/subscriptions/:id/admin-cancel`

Cancel subscription with refund options.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "reason": "Customer requested cancellation due to relocation",
  "issueRefund": true,
  "refundAmount": 500
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "_id": "6789sub123abc456789ab001",
      "status": "CANCELLED",
      "cancelledAt": "2025-01-10T10:00:00.000Z",
      "cancelledBy": "6789abc123def456789abc12",
      "cancellationReason": "Customer requested cancellation due to relocation"
    },
    "refund": {
      "amount": 500,
      "status": "INITIATED",
      "refundId": "ref_XYZ789ABC"
    }
  },
  "message": "Subscription cancelled and refund initiated"
}
```

---

## Data Model Reference

```typescript
interface SubscriptionPlan {
  _id: string;
  name: string;
  description?: string;
  durationDays: 7 | 14 | 30 | 60;
  vouchersPerDay: number;           // 1-4
  voucherValidityDays: number;      // Default: 90
  price: number;
  originalPrice?: number;           // Strike-through price
  totalVouchers: number;            // Virtual: durationDays * vouchersPerDay
  coverageRules: {
    includesAddons: boolean;
    addonValuePerVoucher?: number;
    mealTypes: ("LUNCH" | "DINNER" | "BOTH")[];
  };
  applicableZoneIds: string[];      // Empty = all zones
  displayOrder: number;
  badge?: string;                   // e.g., "BEST VALUE", "POPULAR"
  features: string[];               // Bullet points
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  validFrom?: string;               // Sale start date
  validTill?: string;               // Sale end date
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface Subscription {
  _id: string;
  userId: string | User;
  planId: string | SubscriptionPlan;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  purchasedAt: string;
  expiresAt: string;
  vouchersIssued: number;
  vouchersUsed: number;
  vouchersRemaining: number;
  amountPaid: number;
  paymentId?: string;
  paymentMethod?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  createdAt: string;
}
```

---

## UI Implementation Notes

1. **Plans Table**: Columns - Name, Duration, Price, Total Vouchers, Status, Display Order, Actions
2. **Plan Form Fields**:
   - Name, Description (textarea)
   - Duration (dropdown: 7/14/30/60 days)
   - Vouchers per day (1-4)
   - Price, Original Price (for discount display)
   - Badge (optional text)
   - Features (list input)
   - Valid From/Till (date pickers, optional)
3. **Status Badges**:
   - ACTIVE: Green
   - INACTIVE: Gray
   - ARCHIVED: Red (strikethrough)
4. **Subscriptions Table**: Customer Name, Plan, Status, Vouchers Used/Total, Purchased Date
5. **Discount Display**: Show percentage saved if originalPrice > price
6. **Validation**:
   - originalPrice must be > price
   - validTill must be > validFrom
