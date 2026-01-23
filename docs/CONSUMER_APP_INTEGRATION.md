# Consumer App - Auto-Ordering Integration Guide

## Overview

This document covers the integration of the auto-ordering feature for subscription users in the Consumer App. Auto-ordering automatically places orders for customers with active subscriptions using their vouchers.

---

## Table of Contents

1. [Feature Summary](#feature-summary)
2. [API Endpoints](#api-endpoints)
3. [Data Models](#data-models)
4. [Notification Handling](#notification-handling)
5. [UI/UX Recommendations](#uiux-recommendations)
6. [Error Handling](#error-handling)
7. [Testing Checklist](#testing-checklist)

---

## Feature Summary

### What is Auto-Ordering?

- Customers with active subscriptions can enable auto-ordering
- System automatically places orders at configured times (LUNCH ~10:00 AM, DINNER ~7:00 PM IST)
- Orders are placed using available vouchers (no payment required)
- Orders are auto-accepted and sent directly to the kitchen
- Customers receive push notifications for both successful and failed auto-orders

### Key Features for Consumer App

| Feature | Description |
|---------|-------------|
| Enable/Disable Auto-Ordering | Toggle auto-ordering on/off for a subscription |
| Set Default Preferences | Set default meal type, address, and kitchen |
| Pause Subscription | Temporarily pause auto-ordering |
| Skip Meals | Skip specific meal slots (e.g., skip lunch on a specific date) |
| View Auto-Order History | See past auto-orders and their status |
| Notifications | Receive FCM + in-app notifications for auto-order status |

---

## API Endpoints

### Base URL
```
/api/subscriptions
```

### Authentication
All endpoints require authentication via `Authorization: Bearer <token>` header.

---

### 1. Get My Subscriptions

```http
GET /api/subscriptions/my-subscriptions
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by: `ACTIVE`, `EXPIRED`, `CANCELLED` |
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 20, max: 50) |

**Response:**
```json
{
  "success": true,
  "message": "My subscriptions",
  "data": {
    "subscriptions": [
      {
        "_id": "subscription_id",
        "planId": {
          "_id": "plan_id",
          "name": "Weekly Plan",
          "durationDays": 7
        },
        "status": "ACTIVE",
        "startDate": "2025-01-20T00:00:00.000Z",
        "endDate": "2025-01-27T00:00:00.000Z",
        "totalVouchersIssued": 14,
        "vouchersUsed": 3,
        "voucherExpiryDate": "2025-04-20T00:00:00.000Z",

        // AUTO-ORDERING FIELDS
        "autoOrderingEnabled": true,
        "defaultMealType": "BOTH",
        "defaultKitchenId": "kitchen_id",
        "defaultAddressId": "address_id",
        "isPaused": false,
        "pausedUntil": null,
        "pauseReason": null,
        "skippedSlots": [
          {
            "date": "2025-01-25T00:00:00.000Z",
            "mealWindow": "LUNCH",
            "reason": "Out of town"
          }
        ]
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

---

### 2. Get Subscription Details

```http
GET /api/subscriptions/:id
```

**Response:** Same structure as single subscription object above.

---

### 3. Update Auto-Order Settings

```http
PUT /api/subscriptions/:id/settings
```

**Request Body:**
```json
{
  "autoOrderingEnabled": true,
  "defaultMealType": "BOTH",
  "defaultKitchenId": "64abc123def456...",
  "defaultAddressId": "64abc123def456..."
}
```

**Field Descriptions:**
| Field | Type | Description |
|-------|------|-------------|
| autoOrderingEnabled | boolean | Enable/disable auto-ordering |
| defaultMealType | string | `LUNCH`, `DINNER`, or `BOTH` |
| defaultKitchenId | ObjectId | Preferred kitchen (optional - system finds based on zone if not set) |
| defaultAddressId | ObjectId | Default delivery address (required for auto-ordering) |

**Response:**
```json
{
  "success": true,
  "message": "Auto-order settings updated",
  "data": {
    "subscription": { /* updated subscription object */ }
  }
}
```

**Validation Rules:**
- At least one field must be provided
- `defaultMealType` must be one of: `LUNCH`, `DINNER`, `BOTH`
- IDs must be valid 24-character hex strings

---

### 4. Pause Subscription

Temporarily pauses auto-ordering.

```http
POST /api/subscriptions/:id/pause
```

**Request Body:**
```json
{
  "pauseReason": "Going on vacation",
  "pauseUntil": "2025-02-01T00:00:00.000Z"
}
```

**Field Descriptions:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| pauseReason | string | No | Reason for pausing (max 500 chars) |
| pauseUntil | date | No | Auto-resume date (if null, paused indefinitely) |

**Response:**
```json
{
  "success": true,
  "message": "Subscription paused",
  "data": {
    "subscription": {
      "isPaused": true,
      "pausedUntil": "2025-02-01T00:00:00.000Z",
      "pauseReason": "Going on vacation"
    }
  }
}
```

---

### 5. Resume Subscription

Resumes auto-ordering after pause.

```http
POST /api/subscriptions/:id/resume
```

**Request Body:** None required (empty object `{}`)

**Response:**
```json
{
  "success": true,
  "message": "Subscription resumed",
  "data": {
    "subscription": {
      "isPaused": false,
      "pausedUntil": null,
      "pauseReason": null
    }
  }
}
```

---

### 6. Skip a Meal

Skip a specific meal slot.

```http
POST /api/subscriptions/:id/skip-meal
```

**Request Body:**
```json
{
  "date": "2025-01-25T00:00:00.000Z",
  "mealWindow": "LUNCH",
  "reason": "Office lunch provided"
}
```

**Field Descriptions:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| date | date | Yes | Date to skip |
| mealWindow | string | Yes | `LUNCH` or `DINNER` |
| reason | string | No | Reason for skipping (max 200 chars) |

**Response:**
```json
{
  "success": true,
  "message": "Meal skipped",
  "data": {
    "subscription": {
      "skippedSlots": [
        {
          "date": "2025-01-25T00:00:00.000Z",
          "mealWindow": "LUNCH",
          "reason": "Office lunch provided",
          "skippedAt": "2025-01-23T10:00:00.000Z"
        }
      ]
    }
  }
}
```

---

### 7. Unskip a Meal

Remove a meal from skipped slots.

```http
POST /api/subscriptions/:id/unskip-meal
```

**Request Body:**
```json
{
  "date": "2025-01-25T00:00:00.000Z",
  "mealWindow": "LUNCH"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Meal unskipped",
  "data": {
    "subscription": {
      "skippedSlots": []
    }
  }
}
```

---

## Data Models

### Subscription Object

```typescript
interface Subscription {
  _id: string;
  userId: string;
  planId: SubscriptionPlan;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

  // Dates
  startDate: Date;
  endDate: Date;
  purchasedAt: Date;

  // Vouchers
  totalVouchersIssued: number;
  vouchersUsed: number;
  voucherExpiryDate: Date;

  // Auto-ordering settings
  autoOrderingEnabled: boolean;
  defaultMealType: 'LUNCH' | 'DINNER' | 'BOTH';
  defaultKitchenId?: string;
  defaultAddressId?: string;

  // Pause state
  isPaused: boolean;
  pausedUntil?: Date;
  pauseReason?: string;

  // Skipped meals
  skippedSlots: SkippedSlot[];
}

interface SkippedSlot {
  date: Date;
  mealWindow: 'LUNCH' | 'DINNER';
  reason?: string;
  skippedAt: Date;
}
```

### Order Object (Auto-Order)

Auto-orders have these distinguishing fields:

```typescript
interface Order {
  // ... standard order fields ...

  isAutoOrder: boolean;        // true for auto-orders
  status: 'ACCEPTED';          // Auto-orders start as ACCEPTED
  paymentMethod: 'VOUCHER_ONLY';
  paymentStatus: 'PAID';
  amountPaid: 0;
  specialInstructions: 'Auto-order';

  voucherUsage: {
    voucherIds: string[];
    voucherCount: number;
    mainCoursesCovered: number;
  };
}
```

---

## Notification Handling

### FCM Notification Types

Register handlers for these notification types:

| Type | Description |
|------|-------------|
| `AUTO_ORDER_SUCCESS` | Auto-order placed successfully |
| `AUTO_ORDER_FAILED` | Auto-order failed (with reason) |
| `ORDER_STATUS_CHANGE` | Order status updates |

### Notification Payloads

#### Success Notification

```json
{
  "title": "Auto Order Placed!",
  "body": "Your lunch order #ORD-123456 has been automatically placed from Kitchen Name.",
  "data": {
    "type": "AUTO_ORDER_SUCCESS",
    "orderId": "order_id",
    "orderNumber": "ORD-123456",
    "status": "ACCEPTED",
    "kitchenId": "kitchen_id"
  }
}
```

**Recommended Action:** Navigate to order details screen.

#### Failure Notifications

```json
{
  "title": "Auto Order Skipped",
  "body": "Your lunch auto-order couldn't be placed - no vouchers available. Purchase more vouchers to continue auto-ordering.",
  "data": {
    "type": "AUTO_ORDER_FAILED",
    "failureCategory": "NO_VOUCHERS",
    "mealWindow": "LUNCH"
  }
}
```

**Failure Categories and UI Actions:**

| Category | Message | UI Action |
|----------|---------|-----------|
| `NO_VOUCHERS` | No vouchers available | Show "Buy Subscription" CTA |
| `NO_ADDRESS` | No default address | Show "Set Address" CTA |
| `NO_ZONE` | Pincode not serviceable | Show "Update Address" CTA |
| `NO_KITCHEN` | No kitchen serving area | Show info message |
| `NO_MENU_ITEM` | No menu available | Show info message |
| `VOUCHER_REDEMPTION_FAILED` | Transaction failed | Show "Try Manual Order" CTA |
| `UNKNOWN` | Generic failure | Show "Order Manually" CTA |

### In-App Notifications API

```http
GET /api/notifications?page=1&limit=20
```

Filter by type:
```http
GET /api/notifications?type=AUTO_ORDER_SUCCESS
GET /api/notifications?type=AUTO_ORDER_FAILED
```

---

## UI/UX Recommendations

### 1. Subscription Dashboard

Display on the subscription card:

```
┌─────────────────────────────────────┐
│  Weekly Plan                        │
│  ════════════════════════════       │
│  Vouchers: 11/14 remaining          │
│  Expires: Jan 27, 2025              │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Auto-Ordering     [ON/OFF]  │    │
│  └─────────────────────────────┘    │
│                                     │
│  Status: Active                     │
│  Next auto-order: Lunch today       │
└─────────────────────────────────────┘
```

### 2. Auto-Order Settings Screen

```
┌─────────────────────────────────────┐
│  Auto-Order Settings                │
│  ════════════════════════════       │
│                                     │
│  Enable Auto-Ordering    [TOGGLE]   │
│                                     │
│  Meal Preference                    │
│  ○ Lunch only                       │
│  ○ Dinner only                      │
│  ● Both                             │
│                                     │
│  Default Address                    │
│  [Home - 123 Main St...]     [>]    │
│                                     │
│  Preferred Kitchen (Optional)       │
│  [Auto-select based on zone]  [>]   │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  Pause Auto-Ordering         [>]    │
│  Manage Skipped Meals        [>]    │
└─────────────────────────────────────┘
```

### 3. Skip Meal Calendar

Show a calendar view where users can:
- See which dates have orders scheduled
- Tap dates to skip/unskip meals
- Visual indicators for skipped slots

```
     January 2025
Su Mo Tu We Th Fr Sa
         1  2  3  4
 5  6  7  8  9 10 11
12 13 14 15 16 17 18
19 20 21 22 23 24 ⊘25  <- Skipped
26 27
```

### 4. Auto-Order Indicator on Orders

In the orders list, show a badge or icon for auto-orders:

```
┌─────────────────────────────────────┐
│ 🔄 Order #ORD-123456                │
│    Auto-order • Lunch               │
│    Kitchen Name                     │
│    Status: Preparing                │
└─────────────────────────────────────┘
```

### 5. Failure Notification Toast

When receiving failure notifications, show actionable toasts:

```
┌─────────────────────────────────────┐
│ ⚠️ Auto-order couldn't be placed    │
│    No vouchers available            │
│                    [Buy Vouchers]   │
└─────────────────────────────────────┘
```

---

## Error Handling

### API Error Responses

```json
{
  "success": false,
  "message": "Error message here",
  "data": null
}
```

### Common Errors

| Status Code | Message | Action |
|-------------|---------|--------|
| 400 | Invalid subscription ID | Check ID format |
| 401 | Unauthorized | Re-authenticate |
| 403 | Not your subscription | Check subscription ownership |
| 404 | Subscription not found | Refresh subscription list |
| 422 | Validation error | Show field-specific errors |
| 500 | Server error | Show generic error, retry |

### Validation Errors

```json
{
  "success": false,
  "message": "Validation error",
  "data": {
    "errors": [
      {
        "field": "defaultMealType",
        "message": "Must be LUNCH, DINNER, or BOTH"
      }
    ]
  }
}
```

---

## Testing Checklist

### Auto-Order Settings
- [ ] Enable auto-ordering
- [ ] Disable auto-ordering
- [ ] Change meal type preference
- [ ] Set default address
- [ ] Set preferred kitchen
- [ ] Clear preferred kitchen (auto-select)

### Pause/Resume
- [ ] Pause with reason and date
- [ ] Pause indefinitely (no date)
- [ ] Resume paused subscription
- [ ] Verify auto-resume works when pausedUntil passes

### Skip/Unskip Meals
- [ ] Skip a future lunch
- [ ] Skip a future dinner
- [ ] Unskip a skipped meal
- [ ] Cannot skip past dates
- [ ] Multiple skipped slots display correctly

### Notifications
- [ ] Receive success notification
- [ ] Receive failure notifications for each category
- [ ] Tap notification navigates to correct screen
- [ ] In-app notifications display correctly

### Order Display
- [ ] Auto-orders show in order history
- [ ] Auto-order badge/indicator visible
- [ ] Order details show voucher usage
- [ ] Status timeline shows auto-accept

---

## Appendix: Full Subscription Fields Reference

```typescript
{
  // Identity
  _id: ObjectId,
  userId: ObjectId,
  planId: ObjectId,

  // Status
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED',

  // Dates
  startDate: Date,
  endDate: Date,
  purchasedAt: Date,
  cancelledAt?: Date,

  // Vouchers
  totalVouchersIssued: number,
  vouchersUsed: number,
  voucherExpiryDate: Date,

  // Payment
  paymentTransactionId?: ObjectId,
  amountPaid: number,

  // Auto-ordering
  autoOrderingEnabled: boolean,        // Default: true
  defaultMealType: string,             // Default: 'BOTH'
  defaultKitchenId?: ObjectId,
  defaultAddressId?: ObjectId,

  // Pause state
  isPaused: boolean,                   // Default: false
  pausedUntil?: Date,
  pauseReason?: string,

  // Skipped slots
  skippedSlots: [{
    date: Date,
    mealWindow: 'LUNCH' | 'DINNER',
    reason?: string,
    skippedAt: Date
  }],

  // Cancellation
  cancellationReason?: string,
  cancelledBy?: ObjectId,

  // Metadata
  createdAt: Date,
  updatedAt: Date
}
```

---

## Questions?

Contact the backend team for:
- API clarifications
- Missing endpoints
- Bug reports
- Feature requests
