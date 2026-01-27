# FCM Push Notifications - Complete Implementation Guide

**Last Updated**: 2026-01-27
**Backend Status**: ✅ Fully Implemented
**Consumer App**: ✅ Fully Implemented
**Driver App**: ✅ Fully Implemented
**Kitchen/Admin App**: 🔄 Implementation In Progress

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Implementation](#backend-implementation)
3. [Frontend Implementation - All Apps](#frontend-implementation)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [Notification Types & Channels](#notification-types--channels)
6. [Troubleshooting Guide](#troubleshooting-guide)
7. [Testing Checklist](#testing-checklist)

---

## Overview

### System Architecture

```
Customer Places Order → Backend sends to KITCHEN_STAFF role
Kitchen Dispatches Batch → Backend sends to DRIVER role
Driver Accepts Batch → Backend sends to Driver + Customers
Order Status Changes → Backend sends to Customer
```

### Critical Requirements

1. **Android 8.0+ (API 26+)**: Notification channels are REQUIRED
2. **Android 13+ (API 33+)**: POST_NOTIFICATIONS runtime permission is REQUIRED
3. **iOS**: Notification permission request via Firebase Messaging
4. **Backend**: FCM token must be registered before notifications work
5. **Channel IDs**: Frontend channels MUST match backend channel IDs

---

## Backend Implementation

### Status: ✅ COMPLETE

#### Files Modified
- `services/notification.service.js` - Comprehensive logging added
- `src/delivery/delivery.controller.js` - Driver notification on batch assignment added

#### How Backend Sends Notifications

**1. To Specific User**
```javascript
sendToUser(userId, "ORDER_ACCEPTED", "Order Confirmed!", "Your order #12345 has been accepted", {
  data: { orderId: "123", orderNumber: "ORD-12345" },
  entityType: "ORDER",
  entityId: orderId,
});
```

**2. To Role (Kitchen Staff, Drivers, Admins)**
```javascript
sendToRole("KITCHEN_STAFF", "NEW_MANUAL_ORDER", title, body, {
  kitchenId: kitchenId, // Filter by kitchen
  data: { orderId, orderNumber },
  entityType: "ORDER",
  entityId: orderId,
});
```

#### Backend Channel Mapping

```javascript
const CHANNEL_MAPPING = {
  KITCHEN_STAFF: "kitchen_channel",    // ← Frontend MUST create this channel
  DRIVER: "delivery_channel",          // ← Frontend MUST create this channel
  CUSTOMER: "orders_channel",          // ← Frontend MUST create this channel
};
```

#### Backend Logs (NEW - for debugging)

When notifications are sent, you'll see:

```
=== SEND TO ROLE START ===
Target Role: KITCHEN_STAFF
Kitchen ID Filter: 6xxxxx
Notification Type: NEW_MANUAL_ORDER
Users Found: 2
User Details: [{ id: '...', name: 'Kitchen User', phone: '9876543210' }]

=== NOTIFICATION SEND ATTEMPT ===
Target User ID: 6xxxxx
User Found: { role: 'KITCHEN_STAFF', tokenCount: 1 }
FCM Tokens Found: [{ deviceType: 'ANDROID', tokenPreview: 'dxxx...' }]

=== NOTIFICATION SEND RESULT ===
Success: 1 Failed: 0 Total Tokens: 1
```

**If "Users Found: 0"**:
- User hasn't logged in to app
- User doesn't have FCM tokens registered
- User status is not ACTIVE
- User is not approved (for drivers)

---

## Frontend Implementation

### Option 1: Using @notifee/react-native (Recommended)

**Used by**: Driver App, Kitchen/Admin App

#### Installation

```bash
npm install @notifee/react-native @react-native-firebase/app @react-native-firebase/messaging
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

#### Step 1: Create Notification Channels Service

**File**: `src/services/notificationChannels.service.ts`

```typescript
import notifee, { AndroidImportance, AndroidVisibility } from '@notifee/react-native';
import { Platform, PermissionsAndroid } from 'react-native';

export const NOTIFICATION_CHANNELS = {
  KITCHEN: 'kitchen_channel',      // MUST match backend
  DELIVERY: 'delivery_channel',    // MUST match backend
  ORDERS: 'orders_channel',        // MUST match backend
  GENERAL: 'general_channel',
} as const;

// Request Android 13+ POST_NOTIFICATIONS permission
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS !== 'android') return true;

    if (Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Notification Permission',
          message: 'Allow notifications to stay updated on your orders',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    return true; // Android < 13 doesn't need runtime permission
  } catch (error) {
    console.error('Error requesting permission:', error);
    return false;
  }
};

// Create notification channels (Android 8.0+)
export const createNotificationChannels = async (): Promise<void> => {
  if (Platform.OS !== 'android') {
    console.log('iOS does not use notification channels');
    return;
  }

  try {
    console.log('Creating notification channels...');

    // Kitchen Channel - For kitchen staff
    await notifee.createChannel({
      id: NOTIFICATION_CHANNELS.KITCHEN,
      name: 'Kitchen Orders',
      description: 'Notifications for new orders and kitchen updates',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
      vibrationPattern: [300, 500, 300],
      badge: true,
      visibility: AndroidVisibility.PUBLIC,
    });

    // Delivery Channel - For drivers
    await notifee.createChannel({
      id: NOTIFICATION_CHANNELS.DELIVERY,
      name: 'Delivery Updates',
      description: 'Notifications for batch assignments and delivery updates',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
      vibrationPattern: [300, 500, 300],
      badge: true,
      visibility: AndroidVisibility.PUBLIC,
    });

    // Orders Channel - For customers
    await notifee.createChannel({
      id: NOTIFICATION_CHANNELS.ORDERS,
      name: 'Orders',
      description: 'Order status updates and delivery notifications',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
      vibrationPattern: [300, 200, 300],
      badge: true,
      visibility: AndroidVisibility.PUBLIC,
    });

    // General Channel - Fallback
    await notifee.createChannel({
      id: NOTIFICATION_CHANNELS.GENERAL,
      name: 'General',
      description: 'General app notifications',
      importance: AndroidImportance.DEFAULT,
      sound: 'default',
      vibration: true,
      badge: true,
    });

    console.log('✅ Notification channels created successfully');
  } catch (error) {
    console.error('❌ Error creating notification channels:', error);
  }
};

// Get channel ID based on notification type
export const getChannelForNotificationType = (type?: string): string => {
  if (!type) return NOTIFICATION_CHANNELS.GENERAL;

  const typeUpper = type.toUpperCase();

  // Kitchen notifications
  if (typeUpper.includes('ORDER') && !typeUpper.includes('OUT_FOR_DELIVERY')) {
    return NOTIFICATION_CHANNELS.KITCHEN;
  }

  // Delivery notifications
  if (typeUpper.includes('BATCH') || typeUpper.includes('DELIVERY')) {
    return NOTIFICATION_CHANNELS.DELIVERY;
  }

  // Customer order tracking
  if (typeUpper.includes('OUT_FOR_DELIVERY') || typeUpper.includes('DELIVERED')) {
    return NOTIFICATION_CHANNELS.ORDERS;
  }

  return NOTIFICATION_CHANNELS.GENERAL;
};

// Display notification using notifee (for foreground)
export const displayNotification = async (
  title: string,
  body: string,
  data: any = {},
  type?: string
): Promise<void> => {
  try {
    const channelId = getChannelForNotificationType(type);

    await notifee.displayNotification({
      title,
      body,
      data,
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
        sound: 'default',
        showTimestamp: true,
        timestamp: Date.now(),
      },
      ios: {
        sound: 'default',
        foregroundPresentationOptions: {
          alert: true,
          badge: true,
          sound: true,
        },
      },
    });

    console.log('✅ Notification displayed via notifee');
  } catch (error) {
    console.error('❌ Error displaying notification:', error);
  }
};
```

#### Step 2: Create FCM Service

**File**: `src/services/fcm.service.ts`

```typescript
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { EventType } from '@notifee/react-native';
import {
  createNotificationChannels,
  requestNotificationPermission,
  displayNotification,
} from './notificationChannels.service';

const FCM_TOKEN_KEY = '@fcm_token';
const DEVICE_ID_KEY = '@device_id';

// Generate device ID
const generateDeviceId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

class FCMService {
  private unsubscribeTokenRefresh: (() => void) | null = null;
  private unsubscribeForeground: (() => void) | null = null;

  // Get device ID
  async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = generateDeviceId();
        await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
      }
      return deviceId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      return generateDeviceId();
    }
  }

  // Get FCM token
  async getToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
      console.log('FCM token retrieved:', token.substring(0, 20) + '...');
      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  // Register FCM token with backend
  async registerToken(authToken: string): Promise<boolean> {
    try {
      const fcmToken = await this.getToken();
      if (!fcmToken) {
        console.log('No FCM token available');
        return false;
      }

      const deviceId = await this.getDeviceId();
      const deviceType = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';

      console.log('Registering FCM token with backend...');
      console.log('Device Type:', deviceType);
      console.log('Device ID:', deviceId);

      const response = await fetch('YOUR_API_URL/api/auth/fcm-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fcmToken,
          deviceType,
          deviceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to register FCM token');
      }

      console.log('✅ FCM token registered successfully');
      return true;
    } catch (error: any) {
      console.error('❌ Error registering FCM token:', error.message);
      return false;
    }
  }

  // Remove FCM token from backend
  async removeToken(authToken: string): Promise<boolean> {
    try {
      const fcmToken = await AsyncStorage.getItem(FCM_TOKEN_KEY);
      if (!fcmToken) {
        console.log('No FCM token to remove');
        return true;
      }

      console.log('Removing FCM token from backend...');

      const response = await fetch(
        `YOUR_API_URL/api/auth/fcm-token?fcmToken=${encodeURIComponent(fcmToken)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      await AsyncStorage.removeItem(FCM_TOKEN_KEY);
      console.log('✅ FCM token removed successfully');
      return true;
    } catch (error: any) {
      console.error('❌ Error removing FCM token:', error.message);
      await AsyncStorage.removeItem(FCM_TOKEN_KEY);
      return true; // Clear locally even if backend fails
    }
  }

  // Setup foreground notification listener
  setupForegroundListener(callback?: (notification: any) => void): void {
    this.unsubscribeForeground = messaging().onMessage(
      async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
        console.log('🔔 FOREGROUND NOTIFICATION RECEIVED');
        console.log('Title:', remoteMessage.notification?.title);
        console.log('Body:', remoteMessage.notification?.body);
        console.log('Type:', remoteMessage.data?.type);

        const title = remoteMessage.notification?.title || 'Notification';
        const body = remoteMessage.notification?.body || '';
        const type = remoteMessage.data?.type as string | undefined;

        // Display notification using notifee
        await displayNotification(title, body, remoteMessage.data || {}, type);

        // Callback for in-app handling
        if (callback) {
          callback({
            title,
            body,
            data: remoteMessage.data,
          });
        }
      }
    );
  }

  // Setup background notification handler
  setupBackgroundHandler(): void {
    messaging().setBackgroundMessageHandler(
      async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
        console.log('Background notification received:', remoteMessage);
      }
    );
  }

  // Setup token refresh listener
  setupTokenRefreshListener(authToken: string): void {
    this.unsubscribeTokenRefresh = messaging().onTokenRefresh(async (newToken) => {
      console.log('FCM token refreshed');
      await AsyncStorage.setItem(FCM_TOKEN_KEY, newToken);
      await this.registerToken(authToken);
    });
  }

  // Initialize FCM
  async initialize(authToken: string): Promise<void> {
    try {
      console.log('🚀 Initializing FCM service...');

      // Step 1: Request permission (Android 13+)
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        console.warn('⚠️ Notification permission denied');
      }

      // Step 2: Create notification channels
      await createNotificationChannels();

      // Step 3: Setup background handler
      this.setupBackgroundHandler();

      // Step 4: Setup token refresh
      this.setupTokenRefreshListener(authToken);

      // Step 5: Register token
      await this.registerToken(authToken);

      console.log('✅ FCM service initialized');
    } catch (error) {
      console.error('❌ Error initializing FCM:', error);
    }
  }

  // Cleanup
  cleanup(): void {
    if (this.unsubscribeTokenRefresh) {
      this.unsubscribeTokenRefresh();
      this.unsubscribeTokenRefresh = null;
    }
    if (this.unsubscribeForeground) {
      this.unsubscribeForeground();
      this.unsubscribeForeground = null;
    }
  }

  // Setup notification tap listeners
  setupNotificationOpenListener(
    callback: (notification: FirebaseMessagingTypes.RemoteMessage) => void
  ): () => void {
    // App opened from background
    const unsubscribeOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened app from background:', remoteMessage);
      callback(remoteMessage);
    });

    // App opened from quit state
    messaging().getInitialNotification().then((remoteMessage) => {
      if (remoteMessage) {
        console.log('Notification opened app from quit state:', remoteMessage);
        callback(remoteMessage);
      }
    });

    // Notifee foreground event (when notification tapped while app is open)
    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS && detail.notification?.data) {
        console.log('Notification pressed (foreground):', detail.notification.data);
        // Handle navigation based on data
      }
    });

    return () => {
      unsubscribeOpened();
      unsubscribeNotifee();
    };
  }
}

export const fcmService = new FCMService();
```

#### Step 3: Initialize in App.tsx

```typescript
import { useEffect } from 'react';
import { fcmService } from './src/services/fcm.service';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && authToken) {
      // Initialize FCM after login
      fcmService.initialize(authToken);

      // Setup foreground listener
      fcmService.setupForegroundListener((notification) => {
        console.log('In-app notification:', notification);
        // Show in-app popup or update badge
      });

      // Setup notification opened listener
      const unsubscribeOpened = fcmService.setupNotificationOpenListener(
        (remoteMessage) => {
          // Handle deep linking based on remoteMessage.data
          const { type, orderId, batchId } = remoteMessage.data || {};

          if (type === 'ORDER_ACCEPTED' && orderId) {
            navigation.navigate('OrderDetails', { orderId });
          } else if (type === 'BATCH_ASSIGNED' && batchId) {
            navigation.navigate('BatchDetails', { batchId });
          }
        }
      );

      return () => {
        unsubscribeOpened();
        fcmService.cleanup();
      };
    }
  }, [isAuthenticated, authToken]);

  const handleLogout = async () => {
    if (authToken) {
      await fcmService.removeToken(authToken);
      fcmService.cleanup();
    }
    setIsAuthenticated(false);
    setAuthToken(null);
  };

  return (
    // Your app UI
  );
}
```

---

### Option 2: Using Native Android Module (Alternative)

**Used by**: Consumer App

This approach creates notification channels via native Kotlin code instead of using @notifee/react-native package.

#### Create Native Module

**File**: `android/app/src/main/java/com/yourapp/NotificationChannelModule.kt`

```kotlin
package com.yourapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import com.facebook.react.bridge.*

class NotificationChannelModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NotificationChannelModule"

    @ReactMethod
    fun createNotificationChannels(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val notificationManager = reactApplicationContext
                    .getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

                // Kitchen Channel
                val kitchenChannel = NotificationChannel(
                    "kitchen_channel",
                    "Kitchen Orders",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "New orders and kitchen updates"
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 300, 200, 300)
                    setSound(
                        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                            .build()
                    )
                }

                // Delivery Channel
                val deliveryChannel = NotificationChannel(
                    "delivery_channel",
                    "Deliveries",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Batch and delivery notifications"
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 300, 200, 300)
                }

                // Orders Channel
                val ordersChannel = NotificationChannel(
                    "orders_channel",
                    "Orders",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Order status updates"
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 300, 200, 300)
                }

                notificationManager.createNotificationChannel(kitchenChannel)
                notificationManager.createNotificationChannel(deliveryChannel)
                notificationManager.createNotificationChannel(ordersChannel)

                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("CHANNEL_ERROR", e.message, e)
            }
        } else {
            promise.resolve(true)
        }
    }
}
```

**File**: `android/app/src/main/java/com/yourapp/NotificationChannelPackage.kt`

```kotlin
package com.yourapp

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class NotificationChannelPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(NotificationChannelModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
```

**File**: `android/app/src/main/java/com/yourapp/MainApplication.java`

```java
import com.yourapp.NotificationChannelPackage; // Add this import

@Override
protected List<ReactPackage> getPackages() {
  return Arrays.<ReactPackage>asList(
      new MainReactPackage(),
      new NotificationChannelPackage() // Add this line
  );
}
```

**File**: `src/services/notificationChannel.service.ts`

```typescript
import { NativeModules, Platform } from 'react-native';

const { NotificationChannelModule } = NativeModules;

class NotificationChannelService {
  async createChannels(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.log('iOS does not use notification channels');
      return true;
    }

    if (!NotificationChannelModule) {
      console.warn('NotificationChannelModule not available');
      return false;
    }

    try {
      console.log('Creating notification channels...');
      const result = await NotificationChannelModule.createNotificationChannels();
      console.log('✅ Notification channels created');
      return result;
    } catch (error) {
      console.error('❌ Failed to create channels:', error);
      return false;
    }
  }
}

export default new NotificationChannelService();
```

Then call `notificationChannelService.createChannels()` on app startup.

---

## API Endpoints Reference

### POST /api/auth/fcm-token

Register FCM token with backend.

**Headers:**
```
Authorization: Bearer <firebase-jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "fcmToken": "dGVzdF90b2tlbl9mb3JfZG9j...",
  "deviceType": "ANDROID",
  "deviceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "FCM token registered"
}
```

**When to Call:**
- After successful login
- When FCM token refreshes (onTokenRefresh)
- After app reinstall

---

### DELETE /api/auth/fcm-token

Remove FCM token from backend.

**Headers:**
```
Authorization: Bearer <firebase-jwt-token>
Content-Type: application/json
```

**Query Parameter:**
```
?fcmToken=<encoded-fcm-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "FCM token removed"
}
```

**When to Call:**
- Before logout
- When user disables notifications

---

## Notification Types & Channels

### Backend → Frontend Channel Mapping

| User Role | Backend Channel ID | Frontend Must Create |
|-----------|-------------------|---------------------|
| KITCHEN_STAFF | `kitchen_channel` | ✅ Required |
| DRIVER | `delivery_channel` | ✅ Required |
| CUSTOMER | `orders_channel` | ✅ Required |

### Notification Types by App

#### Consumer App
| Notification Type | Title | Channel |
|------------------|-------|---------|
| ORDER_ACCEPTED | "Order Confirmed!" | orders_channel |
| ORDER_PREPARING | "Order Being Prepared" | orders_channel |
| ORDER_READY | "Order Ready!" | orders_channel |
| ORDER_OUT_FOR_DELIVERY | "On the Way!" | orders_channel |
| ORDER_DELIVERED | "Order Delivered!" | orders_channel |
| AUTO_ORDER_SUCCESS | "Auto Order Placed!" | orders_channel |
| VOUCHER_EXPIRY_REMINDER | "Vouchers Expiring Soon!" | subscriptions_channel |

#### Kitchen/Admin App
| Notification Type | Title | Channel |
|------------------|-------|---------|
| NEW_MANUAL_ORDER | "New Order Received!" | kitchen_channel |
| NEW_AUTO_ORDER | "New Auto Order" | kitchen_channel |
| NEW_AUTO_ACCEPTED_ORDER | "Auto-Accepted Order" | kitchen_channel |
| BATCH_DISPATCHED | "Batch Dispatched" | delivery_channel |

#### Driver App
| Notification Type | Title | Channel |
|------------------|-------|---------|
| BATCH_READY | "New Batch Available!" | delivery_channel |
| BATCH_ASSIGNED | "Batch Assigned" | delivery_channel |
| ORDER_READY_FOR_PICKUP | "Orders Ready!" | delivery_channel |

---

## Troubleshooting Guide

### Problem: Notifications Not Appearing

#### Check 1: Backend Logs

Look for these logs in your backend console:

```
=== SEND TO ROLE START ===
Users Found: 0   ← PROBLEM: No users found!
```

**If "Users Found: 0":**

1. Check if user logged in to the app
2. Check if user has FCM tokens:
   ```javascript
   db.users.findOne({ phone: "9876543210" }, { fcmTokens: 1 })
   ```
3. Check user status:
   ```javascript
   db.users.findOne({ phone: "9876543210" }, { status: 1, role: 1 })
   ```
   - Status must be "ACTIVE"
   - For drivers: approvalStatus must be "APPROVED"

#### Check 2: Frontend - Notification Permission

**Android 13+ (API 33+):**

```kotlin
// Check if permission is granted
if (ContextCompat.checkSelfPermission(
    context,
    Manifest.permission.POST_NOTIFICATIONS
) != PackageManager.PERMISSION_GRANTED) {
    // Permission NOT granted - notifications won't work
}
```

**In React Native:**
```typescript
import { PermissionsAndroid, Platform } from 'react-native';

const checkPermission = async () => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    console.log('Notification permission:', granted ? 'GRANTED' : 'DENIED');
  }
};
```

#### Check 3: Frontend - Notification Channels

Channels MUST be created before notifications work.

**Check if channels exist:**

```typescript
import notifee from '@notifee/react-native';

const checkChannels = async () => {
  const channels = await notifee.getChannels();
  console.log('Channels:', channels);

  const hasKitchenChannel = channels.some(c => c.id === 'kitchen_channel');
  const hasDeliveryChannel = channels.some(c => c.id === 'delivery_channel');

  console.log('kitchen_channel exists:', hasKitchenChannel);
  console.log('delivery_channel exists:', hasDeliveryChannel);
};
```

**If channels don't exist:**
- Call `createNotificationChannels()` on app startup
- Rebuild the app completely

#### Check 4: Frontend - FCM Token Registration

**Check if token is registered:**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const checkToken = async () => {
  const token = await AsyncStorage.getItem('@fcm_token');
  console.log('FCM token exists:', !!token);
  console.log('Token:', token?.substring(0, 20) + '...');
};
```

**If no token:**
- Call `fcmService.initialize(authToken)` after login
- Check backend logs for token registration success

#### Check 5: Channel ID Mismatch

**Backend sends:**
```javascript
channelId: "kitchen_channel"
```

**Frontend must have:**
```typescript
await notifee.createChannel({
  id: 'kitchen_channel',  // ← MUST MATCH
  name: 'Kitchen Orders',
  ...
});
```

**If mismatch:**
- Android will use default channel
- Notification may not appear or have wrong sound/vibration

---

### Problem: Foreground Notifications Not Showing

**Issue**: Notification arrives but doesn't display when app is open.

**Solution**: You must manually display foreground notifications using notifee.

```typescript
messaging().onMessage(async (remoteMessage) => {
  // DON'T just log it - DISPLAY it!
  await notifee.displayNotification({
    title: remoteMessage.notification?.title || 'Notification',
    body: remoteMessage.notification?.body || '',
    data: remoteMessage.data || {},
    android: {
      channelId: 'kitchen_channel',
      importance: AndroidImportance.HIGH,
      pressAction: { id: 'default' },
    },
  });
});
```

---

### Problem: Background Notifications Not Showing

**Issue**: Notification doesn't appear when app is in background.

**Check 1: Android Battery Optimization**
- Go to Settings → Apps → Your App → Battery
- Set to "Unrestricted"

**Check 2: Background Handler**
```typescript
// In index.js (top level)
import messaging from '@react-native-firebase/messaging';

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('Background notification:', remoteMessage);
  // Notification will be shown by system automatically
});
```

---

## Testing Checklist

### Pre-Testing Setup

- [ ] Backend server is running
- [ ] Backend has comprehensive logs enabled
- [ ] App is completely rebuilt after notification changes
- [ ] User is logged in to the app
- [ ] FCM token is registered (check backend logs)
- [ ] Notification channels are created (check app logs)
- [ ] Notification permission is granted (Android 13+)

### Test 1: Kitchen Notification When Order Placed

**Steps:**
1. Login to Kitchen/Admin app
2. Check console for:
   ```
   ✅ FCM token registered successfully
   ✅ Notification channels created
   ```
3. Place order from Consumer app
4. Check backend console:
   ```
   === SEND TO ROLE START ===
   Target Role: KITCHEN_STAFF
   Users Found: 1
   === NOTIFICATION SEND RESULT ===
   Success: 1
   ```
5. Kitchen app should receive notification

**Expected Result:**
- Notification appears in system tray
- Sound plays
- Vibration occurs
- Tapping opens order details

### Test 2: Driver Notification When Batch Dispatched

**Steps:**
1. Login to Driver app
2. Check console for FCM registration success
3. Admin dispatches batch from kitchen
4. Check backend console for "Target Role: DRIVER"
5. Driver app should receive notification

**Expected Result:**
- Notification appears
- Shows batch details (order count, kitchen name)
- Tapping opens batch screen

### Test 3: Driver Notification When Batch Accepted

**Steps:**
1. Driver accepts a batch
2. Check backend logs for:
   ```
   Target User ID: <driver-id>
   Notification Type: BATCH_ASSIGNED
   Success: 1
   ```
3. Driver should receive confirmation notification

**Expected Result:**
- Immediate notification after accepting batch
- Shows batch number and order count

### Test 4: Foreground Notification

**Steps:**
1. Keep app open and in foreground
2. Trigger notification (e.g., place order)
3. Notification should display at top of screen

**Expected Result:**
- Notification displays over app
- Sound and vibration work
- Can dismiss or tap to view

### Test 5: Background Notification

**Steps:**
1. Open app, then press Home button (app in background)
2. Trigger notification
3. Check system notification tray

**Expected Result:**
- Notification appears in tray
- Tapping opens app to relevant screen

### Test 6: App Killed Notification

**Steps:**
1. Force close app (swipe away from recent apps)
2. Trigger notification
3. Check notification tray

**Expected Result:**
- Notification still appears
- Tapping launches app to relevant screen

---

## Common Issues & Solutions

### Issue: "No FCM tokens for user"

**Cause:** User hasn't registered FCM token with backend.

**Solution:**
1. Check if `fcmService.initialize(authToken)` is called after login
2. Check if token registration API call succeeds
3. Verify authToken is valid

### Issue: "Users Found: 0" for Kitchen Staff

**Cause:** Kitchen staff user not properly set up.

**Solution:**
```javascript
// Check user in database
db.users.findOne({ phone: "KITCHEN_PHONE" })

// Verify:
// - role: "KITCHEN_STAFF"
// - status: "ACTIVE"
// - kitchenId: <valid ObjectId>
// - fcmTokens: [{ token: "...", deviceType: "ANDROID" }]
```

### Issue: "Users Found: 0" for Drivers

**Cause:** Driver not approved or no FCM token.

**Solution:**
```javascript
// Check driver in database
db.users.findOne({ phone: "DRIVER_PHONE" })

// Verify:
// - role: "DRIVER"
// - status: "ACTIVE"
// - approvalStatus: "APPROVED"  ← CRITICAL
// - fcmTokens: [{ token: "...", deviceType: "ANDROID" }]
```

### Issue: Notifications work in foreground but not background

**Cause:** Background handler not set up.

**Solution:**
Add to `index.js`:
```javascript
import messaging from '@react-native-firebase/messaging';

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('Background message:', remoteMessage);
});

// Then register your app
AppRegistry.registerComponent(appName, () => App);
```

---

## App-Specific Implementation Status

### ✅ Consumer App (Tiffsy)
- Notification channels: Native module
- FCM integration: Complete
- Permission handling: Complete
- Foreground notifications: Working
- Background notifications: Working
- Status: FULLY WORKING

### ✅ Driver App (TiffsyDriver)
- Notification channels: @notifee/react-native
- FCM integration: Complete
- Permission handling: Complete (with Android 13+ support)
- Foreground notifications: Working
- Background notifications: Working
- Status: FULLY WORKING

### 🔄 Kitchen/Admin App (TiffsyKitchen)
- Notification channels: IN PROGRESS (you're implementing)
- FCM integration: UPDATED (you just modified)
- Permission handling: NEEDS TESTING
- Foreground notifications: NEEDS TESTING
- Background notifications: NEEDS TESTING
- Status: IMPLEMENTATION IN PROGRESS

**What Kitchen/Admin App Still Needs:**

1. Create `notificationChannels.service.ts` file (code provided above)
2. Test FCM initialization on login
3. Test foreground notifications
4. Test background notifications
5. Verify channel IDs match backend

---

## Quick Reference Commands

**Check user FCM tokens:**
```javascript
db.users.findOne(
  { phone: "USER_PHONE" },
  { fcmTokens: 1, status: 1, role: 1, approvalStatus: 1 }
)
```

**Check notification channels in Android (via adb):**
```bash
adb shell dumpsys notification_listener | grep -A 5 "channel"
```

**Force FCM token refresh:**
```typescript
import messaging from '@react-native-firebase/messaging';
await messaging().deleteToken();
const newToken = await messaging().getToken();
```

**Test notification manually (backend):**
```javascript
// In backend console
const { sendToUser } = require('./services/notification.service');
sendToUser('USER_ID', 'TEST', 'Test Title', 'Test Body', {
  data: { test: 'true' }
});
```

---

## Summary

### What's Working
1. ✅ Backend notification service with comprehensive logging
2. ✅ Backend sends notifications to roles (KITCHEN_STAFF, DRIVER)
3. ✅ Backend sends notifications to specific users
4. ✅ Consumer app receives all notifications
5. ✅ Driver app receives all notifications

### What Needs Attention
1. 🔄 Kitchen/Admin app notification channels implementation
2. 🔄 Testing Kitchen/Admin app notifications end-to-end

### Critical Reminders
1. Channel IDs MUST match between backend and frontend
2. Android 13+ REQUIRES POST_NOTIFICATIONS runtime permission
3. Channels MUST be created before notifications work
4. FCM token MUST be registered after login
5. Foreground notifications require manual display via notifee
6. User status must be ACTIVE
7. Drivers must have approvalStatus = APPROVED

---

**Last Updated**: 2026-01-27
**Maintained By**: Development Team
**Questions**: Check backend logs first, then frontend console logs
