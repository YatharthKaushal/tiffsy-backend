# Admin App Integration Guide: Auto-Accept Voucher Orders

## Overview

The backend now supports **automatic acceptance** of voucher-based orders when placed within kitchen operating hours. This document outlines the changes and features relevant to the Admin App for monitoring, configuration, and management.

---

## Feature Summary

### What is Auto-Accept?
When a customer places a voucher order during kitchen operating hours, the system automatically accepts the order (sets status to `ACCEPTED`) without requiring manual kitchen staff action.

### Business Logic
| Scenario | Auto-Accept? | Reason |
|----------|--------------|--------|
| Voucher order, within operating hours | ✅ Yes | Kitchen is ready to prepare |
| Voucher order, outside operating hours | ❌ No | Kitchen not operating yet |
| Voucher + addons, payment pending | ❌ No | Wait for payment verification |
| Voucher + addons, payment complete, within hours | ✅ Yes | After payment is verified |
| Non-voucher order (paid) | ❌ No | Requires kitchen confirmation |
| ON_DEMAND_MENU order | ❌ No | Always requires manual accept |

---

## Kitchen Operating Hours Configuration

### Schema Structure

Each kitchen has configurable operating hours:

```javascript
// Kitchen document structure
{
  "_id": "...",
  "name": "Kitchen Name",
  "operatingHours": {
    "lunch": {
      "startTime": "11:00",  // HH:mm format (IST)
      "endTime": "14:00"
    },
    "dinner": {
      "startTime": "19:00",
      "endTime": "22:00"
    },
    "onDemand": {
      "startTime": "10:00",
      "endTime": "22:00",
      "isAlwaysOpen": false
    }
  }
}
```

### Default Operating Hours
If a kitchen doesn't have operating hours configured:
- **Lunch**: 11:00 - 14:00 IST
- **Dinner**: 19:00 - 22:00 IST

### Admin Configuration UI

Provide UI to configure kitchen operating hours:

```
┌─────────────────────────────────────────────────┐
│ Kitchen Operating Hours                         │
├─────────────────────────────────────────────────┤
│ Lunch Window                                    │
│   Start Time: [11:00] ▼   End Time: [14:00] ▼  │
│                                                 │
│ Dinner Window                                   │
│   Start Time: [19:00] ▼   End Time: [22:00] ▼  │
│                                                 │
│ On-Demand Window                                │
│   Start Time: [10:00] ▼   End Time: [22:00] ▼  │
│   [ ] Always Open                               │
│                                                 │
│                              [Save Changes]     │
└─────────────────────────────────────────────────┘
```

### API Endpoint for Kitchen Update
```
PATCH /api/admin/kitchens/:id
Body: {
  "operatingHours": {
    "lunch": { "startTime": "11:00", "endTime": "14:00" },
    "dinner": { "startTime": "19:00", "endTime": "22:00" }
  }
}
```

---

## Order Management Changes

### Order Status Values
No new statuses added. Existing statuses:
- `PLACED` - Order received, pending acceptance
- `ACCEPTED` - Order accepted (manually or auto)
- `PREPARING` - Kitchen preparing
- `READY` - Ready for pickup
- `PICKED_UP` - Driver picked up
- `OUT_FOR_DELIVERY` - Being delivered
- `DELIVERED` - Completed
- `CANCELLED` - Cancelled
- `REJECTED` - Kitchen rejected
- `FAILED` - Delivery failed

### New Order Fields

#### In Order Document
```json
{
  "status": "ACCEPTED",
  "acceptedAt": "2024-01-15T12:30:00.000Z",
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
  ]
}
```

#### Identifying Auto-Accepted Orders
Check the `statusTimeline` for the acceptance entry:
```javascript
function isAutoAccepted(order) {
  const acceptEntry = order.statusTimeline?.find(
    entry => entry.status === "ACCEPTED"
  );
  return acceptEntry?.notes?.includes("Auto-accepted") || false;
}
```

---

## Admin Dashboard Considerations

### 1. Order Listing Enhancements

Add visual indicators for auto-accepted orders:

```
┌──────────────────────────────────────────────────────────────┐
│ Orders                                    [Filter ▼] [Export]│
├──────────────────────────────────────────────────────────────┤
│ # | Order No.    | Status    | Type    | Kitchen    | Time   │
├───┼──────────────┼───────────┼─────────┼────────────┼────────┤
│ 1 │ ORD-123456   │ ACCEPTED  │ 🎫 Auto │ Kitchen A  │ 12:30  │
│   │              │ (auto)    │         │            │        │
├───┼──────────────┼───────────┼─────────┼────────────┼────────┤
│ 2 │ ORD-123457   │ ACCEPTED  │ Manual  │ Kitchen B  │ 12:32  │
├───┼──────────────┼───────────┼─────────┼────────────┼────────┤
│ 3 │ ORD-123458   │ PLACED    │ Pending │ Kitchen A  │ 12:35  │
└───┴──────────────┴───────────┴─────────┴────────────┴────────┘
```

### 2. Order Filters

Add filter options:
- **Acceptance Type**: All / Auto-Accepted / Manual / Pending
- **Has Vouchers**: Yes / No / All
- **Menu Type**: MEAL_MENU / ON_DEMAND_MENU / All

```javascript
// Filter implementation
const filters = {
  acceptanceType: "auto",  // "auto" | "manual" | "pending" | "all"
  hasVouchers: true,
  menuType: "MEAL_MENU"
};
```

### 3. Order Detail View

Display auto-accept information:

```
┌─────────────────────────────────────────────────────────────┐
│ Order #ORD-123456                                           │
├─────────────────────────────────────────────────────────────┤
│ Status: ACCEPTED                                            │
│ Acceptance: 🤖 Auto-Accepted                                │
│ Accepted At: Jan 15, 2024 12:30:00 PM                      │
│                                                             │
│ Voucher Usage:                                              │
│   • Vouchers Used: 1                                        │
│   • Main Courses Covered: 1                                 │
│   • Amount Paid: ₹0 (fully covered)                         │
│                                                             │
│ Timeline:                                                   │
│ ──────────────────────────────────────────────────────────  │
│ 12:30 PM  PLACED                                            │
│           Order received                                    │
│ ──────────────────────────────────────────────────────────  │
│ 12:30 PM  ACCEPTED                                          │
│           Auto-accepted (voucher order within operating     │
│           hours)                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Reporting & Analytics

### New Metrics to Track

#### 1. Auto-Accept Rate
```javascript
// Calculate auto-accept percentage
const autoAcceptRate = (autoAcceptedOrders / totalVoucherOrders) * 100;
```

#### 2. Orders by Acceptance Type
```
Acceptance Type Breakdown (Last 7 Days)
─────────────────────────────────────────
Auto-Accepted:     450 orders (45%)
Manual Accepted:   350 orders (35%)
Pending:           50 orders  (5%)
Rejected:          150 orders (15%)
```

#### 3. Operating Hours Efficiency
Track orders placed outside operating hours that couldn't be auto-accepted:
```
Orders Outside Operating Hours: 120
  - Before lunch start: 45
  - After lunch end, before dinner: 30
  - After dinner end: 45
```

### Suggested Report Fields

For order export/reports, include:
- `isAutoAccepted` (boolean)
- `acceptanceType` ("auto" | "manual" | "pending" | "rejected")
- `acceptedAt` (timestamp)
- `operatingHoursAtPlacement` (for analysis)

---

## System Configuration

### Cutoff Times vs Operating Hours

**Important Distinction:**

| Concept | Purpose | Default Values |
|---------|---------|----------------|
| **Cutoff Times** | When ordering closes | Lunch: 11:00, Dinner: 21:00 |
| **Operating Hours** | When kitchen prepares | Lunch: 11:00-14:00, Dinner: 19:00-22:00 |

- Cutoff times are system-wide (configurable via SystemConfig)
- Operating hours are per-kitchen

### System Config for Cutoff Times

```
GET /api/admin/config/cutoffTimes
Response: {
  "LUNCH": "11:00",
  "DINNER": "21:00"
}

PATCH /api/admin/config/cutoffTimes
Body: {
  "LUNCH": "10:30",
  "DINNER": "20:30"
}
```

### Admin Config UI

```
┌─────────────────────────────────────────────────┐
│ System Configuration                            │
├─────────────────────────────────────────────────┤
│ Order Cutoff Times (IST)                        │
│   Lunch Cutoff:  [11:00] ▼                      │
│   Dinner Cutoff: [21:00] ▼                      │
│                                                 │
│ ℹ️ Orders cannot be placed after cutoff time    │
│   for that meal window.                         │
│                                                 │
│                              [Save Changes]     │
└─────────────────────────────────────────────────┘
```

---

## API Reference

### Get All Orders (Admin)
```
GET /api/orders/admin/all
Query params:
  - status: PLACED|ACCEPTED|PREPARING|...
  - menuType: MEAL_MENU|ON_DEMAND_MENU
  - kitchenId: string
  - fromDate: ISO date
  - toDate: ISO date
  - page: number
  - limit: number
```

### Get Order Statistics
```
GET /api/orders/admin/stats
Response: {
  "total": 1000,
  "byStatus": {
    "PLACED": 50,
    "ACCEPTED": 100,
    "PREPARING": 75,
    "DELIVERED": 700,
    ...
  },
  "byMenuType": {
    "MEAL_MENU": 800,
    "ON_DEMAND_MENU": 200
  },
  "voucherOrders": 600,
  "autoAcceptedOrders": 450  // NEW - if implemented
}
```

### Update Kitchen Operating Hours
```
PATCH /api/admin/kitchens/:id
Body: {
  "operatingHours": {
    "lunch": {
      "startTime": "11:00",
      "endTime": "14:00"
    },
    "dinner": {
      "startTime": "19:00",
      "endTime": "22:00"
    }
  }
}
```

### Admin Force Status Change
```
PATCH /api/orders/admin/:id/status
Body: {
  "status": "ACCEPTED",
  "notes": "Manually accepted by admin"
}
```

---

## Monitoring & Alerts

### Suggested Alerts

1. **High Pending Orders Alert**
   - Trigger when orders in `PLACED` status exceed threshold
   - May indicate kitchen not responding or auto-accept issues

2. **Operating Hours Mismatch**
   - Alert if many voucher orders are not auto-accepting
   - Could indicate incorrect operating hours configuration

3. **Payment Verification Delays**
   - Voucher + addon orders stuck in `PLACED` due to payment issues

### Log Events to Monitor

The backend logs these events:
```
ORDER_CREATED - New order placed
  - autoAccepted: true/false
  - autoAcceptReason: string

[PAYMENT SERVICE] Auto-accepting voucher order after payment
[PAYMENT SERVICE] Order auto-accepted: ORD-XXXXXX
[PAYMENT SERVICE] Voucher order outside operating hours, not auto-accepting
```

---

## Testing Scenarios

### Admin Testing Checklist

- [ ] View auto-accepted order in order list
- [ ] Filter orders by acceptance type
- [ ] View auto-accept info in order detail
- [ ] Update kitchen operating hours
- [ ] Verify auto-accept respects new operating hours
- [ ] Export orders with auto-accept data
- [ ] View order timeline with auto-accept note

### Configuration Testing

- [ ] Change lunch operating hours → verify auto-accept timing changes
- [ ] Change dinner operating hours → verify auto-accept timing changes
- [ ] Set very narrow window → verify orders outside window don't auto-accept
- [ ] Remove operating hours → verify defaults are used

---

## Backward Compatibility

### No Breaking Changes
- All existing API endpoints work unchanged
- Order status values unchanged
- Existing filters continue to work

### Enhanced Data
- Orders now include `acceptedAt` field when accepted
- `statusTimeline` entries may include `notes` for auto-accept
- Response includes `autoAccepted` boolean for new orders

---

## Implementation Priority

### Phase 1 (Essential)
1. Display auto-accept indicator in order list
2. Show auto-accept info in order detail
3. Kitchen operating hours configuration

### Phase 2 (Recommended)
1. Add acceptance type filter
2. Order timeline with auto-accept notes
3. Basic reporting on auto-accepted orders

### Phase 3 (Nice to Have)
1. Analytics dashboard for auto-accept metrics
2. Alert configuration for monitoring
3. Export enhancements

---

## Questions & Support

Contact the backend team for:
- Custom reporting requirements
- Operating hours configuration assistance
- Troubleshooting auto-accept issues
- Additional filter requirements
