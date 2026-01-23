# Kitchen App Integration Guide: Auto-Accept Voucher Orders

## Overview

The backend now supports **automatic acceptance** of voucher-based orders when placed within kitchen operating hours. This document outlines the changes required in the Kitchen App to handle this new functionality.

---

## What Changed?

### Previous Behavior
- All orders arrived with status `PLACED`
- Kitchen staff had to manually accept every order
- Notification: `NEW_MANUAL_ORDER`

### New Behavior
- **Voucher orders within operating hours**: Arrive with status `ACCEPTED` (auto-accepted)
- **All other orders**: Still arrive with status `PLACED` (manual accept required)
- New notification type: `NEW_AUTO_ACCEPTED_ORDER`

---

## Auto-Accept Conditions

An order is auto-accepted when ALL of these conditions are met:

| Condition | Requirement |
|-----------|-------------|
| Menu Type | `MEAL_MENU` only |
| Vouchers Used | At least 1 voucher (`voucherUsage.voucherCount > 0`) |
| Payment Status | `PAID` (either fully covered by vouchers OR payment verified) |
| Time | Within kitchen's operating hours for the meal window |

### Operating Hours Reference
- **Lunch**: Typically 11:00 - 14:00 IST (kitchen-specific)
- **Dinner**: Typically 19:00 - 22:00 IST (kitchen-specific)

> **Note**: Operating hours are different from cutoff times. Cutoff is when ordering closes (11:00 for lunch). Operating hours are when the kitchen is actively preparing/serving.

---

## API Response Changes

### Create Order Response (Customer places order)

The order object now includes:

```json
{
  "success": true,
  "message": "Order placed successfully",
  "data": {
    "order": {
      "_id": "...",
      "orderNumber": "ORD-XXXXXX",
      "status": "ACCEPTED",          // Can be "PLACED" or "ACCEPTED"
      "acceptedAt": "2024-01-15T12:30:00.000Z",  // Present if auto-accepted
      "statusTimeline": [
        {
          "status": "PLACED",
          "timestamp": "2024-01-15T12:30:00.000Z",
          "updatedBy": "userId"
        },
        {
          "status": "ACCEPTED",
          "timestamp": "2024-01-15T12:30:00.000Z",
          "updatedBy": "userId",
          "notes": "Auto-accepted (voucher order within operating hours)"
        }
      ],
      "voucherUsage": {
        "voucherIds": ["...", "..."],
        "voucherCount": 1,
        "mainCoursesCovered": 1
      },
      "menuType": "MEAL_MENU",
      "mealWindow": "LUNCH"
    },
    "autoAccepted": true,           // NEW FIELD - indicates if order was auto-accepted
    "vouchersUsed": 1,
    "amountToPay": 0
  }
}
```

### Key Fields to Check

| Field | Type | Description |
|-------|------|-------------|
| `order.status` | String | `"PLACED"` or `"ACCEPTED"` |
| `order.acceptedAt` | Date | Timestamp when accepted (null if not accepted) |
| `autoAccepted` | Boolean | `true` if auto-accepted, `false` otherwise |
| `order.statusTimeline[].notes` | String | Contains "Auto-accepted" text for auto-accepted orders |

---

## Notification Changes

### Push Notification Types

#### 1. NEW_MANUAL_ORDER (Existing)
Sent when order requires manual acceptance.

```json
{
  "type": "NEW_MANUAL_ORDER",
  "title": "New Order Received!",
  "body": "Order #ORD-123456 - 2 item(s) for LUNCH",
  "data": {
    "orderId": "...",
    "orderNumber": "ORD-123456",
    "autoAccepted": false
  }
}
```

#### 2. NEW_AUTO_ACCEPTED_ORDER (New)
Sent when order is auto-accepted.

```json
{
  "type": "NEW_AUTO_ACCEPTED_ORDER",
  "title": "Auto-Accepted Order #ORD-123456",
  "body": "Voucher order for LUNCH - 2 item(s). Start preparation!",
  "data": {
    "orderId": "...",
    "orderNumber": "ORD-123456",
    "autoAccepted": true
  }
}
```

### Handling Notifications

```javascript
// Example notification handler
function handleOrderNotification(notification) {
  const { type, data } = notification;

  if (type === "NEW_AUTO_ACCEPTED_ORDER") {
    // Order already accepted - show "Start Preparation" UI
    showAutoAcceptedOrderAlert(data);
    refreshOrderList();
    // Optionally play different sound/vibration
  } else if (type === "NEW_MANUAL_ORDER") {
    // Order needs acceptance - show Accept/Reject UI
    showNewOrderAlert(data);
    refreshOrderList();
  }
}
```

---

## UI/UX Implementation Guide

### 1. Order List Screen

#### Visual Differentiation
Auto-accepted orders should be visually distinguished:

```
┌─────────────────────────────────────────┐
│ 🟢 AUTO-ACCEPTED                        │
│ Order #ORD-123456                       │
│ 2 items • Lunch • Voucher Order         │
│ Accepted at 12:30 PM                    │
│                                         │
│ [Start Preparing]                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🟡 PENDING ACCEPTANCE                   │
│ Order #ORD-123457                       │
│ 3 items • Lunch                         │
│ Placed at 12:32 PM                      │
│                                         │
│ [Accept]  [Reject]                      │
└─────────────────────────────────────────┘
```

#### Recommended Visual Indicators
- **Auto-accepted**: Green badge/tag, "AUTO-ACCEPTED" label
- **Manual pending**: Yellow/Orange badge, "PENDING ACCEPTANCE" label
- **Voucher indicator**: Show voucher icon for voucher orders

### 2. Order Detail Screen

For auto-accepted orders, show:
- "Auto-Accepted" status badge
- Acceptance timestamp
- Note in timeline: "Auto-accepted (voucher order within operating hours)"
- Skip the Accept/Reject buttons - show "Start Preparing" directly

```javascript
// Example logic
function renderOrderActions(order) {
  if (order.status === "ACCEPTED") {
    // Auto-accepted or already accepted
    return (
      <Button onPress={() => updateStatus("PREPARING")}>
        Start Preparing
      </Button>
    );
  } else if (order.status === "PLACED") {
    // Needs manual acceptance
    return (
      <>
        <Button onPress={() => acceptOrder(order._id)}>Accept</Button>
        <Button onPress={() => rejectOrder(order._id)}>Reject</Button>
      </>
    );
  }
  // ... other statuses
}
```

### 3. Status Timeline Display

Show the auto-accept note in the order timeline:

```
Timeline:
─────────────────────────────────
12:30 PM  PLACED
          Order received
─────────────────────────────────
12:30 PM  ACCEPTED ✓
          Auto-accepted (voucher order within operating hours)
─────────────────────────────────
```

---

## Order Status Flow

### Auto-Accepted Order Flow
```
PLACED → ACCEPTED (auto) → PREPARING → READY → PICKED_UP → DELIVERED
                    ↓
              Kitchen starts
              preparing immediately
```

### Manual Order Flow (unchanged)
```
PLACED → [Kitchen Action] → ACCEPTED → PREPARING → READY → ...
              ↓
         or REJECTED
```

---

## API Endpoints Reference

### Get Kitchen Orders
```
GET /api/orders/kitchen
```

Response includes all order fields. Check `status` and `statusTimeline` for auto-accept info.

### Update Order Status
```
PATCH /api/orders/:id/status
Body: { "status": "PREPARING" }
```

For auto-accepted orders, kitchen staff can directly move to `PREPARING`.

### Accept Order (Manual)
```
PATCH /api/orders/:id/accept
```

Only needed for orders with `status: "PLACED"`.

### Reject Order
```
PATCH /api/orders/:id/reject
Body: { "reason": "Out of ingredients" }
```

Still available for `PLACED` orders only.

---

## Edge Cases to Handle

### 1. Order Arrives as PLACED Despite Having Vouchers
This happens when:
- Order placed **outside operating hours** (before 11:00 for lunch, etc.)
- Payment pending at order creation time (voucher + addons scenario in production)

**Action**: Show normal Accept/Reject UI.

### 2. Payment Verified Later (Voucher + Addon Orders)
When a voucher order with additional payment gets auto-accepted after payment:
- Order status changes from `PLACED` to `ACCEPTED` automatically
- Kitchen receives updated order via real-time sync or pull refresh
- No separate notification currently (may be added later)

**Recommendation**: Implement periodic order list refresh or WebSocket for real-time updates.

### 3. Outside Operating Hours
If kitchen receives voucher order outside operating hours:
- Status will be `PLACED`
- Manual acceptance required
- This is intentional to prevent auto-accept when kitchen isn't ready

---

## Testing Checklist

- [ ] Receive `NEW_AUTO_ACCEPTED_ORDER` notification
- [ ] Verify order arrives with `status: "ACCEPTED"`
- [ ] Verify `autoAccepted: true` in notification data
- [ ] Display auto-accepted badge/indicator correctly
- [ ] "Start Preparing" button works for auto-accepted orders
- [ ] Order timeline shows auto-accept note
- [ ] Manual orders still show Accept/Reject buttons
- [ ] Both order types display correctly in order list
- [ ] Sound/vibration differentiation (optional)

---

## Migration Notes

### Backward Compatibility
- All existing order handling continues to work
- Only new voucher orders within operating hours get auto-accepted
- No breaking changes to existing APIs

### Recommended Updates
1. Add notification handler for `NEW_AUTO_ACCEPTED_ORDER`
2. Update order list UI to show auto-accepted badge
3. Update order detail to skip Accept/Reject for accepted orders
4. Add auto-accept info to order timeline

---

## Questions?

Contact the backend team for:
- Operating hours configuration queries
- Order status clarification
- Notification troubleshooting
