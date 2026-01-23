# Kitchen App - Auto-Ordering Integration Guide

## Overview

This document covers the integration of the auto-ordering feature for the Kitchen App. Auto-orders are automatically placed for subscription users and arrive at the kitchen as pre-accepted orders, ready for preparation.

---

## Table of Contents

1. [Feature Summary](#feature-summary)
2. [Key Differences: Auto-Orders vs Manual Orders](#key-differences-auto-orders-vs-manual-orders)
3. [Notification Handling](#notification-handling)
4. [Order Data Structure](#order-data-structure)
5. [UI/UX Recommendations](#uiux-recommendations)
6. [API Endpoints](#api-endpoints)
7. [Testing Checklist](#testing-checklist)

---

## Feature Summary

### What are Auto-Orders?

- Orders automatically placed by the system for subscription users
- Placed at configured times: **LUNCH (~10:00 AM IST)**, **DINNER (~7:00 PM IST)**
- Paid via vouchers (no payment collection needed)
- **Already ACCEPTED** when they arrive - no accept/reject step required
- Kitchen should start preparing immediately upon receiving notification

### Key Points for Kitchen Staff

| Aspect | Auto-Order Behavior |
|--------|---------------------|
| Arrival Status | `ACCEPTED` (pre-accepted by system) |
| Payment | Already paid via voucher |
| Action Required | Start preparation immediately |
| Notification | Push notification with "New Auto Order" |
| Identification | `isAutoOrder: true` flag on order |

---

## Key Differences: Auto-Orders vs Manual Orders

| Feature | Manual Order | Auto-Order |
|---------|--------------|------------|
| Initial Status | `PLACED` (pending acceptance) | `ACCEPTED` (ready for prep) |
| Accept/Reject | Required | Not required (auto-accepted) |
| Payment Method | Various (UPI, Card, COD, Voucher) | Always `VOUCHER_ONLY` |
| Payment Status | May vary | Always `PAID` |
| Amount to Collect | May have `amountPaid > 0` | Always `amountPaid: 0` |
| Special Instructions | User-provided | "Auto-order" |
| Notification Type | `NEW_MANUAL_ORDER` | `NEW_AUTO_ORDER` |

### Order Status Flow

**Manual Order:**
```
PLACED → [Accept/Reject] → ACCEPTED → PREPARING → READY → ...
```

**Auto-Order:**
```
ACCEPTED → PREPARING → READY → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED
```

---

## Notification Handling

### FCM Notification Types for Kitchen

| Type | Description | Priority |
|------|-------------|----------|
| `NEW_AUTO_ORDER` | Auto-order received | High |
| `NEW_MANUAL_ORDER` | Manual order received | High |
| `BATCH_REMINDER` | Cutoff approaching | Medium |

### Auto-Order Notification Payload

```json
{
  "title": "New Auto Order",
  "body": "Auto order #ORD-123456 received for LUNCH",
  "data": {
    "type": "NEW_AUTO_ORDER",
    "orderId": "64abc123def456...",
    "orderNumber": "ORD-123456"
  }
}
```

### Notification Registration

Kitchen staff should register for notifications with:
```json
{
  "role": "KITCHEN_STAFF",
  "kitchenId": "your_kitchen_id"
}
```

Only staff assigned to the specific kitchen will receive that kitchen's auto-order notifications.

### Recommended Notification Handling

```javascript
// FCM message handler
firebase.messaging().onMessage((payload) => {
  const { type, orderId, orderNumber } = payload.data;

  switch (type) {
    case 'NEW_AUTO_ORDER':
      // Play notification sound
      playSound('new_order');

      // Show prominent notification
      showNotification({
        title: 'New Auto Order!',
        body: `Order #${orderNumber} - Ready to prepare`,
        icon: 'auto_order_icon',
        priority: 'high',
        action: () => navigateToOrder(orderId)
      });

      // Refresh orders list
      refreshOrdersList();
      break;

    case 'NEW_MANUAL_ORDER':
      // Similar handling for manual orders
      // But these need accept/reject action
      break;
  }
});
```

---

## Order Data Structure

### Auto-Order Object

```typescript
interface AutoOrder {
  _id: string;
  orderNumber: string;                    // e.g., "ORD-123456"

  // Identification
  isAutoOrder: boolean;                   // TRUE for auto-orders

  // Status - starts as ACCEPTED
  status: 'ACCEPTED' | 'PREPARING' | 'READY' | 'PICKED_UP' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
  acceptedAt: Date;                       // Set automatically

  // Kitchen & Zone
  kitchenId: string;
  zoneId: string;

  // Customer
  userId: {
    _id: string;
    name: string;
    phone: string;
  };

  // Delivery
  deliveryAddress: {
    addressLine1: string;
    addressLine2?: string;
    landmark?: string;
    locality?: string;
    city: string;
    pincode: string;
    contactName: string;
    contactPhone: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };

  // Menu
  menuType: 'MEAL_MENU';
  mealWindow: 'LUNCH' | 'DINNER';
  items: [{
    menuItemId: string;
    name: string;                         // e.g., "Veg Thali"
    quantity: number;                     // Usually 1 for auto-orders
    unitPrice: number;
    totalPrice: number;
    isMainCourse: boolean;
    addons: [];                           // Usually empty for auto-orders
  }];

  // Payment - Always voucher for auto-orders
  paymentMethod: 'VOUCHER_ONLY';
  paymentStatus: 'PAID';
  amountPaid: 0;                          // Always 0 for voucher orders
  grandTotal: 0;                          // Covered by voucher

  voucherUsage: {
    voucherIds: string[];
    voucherCount: number;
    mainCoursesCovered: number;
  };

  // Instructions
  specialInstructions: 'Auto-order';      // System-generated

  // Timeline
  placedAt: Date;
  statusTimeline: [{
    status: string;
    timestamp: Date;
    notes: string;
  }];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

### Status Timeline for Auto-Orders

Auto-orders arrive with two entries already in the timeline:

```json
{
  "statusTimeline": [
    {
      "status": "PLACED",
      "timestamp": "2025-01-23T04:30:00.000Z",
      "notes": "Auto-ordered by system"
    },
    {
      "status": "ACCEPTED",
      "timestamp": "2025-01-23T04:30:00.000Z",
      "notes": "Auto-accepted (voucher order policy)"
    }
  ]
}
```

---

## UI/UX Recommendations

### 1. Orders List - Visual Differentiation

Clearly distinguish auto-orders from manual orders:

```
┌─────────────────────────────────────┐
│ 🔄 AUTO ORDER                       │
│ #ORD-123456 • LUNCH                 │
│ ─────────────────────────────────── │
│ Veg Thali x1                        │
│ ─────────────────────────────────── │
│ Customer: John Doe                  │
│ 📍 123 Main St, Sector 15          │
│ ─────────────────────────────────── │
│ Status: ACCEPTED                    │
│        [Start Preparing]            │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 📋 MANUAL ORDER                     │
│ #ORD-123457 • LUNCH                 │
│ ─────────────────────────────────── │
│ Special Thali x2                    │
│ ─────────────────────────────────── │
│ Customer: Jane Smith                │
│ 📍 456 Oak Ave, Sector 22          │
│ ─────────────────────────────────── │
│ Status: PLACED                      │
│    [Accept]        [Reject]         │
└─────────────────────────────────────┘
```

### 2. Auto-Order Badge/Indicator

Use a consistent visual indicator:

```
┌──────────────┐
│ 🔄 Auto      │  <- Badge for auto-orders
└──────────────┘

┌──────────────┐
│ 🎫 Voucher   │  <- Payment method indicator
└──────────────┘
```

### 3. Order Details Screen

For auto-orders, show:

```
┌─────────────────────────────────────┐
│  Order #ORD-123456                  │
│  ════════════════════════════       │
│                                     │
│  🔄 AUTO ORDER                      │
│  This order was placed automatically│
│  for a subscription customer.       │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  ITEMS                              │
│  ├─ Veg Thali              x1       │
│  │  (Main Course)                   │
│  │                                  │
│  └─ Total Items: 1                  │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  PAYMENT                            │
│  Method: Voucher                    │
│  Status: Paid ✓                     │
│  Amount to Collect: ₹0              │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  DELIVERY                           │
│  John Doe • +91 98765 43210         │
│  123 Main St, Landmark              │
│  Sector 15, City - 110001           │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  STATUS TIMELINE                    │
│  ● ACCEPTED      04:30 AM           │
│  │  Auto-accepted (voucher policy)  │
│  │                                  │
│  ○ PREPARING     --:-- --           │
│  ○ READY         --:-- --           │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│       [Mark as Preparing]           │
└─────────────────────────────────────┘
```

### 4. No Accept/Reject for Auto-Orders

**Important:** Do NOT show Accept/Reject buttons for auto-orders. They are pre-accepted.

```javascript
// Conditional button rendering
if (order.isAutoOrder) {
  // Show only status progression buttons
  if (order.status === 'ACCEPTED') {
    showButton('Mark as Preparing');
  } else if (order.status === 'PREPARING') {
    showButton('Mark as Ready');
  }
} else {
  // Manual order - show accept/reject if PLACED
  if (order.status === 'PLACED') {
    showButtons(['Accept', 'Reject']);
  }
  // ... other status buttons
}
```

### 5. Filter/Tab for Auto-Orders

Add filter option to orders list:

```
┌─────────────────────────────────────┐
│  Orders                             │
│  ════════════════════════════       │
│                                     │
│  [All] [Manual] [Auto] [Pending]    │
│                                     │
│  ... order list ...                 │
└─────────────────────────────────────┘
```

### 6. Dashboard Stats

Include auto-order metrics:

```
┌─────────────────────────────────────┐
│  Today's Summary                    │
│  ════════════════════════════       │
│                                     │
│  Total Orders:     45               │
│  ├─ Manual:        32               │
│  └─ Auto:          13               │
│                                     │
│  Pending:          5                │
│  Preparing:        8                │
│  Ready:            3                │
└─────────────────────────────────────┘
```

---

## API Endpoints

### Base URL
```
/api/kitchen
```

### Authentication
All endpoints require `Authorization: Bearer <token>` header.
Kitchen staff must have `role: KITCHEN_STAFF` and valid `kitchenId`.

---

### 1. Get Kitchen Orders

```http
GET /api/kitchen/orders
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status |
| mealWindow | string | `LUNCH` or `DINNER` |
| isAutoOrder | boolean | Filter auto-orders only |
| date | string | Filter by date (YYYY-MM-DD) |
| page | number | Page number |
| limit | number | Items per page |

**Example - Get Auto-Orders Only:**
```http
GET /api/kitchen/orders?isAutoOrder=true&mealWindow=LUNCH&status=ACCEPTED
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "_id": "order_id",
        "orderNumber": "ORD-123456",
        "isAutoOrder": true,
        "status": "ACCEPTED",
        "mealWindow": "LUNCH",
        "items": [...],
        "userId": {
          "name": "John Doe",
          "phone": "+919876543210"
        },
        "deliveryAddress": {...},
        "paymentMethod": "VOUCHER_ONLY",
        "paymentStatus": "PAID",
        "amountPaid": 0,
        "placedAt": "2025-01-23T04:30:00.000Z",
        "acceptedAt": "2025-01-23T04:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 13,
      "page": 1,
      "limit": 20
    }
  }
}
```

---

### 2. Get Order Details

```http
GET /api/kitchen/orders/:id
```

**Response:** Full order object as shown in [Order Data Structure](#order-data-structure).

---

### 3. Update Order Status

```http
PATCH /api/kitchen/orders/:id/status
```

**Request Body:**
```json
{
  "status": "PREPARING",
  "notes": "Started preparation"
}
```

**Valid Status Transitions for Auto-Orders:**
```
ACCEPTED → PREPARING → READY
```

**Response:**
```json
{
  "success": true,
  "message": "Order status updated",
  "data": {
    "order": {
      "status": "PREPARING",
      "statusTimeline": [
        { "status": "PLACED", "timestamp": "...", "notes": "Auto-ordered by system" },
        { "status": "ACCEPTED", "timestamp": "...", "notes": "Auto-accepted (voucher order policy)" },
        { "status": "PREPARING", "timestamp": "...", "notes": "Started preparation" }
      ]
    }
  }
}
```

---

### 4. Get Kitchen Dashboard Stats

```http
GET /api/kitchen/dashboard
```

**Response:**
```json
{
  "success": true,
  "data": {
    "today": {
      "totalOrders": 45,
      "autoOrders": 13,
      "manualOrders": 32,
      "byStatus": {
        "PLACED": 2,
        "ACCEPTED": 5,
        "PREPARING": 8,
        "READY": 3,
        "PICKED_UP": 12,
        "DELIVERED": 15
      }
    },
    "currentMealWindow": "LUNCH",
    "pendingPreparation": 5
  }
}
```

---

## Testing Checklist

### Notification Testing
- [ ] Receive `NEW_AUTO_ORDER` notification when auto-order placed
- [ ] Notification displays correct order number and meal window
- [ ] Tapping notification navigates to order details
- [ ] Notification sound plays for new orders

### Order Display
- [ ] Auto-orders appear in orders list
- [ ] Auto-order badge/indicator visible
- [ ] `isAutoOrder: true` orders don't show Accept/Reject buttons
- [ ] Status shows as `ACCEPTED` on arrival
- [ ] Payment shows as "Voucher - Paid"
- [ ] Amount to collect shows ₹0

### Status Updates
- [ ] Can mark auto-order as PREPARING
- [ ] Can mark as READY
- [ ] Status timeline updates correctly
- [ ] Customer receives status update notification

### Filtering
- [ ] Can filter orders by auto-order flag
- [ ] Can filter by meal window (LUNCH/DINNER)
- [ ] Dashboard shows auto-order count

### Edge Cases
- [ ] Handle multiple auto-orders arriving simultaneously
- [ ] Handle auto-orders during high-load periods
- [ ] Verify order details when kitchen serves multiple zones

---

## Common Questions

### Q: Can we reject an auto-order?

**A:** Auto-orders cannot be rejected through normal flow since they're pre-accepted. If there's an issue (out of ingredients, etc.), contact admin to handle cancellation and customer refund.

### Q: Why is the amount ₹0?

**A:** Auto-orders are paid via vouchers. The customer has already purchased a subscription that includes meal vouchers. No cash/card collection needed.

### Q: What if the customer didn't want this order?

**A:** Customers can skip meals or pause auto-ordering through the Consumer App. If an unwanted order arrives, admin can cancel it and restore the voucher.

### Q: When do auto-orders arrive?

**A:**
- **LUNCH orders:** Around 10:00 AM IST
- **DINNER orders:** Around 7:00 PM IST

These times are configurable by admin.

### Q: How do I know which orders are for subscriptions?

**A:** Look for `isAutoOrder: true` and `paymentMethod: "VOUCHER_ONLY"`.

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────┐
│  AUTO-ORDER QUICK REFERENCE                         │
│  ═══════════════════════════════════════════════    │
│                                                     │
│  IDENTIFY:                                          │
│  • isAutoOrder = true                               │
│  • paymentMethod = "VOUCHER_ONLY"                   │
│  • specialInstructions = "Auto-order"               │
│                                                     │
│  STATUS ON ARRIVAL: ACCEPTED                        │
│                                                     │
│  ACTIONS:                                           │
│  ✓ Start preparing immediately                      │
│  ✓ Update status: PREPARING → READY                 │
│  ✗ No Accept/Reject needed                          │
│                                                     │
│  PAYMENT:                                           │
│  • Already paid via voucher                         │
│  • Amount to collect: ₹0                            │
│                                                     │
│  NOTIFICATION TYPE: NEW_AUTO_ORDER                  │
│                                                     │
│  TIMING:                                            │
│  • LUNCH: ~10:00 AM IST                             │
│  • DINNER: ~7:00 PM IST                             │
└─────────────────────────────────────────────────────┘
```

---

## Questions?

Contact the backend team for:
- API clarifications
- Notification issues
- Bug reports
- Feature requests
