# Admin Batch Management API

## Overview

Batch management allows admin to group orders for delivery and dispatch them to drivers. This involves two main actions: auto-batching orders and dispatching batches.

## Screen Recommendation

Integrate into existing Admin Kitchen Management screen. Add a "Delivery Batches" section or tab. No separate screen needed since batches are tied to kitchens and zones.

Suggested UI placement:
- Kitchen Details Page: Add "Batches" tab alongside existing tabs
- Or: Dashboard with "Batch Management" card showing pending actions

---

## API Endpoints

### 1. Auto-Batch Orders

Groups unbatched orders into delivery batches by kitchen, zone, and meal window.

**Endpoint:** `POST /api/delivery/auto-batch`

**Auth:** Admin only (Bearer token)

**Request Body:**
```json
{
  "mealWindow": "LUNCH",
  "kitchenId": "optional-kitchen-id"
}
```

**Parameters:**
- `mealWindow` (optional): "LUNCH" or "DINNER". If omitted, batches all windows.
- `kitchenId` (optional): Specific kitchen ID. If omitted, batches all kitchens.

**Response:**
```json
{
  "success": true,
  "message": "Auto-batching complete",
  "data": {
    "batchesCreated": 2,
    "batchesUpdated": 1,
    "ordersProcessed": 15,
    "batches": [
      {
        "batchId": "...",
        "batchNumber": "BATCH-20260114-CP-A1B2C",
        "orderCount": 5,
        "zone": "zone-id",
        "kitchen": "kitchen-id"
      }
    ]
  }
}
```

**When to call:** Periodically or manually when orders need batching. Orders must be in ACCEPTED, PREPARING, or READY status.

---

### 2. Dispatch Batches

Changes batch status from COLLECTING to READY_FOR_DISPATCH so drivers can see and accept them.

**Endpoint:** `POST /api/delivery/dispatch`

**Auth:** Admin only (Bearer token)

**Request Body:**
```json
{
  "mealWindow": "LUNCH"
}
```

**Parameters:**
- `mealWindow` (required): "LUNCH" or "DINNER"

**Response:**
```json
{
  "success": true,
  "message": "Batches dispatched",
  "data": {
    "batchesDispatched": 3,
    "batches": [
      {
        "batchId": "...",
        "batchNumber": "BATCH-20260114-CP-A1B2C",
        "status": "READY_FOR_DISPATCH",
        "orderCount": 5
      }
    ]
  }
}
```

**Important:** Dispatch only works after meal window ends:
- LUNCH: After 1:00 PM
- DINNER: After 10:00 PM

Calling before window ends returns error unless using development override.

---

### 3. View All Batches (Admin)

**Endpoint:** `GET /api/delivery/admin/batches`

**Query Parameters:**
- `kitchenId`: Filter by kitchen
- `zoneId`: Filter by zone
- `status`: COLLECTING, READY_FOR_DISPATCH, DISPATCHED, IN_PROGRESS, COMPLETED
- `dateFrom`: Start date
- `dateTo`: End date
- `page`: Page number (default 1)
- `limit`: Items per page (default 20)

**Example:** `GET /api/delivery/admin/batches?status=COLLECTING&mealWindow=LUNCH`

---

## UI Implementation Guide

### Batch Management Section

Show two action buttons:

**Button 1: "Auto-Batch Orders"**
- Label: "Batch Orders"
- Action: Opens modal to select meal window
- Modal fields: Dropdown for LUNCH/DINNER (or "All")
- On submit: POST /api/delivery/auto-batch
- Show toast with ordersProcessed count

**Button 2: "Dispatch Batches"**
- Label: "Dispatch to Drivers"
- Action: Opens modal to select meal window
- Modal fields: Dropdown for LUNCH/DINNER
- On submit: POST /api/delivery/dispatch
- Disable if current time < window end time
- Show toast with batchesDispatched count

### Batch List View

Display batches with:
- Batch number
- Status badge (color coded)
- Order count
- Kitchen name
- Zone name
- Created time

Filter options:
- Status dropdown
- Meal window dropdown
- Date picker

---

## Batch Status Flow

COLLECTING: Orders being added, not visible to drivers
READY_FOR_DISPATCH: Waiting for driver to accept
DISPATCHED: Driver accepted
IN_PROGRESS: Driver picked up, delivering
COMPLETED: All orders delivered

---

## Timing Reference

LUNCH window ends: 1:00 PM (13:00)
DINNER window ends: 10:00 PM (22:00)

Dispatch calls before these times will fail unless admin forces override.

---

## Error Handling

**Auto-batch with no orders:**
```json
{
  "success": true,
  "message": "No orders to batch",
  "data": { "batchesCreated": 0, "ordersProcessed": 0 }
}
```

**Dispatch before window ends:**
```json
{
  "success": false,
  "message": "Cannot dispatch LUNCH batches yet. Meal window ends in 45 minute(s)."
}
```

---

## Sample Integration Code

```javascript
// Auto-batch orders
const autoBatch = async (mealWindow) => {
  const response = await api.post('/delivery/auto-batch', {
    mealWindow // "LUNCH" or "DINNER" or omit for all
  });
  return response.data;
};

// Dispatch batches
const dispatchBatches = async (mealWindow) => {
  const response = await api.post('/delivery/dispatch', {
    mealWindow // required: "LUNCH" or "DINNER"
  });
  return response.data;
};

// Fetch batches
const getBatches = async (filters) => {
  const response = await api.get('/delivery/admin/batches', { params: filters });
  return response.data;
};
```

---

## Quick Reference

Auto-batch: Groups orders into batches (COLLECTING status)
Dispatch: Makes batches visible to drivers (READY_FOR_DISPATCH status)
Both require admin auth
Dispatch requires meal window to be ended
Batch max size: 15 orders per batch
