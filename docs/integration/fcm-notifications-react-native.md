# FCM Notifications - React Native Integration Guide

## Overview

This document describes the FCM (Firebase Cloud Messaging) notification structure used by the Tiffsy backend for React Native apps using `@react-native-firebase/messaging`.

---

## FCM Payload Structure

### General Structure

All notifications follow this React Native compatible structure:

```javascript
{
  // Displayed notification (shows in system tray)
  notification: {
    title: "Notification Title",
    body: "Notification body text"
  },

  // Custom data payload (accessible in your app)
  data: {
    type: "NOTIFICATION_TYPE",      // Required - notification type
    channelId: "channel_name",      // Android notification channel
    // ... additional type-specific fields (all values are STRINGS)
  },

  // Android-specific configuration
  android: {
    channelId: "channel_name",      // React Native Firebase uses this
    priority: "high" | "default",
    ttl: 86400000,                  // 24 hours in ms
    notification: {
      sound: "default",
      priority: "high" | "default"
    }
  },

  // iOS-specific configuration
  apns: {
    payload: {
      aps: {
        sound: "default",
        badge: 1,
        "content-available": 1
      }
    }
  }
}
```

---

## Android Notification Channels

### Required Channels

Create these channels on app startup:

| Channel ID | Name | Priority | Use Case |
|------------|------|----------|----------|
| `orders_channel` | Orders | HIGH | Order notifications (new, status updates) |
| `subscriptions_channel` | Subscriptions | HIGH | Voucher expiry, subscription alerts |
| `delivery_channel` | Deliveries | HIGH | Driver batch/delivery notifications |
| `general_channel` | General | DEFAULT | Promotional, system updates |
| `default_channel` | Default | DEFAULT | Fallback channel |

### Channel Setup Code

```javascript
import notifee, { AndroidImportance } from '@notifee/react-native';

export async function setupNotificationChannels() {
  // Orders - High priority for immediate attention
  await notifee.createChannel({
    id: 'orders_channel',
    name: 'Orders',
    description: 'New orders and order status updates',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [300, 500],
  });

  // Subscriptions - High priority for voucher alerts
  await notifee.createChannel({
    id: 'subscriptions_channel',
    name: 'Subscriptions & Vouchers',
    description: 'Voucher expiry reminders and subscription updates',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });

  // Deliveries - High priority for drivers
  await notifee.createChannel({
    id: 'delivery_channel',
    name: 'Deliveries',
    description: 'Batch assignments and delivery updates',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });

  // General - Default priority
  await notifee.createChannel({
    id: 'general_channel',
    name: 'General',
    description: 'Promotional and system notifications',
    importance: AndroidImportance.DEFAULT,
  });

  // Default fallback
  await notifee.createChannel({
    id: 'default_channel',
    name: 'Notifications',
    description: 'General notifications',
    importance: AndroidImportance.DEFAULT,
  });
}
```

---

## Notification Types by App

### Consumer App

| Type | Channel | Description |
|------|---------|-------------|
| `ORDER_ACCEPTED` | orders_channel | Order accepted by kitchen |
| `ORDER_REJECTED` | orders_channel | Order rejected by kitchen |
| `ORDER_PREPARING` | orders_channel | Kitchen started preparing |
| `ORDER_READY` | orders_channel | Order ready for pickup |
| `ORDER_PICKED_UP` | orders_channel | Driver picked up order |
| `ORDER_OUT_FOR_DELIVERY` | orders_channel | Order out for delivery |
| `ORDER_DELIVERED` | orders_channel | Order delivered |
| `ORDER_CANCELLED` | orders_channel | Order cancelled |
| `AUTO_ORDER_SUCCESS` | orders_channel | Auto-order placed successfully |
| `AUTO_ORDER_FAILED` | orders_channel | Auto-order failed |
| `VOUCHER_EXPIRY_REMINDER` | subscriptions_channel | Vouchers expiring soon |
| `SUBSCRIPTION_CREATED` | subscriptions_channel | New subscription purchased |
| `PROMOTIONAL` | general_channel | Promotional messages |

### Kitchen App

| Type | Channel | Description |
|------|---------|-------------|
| `NEW_MANUAL_ORDER` | orders_channel | New order needs acceptance |
| `NEW_AUTO_ACCEPTED_ORDER` | orders_channel | Auto-accepted voucher order |
| `NEW_AUTO_ORDER` | orders_channel | Auto-order from subscription |
| `ORDER_CANCELLED` | orders_channel | Customer cancelled order |

### Driver App

| Type | Channel | Description |
|------|---------|-------------|
| `BATCH_READY` | delivery_channel | New batch available for pickup |
| `BATCH_ASSIGNED` | delivery_channel | Batch assigned to driver |
| `DELIVERY_ASSIGNED` | delivery_channel | Individual delivery assigned |

---

## Notification Payload Examples

### 1. Order Status Update (Consumer)

```json
{
  "notification": {
    "title": "Order Confirmed!",
    "body": "Your order #ORD-123456 has been accepted and is being prepared."
  },
  "data": {
    "type": "ORDER_ACCEPTED",
    "orderId": "64f8a3c9e1b2c3d4e5f6g7h8",
    "orderNumber": "ORD-123456",
    "status": "ACCEPTED",
    "channelId": "orders_channel"
  },
  "android": {
    "channelId": "orders_channel",
    "priority": "high"
  }
}
```

### 2. New Order - Manual Accept (Kitchen)

```json
{
  "notification": {
    "title": "New Order Received!",
    "body": "Order #ORD-123456 - 2 item(s) for LUNCH"
  },
  "data": {
    "type": "NEW_MANUAL_ORDER",
    "orderId": "64f8a3c9e1b2c3d4e5f6g7h8",
    "orderNumber": "ORD-123456",
    "autoAccepted": "false",
    "channelId": "orders_channel"
  },
  "android": {
    "channelId": "orders_channel",
    "priority": "high"
  }
}
```

### 3. Auto-Accepted Order (Kitchen)

```json
{
  "notification": {
    "title": "Auto-Accepted Order #ORD-123456",
    "body": "Voucher order for LUNCH - 2 item(s). Start preparation!"
  },
  "data": {
    "type": "NEW_AUTO_ACCEPTED_ORDER",
    "orderId": "64f8a3c9e1b2c3d4e5f6g7h8",
    "orderNumber": "ORD-123456",
    "autoAccepted": "true",
    "channelId": "orders_channel"
  },
  "android": {
    "channelId": "orders_channel",
    "priority": "high"
  }
}
```

### 4. Voucher Expiry Reminder (Consumer)

```json
{
  "notification": {
    "title": "Vouchers Expiring Soon!",
    "body": "You have 3 voucher(s) expiring in 7 days. Use them before Jan 25!"
  },
  "data": {
    "type": "VOUCHER_EXPIRY_REMINDER",
    "count": "3",
    "expiryDate": "2024-01-25",
    "daysRemaining": "7",
    "channelId": "subscriptions_channel"
  },
  "android": {
    "channelId": "subscriptions_channel",
    "priority": "high"
  }
}
```

### 5. Batch Ready (Driver)

```json
{
  "notification": {
    "title": "New Batch Available!",
    "body": "5 orders ready for pickup from Tiffsy Kitchen"
  },
  "data": {
    "type": "BATCH_READY",
    "batchId": "64f8a3c9e1b2c3d4e5f6g7h8",
    "kitchenId": "64f8a3c9e1b2c3d4e5f6g7h9",
    "kitchenName": "Tiffsy Kitchen",
    "orderCount": "5",
    "channelId": "delivery_channel"
  },
  "android": {
    "channelId": "delivery_channel",
    "priority": "high"
  }
}
```

### 6. Auto-Order Success (Consumer)

```json
{
  "notification": {
    "title": "Your lunch is on the way!",
    "body": "Auto-order #ORD-123456 accepted by Tiffsy Kitchen"
  },
  "data": {
    "type": "AUTO_ORDER_SUCCESS",
    "orderId": "64f8a3c9e1b2c3d4e5f6g7h8",
    "orderNumber": "ORD-123456",
    "mealWindow": "LUNCH",
    "kitchenName": "Tiffsy Kitchen",
    "channelId": "orders_channel"
  },
  "android": {
    "channelId": "orders_channel",
    "priority": "high"
  }
}
```

### 7. Auto-Order Failed (Consumer)

```json
{
  "notification": {
    "title": "Couldn't place your lunch order",
    "body": "No vouchers available. Purchase a subscription to continue."
  },
  "data": {
    "type": "AUTO_ORDER_FAILED",
    "mealWindow": "LUNCH",
    "failureReason": "NO_VOUCHERS",
    "message": "No vouchers available",
    "channelId": "subscriptions_channel"
  },
  "android": {
    "channelId": "subscriptions_channel",
    "priority": "high"
  }
}
```

---

## React Native Implementation

### Setup Firebase Messaging

```javascript
// App.js or index.js
import messaging from '@react-native-firebase/messaging';
import { setupNotificationChannels } from './services/NotificationService';

// Request permission (iOS)
async function requestPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  return enabled;
}

// Initialize
async function initializeNotifications() {
  await requestPermission();
  await setupNotificationChannels(); // Android channels

  // Get FCM token
  const token = await messaging().getToken();
  console.log('FCM Token:', token);
  // Send token to backend: POST /api/auth/fcm-token
}
```

### Message Handlers

```javascript
import messaging from '@react-native-firebase/messaging';

// Background/Quit state handler (must be outside component)
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('Background message:', remoteMessage);
  // Handle notification tap from background
});

// In your App component
function App() {
  useEffect(() => {
    // Foreground handler
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground message:', remoteMessage);
      // Show local notification or in-app alert
      handleForegroundNotification(remoteMessage);
    });

    // Notification opened app from background
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened app:', remoteMessage);
      navigateToScreen(remoteMessage.data);
    });

    // Check if app was opened from quit state via notification
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('App opened from quit:', remoteMessage);
          navigateToScreen(remoteMessage.data);
        }
      });

    return unsubscribe;
  }, []);
}
```

### Handle Notification by Type

```javascript
function handleNotification(remoteMessage) {
  const { data } = remoteMessage;
  const type = data?.type;

  switch (type) {
    // Consumer App
    case 'ORDER_ACCEPTED':
    case 'ORDER_PREPARING':
    case 'ORDER_READY':
    case 'ORDER_OUT_FOR_DELIVERY':
    case 'ORDER_DELIVERED':
      navigateToOrderTracking(data.orderId);
      break;

    case 'ORDER_CANCELLED':
    case 'ORDER_REJECTED':
      showOrderCancelledAlert(data);
      break;

    case 'VOUCHER_EXPIRY_REMINDER':
      navigateToVouchers();
      break;

    // Kitchen App
    case 'NEW_MANUAL_ORDER':
      navigateToOrderDetail(data.orderId, { needsAcceptance: true });
      break;

    case 'NEW_AUTO_ACCEPTED_ORDER':
      navigateToOrderDetail(data.orderId, { autoAccepted: true });
      break;

    // Driver App
    case 'BATCH_READY':
    case 'BATCH_ASSIGNED':
      navigateToBatchDetail(data.batchId);
      break;

    default:
      console.log('Unknown notification type:', type);
  }
}
```

---

## Important Notes

### 1. Data Types
All values in `data` object are **strings**. Convert as needed:

```javascript
const orderCount = parseInt(data.orderCount, 10);
const autoAccepted = data.autoAccepted === 'true';
```

### 2. Token Management
- Register FCM token on login: `POST /api/auth/register-fcm-token`
- Remove token on logout: `DELETE /api/auth/fcm-token`
- Handle token refresh:

```javascript
messaging().onTokenRefresh((token) => {
  // Update token on backend
  updateFCMToken(token);
});
```

### 3. Testing Notifications
Use Firebase Console or backend admin API to send test notifications:

```bash
# Test via backend (if admin endpoint exists)
POST /api/admin/test-notification
{
  "userId": "...",
  "type": "NEW_MANUAL_ORDER",
  "title": "Test Notification",
  "body": "This is a test"
}
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Notifications not received | Check FCM token is registered, app has permission |
| Wrong channel used | Verify `channelId` in both `data` and `android` objects |
| No sound/vibration | Check channel importance is HIGH, device not in DND |
| Background handler not called | Ensure handler is registered outside component |
| Data values are undefined | Check field names match (case-sensitive) |

---

## Backend Reference

Notification types and channel mappings are defined in:
- `services/notification.service.js` - FCM sending logic
- `services/notification-templates.service.js` - Message templates

Channel mapping:
```javascript
const NOTIFICATION_CHANNELS = {
  NEW_MANUAL_ORDER: "orders_channel",
  NEW_AUTO_ACCEPTED_ORDER: "orders_channel",
  ORDER_ACCEPTED: "orders_channel",
  VOUCHER_EXPIRY_REMINDER: "subscriptions_channel",
  BATCH_READY: "delivery_channel",
  // ... etc
};
```
