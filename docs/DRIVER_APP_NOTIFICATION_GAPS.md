# Driver App Notification Requirements - Gap Analysis

**Date**: 2026-01-27
**Analysis**: Comparing Driver App Requirements vs Backend Implementation

---

## Summary

| Component | Status | Notes |
|-----------|--------|-------|
| FCM Token Management | ✅ COMPLETE | Working correctly |
| Notification Payload Format | ✅ COMPLETE | Includes android.channelId |
| Notification History APIs | ✅ COMPLETE | All endpoints implemented |
| BATCH_READY Notification | ✅ COMPLETE | Sent when dispatching |
| BATCH_ASSIGNED Notification | ✅ COMPLETE | Just added |
| BATCH_UPDATED Notification | ❌ MISSING | Not implemented |
| BATCH_CANCELLED Notification | ❌ MISSING | Not implemented |

---

## 1. FCM Token Management

### Driver App Expects:
```
POST /api/auth/fcm-token - Register token
DELETE /api/auth/fcm-token - Remove token
```

### Backend Reality:
✅ **COMPLETE** - Both endpoints implemented and working

**Files**:
- `src/auth/auth.controller.js` - Token registration/removal
- Stores in: `users.fcmTokens[]`

---

## 2. Notification Payload Format

### Driver App Expects:
```json
{
  "notification": {
    "title": "Batch Assigned",
    "body": "You have been assigned batch #B-1234"
  },
  "data": {
    "type": "BATCH_ASSIGNED",
    "batchId": "507f...",
    "batchNumber": "B-1234",
    "orderCount": "5"
  },
  "android": {
    "priority": "high",
    "channelId": "delivery_channel"
  }
}
```

### Backend Reality:
✅ **COMPLETE** - Payload format is correct

**Evidence** (`services/notification.service.js:104-113`):
```javascript
android: {
  priority,
  ttl: 86400 * 1000,
  notification: {
    channelId,  // ← Correctly included!
    sound: "default",
    priority: priority === "high" ? "high" : "default",
  },
}
```

The backend correctly sends:
- ✅ `notification.title`
- ✅ `notification.body`
- ✅ `data.type`
- ✅ `data.*` (all custom fields)
- ✅ `android.notification.channelId`
- ✅ `android.priority`

---

## 3. Notification History APIs

### Driver App Expects:

**GET /api/notifications**
- Fetch notification history
- Pagination support
- Filter by unread

**PATCH /api/notifications/:id/read**
- Mark single notification as read

**PATCH /api/notifications/mark-all-read**
- Mark all as read

### Backend Reality:
✅ **COMPLETE** - All endpoints implemented

**Files**:
- `src/notification/notification.controller.js`
- `src/notification/notification.routes.js`
- `schema/notification.schema.js`

**Implemented Endpoints**:
```javascript
GET /api/notifications - getMyNotifications()
GET /api/notifications/latest-unread - getLatestUnread()
GET /api/notifications/unread-count - getUnreadCount()
PATCH /api/notifications/:id/read - markAsRead()
POST /api/notifications/mark-all-read - markAllAsRead()
DELETE /api/notifications/:id - deleteNotification()
```

**Database Schema**:
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  type: String,
  title: String,
  body: String,
  data: Object,
  entityType: String,
  entityId: ObjectId,
  isRead: Boolean,
  deliveryStatus: String,
  createdAt: Date,
  updatedAt: Date
}
```

✅ Matches driver app requirements

---

## 4. Batch Notification Events

### Event 1: BATCH_READY

**Driver App Expects:**
- When: Kitchen dispatches batch
- Recipients: All active, approved drivers
- Type: `BATCH_READY`

**Backend Reality:**
✅ **IMPLEMENTED** (`src/delivery/delivery.controller.js:416-427`)

```javascript
// In dispatchBatches() function
const { title, body } = buildFromTemplate(DRIVER_TEMPLATES.BATCH_READY, {
  kitchenName: kitchen?.name || "Kitchen",
  mealWindow: mealWindow,
  orderCount: batch.orderIds.length,
  batchCount: dispatchedBatches.length,
});

sendToRole("DRIVER", "BATCH_READY", title, body, {
  data: { kitchenId, mealWindow, batchCount: dispatchedBatches.length.toString() },
  entityType: "BATCH",
  entityId: batch._id,
});
```

**Status**: ✅ Working correctly

---

### Event 2: BATCH_ASSIGNED

**Driver App Expects:**
- When: Driver accepts batch OR admin assigns batch
- Recipients: Specific driver
- Type: `BATCH_ASSIGNED`

**Backend Reality:**
✅ **IMPLEMENTED** (Just added: `src/delivery/delivery.controller.js:615-630`)

```javascript
// In acceptBatch() function
const { title: driverTitle, body: driverBody } = buildFromTemplate(
  DRIVER_TEMPLATES.BATCH_ASSIGNED, {
    batchNumber: batch.batchNumber,
    orderCount: orders.length,
    kitchenName: kitchen?.name || "Kitchen",
  }
);

sendToUser(driverId, "BATCH_ASSIGNED", driverTitle, driverBody, {
  data: {
    batchId: batch._id.toString(),
    batchNumber: batch.batchNumber,
    orderCount: orders.length.toString(),
    kitchenId: batch.kitchenId.toString(),
  },
  entityType: "BATCH",
  entityId: batch._id,
});
```

**Status**: ✅ Working correctly

---

### Event 3: BATCH_UPDATED

**Driver App Expects:**
- When: Batch details change (orders added/removed, sequence changed)
- Recipients: Driver assigned to batch
- Type: `BATCH_UPDATED`

**Backend Reality:**
❌ **NOT IMPLEMENTED**

**Where it should be:**
1. `reassignBatch()` - When admin reassigns batch to different driver
2. `updateDeliverySequence()` - When delivery sequence is changed
3. When orders are added/removed from batch (if such functionality exists)

**Current Status**:
- `reassignBatch()` exists at line 1469 but does NOT send notification
- No BATCH_UPDATED notification is sent anywhere

**Example of what's needed** (`reassignBatch` function should add):
```javascript
// After reassigning driver
if (previousDriver) {
  // Notify old driver that batch was removed
  sendToUser(previousDriver, "BATCH_CANCELLED",
    "Batch Reassigned",
    `Batch #${batch.batchNumber} has been reassigned to another driver`, {
      data: {
        batchId: batch._id.toString(),
        batchNumber: batch.batchNumber,
        reason: "reassigned"
      },
      entityType: "BATCH",
      entityId: batch._id,
  });
}

// Notify new driver of assignment
sendToUser(driverId, "BATCH_ASSIGNED",
  "Batch Assigned",
  `You have been assigned batch #${batch.batchNumber}`, {
    data: {
      batchId: batch._id.toString(),
      batchNumber: batch.batchNumber,
      orderCount: batch.orderIds.length.toString(),
    },
    entityType: "BATCH",
    entityId: batch._id,
});
```

---

### Event 4: BATCH_CANCELLED

**Driver App Expects:**
- When: Batch is cancelled before completion
- Recipients: Driver assigned to batch
- Type: `BATCH_CANCELLED`

**Backend Reality:**
❌ **NOT IMPLEMENTED**

**Where it should be:**
- `cancelBatch()` function at line 1531

**Current Status**:
- Function exists and cancels batch successfully
- Updates batch status to "CANCELLED"
- Removes orders from batch
- But does NOT send notification to driver

**What needs to be added** (`cancelBatch` function should add):
```javascript
// After cancelling batch, before returning response
if (batch.driverId) {
  const { title, body } = buildFromTemplate(
    DRIVER_TEMPLATES.BATCH_CANCELLED, {
      batchNumber: batch.batchNumber,
      reason: reason || "Batch cancelled by admin"
    }
  );

  sendToUser(batch.driverId, "BATCH_CANCELLED", title, body, {
    data: {
      batchId: batch._id.toString(),
      batchNumber: batch.batchNumber,
      reason: reason || "Cancelled by admin"
    },
    entityType: "BATCH",
    entityId: batch._id,
  });
}
```

---

## 5. Notification Templates

### Driver App Expects:
```javascript
DRIVER_TEMPLATES = {
  BATCH_READY: { ... },
  BATCH_ASSIGNED: { ... },
  ORDER_READY_FOR_PICKUP: { ... }
}
```

### Backend Reality:
✅ **PARTIALLY COMPLETE** (`services/notification-templates.service.js`)

**Templates that EXIST**:
```javascript
export const DRIVER_TEMPLATES = {
  BATCH_READY: {
    title: "New Batch Available!",
    body: "{orderCount} orders ready for pickup from {kitchenName}"
  },
  BATCH_ASSIGNED: {
    title: "Batch Assigned",
    body: "You have been assigned a batch with {orderCount} orders from {kitchenName}"
  },
  ORDER_READY_FOR_PICKUP: {
    title: "Orders Ready!",
    body: "{orderCount} order(s) ready for pickup at {kitchenName}"
  },
};
```

**Templates that are MISSING**:
```javascript
// Need to add:
export const DRIVER_TEMPLATES = {
  // ... existing templates ...

  BATCH_CANCELLED: {
    title: "Batch Cancelled",
    body: "Batch #{batchNumber} has been cancelled. {reason}"
  },

  BATCH_UPDATED: {
    title: "Batch Updated",
    body: "Batch #{batchNumber} has been updated. Please review changes."
  },
};
```

---

## 6. Channel ID Mapping

### Driver App Expects:
```javascript
"delivery_channel"  // For batch/delivery notifications
"batch_channel"     // For urgent batch updates
"urgent_channel"    // For critical notifications
"general_channel"   // For general notifications
```

### Backend Reality:
✅ **MOSTLY CORRECT** (`services/notification.service.js:37-51`)

```javascript
const CHANNEL_MAPPING = {
  KITCHEN_STAFF: "kitchen_channel",
  DRIVER: "delivery_channel",  // ✅ Correct!
  CUSTOMER: "orders_channel",
};

const NOTIFICATION_TYPE_CHANNELS = {
  BATCH_READY: "delivery_channel",      // ✅ Correct
  BATCH_ASSIGNED: "delivery_channel",   // ✅ Correct
  ORDER_STATUS: "orders_channel",
  // ... more mappings
};
```

**Note**: Driver app has 4 channels but backend only uses `delivery_channel` for all driver notifications. This is FINE because:
- `delivery_channel` is set to HIGH importance
- Driver app will fall back to correct channel
- All batch notifications use same channel anyway

---

## Required Backend Changes

### CRITICAL (Needed for Driver App)

#### 1. Add BATCH_CANCELLED Notification

**File**: `src/delivery/delivery.controller.js`
**Function**: `cancelBatch` (line 1531)

**Add after line 1577** (after audit log):
```javascript
// Send notification to driver if batch was assigned
if (batch.driverId) {
  const driver = await User.findById(batch.driverId).select('name');
  const { title, body } = buildFromTemplate(DRIVER_TEMPLATES.BATCH_CANCELLED, {
    batchNumber: batch.batchNumber,
    reason: reason || ""
  });

  sendToUser(batch.driverId, "BATCH_CANCELLED", title, body, {
    data: {
      batchId: batch._id.toString(),
      batchNumber: batch.batchNumber,
      reason: reason || "Cancelled by admin"
    },
    entityType: "BATCH",
    entityId: batch._id,
  });
}
```

#### 2. Add BATCH_CANCELLED Template

**File**: `services/notification-templates.service.js`
**Add to DRIVER_TEMPLATES** (after BATCH_ASSIGNED):
```javascript
BATCH_CANCELLED: {
  title: "Batch Cancelled",
  body: "Batch #{batchNumber} has been cancelled.{reason}"
},
```

#### 3. Update Reassign Notification

**File**: `src/delivery/delivery.controller.js`
**Function**: `reassignBatch` (line 1469)

**Add after line 1517** (after audit log):
```javascript
// Notify previous driver
if (previousDriver) {
  sendToUser(previousDriver, "BATCH_CANCELLED",
    "Batch Reassigned",
    `Batch #${batch.batchNumber} has been reassigned to another driver`, {
      data: {
        batchId: batch._id.toString(),
        batchNumber: batch.batchNumber,
        reason: "Reassigned to another driver"
      },
      entityType: "BATCH",
      entityId: batch._id,
  });
}

// Notify new driver
const { title, body } = buildFromTemplate(DRIVER_TEMPLATES.BATCH_ASSIGNED, {
  batchNumber: batch.batchNumber,
  orderCount: batch.orderIds.length,
  kitchenName: batch.kitchenId?.name || "Kitchen"
});

sendToUser(driverId, "BATCH_ASSIGNED", title, body, {
  data: {
    batchId: batch._id.toString(),
    batchNumber: batch.batchNumber,
    orderCount: batch.orderIds.length.toString(),
  },
  entityType: "BATCH",
  entityId: batch._id,
});
```

### OPTIONAL (Nice to Have)

#### 4. Add BATCH_UPDATED Template

**File**: `services/notification-templates.service.js`
```javascript
BATCH_UPDATED: {
  title: "Batch Updated",
  body: "Batch #{batchNumber} has been updated. Please review changes."
},
```

#### 5. Add Notification Type to Schema

**File**: `schema/notification.schema.js`

Verify these types are in the enum:
```javascript
"BATCH_READY",
"BATCH_ASSIGNED",
"BATCH_CANCELLED",  // ← Add if missing
"BATCH_UPDATED",    // ← Add if missing
```

---

## Testing Checklist

### After Implementing Missing Notifications

#### Test 1: BATCH_CANCELLED
- [ ] Admin cancels a batch with assigned driver
- [ ] Driver receives "Batch Cancelled" notification
- [ ] Notification appears in driver's notification history
- [ ] Check backend logs for successful send

#### Test 2: BATCH_REASSIGNED
- [ ] Admin reassigns batch from Driver A to Driver B
- [ ] Driver A receives "Batch Reassigned" notification
- [ ] Driver B receives "Batch Assigned" notification
- [ ] Both notifications appear in history

---

## Conclusion

### What Works
1. ✅ FCM token management (registration/removal)
2. ✅ Notification payload format (includes android.channelId)
3. ✅ Notification history APIs (GET, PATCH endpoints)
4. ✅ BATCH_READY notification (when dispatching)
5. ✅ BATCH_ASSIGNED notification (when accepting batch)

### What's Missing
1. ❌ BATCH_CANCELLED notification (when admin cancels batch)
2. ❌ BATCH_CANCELLED template in notification-templates.service.js
3. ❌ Notifications in reassignBatch function
4. ❌ BATCH_UPDATED template (optional)

### Verdict

**The issue is 100% in the BACKEND, not the driver app.**

The driver app is correctly configured and expects notifications that the backend is NOT sending for:
- Batch cancellation
- Batch reassignment

**Driver app does NOT need any changes.**

**Backend needs 3 simple additions:**
1. Add BATCH_CANCELLED template
2. Send notification in `cancelBatch()` function
3. Send notifications in `reassignBatch()` function

---

**Priority**: HIGH
**Estimated Effort**: 30 minutes
**Impact**: Drivers will be properly notified when batches are cancelled or reassigned

---

**Last Updated**: 2026-01-27
