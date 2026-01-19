# Authentication Troubleshooting Guide

## Quick Reference: Common Errors and Solutions

### Error: "403 Forbidden - Access denied to this kitchen"

**Symptoms:**
- Kitchen staff user can log in but gets 403 when accessing `/api/kitchens/dashboard`
- Error message: "Access denied to this kitchen"

**Root Cause:**
User's Firebase UID is not linked to their database record, OR the sync endpoint wasn't called.

**Solution:**
```javascript
// Always call sync after Firebase authentication
const token = await firebaseUser.getIdToken(true);
const syncResponse = await fetch('/api/auth/sync', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
const syncData = await syncResponse.json();

// THEN access protected endpoints
const dashboardResponse = await fetch('/api/kitchens/dashboard', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**Verification:**
```javascript
// Check if sync was successful
console.log('User:', syncData.data.user);
console.log('Has kitchenId:', !!syncData.data.user.kitchenId);
console.log('Has firebaseUid:', !!syncData.data.user.firebaseUid);
```

---

### Error: "400 Bad Request - Kitchen ID is required"

**Symptoms:**
- Kitchen staff can't access dashboard
- Error: "Kitchen ID is required"

**Root Cause:**
1. User doesn't have `kitchenId` assigned in database
2. Kitchen is still pending approval

**Solution:**
Check sync response for kitchen approval status:
```javascript
const syncData = await fetch('/api/auth/sync', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

if (syncData.data.kitchenApprovalStatus === 'PENDING') {
  // Kitchen not yet approved by admin
  showPendingApprovalScreen();
} else if (!syncData.data.user.kitchenId) {
  // No kitchen assigned - contact support
  showErrorScreen('No kitchen assigned to your account');
}
```

---

### Error: "401 Unauthorized - Token expired"

**Symptoms:**
- API calls fail with 401 after some time
- Error: "Token expired"

**Root Cause:**
Firebase ID token expires after 1 hour.

**Solution:**
Always refresh token before API calls:
```javascript
async function getValidToken() {
  const user = auth().currentUser;
  if (!user) throw new Error('Not authenticated');

  // Force refresh token
  return await user.getIdToken(true);
}

// Use in all API calls
const token = await getValidToken();
fetch('/api/endpoint', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**Pro Tip:**
Implement automatic token refresh:
```javascript
// Refresh token every 50 minutes
setInterval(async () => {
  if (auth().currentUser) {
    await auth().currentUser.getIdToken(true);
  }
}, 50 * 60 * 1000);
```

---

### Error: "User not found" after registration

**Symptoms:**
- Registration succeeds but user can't log in
- Sync returns "User not found"

**Root Cause:**
Phone number format mismatch between Firebase and backend.

**Solution:**
1. Ensure phone format is consistent:
```javascript
// Always use +91 prefix
const phoneNumber = '+91' + userInput.replace(/^0+/, '');

// Example: 9876543210 → +919876543210
```

2. Check backend normalization:
```javascript
// Backend normalizes to: 9876543210 (no +91)
// But Firebase token has: +919876543210
// Auth middleware handles this automatically
```

---

### Error: "Driver pending approval" but can't access anything

**Symptoms:**
- Driver registered successfully
- Can't access driver dashboard
- Status shows "PENDING"

**Root Cause:**
Driver approval is required before access is granted.

**Solution:**
This is expected behavior. Show approval pending screen:
```javascript
if (syncData.data.approvalStatus === 'PENDING') {
  return (
    <PendingApprovalScreen
      message="Your driver registration is being reviewed by our admin team."
      submittedAt={syncData.data.user.createdAt}
    />
  );
}

// Admin must approve via admin panel before driver can access app
```

**Admin Action Required:**
1. Admin logs into admin panel
2. Navigate to Drivers → Pending Approvals
3. Review driver documents
4. Click "Approve" or "Reject"

---

### Error: Kitchen staff can't see orders

**Symptoms:**
- Kitchen staff logged in successfully
- Dashboard loads but no orders visible
- Empty order list

**Root Cause:**
1. No orders assigned to this kitchen yet
2. Kitchen status is not ACTIVE
3. Kitchen not accepting orders

**Solution:**
```javascript
// Check kitchen status in dashboard response
const dashboard = await fetch('/api/kitchens/dashboard', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

console.log('Kitchen status:', dashboard.data.kitchen.status);
console.log('Accepting orders:', dashboard.data.kitchen.isAcceptingOrders);
console.log('Orders count:', dashboard.data.todayStats.ordersCount);

if (dashboard.data.kitchen.status !== 'ACTIVE') {
  showMessage('Kitchen is not active. Contact admin.');
} else if (!dashboard.data.kitchen.isAcceptingOrders) {
  showMessage('Kitchen is not accepting orders currently.');
} else if (dashboard.data.todayStats.ordersCount === 0) {
  showMessage('No orders yet today.');
}
```

---

### Error: Can't update kitchen details

**Symptoms:**
- Kitchen staff tries to update kitchen info
- Gets 403 or 404 error

**Root Cause:**
Kitchen staff can only update specific fields via `/my-kitchen` endpoint.

**Solution:**
```javascript
// ❌ WRONG - Kitchen staff can't use this
PATCH /api/kitchens/{id}

// ✅ CORRECT - Use my-kitchen endpoint
PATCH /api/kitchens/my-kitchen/images
PATCH /api/kitchens/my-kitchen/accepting-orders

// Only these fields can be updated by kitchen staff:
// - logo
// - coverImage
// - isAcceptingOrders
```

---

### Error: Multiple accounts with same phone number

**Symptoms:**
- Registration fails with "User already exists"
- Can't register new account

**Root Cause:**
Phone number is unique across all users.

**Solution:**
1. Check if user already exists:
```javascript
const syncData = await fetch('/api/auth/sync', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

if (!syncData.data.isNewUser) {
  // User already exists
  console.log('Existing role:', syncData.data.user.role);
  console.log('Existing status:', syncData.data.user.status);

  // User should log in instead of register
}
```

2. If user was deleted, contact backend to reactivate.

---

### Error: FCM token not registering

**Symptoms:**
- Push notifications not working
- FCM token registration fails

**Root Cause:**
1. Token not registered with backend
2. Token expired or invalid

**Solution:**
```javascript
import messaging from '@react-native-firebase/messaging';

// Request permission and get token
async function registerFCM() {
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      const fcmToken = await messaging().getToken();

      // Register with backend
      const token = await auth().currentUser.getIdToken(true);
      await fetch('/api/auth/fcm-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: fcmToken })
      });

      console.log('FCM token registered:', fcmToken);
    }
  } catch (error) {
    console.error('FCM registration error:', error);
  }
}

// Listen for token refresh
messaging().onTokenRefresh(async (fcmToken) => {
  // Re-register new token
  const token = await auth().currentUser.getIdToken(true);
  await fetch('/api/auth/fcm-token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token: fcmToken })
  });
});
```

---

## Debugging Checklist

### When authentication fails:

1. **Check Firebase authentication:**
```javascript
const user = auth().currentUser;
console.log('Firebase user:', user);
console.log('Phone:', user?.phoneNumber);
console.log('UID:', user?.uid);
```

2. **Check token validity:**
```javascript
const token = await user.getIdToken(true);
console.log('Token (first 50 chars):', token.substring(0, 50));

// Decode token (for debugging only)
const decoded = JSON.parse(atob(token.split('.')[1]));
console.log('Token expires:', new Date(decoded.exp * 1000));
```

3. **Check sync response:**
```javascript
const syncData = await fetch('/api/auth/sync', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

console.log('Sync success:', syncData.success);
console.log('Is new user:', syncData.data.isNewUser);
console.log('User role:', syncData.data.user?.role);
console.log('User status:', syncData.data.user?.status);
console.log('Has kitchenId:', !!syncData.data.user?.kitchenId);
console.log('Has firebaseUid:', !!syncData.data.user?.firebaseUid);
```

4. **Check network request:**
```javascript
fetch('/api/auth/sync', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(response => {
  console.log('Status:', response.status);
  console.log('Headers:', response.headers);
  return response.json();
})
.then(data => console.log('Response:', data))
.catch(error => console.error('Network error:', error));
```

---

## Environment-Specific Issues

### Development Environment

**Issue:** SSL certificate errors
```javascript
// Only for development - DO NOT use in production
if (__DEV__) {
  global.XMLHttpRequest = global.originalXMLHttpRequest || global.XMLHttpRequest;
}
```

**Issue:** localhost not accessible
```javascript
// Use your computer's IP instead of localhost
const API_BASE_URL = __DEV__
  ? 'http://192.168.1.100:5005/api'  // Your local IP
  : 'https://api.tiffsy.com/api';
```

### Production Environment

**Issue:** CORS errors
```
Error: CORS policy blocked
```
**Solution:** Backend must allow your domain in CORS config.

**Issue:** HTTPS required
```
Error: Mixed content blocked
```
**Solution:** Ensure all API calls use HTTPS in production.

---

## Backend Logs to Check

When reporting issues to backend team, provide:

1. **User phone number:** +919800000001
2. **Timestamp:** 2026-01-19 14:30:00 IST
3. **Endpoint called:** POST /api/auth/sync
4. **Error response:**
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error"
}
```
5. **Steps to reproduce:**
   - Open app
   - Enter phone number
   - Enter OTP
   - Click login
   - Error appears

---

## Quick Fix Commands (Backend Team)

### Fix missing kitchenId for kitchen staff:
```javascript
// In MongoDB or via script
db.users.updateOne(
  { phone: "9800000001" },
  { $set: { kitchenId: ObjectId("kitchen_id_here") } }
)
```

### Fix missing firebaseUid:
```javascript
// User needs to call /api/auth/sync endpoint
// Backend will automatically set firebaseUid
```

### Approve pending kitchen:
```javascript
db.kitchens.updateOne(
  { _id: ObjectId("kitchen_id") },
  {
    $set: {
      status: "ACTIVE",
      approvedBy: ObjectId("admin_id"),
      approvedAt: new Date()
    }
  }
)
```

### Approve pending driver:
```javascript
db.users.updateOne(
  { _id: ObjectId("user_id"), role: "DRIVER" },
  {
    $set: {
      approvalStatus: "APPROVED",
      "approvalDetails.approvedBy": ObjectId("admin_id"),
      "approvalDetails.approvedAt": new Date()
    }
  }
)
```

---

## Testing Tips

### Test User Sync Flow:
```bash
# 1. Get Firebase token (from Firebase console or app)
TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."

# 2. Call sync endpoint
curl -X POST https://api.tiffsy.com/api/auth/sync \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Expected response:
{
  "success": true,
  "message": "User authenticated",
  "data": {
    "user": { /* user object */ },
    "isNewUser": false,
    "isProfileComplete": true
  }
}
```

### Test Registration Flow:
```bash
# Register new customer
curl -X POST https://api.tiffsy.com/api/auth/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "dietaryPreferences": ["VEG"]
  }'
```

---

## Contact Support

If issues persist after following this guide:

**Backend Team:**
- Email: backend@tiffsy.com
- Slack: #backend-support
- GitHub Issues: [link to repo]

**Include in support request:**
- This troubleshooting guide reference
- Error message screenshot
- Console logs
- User phone number (for investigation)
- Device info (iOS/Android version)

---

**Last Updated:** January 19, 2026
