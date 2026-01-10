# Customer Order Placement API

> **PROMPT**: Implement order placement for the customer app. Support two menu types: MEAL_MENU (with vouchers, meal windows) and ON_DEMAND_MENU (with coupons, anytime). Show cart pricing preview before checkout. Validate cutoff time for voucher orders (LUNCH: 11:00, DINNER: 21:00 IST). Handle multiple voucher redemption (max 10). Each voucher covers one main course. Show order tracking and allow cancellation before cutoff.

---

## Authentication

All endpoints require Firebase ID Token:
```
Authorization: Bearer <firebase_id_token>
```

---

## Order Types

| Type | Description | Payment Options |
|------|-------------|-----------------|
| `MEAL_MENU` | Pre-planned meals with meal windows | Vouchers + Cash/Card |
| `ON_DEMAND_MENU` | Anytime orders | Coupons + Cash/Card |

---

## Voucher Rules

1. **Only for MEAL_MENU** - Cannot use vouchers with ON_DEMAND_MENU
2. **Cutoff Time** - LUNCH: 11:00 IST, DINNER: 21:00 IST
3. **Coverage** - Each voucher covers ONE main course
4. **Max per Order** - Up to 10 vouchers
5. **FIFO** - Earliest expiring vouchers used first
6. **Atomic** - All-or-nothing redemption in transaction

---

## Endpoints

### 1. Calculate Pricing (Cart Preview)

**POST** `/api/orders/calculate-pricing`

Get pricing breakdown before placing order.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Request Body:**
```json
{
  "kitchenId": "6789kit123abc456789ab01",
  "menuType": "MEAL_MENU",
  "mealWindow": "LUNCH",
  "deliveryAddressId": "6789addr123abc456789ab01",
  "items": [
    {
      "menuItemId": "6789item123abc456789ab01",
      "quantity": 2,
      "addons": [
        {
          "addonId": "6789addon123abc456789a01",
          "quantity": 1
        }
      ]
    },
    {
      "menuItemId": "6789item123abc456789ab02",
      "quantity": 1
    }
  ],
  "voucherCount": 2,
  "couponCode": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| kitchenId | string | Yes | Kitchen ObjectId (24 chars) |
| menuType | string | Yes | `MEAL_MENU` or `ON_DEMAND_MENU` |
| mealWindow | string | Conditional | Required for MEAL_MENU: `LUNCH` or `DINNER` |
| deliveryAddressId | string | Yes | Address ObjectId |
| items | array | Yes | Min 1 item |
| items[].menuItemId | string | Yes | Menu item ObjectId |
| items[].quantity | number | Yes | 1-10 |
| items[].addons | array | No | Optional addons |
| voucherCount | number | No | 0-10, MEAL_MENU only |
| couponCode | string | No | ON_DEMAND_MENU only |

**Response (200) - With Vouchers:**
```json
{
  "success": true,
  "data": {
    "breakdown": {
      "items": [
        {
          "name": "Dal Tadka Thali",
          "quantity": 2,
          "unitPrice": 150,
          "total": 300,
          "isMainCourse": true,
          "addons": [
            {
              "name": "Extra Raita",
              "quantity": 1,
              "unitPrice": 30,
              "total": 30
            }
          ]
        },
        {
          "name": "Paneer Butter Masala",
          "quantity": 1,
          "unitPrice": 180,
          "total": 180,
          "isMainCourse": true
        }
      ],
      "subtotal": 510,
      "charges": {
        "deliveryFee": 0,
        "serviceFee": 0,
        "packagingFee": 15,
        "handlingFee": 0,
        "taxAmount": 26.25,
        "taxBreakdown": [
          {
            "taxType": "GST",
            "rate": 5,
            "amount": 26.25
          }
        ]
      },
      "discount": null,
      "voucherCoverage": {
        "voucherCount": 2,
        "mainCoursesCovered": 2,
        "value": 330
      },
      "grandTotal": 551.25,
      "amountToPay": 221.25
    },
    "voucherEligibility": {
      "available": 10,
      "canUse": 2,
      "cutoffPassed": false,
      "cutoffInfo": {
        "cutoffTime": "11:00",
        "currentTime": "09:30",
        "message": "LUNCH orders open until 11:00"
      }
    }
  }
}
```

**Response (200) - Cutoff Passed:**
```json
{
  "success": true,
  "data": {
    "breakdown": {...},
    "voucherEligibility": {
      "available": 10,
      "canUse": 0,
      "cutoffPassed": true,
      "cutoffInfo": {
        "cutoffTime": "11:00",
        "currentTime": "11:30",
        "message": "LUNCH ordering closed. Cutoff was 11:00."
      }
    }
  }
}
```

**Response (200) - With Coupon (ON_DEMAND):**
```json
{
  "success": true,
  "data": {
    "breakdown": {
      "items": [...],
      "subtotal": 500,
      "charges": {
        "deliveryFee": 40,
        "serviceFee": 10,
        "packagingFee": 15,
        "handlingFee": 0,
        "taxAmount": 26.25
      },
      "discount": {
        "couponCode": "SAVE20",
        "discountType": "PERCENTAGE",
        "discountAmount": 100
      },
      "voucherCoverage": null,
      "grandTotal": 491.25,
      "amountToPay": 491.25
    }
  }
}
```

---

### 2. Create Order - With Vouchers (MEAL_MENU)

**POST** `/api/orders`

Place order using subscription vouchers.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Request Body:**
```json
{
  "kitchenId": "6789kit123abc456789ab01",
  "menuType": "MEAL_MENU",
  "mealWindow": "LUNCH",
  "deliveryAddressId": "6789addr123abc456789ab01",
  "items": [
    {
      "menuItemId": "6789item123abc456789ab01",
      "quantity": 1,
      "addons": [
        {
          "addonId": "6789addon123abc456789a01",
          "quantity": 1
        }
      ]
    }
  ],
  "voucherCount": 1,
  "specialInstructions": "Extra spicy please",
  "deliveryNotes": "Ring doorbell twice",
  "paymentMethod": "VOUCHER_ONLY"
}
```

**Response (201) - Vouchers Cover Full Amount:**
```json
{
  "success": true,
  "message": "Order placed successfully",
  "data": {
    "order": {
      "_id": "6789order123abc456789ab1",
      "orderNumber": "ORD-20250110-A2B3C",
      "userId": "6789user123abc456789ab01",
      "kitchenId": "6789kit123abc456789ab01",
      "zoneId": "6789zone123abc456789ab01",
      "deliveryAddressId": "6789addr123abc456789ab01",
      "deliveryAddress": {
        "addressLine1": "123, Tower A, Sky Heights",
        "locality": "Fort",
        "city": "Mumbai",
        "pincode": "400001",
        "contactName": "John Doe",
        "contactPhone": "9876543210"
      },
      "menuType": "MEAL_MENU",
      "mealWindow": "LUNCH",
      "items": [
        {
          "menuItemId": "6789item123abc456789ab01",
          "name": "Dal Tadka Thali",
          "quantity": 1,
          "unitPrice": 150,
          "totalPrice": 150,
          "isMainCourse": true,
          "addons": [
            {
              "addonId": "6789addon123abc456789a01",
              "name": "Extra Raita",
              "quantity": 1,
              "unitPrice": 30,
              "totalPrice": 30
            }
          ]
        }
      ],
      "subtotal": 180,
      "charges": {
        "deliveryFee": 0,
        "serviceFee": 0,
        "packagingFee": 10,
        "handlingFee": 0,
        "taxAmount": 9.5
      },
      "discount": null,
      "grandTotal": 199.5,
      "voucherUsage": {
        "voucherIds": ["6789vch123abc456789ab01"],
        "voucherCount": 1,
        "mainCoursesCovered": 1
      },
      "amountPaid": 0,
      "paymentStatus": "PAID",
      "paymentMethod": "VOUCHER_ONLY",
      "status": "PLACED",
      "statusTimeline": [
        {
          "status": "PLACED",
          "timestamp": "2025-01-10T09:00:00.000Z"
        }
      ],
      "specialInstructions": "Extra spicy please",
      "placedAt": "2025-01-10T09:00:00.000Z"
    },
    "vouchersUsed": 1,
    "amountToPay": 0,
    "paymentRequired": false
  }
}
```

**Response (201) - Partial Payment Required:**
```json
{
  "success": true,
  "message": "Order placed successfully",
  "data": {
    "order": {
      ...
      "grandTotal": 350,
      "voucherUsage": {
        "voucherIds": ["..."],
        "voucherCount": 1,
        "mainCoursesCovered": 1
      },
      "amountPaid": 200,
      "paymentStatus": "PENDING",
      "paymentMethod": "UPI"
    },
    "vouchersUsed": 1,
    "amountToPay": 200,
    "paymentRequired": true
  }
}
```

**Response (400) - Cutoff Passed:**
```json
{
  "success": false,
  "message": "Cutoff time for LUNCH orders has passed. Vouchers cannot be used."
}
```

---

### 3. Create Order - Without Vouchers (ON_DEMAND_MENU)

**POST** `/api/orders`

Place on-demand order with optional coupon.

**Request Body:**
```json
{
  "kitchenId": "6789kit123abc456789ab01",
  "menuType": "ON_DEMAND_MENU",
  "deliveryAddressId": "6789addr123abc456789ab01",
  "items": [
    {
      "menuItemId": "6789item123abc456789ab03",
      "quantity": 2
    }
  ],
  "couponCode": "SAVE20",
  "paymentMethod": "UPI"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Order placed successfully",
  "data": {
    "order": {
      "_id": "6789order123abc456789ab2",
      "orderNumber": "ORD-20250110-D4E5F",
      "menuType": "ON_DEMAND_MENU",
      "mealWindow": null,
      "items": [...],
      "subtotal": 400,
      "charges": {
        "deliveryFee": 40,
        "serviceFee": 10,
        "packagingFee": 15,
        "taxAmount": 21
      },
      "discount": {
        "couponId": "6789cpn123abc456789ab01",
        "couponCode": "SAVE20",
        "discountType": "PERCENTAGE",
        "discountAmount": 80
      },
      "grandTotal": 406,
      "voucherUsage": null,
      "amountPaid": 406,
      "paymentStatus": "PENDING",
      "paymentMethod": "UPI",
      "status": "PLACED"
    },
    "vouchersUsed": 0,
    "amountToPay": 406,
    "paymentRequired": true
  }
}
```

---

### 4. Create Order - Multiple Vouchers

**POST** `/api/orders`

Use multiple vouchers for multiple main courses.

**Request Body:**
```json
{
  "kitchenId": "6789kit123abc456789ab01",
  "menuType": "MEAL_MENU",
  "mealWindow": "DINNER",
  "deliveryAddressId": "6789addr123abc456789ab01",
  "items": [
    {
      "menuItemId": "6789item123abc456789ab01",
      "quantity": 3
    },
    {
      "menuItemId": "6789item123abc456789ab02",
      "quantity": 2
    }
  ],
  "voucherCount": 5,
  "paymentMethod": "CARD"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Order placed successfully",
  "data": {
    "order": {
      ...
      "items": [
        {
          "name": "Dal Tadka Thali",
          "quantity": 3,
          "unitPrice": 150,
          "totalPrice": 450,
          "isMainCourse": true
        },
        {
          "name": "Paneer Thali",
          "quantity": 2,
          "unitPrice": 180,
          "totalPrice": 360,
          "isMainCourse": true
        }
      ],
      "subtotal": 810,
      "grandTotal": 850,
      "voucherUsage": {
        "voucherIds": ["vch1", "vch2", "vch3", "vch4", "vch5"],
        "voucherCount": 5,
        "mainCoursesCovered": 5
      },
      "amountPaid": 20,
      "paymentStatus": "PENDING"
    },
    "vouchersUsed": 5,
    "amountToPay": 20
  }
}
```

---

### 5. Get My Orders

**GET** `/api/orders/my-orders`

Get order history with filters.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| status | string | Filter by status |
| menuType | string | `MEAL_MENU` or `ON_DEMAND_MENU` |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |

**Request:**
```
GET /api/orders/my-orders?status=DELIVERED&page=1&limit=10
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "_id": "6789order123abc456789ab1",
        "orderNumber": "ORD-20250110-A2B3C",
        "kitchenId": {
          "_id": "6789kit123abc456789ab01",
          "name": "Tiffsy Central Kitchen"
        },
        "menuType": "MEAL_MENU",
        "mealWindow": "LUNCH",
        "itemCount": 2,
        "grandTotal": 350,
        "amountPaid": 100,
        "status": "DELIVERED",
        "paymentStatus": "PAID",
        "placedAt": "2025-01-10T09:00:00.000Z",
        "deliveredAt": "2025-01-10T12:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 10,
      "pages": 5
    }
  }
}
```

---

### 6. Get Order Details

**GET** `/api/orders/:id`

Get full order details.

**Request:**
```
GET /api/orders/6789order123abc456789ab1
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "6789order123abc456789ab1",
      "orderNumber": "ORD-20250110-A2B3C",
      "userId": "6789user123abc456789ab01",
      "kitchenId": {
        "_id": "6789kit123abc456789ab01",
        "name": "Tiffsy Central Kitchen",
        "phone": "9876543200"
      },
      "deliveryAddress": {
        "addressLine1": "123, Tower A",
        "locality": "Fort",
        "city": "Mumbai",
        "pincode": "400001",
        "contactName": "John Doe",
        "contactPhone": "9876543210"
      },
      "menuType": "MEAL_MENU",
      "mealWindow": "LUNCH",
      "items": [...],
      "subtotal": 300,
      "charges": {...},
      "grandTotal": 350,
      "voucherUsage": {...},
      "amountPaid": 100,
      "paymentStatus": "PAID",
      "status": "DELIVERED",
      "statusTimeline": [
        {"status": "PLACED", "timestamp": "2025-01-10T09:00:00.000Z"},
        {"status": "ACCEPTED", "timestamp": "2025-01-10T09:05:00.000Z"},
        {"status": "PREPARING", "timestamp": "2025-01-10T10:00:00.000Z"},
        {"status": "READY", "timestamp": "2025-01-10T11:30:00.000Z"},
        {"status": "PICKED_UP", "timestamp": "2025-01-10T11:45:00.000Z"},
        {"status": "OUT_FOR_DELIVERY", "timestamp": "2025-01-10T12:00:00.000Z"},
        {"status": "DELIVERED", "timestamp": "2025-01-10T12:30:00.000Z"}
      ],
      "specialInstructions": "Extra spicy",
      "rating": {
        "value": 5,
        "comment": "Excellent food!"
      }
    }
  }
}
```

---

### 7. Track Order

**GET** `/api/orders/:id/track`

Real-time order tracking.

**Request:**
```
GET /api/orders/6789order123abc456789ab1/track
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "orderId": "6789order123abc456789ab1",
    "orderNumber": "ORD-20250110-A2B3C",
    "status": "OUT_FOR_DELIVERY",
    "statusTimeline": [...],
    "estimatedDelivery": "2025-01-10T12:30:00.000Z",
    "driver": {
      "name": "Vijay",
      "phone": "9876543230"
    },
    "kitchen": {
      "name": "Tiffsy Central Kitchen",
      "phone": "9876543200"
    }
  }
}
```

---

### 8. Cancel Order

**PATCH** `/api/orders/:id/customer-cancel`

Cancel order (before cutoff for meal orders).

**Request:**
```
PATCH /api/orders/6789order123abc456789ab1/customer-cancel
```

**Request Body:**
```json
{
  "reason": "Changed my mind"
}
```

**Response (200) - With Voucher Restoration:**
```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "data": {
    "order": {
      "_id": "6789order123abc456789ab1",
      "status": "CANCELLED",
      "cancellationReason": "Changed my mind"
    },
    "vouchersRestored": 2,
    "refundInitiated": true,
    "refundAmount": 50
  }
}
```

**Response (400) - Past Cutoff:**
```json
{
  "success": false,
  "message": "Cannot cancel order after cutoff time",
  "data": {
    "cutoffInfo": {
      "cutoffTime": "11:00",
      "currentTime": "11:30"
    }
  }
}
```

---

### 9. Rate Order

**POST** `/api/orders/:id/rate`

Rate a delivered order.

**Request Body:**
```json
{
  "rating": 5,
  "comment": "Excellent food, delivered on time!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Rating submitted",
  "data": {
    "orderId": "6789order123abc456789ab1",
    "rating": {
      "value": 5,
      "comment": "Excellent food, delivered on time!",
      "ratedAt": "2025-01-10T13:00:00.000Z"
    }
  }
}
```

---

## Order Status Flow

```
PLACED → ACCEPTED → PREPARING → READY → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED
   ↓         ↓
CANCELLED  REJECTED
```

---

## Payment Handling (Mock)

For demo purposes, the backend accepts any `paymentId`:

```json
{
  "paymentMethod": "UPI",
  "paymentId": "demo_pay_12345"  // Any string works
}
```

**Voucher-Only Orders**: If vouchers cover full amount, no payment needed:
- `paymentStatus`: "PAID"
- `amountToPay`: 0
- `paymentRequired`: false

---

## UI Implementation Notes

1. **Cart Screen**:
   - Show items with quantity adjusters
   - Voucher selector (if MEAL_MENU and before cutoff)
   - Coupon input (if ON_DEMAND_MENU)
   - Price breakdown with voucher coverage
   - "Apply Vouchers" toggle with count selector

2. **Checkout Flow**:
   - Calculate pricing before order
   - Show cutoff warning if approaching
   - Payment method selection (skip if voucher-only)
   - Place order button

3. **Order Tracking**:
   - Status stepper visualization
   - Estimated delivery time
   - Driver contact (when out for delivery)
   - Map view (optional)

4. **Order History**:
   - FlatList with status badges
   - Quick reorder button
   - Rate delivered orders
