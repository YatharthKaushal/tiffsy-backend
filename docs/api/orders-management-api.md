# Orders Management API

> **PROMPT**: Implement orders management for the admin dashboard. Orders can be MEAL_MENU (subscription-based with vouchers) or ON_DEMAND_MENU (direct purchase). Admin can view all orders, filter by status/kitchen/zone/date, view order details, and cancel orders with refund. Implement order listing with real-time status, order detail modal, status timeline, and order statistics dashboard. Show different status flows for meal vs on-demand orders.

---

## Authentication

All admin endpoints require JWT token:

```
Authorization: Bearer <jwt_token>
```

---

## Order Status Flow

```
MEAL_MENU:     PLACED -> ACCEPTED -> PREPARING -> READY -> PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED
ON_DEMAND_MENU: PLACED -> ACCEPTED -> PREPARING -> READY -> PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED

Alternate paths:
- PLACED -> REJECTED (by kitchen)
- Any status before PICKED_UP -> CANCELLED
- DELIVERED -> (completed)
- Any -> FAILED (system error)
```

---

## Endpoints

### 1. Get All Orders (Admin)

**GET** `/api/orders/admin/all`

Fetch all orders with filters.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | No | Filter by customer ID |
| kitchenId | string | No | Filter by kitchen ID |
| zoneId | string | No | Filter by zone ID |
| status | string | No | Order status |
| menuType | string | No | `MEAL_MENU` or `ON_DEMAND_MENU` |
| dateFrom | date | No | Orders after this date |
| dateTo | date | No | Orders before this date |
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 20, max: 100) |

**Status Values:**
`PLACED`, `ACCEPTED`, `REJECTED`, `PREPARING`, `READY`, `PICKED_UP`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`, `FAILED`

**Request:**
```
GET /api/orders/admin/all?status=PLACED&menuType=MEAL_MENU&dateFrom=2025-01-01&page=1&limit=20
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "_id": "6789ord123abc456789ab001",
        "orderNumber": "ORD-20250110-A2B3C",
        "userId": {
          "_id": "6789user123abc456789ab01",
          "name": "John Doe",
          "phone": "9876543210"
        },
        "kitchenId": {
          "_id": "6789def123abc456789def01",
          "name": "Tiffsy Central Kitchen"
        },
        "zoneId": {
          "_id": "6789abc123def456789abc01",
          "pincode": "400001",
          "name": "Fort"
        },
        "menuType": "MEAL_MENU",
        "mealWindow": "LUNCH",
        "status": "PLACED",
        "paymentStatus": "PAID",
        "subtotal": 299,
        "grandTotal": 299,
        "amountPaid": 0,
        "voucherUsage": {
          "voucherCount": 2,
          "mainCoursesCovered": 2
        },
        "itemCount": 2,
        "placedAt": "2025-01-10T08:30:00.000Z",
        "estimatedDeliveryTime": "2025-01-10T12:30:00.000Z"
      },
      {
        "_id": "6789ord123abc456789ab002",
        "orderNumber": "ORD-20250110-X9Y8Z",
        "userId": {
          "_id": "6789user123abc456789ab02",
          "name": "Jane Smith",
          "phone": "9876543211"
        },
        "kitchenId": {
          "_id": "6789def123abc456789def01",
          "name": "Tiffsy Central Kitchen"
        },
        "zoneId": {
          "_id": "6789abc123def456789abc02",
          "pincode": "400002",
          "name": "Kalbadevi"
        },
        "menuType": "ON_DEMAND_MENU",
        "mealWindow": null,
        "status": "PREPARING",
        "paymentStatus": "PAID",
        "subtotal": 450,
        "grandTotal": 520,
        "amountPaid": 520,
        "voucherUsage": {
          "voucherCount": 0,
          "mainCoursesCovered": 0
        },
        "itemCount": 3,
        "placedAt": "2025-01-10T09:00:00.000Z",
        "estimatedDeliveryTime": "2025-01-10T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 245,
      "page": 1,
      "limit": 20,
      "pages": 13
    }
  }
}
```

---

### 2. Get Order by ID

**GET** `/api/orders/:id`

Fetch complete order details.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request:**
```
GET /api/orders/6789ord123abc456789ab001
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "6789ord123abc456789ab001",
      "orderNumber": "ORD-20250110-A2B3C",
      "userId": {
        "_id": "6789user123abc456789ab01",
        "name": "John Doe",
        "phone": "9876543210",
        "email": "john@example.com"
      },
      "kitchenId": {
        "_id": "6789def123abc456789def01",
        "name": "Tiffsy Central Kitchen",
        "code": "KIT-A2B3C",
        "contactPhone": "9876543210"
      },
      "zoneId": {
        "_id": "6789abc123def456789abc01",
        "pincode": "400001",
        "name": "Fort",
        "city": "Mumbai"
      },
      "deliveryAddressId": "6789addr123abc456789ab01",
      "deliveryAddress": {
        "addressLine1": "123, Tower A",
        "addressLine2": "Business Park",
        "landmark": "Near Metro Station",
        "locality": "Fort",
        "city": "Mumbai",
        "pincode": "400001",
        "contactName": "John Doe",
        "contactPhone": "9876543210",
        "coordinates": {
          "latitude": 18.9322,
          "longitude": 72.8352
        }
      },
      "menuType": "MEAL_MENU",
      "mealWindow": "LUNCH",
      "items": [
        {
          "menuItemId": "6789menu123abc456789ab01",
          "name": "Dal Tadka",
          "quantity": 1,
          "unitPrice": 0,
          "totalPrice": 0,
          "isMainCourse": true,
          "addons": []
        },
        {
          "menuItemId": "6789menu123abc456789ab02",
          "name": "Jeera Rice",
          "quantity": 1,
          "unitPrice": 0,
          "totalPrice": 0,
          "isMainCourse": true,
          "addons": [
            {
              "addonId": "6789addon123abc456789ab01",
              "name": "Extra Raita",
              "quantity": 1,
              "unitPrice": 30,
              "totalPrice": 30
            }
          ]
        }
      ],
      "subtotal": 30,
      "charges": {
        "deliveryFee": 0,
        "serviceFee": 0,
        "packagingFee": 10,
        "handlingFee": 0,
        "taxAmount": 2,
        "taxBreakdown": [
          {
            "taxType": "GST",
            "rate": 5,
            "amount": 2
          }
        ]
      },
      "discount": null,
      "grandTotal": 42,
      "voucherUsage": {
        "voucherIds": [
          "6789vouch123abc456789ab01",
          "6789vouch123abc456789ab02"
        ],
        "voucherCount": 2,
        "mainCoursesCovered": 2
      },
      "amountPaid": 42,
      "paymentStatus": "PAID",
      "paymentMethod": "UPI",
      "paymentId": "pay_ABC123XYZ",
      "status": "PLACED",
      "statusTimeline": [
        {
          "status": "PLACED",
          "timestamp": "2025-01-10T08:30:00.000Z",
          "updatedBy": null,
          "notes": null
        }
      ],
      "specialInstructions": "Please add extra spice",
      "placedAt": "2025-01-10T08:30:00.000Z",
      "estimatedDeliveryTime": "2025-01-10T12:30:00.000Z",
      "batchId": null,
      "driverId": null,
      "rating": null,
      "createdAt": "2025-01-10T08:30:00.000Z",
      "updatedAt": "2025-01-10T08:30:00.000Z"
    }
  }
}
```

---

### 3. Get Order Statistics

**GET** `/api/orders/admin/stats`

Get order statistics for dashboard.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request:**
```
GET /api/orders/admin/stats
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "today": {
      "total": 156,
      "placed": 12,
      "accepted": 8,
      "preparing": 15,
      "ready": 5,
      "pickedUp": 20,
      "outForDelivery": 18,
      "delivered": 70,
      "cancelled": 6,
      "rejected": 2
    },
    "byMenuType": {
      "MEAL_MENU": 120,
      "ON_DEMAND_MENU": 36
    },
    "byMealWindow": {
      "LUNCH": 85,
      "DINNER": 35
    },
    "revenue": {
      "today": 45600,
      "thisWeek": 320000,
      "thisMonth": 1250000
    },
    "averageOrderValue": {
      "MEAL_MENU": 45,
      "ON_DEMAND_MENU": 380
    }
  }
}
```

---

### 4. Admin Cancel Order

**PATCH** `/api/orders/:id/admin-cancel`

Cancel order with refund and voucher restoration options.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "reason": "Customer reported incorrect address, unable to deliver",
  "issueRefund": true,
  "restoreVouchers": true
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "6789ord123abc456789ab001",
      "orderNumber": "ORD-20250110-A2B3C",
      "status": "CANCELLED",
      "cancelledAt": "2025-01-10T10:00:00.000Z",
      "cancelledBy": "ADMIN",
      "cancellationReason": "Customer reported incorrect address, unable to deliver"
    },
    "refund": {
      "amount": 42,
      "status": "INITIATED",
      "refundId": "ref_XYZ789ABC"
    },
    "vouchersRestored": 2
  },
  "message": "Order cancelled successfully"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": {
    "code": "CANNOT_CANCEL",
    "message": "Order cannot be cancelled after pickup"
  }
}
```

---

### 5. Track Order (Customer)

**GET** `/api/orders/:id/track`

Get order tracking info.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request:**
```
GET /api/orders/6789ord123abc456789ab001/track
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "6789ord123abc456789ab001",
      "orderNumber": "ORD-20250110-A2B3C",
      "status": "OUT_FOR_DELIVERY",
      "statusTimeline": [
        {
          "status": "PLACED",
          "timestamp": "2025-01-10T08:30:00.000Z"
        },
        {
          "status": "ACCEPTED",
          "timestamp": "2025-01-10T08:35:00.000Z"
        },
        {
          "status": "PREPARING",
          "timestamp": "2025-01-10T09:00:00.000Z"
        },
        {
          "status": "READY",
          "timestamp": "2025-01-10T11:00:00.000Z"
        },
        {
          "status": "PICKED_UP",
          "timestamp": "2025-01-10T11:30:00.000Z"
        },
        {
          "status": "OUT_FOR_DELIVERY",
          "timestamp": "2025-01-10T11:45:00.000Z"
        }
      ],
      "estimatedDeliveryTime": "2025-01-10T12:30:00.000Z",
      "driver": {
        "_id": "6789driver123abc456789ab01",
        "name": "Rajesh Kumar",
        "phone": "9876543220"
      },
      "deliveryAddress": {
        "addressLine1": "123, Tower A",
        "locality": "Fort",
        "city": "Mumbai"
      }
    }
  }
}
```

---

### 6. Kitchen Orders

**GET** `/api/orders/kitchen`

Get orders for kitchen staff.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | No | Filter by status |
| mealWindow | string | No | `LUNCH` or `DINNER` |
| date | date | No | Filter by date (default: today) |
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 50) |

**Request:**
```
GET /api/orders/kitchen?status=PLACED&mealWindow=LUNCH&date=2025-01-10
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "_id": "6789ord123abc456789ab001",
        "orderNumber": "ORD-20250110-A2B3C",
        "menuType": "MEAL_MENU",
        "mealWindow": "LUNCH",
        "status": "PLACED",
        "items": [
          {
            "name": "Dal Tadka",
            "quantity": 1,
            "addons": []
          },
          {
            "name": "Jeera Rice",
            "quantity": 1,
            "addons": [
              {
                "name": "Extra Raita",
                "quantity": 1
              }
            ]
          }
        ],
        "specialInstructions": "Please add extra spice",
        "placedAt": "2025-01-10T08:30:00.000Z",
        "deliveryAddress": {
          "locality": "Fort",
          "pincode": "400001"
        }
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 50,
      "pages": 1
    }
  }
}
```

---

### 7. Accept Order (Kitchen)

**PATCH** `/api/orders/:id/accept`

Kitchen accepts order.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "estimatedPrepTime": 30
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "6789ord123abc456789ab001",
      "orderNumber": "ORD-20250110-A2B3C",
      "status": "ACCEPTED",
      "acceptedAt": "2025-01-10T08:35:00.000Z",
      "estimatedPrepTime": 30
    }
  },
  "message": "Order accepted"
}
```

---

### 8. Reject Order (Kitchen)

**PATCH** `/api/orders/:id/reject`

Kitchen rejects order.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "reason": "Item out of stock - Dal Tadka unavailable today"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "6789ord123abc456789ab001",
      "orderNumber": "ORD-20250110-A2B3C",
      "status": "REJECTED",
      "rejectedAt": "2025-01-10T08:35:00.000Z",
      "rejectionReason": "Item out of stock - Dal Tadka unavailable today"
    }
  },
  "message": "Order rejected"
}
```

---

### 9. Update Order Status (Kitchen)

**PATCH** `/api/orders/:id/status`

Update order preparation status.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "status": "PREPARING",
  "notes": "Started preparation"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "6789ord123abc456789ab001",
      "orderNumber": "ORD-20250110-A2B3C",
      "status": "PREPARING"
    }
  },
  "message": "Order status updated"
}
```

---

### 10. Update Delivery Status (Driver)

**PATCH** `/api/orders/:id/delivery-status`

Driver updates delivery status.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request (Picked Up):**
```json
{
  "status": "PICKED_UP",
  "notes": "Picked up from kitchen"
}
```

**Request (Delivered):**
```json
{
  "status": "DELIVERED",
  "proofOfDelivery": {
    "type": "OTP",
    "value": "1234"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "6789ord123abc456789ab001",
      "orderNumber": "ORD-20250110-A2B3C",
      "status": "DELIVERED",
      "deliveredAt": "2025-01-10T12:30:00.000Z",
      "proofOfDelivery": {
        "type": "OTP",
        "value": "1234",
        "verifiedAt": "2025-01-10T12:30:00.000Z"
      }
    }
  },
  "message": "Order delivered successfully"
}
```

---

## Data Model Reference

```typescript
interface Order {
  _id: string;
  orderNumber: string;              // Auto-generated (ORD-YYYYMMDD-XXXXX)
  userId: string | User;
  kitchenId: string | Kitchen;
  zoneId: string | Zone;
  deliveryAddressId: string;
  deliveryAddress: {
    addressLine1: string;
    addressLine2?: string;
    landmark?: string;
    locality: string;
    city: string;
    pincode: string;
    contactName?: string;
    contactPhone?: string;
    coordinates?: { latitude: number; longitude: number; };
  };
  menuType: "MEAL_MENU" | "ON_DEMAND_MENU";
  mealWindow?: "LUNCH" | "DINNER";  // Required for MEAL_MENU
  items: OrderItem[];
  subtotal: number;
  charges: {
    deliveryFee: number;
    serviceFee: number;
    packagingFee: number;
    handlingFee: number;
    taxAmount: number;
    taxBreakdown: { taxType: string; rate: number; amount: number; }[];
  };
  discount?: {
    couponId?: string;
    couponCode?: string;
    discountAmount: number;
    discountType: string;
  };
  grandTotal: number;
  voucherUsage: {
    voucherIds: string[];
    voucherCount: number;
    mainCoursesCovered: number;
  };
  amountPaid: number;
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  paymentMethod?: string;
  paymentId?: string;
  status: OrderStatus;
  statusTimeline: StatusEntry[];
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  cancelledBy?: "CUSTOMER" | "KITCHEN" | "ADMIN" | "SYSTEM";
  estimatedPrepTime?: number;
  preparedAt?: string;
  batchId?: string;
  driverId?: string;
  estimatedDeliveryTime?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  proofOfDelivery?: {
    type: "OTP" | "SIGNATURE" | "PHOTO";
    value: string;
    verifiedAt: string;
  };
  rating?: { stars: number; comment?: string; ratedAt: string; };
  specialInstructions?: string;
  placedAt: string;
  scheduledFor?: string;
  createdAt: string;
  updatedAt: string;
}

type OrderStatus =
  | "PLACED"
  | "ACCEPTED"
  | "REJECTED"
  | "PREPARING"
  | "READY"
  | "PICKED_UP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "FAILED";
```

---

## UI Implementation Notes

1. **Orders Table**: Order#, Customer, Kitchen, Type, Status, Amount, Time
2. **Status Filters**: Tabs or dropdown for each status
3. **Real-time Updates**: Poll every 30s or use WebSocket
4. **Order Detail Modal**:
   - Customer info
   - Delivery address with map
   - Order items with addons
   - Pricing breakdown
   - Status timeline (vertical stepper)
   - Actions (Cancel, Refund)
5. **Status Badges** (color coding):
   - PLACED: Blue
   - ACCEPTED: Cyan
   - PREPARING: Yellow
   - READY: Orange
   - PICKED_UP: Purple
   - OUT_FOR_DELIVERY: Indigo
   - DELIVERED: Green
   - CANCELLED: Red
   - REJECTED: Red
   - FAILED: Dark Red
6. **Dashboard Stats**: Cards showing today's orders by status
7. **Menu Type Badge**: MEAL_MENU (Green), ON_DEMAND_MENU (Blue)
