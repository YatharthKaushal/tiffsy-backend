# Admin Orders Management API

This document covers all order management endpoints available to administrators, including order status changes, delivery management, and cancellation flows.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Order Status Flow](#order-status-flow)
4. [Order Endpoints](#order-endpoints)
5. [Delivery & Batch Endpoints](#delivery--batch-endpoints)
6. [Admin-Specific Actions](#admin-specific-actions)
7. [Error Handling](#error-handling)

---

## Overview

Administrators have elevated privileges for order management:
- **Bypass ownership checks** - Can manage any order regardless of kitchen/driver assignment
- **Bypass status transition rules** - Can change order status directly without following normal flow
- **Auto status transitions** - Accept → PREPARING, Pickup → OUT_FOR_DELIVERY happen automatically
- **Proper audit trails** - All actions are logged with admin user ID

### Admin Privileges Summary

| Action | Regular User | Admin |
|--------|--------------|-------|
| View any order | Own orders only | All orders |
| Change order status | Kitchen's orders only | Any order |
| Bypass status flow | No | Yes |
| Cancel any order | Limited | Yes |
| Update delivery status | Assigned driver only | Any order |

---

## Authentication

All admin endpoints require JWT authentication with ADMIN role.

```
Authorization: Bearer <jwt_token>
```

The token is obtained from `POST /api/auth/admin/login`.

---

## Order Status Flow

### Standard Order Lifecycle

```
PLACED → ACCEPTED → PREPARING → READY → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED
    ↓         ↓          ↓         ↓
    └─────────┴──────────┴─────────┴──→ CANCELLED (by customer/kitchen/admin)
    ↓
    └──→ REJECTED (by kitchen)
```

### Status Descriptions

| Status | Description | Changed By |
|--------|-------------|------------|
| `PLACED` | Order created, awaiting kitchen response | System |
| `ACCEPTED` | Kitchen accepted the order | Kitchen Staff / Admin |
| `PREPARING` | Kitchen is preparing the food | Auto (after accept) / Admin |
| `READY` | Food is ready for pickup | Kitchen Staff / Admin |
| `PICKED_UP` | Driver picked up the order | Driver / Admin |
| `OUT_FOR_DELIVERY` | Driver is on the way | Auto (after pickup) / Admin |
| `DELIVERED` | Order delivered to customer | Driver / Admin |
| `CANCELLED` | Order cancelled | Customer / Kitchen / Admin |
| `REJECTED` | Kitchen rejected the order | Kitchen Staff / Admin |
| `FAILED` | Order failed (payment/system issue) | System |

### Auto Status Transitions

1. **Accept → PREPARING**: When an order is accepted, it automatically transitions to PREPARING
2. **Pickup → OUT_FOR_DELIVERY**: When an order/batch is picked up, it automatically transitions to OUT_FOR_DELIVERY

---

## Order Endpoints

### 1. Get All Orders (Admin View)

Retrieve all orders with filtering and pagination.

```
GET /api/orders/admin/all
Authorization: Bearer <admin_token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (PLACED, ACCEPTED, etc.) |
| `kitchenId` | ObjectId | Filter by kitchen |
| `zoneId` | ObjectId | Filter by zone |
| `driverId` | ObjectId | Filter by assigned driver |
| `menuType` | string | MEAL_MENU or ON_DEMAND_MENU |
| `mealWindow` | string | LUNCH or DINNER |
| `dateFrom` | ISO Date | Orders placed from this date |
| `dateTo` | ISO Date | Orders placed until this date |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50) |

**Response:**
```json
{
  "success": true,
  "message": "Orders retrieved",
  "data": {
    "orders": [
      {
        "_id": "...",
        "orderNumber": "ORD-20250112-ABC12",
        "userId": {
          "_id": "...",
          "name": "John Doe",
          "phone": "9876543210"
        },
        "kitchenId": {
          "_id": "...",
          "name": "Kitchen A"
        },
        "status": "PLACED",
        "grandTotal": 450,
        "placedAt": "2025-01-12T10:30:00Z",
        "items": [...],
        "deliveryAddress": {...}
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "pages": 3
    }
  }
}
```

---

### 2. Get Order by ID

Get detailed information about a specific order.

```
GET /api/orders/:id
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Order retrieved",
  "data": {
    "order": {
      "_id": "...",
      "orderNumber": "ORD-20250112-ABC12",
      "userId": {
        "_id": "...",
        "name": "John Doe",
        "phone": "9876543210"
      },
      "kitchenId": {...},
      "zoneId": {...},
      "deliveryAddress": {
        "addressLine1": "123 Main St",
        "locality": "Andheri West",
        "city": "Mumbai",
        "pincode": "400058"
      },
      "menuType": "MEAL_MENU",
      "mealWindow": "LUNCH",
      "items": [
        {
          "menuItemId": "...",
          "name": "Dal Rice Combo",
          "quantity": 2,
          "unitPrice": 150,
          "totalPrice": 300,
          "isMainCourse": true,
          "addons": [...]
        }
      ],
      "subtotal": 300,
      "charges": {
        "deliveryFee": 30,
        "packagingFee": 20,
        "taxAmount": 17.5
      },
      "grandTotal": 367.5,
      "amountPaid": 367.5,
      "paymentStatus": "PAID",
      "status": "ACCEPTED",
      "statusTimeline": [
        {
          "status": "PLACED",
          "timestamp": "2025-01-12T10:30:00Z",
          "updatedBy": "...",
          "notes": null
        },
        {
          "status": "ACCEPTED",
          "timestamp": "2025-01-12T10:35:00Z",
          "updatedBy": "...",
          "notes": "Order accepted by kitchen"
        }
      ],
      "placedAt": "2025-01-12T10:30:00Z",
      "acceptedAt": "2025-01-12T10:35:00Z"
    }
  }
}
```

---

### 3. Update Order Status (Admin - Full Access)

Admin-specific endpoint that allows changing order status to **any valid status**, bypassing normal transition rules.

```
PATCH /api/orders/admin/:id/status
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "ACCEPTED",
  "notes": "Manually updated by admin",
  "reason": "Optional reason for the change"
}
```

**Valid Status Values:**
- `PLACED`, `ACCEPTED`, `PREPARING`, `READY`, `PICKED_UP`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`, `REJECTED`, `FAILED`

**Response:**
```json
{
  "success": true,
  "message": "Order status updated",
  "data": {
    "order": {
      "_id": "...",
      "status": "ACCEPTED",
      "statusTimeline": [
        ...previousStatuses,
        {
          "status": "ACCEPTED",
          "timestamp": "2025-01-12T11:00:00Z",
          "updatedBy": "<admin_user_id>",
          "notes": "Manually updated by admin"
        }
      ],
      "acceptedAt": "2025-01-12T11:00:00Z"
    },
    "previousStatus": "PLACED",
    "newStatus": "ACCEPTED"
  }
}
```

**Notes:**
- Admin bypasses status transition validation completely
- All transitions are logged in `statusTimeline` and audit trail
- Corresponding timestamps are set automatically (e.g., `acceptedAt` for ACCEPTED, `preparedAt` for READY)
- Audit log includes `bypassedValidation: true` flag

---

### 3b. Update Order Status (Kitchen Staff Endpoint)

> **Note:** This endpoint is restricted to `PREPARING` and `READY` statuses only. For full status control, admins should use the `/api/orders/admin/:id/status` endpoint above.

```
PATCH /api/orders/:id/status
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "READY",
  "notes": "Food is ready for pickup"
}
```

**Valid Status Values (Limited):**
- `PREPARING`, `READY`

This endpoint is designed for kitchen staff and only allows transitioning orders to PREPARING or READY status.

---

### 4. Accept Order

Accept an order on behalf of a kitchen.

```
PATCH /api/orders/:id/accept
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "estimatedPrepTime": 30
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order accepted",
  "data": {
    "order": {
      "_id": "...",
      "status": "PREPARING",
      "acceptedAt": "2025-01-12T10:35:00Z",
      "preparingAt": "2025-01-12T10:35:00Z",
      "estimatedPrepTime": 30,
      "statusTimeline": [
        { "status": "PLACED", ... },
        { "status": "ACCEPTED", "notes": "Order accepted by kitchen", ... },
        { "status": "PREPARING", "notes": "Preparation started automatically", ... }
      ]
    }
  }
}
```

**Note:** Accepting an order automatically transitions it to PREPARING status.

---

### 5. Reject Order

Reject an order on behalf of a kitchen.

```
PATCH /api/orders/:id/reject
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "Items not available"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order rejected",
  "data": {
    "order": {
      "_id": "...",
      "status": "REJECTED",
      "rejectedAt": "2025-01-12T10:40:00Z",
      "rejectionReason": "Items not available",
      "cancelledBy": "ADMIN"
    },
    "refundInitiated": true
  }
}
```

**Audit Trail:**
- `cancelledBy` is set to "ADMIN" when admin rejects
- Refund is automatically initiated if payment was made

---

### 6. Cancel Order (Kitchen Cancel)

Cancel an order as kitchen/admin.

```
PATCH /api/orders/:id/cancel
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "Kitchen closed unexpectedly"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order cancelled",
  "data": {
    "order": {
      "_id": "...",
      "status": "CANCELLED",
      "cancelledAt": "2025-01-12T11:00:00Z",
      "cancellationReason": "Kitchen closed unexpectedly",
      "cancelledBy": "ADMIN"
    },
    "refundInitiated": true,
    "vouchersRestored": 2
  }
}
```

---

### 7. Cancel Order (Customer Cancel by Admin)

Cancel an order on behalf of a customer.

```
PATCH /api/orders/:id/customer-cancel
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "Customer requested cancellation via support"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "data": {
    "order": {...},
    "refundInitiated": true,
    "vouchersRestored": 2,
    "cancelledBy": "ADMIN",
    "message": "Your refund will be processed within 5-7 business days."
  }
}
```

**Admin Benefits:**
- Bypasses cancellation time window restrictions
- Always restores vouchers regardless of cutoff time
- Proper audit: `cancelledBy: "ADMIN"`

---

### 8. Admin Cancel Order

Special admin-only cancellation with full control.

```
PATCH /api/orders/:id/admin-cancel
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "Fraudulent order detected",
  "initiateRefund": true,
  "restoreVouchers": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order cancelled by admin",
  "data": {
    "order": {...},
    "refundInitiated": true,
    "vouchersRestored": 2
  }
}
```

---

## Delivery & Batch Endpoints

### 9. Get All Batches (Admin)

View all delivery batches.

```
GET /api/delivery/batches
Authorization: Bearer <admin_token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | PENDING, ASSIGNED, PICKED_UP, IN_PROGRESS, COMPLETED, CANCELLED |
| `kitchenId` | ObjectId | Filter by kitchen |
| `zoneId` | ObjectId | Filter by zone |
| `driverId` | ObjectId | Filter by driver |
| `date` | ISO Date | Filter by date |
| `page` | number | Page number |
| `limit` | number | Items per page |

**Response:**
```json
{
  "success": true,
  "message": "Batches retrieved",
  "data": {
    "batches": [
      {
        "_id": "...",
        "batchNumber": "BTH-20250112-001",
        "kitchenId": {...},
        "zoneId": {...},
        "driverId": {...},
        "orderIds": ["...", "..."],
        "status": "ASSIGNED",
        "orderCount": 5,
        "estimatedDeliveryTime": "2025-01-12T13:00:00Z"
      }
    ],
    "pagination": {...}
  }
}
```

---

### 10. Get Batch by ID

```
GET /api/delivery/batches/:batchId
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Batch retrieved",
  "data": {
    "batch": {
      "_id": "...",
      "batchNumber": "BTH-20250112-001",
      "kitchenId": {...},
      "zoneId": {...},
      "driverId": {
        "_id": "...",
        "name": "Driver Name",
        "phone": "9876543210"
      },
      "orders": [
        {
          "_id": "...",
          "orderNumber": "ORD-20250112-ABC12",
          "deliveryAddress": {...},
          "status": "READY",
          "deliverySequence": 1
        }
      ],
      "status": "ASSIGNED",
      "pickupTime": null,
      "completedAt": null
    }
  }
}
```

---

### 11. Update Batch Pickup

Mark a batch as picked up by driver.

```
PATCH /api/delivery/batches/:batchId/pickup
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Batch picked up",
  "data": {
    "batch": {
      "_id": "...",
      "status": "PICKED_UP",
      "pickupTime": "2025-01-12T12:30:00Z"
    },
    "ordersUpdated": 5
  }
}
```

**Auto Transitions:**
- Batch status → `PICKED_UP`
- All orders in batch → `PICKED_UP` → `OUT_FOR_DELIVERY`
- Both statuses logged in each order's `statusTimeline`

---

### 12. Update Delivery Status (Single Order)

Update delivery status for a specific order.

```
PATCH /api/delivery/orders/:orderId/status
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "DELIVERED",
  "notes": "Delivered to security guard"
}
```

**Valid Delivery Statuses:**
- `PICKED_UP`
- `OUT_FOR_DELIVERY`
- `DELIVERED`

**Response:**
```json
{
  "success": true,
  "message": "Delivery status updated",
  "data": {
    "order": {
      "_id": "...",
      "status": "DELIVERED",
      "deliveredAt": "2025-01-12T13:15:00Z",
      "statusTimeline": [...]
    }
  }
}
```

**Auto Transition:**
- When setting `PICKED_UP`, order automatically transitions to `OUT_FOR_DELIVERY`

---

### 13. Complete Batch

Mark entire batch as completed.

```
PATCH /api/delivery/batches/:batchId/complete
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Batch completed",
  "data": {
    "batch": {
      "_id": "...",
      "status": "COMPLETED",
      "completedAt": "2025-01-12T13:30:00Z"
    },
    "ordersDelivered": 5
  }
}
```

---

### 14. Update Delivery Sequence

Reorder deliveries within a batch.

```
PATCH /api/delivery/batches/:batchId/sequence
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "sequence": [
    { "orderId": "order_id_1", "sequence": 1 },
    { "orderId": "order_id_2", "sequence": 2 },
    { "orderId": "order_id_3", "sequence": 3 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Delivery sequence updated",
  "data": {
    "batch": {...}
  }
}
```

---

### 15. Reassign Batch

Reassign a batch to a different driver.

```
PATCH /api/delivery/batches/:batchId/reassign
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "driverId": "new_driver_id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Batch reassigned",
  "data": {
    "batch": {
      "_id": "...",
      "driverId": {
        "_id": "new_driver_id",
        "name": "New Driver"
      }
    }
  }
}
```

---

### 16. Cancel Batch

Cancel an entire batch.

```
PATCH /api/delivery/batches/:batchId/cancel
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "Driver unavailable"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Batch cancelled",
  "data": {
    "batch": {
      "_id": "...",
      "status": "CANCELLED"
    },
    "ordersAffected": 5
  }
}
```

---

## Admin-Specific Actions

### Track Order (with Customer Info)

Get order tracking details including customer information.

```
GET /api/orders/:id/track
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Order tracking details",
  "data": {
    "order": {
      "_id": "...",
      "orderNumber": "ORD-20250112-ABC12",
      "status": "OUT_FOR_DELIVERY",
      "statusTimeline": [...],
      "estimatedDeliveryTime": "2025-01-12T13:00:00Z",
      "deliveryAddress": {...}
    },
    "customer": {
      "name": "John Doe",
      "phone": "9876543210"
    },
    "driver": {
      "_id": "...",
      "name": "Driver Name",
      "phone": "9123456789"
    },
    "batch": {
      "_id": "...",
      "batchNumber": "BTH-20250112-001"
    }
  }
}
```

---

## Error Handling

### Common Error Responses

**404 - Order Not Found:**
```json
{
  "success": false,
  "message": "Order not found"
}
```

**400 - Invalid Status:**
```json
{
  "success": false,
  "message": "Invalid status value"
}
```

**400 - Cannot Cancel:**
```json
{
  "success": false,
  "message": "Order cannot be cancelled",
  "data": {
    "reason": "Order already delivered"
  }
}
```

**403 - Forbidden:**
```json
{
  "success": false,
  "message": "Admin access required"
}
```

---

## Audit Trail

All admin actions are tracked with:

| Field | Description |
|-------|-------------|
| `statusTimeline[].updatedBy` | Admin's user ID |
| `statusTimeline[].timestamp` | When the action occurred |
| `statusTimeline[].notes` | Action description |
| `cancelledBy` | "ADMIN", "CUSTOMER", or "KITCHEN" |
| `acceptedAt`, `preparingAt`, etc. | Status-specific timestamps |

### Example Status Timeline:
```json
{
  "statusTimeline": [
    {
      "status": "PLACED",
      "timestamp": "2025-01-12T10:30:00Z",
      "updatedBy": "customer_id",
      "notes": null
    },
    {
      "status": "ACCEPTED",
      "timestamp": "2025-01-12T10:35:00Z",
      "updatedBy": "admin_id",
      "notes": "Order accepted by kitchen"
    },
    {
      "status": "PREPARING",
      "timestamp": "2025-01-12T10:35:00Z",
      "updatedBy": "admin_id",
      "notes": "Preparation started automatically"
    },
    {
      "status": "CANCELLED",
      "timestamp": "2025-01-12T11:00:00Z",
      "updatedBy": "admin_id",
      "notes": "Cancelled by admin - customer request"
    }
  ]
}
```

---

## Quick Reference

### Order Status Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders/admin/all` | List all orders |
| GET | `/api/orders/admin/stats` | Get order statistics |
| GET | `/api/orders/:id` | Get order details |
| PATCH | `/api/orders/admin/:id/status` | **Admin: Update to ANY status** |
| PATCH | `/api/orders/:id/status` | Kitchen: Update to PREPARING/READY only |
| PATCH | `/api/orders/:id/accept` | Accept order |
| PATCH | `/api/orders/:id/reject` | Reject order |
| PATCH | `/api/orders/:id/cancel` | Cancel (kitchen) |
| PATCH | `/api/orders/:id/customer-cancel` | Cancel (customer) |
| PATCH | `/api/orders/:id/admin-cancel` | Admin cancel with options |
| GET | `/api/orders/:id/track` | Track order |

### Delivery Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/delivery/batches` | List all batches |
| GET | `/api/delivery/batches/:batchId` | Get batch details |
| PATCH | `/api/delivery/batches/:batchId/pickup` | Mark pickup |
| PATCH | `/api/delivery/batches/:batchId/complete` | Complete batch |
| PATCH | `/api/delivery/batches/:batchId/sequence` | Update sequence |
| PATCH | `/api/delivery/batches/:batchId/reassign` | Reassign driver |
| PATCH | `/api/delivery/batches/:batchId/cancel` | Cancel batch |
| PATCH | `/api/delivery/orders/:orderId/status` | Update delivery status |
