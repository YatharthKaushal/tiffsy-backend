# 🚀 Authentication Quick Reference Card

> **Print this and keep it handy for quick reference during development**

---

## 🔥 The Golden Rule

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  ⚠️  ALWAYS CALL /api/auth/sync IMMEDIATELY               │
│     AFTER FIREBASE OTP VERIFICATION                        │
│                                                            │
│  Without this, ALL subsequent API calls will fail!        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 🎯 Essential Flow (3 Steps)

```javascript
// Step 1: Firebase OTP → Get Token
const token = await firebaseUser.getIdToken();

// Step 2: Sync (CRITICAL!)
const sync = await fetch('/api/auth/sync', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});

// Step 3: Handle Response
const data = await sync.json();
if (data.data.isNewUser) {
  // Register
} else {
  // Navigate based on role
}
```

---

## 📍 API Endpoints Cheat Sheet

| What | Endpoint | When |
|------|----------|------|
| Check user exists | `POST /auth/sync` | ⚠️ FIRST, after Firebase auth |
| Register customer | `POST /auth/register` | If isNewUser: true |
| Register kitchen | `POST /auth/register-kitchen` | If isNewUser: true |
| Register driver | `POST /auth/register-driver` | If isNewUser: true |
| Get profile | `GET /auth/me` | Anytime |
| Update profile | `PUT /auth/profile` | Anytime |
| Kitchen dashboard | `GET /kitchens/dashboard` | After sync (kitchen staff) |

**Base URL:** `https://api.tiffsy.com/api`
**Auth Header:** `Authorization: Bearer {firebase_token}`

---

## 🔐 Token Management

```javascript
// Get fresh token (always do this before API calls)
const token = await auth().currentUser.getIdToken(true);
//                                               ^^^^ Force refresh

// Auto-refresh every 50 minutes
setInterval(async () => {
  if (auth().currentUser) {
    await auth().currentUser.getIdToken(true);
  }
}, 50 * 60 * 1000);
```

**Token expires:** 1 hour
**Refresh before:** 50 minutes

---

## 👥 User Roles & Status Checks

### Customer
```javascript
// No approval needed
if (user.role === 'CUSTOMER') {
  navigate('CustomerHome');
}
```

### Kitchen Staff
```javascript
// Check kitchen approval status
if (user.role === 'KITCHEN_STAFF') {
  if (syncData.kitchenApprovalStatus === 'PENDING') {
    navigate('Pending');
  } else if (syncData.kitchenApprovalStatus === 'REJECTED') {
    navigate('Rejected');
  } else {
    navigate('KitchenDashboard');
  }
}
```

### Driver
```javascript
// Check driver approval status
if (user.role === 'DRIVER') {
  if (syncData.approvalStatus === 'APPROVED') {
    navigate('DriverHome');
  } else {
    navigate('Pending');
  }
}
```

---

## 🐛 Error Quick Fixes

| Error Code | What It Means | Fix |
|------------|---------------|-----|
| **403** | Access denied | Call `/auth/sync` first |
| **401** | Token expired | Refresh token: `getIdToken(true)` |
| **400** | Bad request | Check request body |
| **404** | Not found | Check endpoint URL |
| **500** | Server error | Retry or contact support |

---

## ✅ Pre-Flight Checklist

Before making ANY API call:

```
□ Firebase user signed in?
□ Called /api/auth/sync?
□ Token is fresh (< 50 minutes old)?
□ Authorization header present?
□ Request body correct?
```

---

## 📱 Phone Number Format

```javascript
// Always use +91 prefix for Firebase
const phone = '+91' + userInput.replace(/^0+/, '');

// Examples:
// Input:  9876543210  → Firebase: +919876543210
// Input: 09876543210  → Firebase: +919876543210
```

**Backend stores:** `9876543210` (without +91)
**Firebase uses:** `+919876543210` (with +91)
**Auth middleware:** Handles both automatically

---

## 🔄 Registration Flow

```javascript
// 1. Sync first
const sync = await fetch('/api/auth/sync', {...});
const { isNewUser } = await sync.json();

if (isNewUser) {
  // 2. Register
  await fetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, ... })
  });

  // 3. Sync again to get updated profile
  await fetch('/api/auth/sync', {...});
}
```

---

## 💾 User Data Storage

```javascript
// Store after successful sync
await AsyncStorage.setItem('user', JSON.stringify(user));
await AsyncStorage.setItem('userRole', user.role);

// Clear on logout
await AsyncStorage.multiRemove(['user', 'userRole', 'fcmToken']);
```

---

## 🚨 Common Mistakes

```javascript
// ❌ WRONG - Skipping sync
const token = await getToken();
fetch('/api/kitchens/dashboard', { headers: { Authorization: token }});

// ✅ CORRECT - Sync first
const token = await getToken();
await fetch('/api/auth/sync', { method: 'POST', headers: { Authorization: token }});
fetch('/api/kitchens/dashboard', { headers: { Authorization: token }});
```

```javascript
// ❌ WRONG - Using old/cached token
const token = this.cachedToken;

// ✅ CORRECT - Always get fresh token
const token = await auth().currentUser.getIdToken(true);
```

```javascript
// ❌ WRONG - Not checking approval status
if (user.role === 'KITCHEN_STAFF') {
  navigate('Dashboard');
}

// ✅ CORRECT - Check approval status
if (user.role === 'KITCHEN_STAFF') {
  if (syncData.kitchenApprovalStatus === 'PENDING') {
    navigate('Pending');
  } else {
    navigate('Dashboard');
  }
}
```

---

## 🧪 Testing Commands

### Test sync endpoint
```bash
TOKEN="your_firebase_token"

curl -X POST https://api.tiffsy.com/api/auth/sync \
  -H "Authorization: Bearer $TOKEN"
```

### Test registration
```bash
curl -X POST https://api.tiffsy.com/api/auth/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com"}'
```

---

## 📞 Emergency Contacts

**Backend Issues:** backend@tiffsy.com
**Slack:** #backend-support
**Docs:** [README_AUTHENTICATION.md](README_AUTHENTICATION.md)

---

## 🎓 Learn More

| Topic | Document |
|-------|----------|
| Full implementation guide | [AUTHENTICATION_FLOW_GUIDE.md](AUTHENTICATION_FLOW_GUIDE.md) |
| Debugging & errors | [AUTHENTICATION_TROUBLESHOOTING.md](AUTHENTICATION_TROUBLESHOOTING.md) |
| Visual flow diagrams | [AUTHENTICATION_FLOW_DIAGRAM.md](AUTHENTICATION_FLOW_DIAGRAM.md) |

---

## 💡 Pro Tips

1. **Always log sync responses** during development
   ```javascript
   const syncData = await fetch('/api/auth/sync', {...}).then(r => r.json());
   console.log('Sync response:', JSON.stringify(syncData, null, 2));
   ```

2. **Use a wrapper function** for API calls
   ```javascript
   async function apiCall(endpoint, options = {}) {
     const token = await auth().currentUser.getIdToken(true);
     return fetch(`${BASE_URL}${endpoint}`, {
       ...options,
       headers: {
         'Authorization': `Bearer ${token}`,
         'Content-Type': 'application/json',
         ...options.headers
       }
     });
   }
   ```

3. **Handle errors gracefully**
   ```javascript
   try {
     const response = await apiCall('/auth/sync', { method: 'POST' });
     const data = await response.json();

     if (!response.ok) {
       throw new Error(data.error || 'Request failed');
     }

     return data;
   } catch (error) {
     console.error('API Error:', error);
     Alert.alert('Error', error.message);
   }
   ```

---

**Version:** 1.0 | **Last Updated:** 2026-01-19

---

> **Bookmark this page for quick access during development!**
