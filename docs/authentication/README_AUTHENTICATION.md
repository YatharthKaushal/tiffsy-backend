# Tiffsy Authentication Documentation

## 📚 Documentation Overview

This folder contains comprehensive authentication documentation for the Tiffsy platform. These documents are designed to help frontend developers implement the authentication flow correctly and troubleshoot common issues.

---

## 📖 Available Documents

### 1. **AUTHENTICATION_FLOW_GUIDE.md** (Main Guide)
**Purpose:** Complete implementation guide for frontend developers

**Contents:**
- Step-by-step authentication flow for all user types
- Complete API endpoint reference with request/response examples
- Code examples (React Native, JavaScript)
- Testing checklist
- Error handling patterns

**When to use:**
- Starting new authentication implementation
- Need API endpoint documentation
- Looking for code examples

**Key Sections:**
- [Authentication Flow Overview](AUTHENTICATION_FLOW_GUIDE.md#authentication-flow-overview)
- [API Endpoints Reference](AUTHENTICATION_FLOW_GUIDE.md#api-endpoints-reference)
- [Code Examples](AUTHENTICATION_FLOW_GUIDE.md#code-examples)

---

### 2. **AUTHENTICATION_TROUBLESHOOTING.md** (Debug Guide)
**Purpose:** Quick reference for fixing common authentication issues

**Contents:**
- Common error messages and solutions
- Debugging checklist
- Backend fix commands
- Testing tips

**When to use:**
- Encountering authentication errors
- Need to debug specific issues
- Testing authentication flow

**Key Issues Covered:**
- "403 Forbidden - Access denied to this kitchen"
- "Kitchen ID is required"
- "Token expired"
- "User not found"

---

### 3. **AUTHENTICATION_FLOW_DIAGRAM.md** (Visual Guide)
**Purpose:** Visual representation of authentication flows

**Contents:**
- Flow diagrams for all user types
- Token refresh flow
- Error handling flow
- State machine diagram
- Data flow diagrams

**When to use:**
- Understanding overall flow
- Explaining authentication to team
- Planning implementation

**Key Diagrams:**
- [Complete Authentication Flow](AUTHENTICATION_FLOW_DIAGRAM.md#complete-authentication-flow-all-user-types)
- [Customer Flow](AUTHENTICATION_FLOW_DIAGRAM.md#customer-flow)
- [Kitchen Staff Flow](AUTHENTICATION_FLOW_DIAGRAM.md#kitchen-staff-flow)
- [Driver Flow](AUTHENTICATION_FLOW_DIAGRAM.md#driver-flow)

---

## 🚀 Quick Start

### For First-Time Implementation

1. **Read:** [AUTHENTICATION_FLOW_GUIDE.md](AUTHENTICATION_FLOW_GUIDE.md)
   - Understand the complete flow
   - Review API endpoints
   - Study code examples

2. **Review:** [AUTHENTICATION_FLOW_DIAGRAM.md](AUTHENTICATION_FLOW_DIAGRAM.md)
   - Visualize the flow for your user type
   - Understand state transitions

3. **Implement:** Follow the code examples in the main guide

4. **Test:** Use the testing checklist in the main guide

5. **Debug:** Refer to [AUTHENTICATION_TROUBLESHOOTING.md](AUTHENTICATION_TROUBLESHOOTING.md) if issues arise

---

## ⚡ Critical Implementation Points

### 🔴 MUST DO

1. **Always call `/api/auth/sync` immediately after Firebase authentication**
   ```javascript
   // After Firebase OTP verification
   const token = await firebaseUser.getIdToken();

   // CRITICAL: Call sync first
   await fetch('/api/auth/sync', {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${token}` }
   });
   ```

2. **Handle token refresh (tokens expire after 1 hour)**
   ```javascript
   // Force refresh token
   const freshToken = await auth().currentUser.getIdToken(true);
   ```

3. **Check approval statuses for Kitchen Staff and Drivers**
   ```javascript
   if (syncData.data.kitchenApprovalStatus === 'PENDING') {
     showPendingScreen();
   }
   ```

### 🔴 MUST NOT DO

1. ❌ Skip the `/api/auth/sync` endpoint
2. ❌ Cache user data without refreshing
3. ❌ Ignore approval statuses
4. ❌ Use expired tokens
5. ❌ Assume user exists in database

---

## 🎯 User Type Implementation Guide

### Customer Implementation
**Endpoints:**
- `POST /api/auth/sync` - Check if user exists
- `POST /api/auth/register` - Register new customer
- `GET /api/auth/me` - Get profile
- `PUT /api/auth/profile` - Update profile

**Key Points:**
- Simplest flow
- No approval required
- Profile can be completed later

**See:** [Customer Flow Diagram](AUTHENTICATION_FLOW_DIAGRAM.md#customer-flow)

---

### Kitchen Staff Implementation
**Endpoints:**
- `POST /api/auth/sync` - Check user & kitchen status
- `POST /api/auth/register-kitchen` - Register kitchen
- `GET /api/kitchens/dashboard` - Access dashboard
- `GET /api/kitchens/my-kitchen` - Get kitchen details

**Key Points:**
- Requires admin approval
- Kitchen must be ACTIVE before access
- Check `kitchenApprovalStatus` in sync response
- Show pending/rejected screens appropriately

**See:** [Kitchen Staff Flow Diagram](AUTHENTICATION_FLOW_DIAGRAM.md#kitchen-staff-flow)

---

### Driver Implementation
**Endpoints:**
- `POST /api/auth/sync` - Check approval status
- `POST /api/auth/register-driver` - Register driver
- Driver-specific endpoints after approval

**Key Points:**
- Requires admin approval
- Must upload documents (license, vehicle docs)
- Check `approvalStatus` in sync response
- Show pending/rejected screens appropriately

**See:** [Driver Flow Diagram](AUTHENTICATION_FLOW_DIAGRAM.md#driver-flow)

---

## 🐛 Common Issues & Quick Fixes

| Issue | Quick Fix | Documentation |
|-------|-----------|---------------|
| 403 Forbidden error | Call `/api/auth/sync` first | [Link](AUTHENTICATION_TROUBLESHOOTING.md#error-403-forbidden---access-denied-to-this-kitchen) |
| Token expired | Refresh with `getIdToken(true)` | [Link](AUTHENTICATION_TROUBLESHOOTING.md#error-401-unauthorized---token-expired) |
| Kitchen ID required | Check kitchen approval status | [Link](AUTHENTICATION_TROUBLESHOOTING.md#error-400-bad-request---kitchen-id-is-required) |
| User not found | Verify phone format consistency | [Link](AUTHENTICATION_TROUBLESHOOTING.md#error-user-not-found-after-registration) |

---

## 📋 Testing Checklist

### Before Production Release

- [ ] OTP flow works correctly
- [ ] `/api/auth/sync` called after Firebase auth
- [ ] New user registration works for all types
- [ ] Existing user login works for all roles
- [ ] Token refresh implemented
- [ ] Approval pending states handled
- [ ] Rejection screens implemented
- [ ] Error messages user-friendly
- [ ] FCM token registration works
- [ ] Profile updates work correctly
- [ ] Logout clears all data

**Detailed Checklist:** [Testing Section](AUTHENTICATION_FLOW_GUIDE.md#testing-checklist)

---

## 🔍 Debugging Guide

### When Authentication Fails

1. **Check Firebase Authentication**
   - Is user signed in to Firebase?
   - Is phone number correct?
   - Is Firebase UID present?

2. **Check Sync Call**
   - Was `/api/auth/sync` called?
   - What was the response?
   - Is `firebaseUid` set in database?

3. **Check Token**
   - Is token valid?
   - Is token expired?
   - Is Authorization header correct?

4. **Check User Status**
   - User role correct?
   - User status ACTIVE?
   - Approval status (if applicable)?

**Full Debugging Guide:** [AUTHENTICATION_TROUBLESHOOTING.md](AUTHENTICATION_TROUBLESHOOTING.md#debugging-checklist)

---

## 💻 Code Examples

### Complete Authentication Flow
```javascript
import auth from '@react-native-firebase/auth';

// 1. Send OTP
const confirmation = await auth().signInWithPhoneNumber('+919876543210');

// 2. Verify OTP
const result = await confirmation.confirm('123456');

// 3. Get token
const token = await result.user.getIdToken();

// 4. CRITICAL: Sync with backend
const syncResponse = await fetch('https://api.tiffsy.com/api/auth/sync', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const syncData = await syncResponse.json();

// 5. Handle response
if (syncData.data.isNewUser) {
  // Navigate to registration
  navigation.navigate('Register');
} else {
  // Navigate based on role
  const user = syncData.data.user;

  switch(user.role) {
    case 'CUSTOMER':
      navigation.navigate('CustomerHome');
      break;
    case 'KITCHEN_STAFF':
      if (syncData.data.kitchenApprovalStatus === 'PENDING') {
        navigation.navigate('KitchenPending');
      } else {
        navigation.navigate('KitchenDashboard');
      }
      break;
    case 'DRIVER':
      if (syncData.data.approvalStatus === 'APPROVED') {
        navigation.navigate('DriverHome');
      } else {
        navigation.navigate('DriverPending');
      }
      break;
  }
}
```

**More Examples:** [Code Examples Section](AUTHENTICATION_FLOW_GUIDE.md#code-examples)

---

## 🛠 API Quick Reference

### Base URL
```
https://api.tiffsy.com/api
```

### Authentication Endpoints

| Endpoint | Method | Auth Required | Purpose |
|----------|--------|---------------|---------|
| `/auth/sync` | POST | Firebase Token | Check if user exists, link Firebase UID |
| `/auth/register` | POST | Firebase Token | Register new customer |
| `/auth/register-kitchen` | POST | Firebase Token | Register kitchen staff & kitchen |
| `/auth/register-driver` | POST | Firebase Token | Register driver |
| `/auth/me` | GET | Firebase Token | Get current user profile |
| `/auth/profile` | PUT | Firebase Token | Update user profile |
| `/auth/fcm-token` | POST | Firebase Token | Register FCM token |

**Full API Reference:** [API Endpoints Reference](AUTHENTICATION_FLOW_GUIDE.md#api-endpoints-reference)

---

## 📞 Support

### Getting Help

**For Implementation Questions:**
- Review the [Main Guide](AUTHENTICATION_FLOW_GUIDE.md)
- Check [Flow Diagrams](AUTHENTICATION_FLOW_DIAGRAM.md)

**For Issues/Errors:**
- Check [Troubleshooting Guide](AUTHENTICATION_TROUBLESHOOTING.md)
- Follow the debugging checklist

**For Backend Support:**
- Email: backend@tiffsy.com
- Slack: #backend-support
- Include: error message, phone number, logs, steps to reproduce

---

## 📊 Documentation Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| AUTHENTICATION_FLOW_GUIDE.md | ✅ Complete | 2026-01-19 |
| AUTHENTICATION_TROUBLESHOOTING.md | ✅ Complete | 2026-01-19 |
| AUTHENTICATION_FLOW_DIAGRAM.md | ✅ Complete | 2026-01-19 |

---

## 🔄 Recent Changes

### January 19, 2026
- Created comprehensive authentication documentation
- Added flow diagrams for all user types
- Included troubleshooting guide
- Added code examples and testing checklist

---

## 📝 Feedback

If you find any issues with this documentation or have suggestions for improvement:

1. Create an issue in the GitHub repository
2. Contact the backend team
3. Submit a pull request with improvements

---

**Documentation Version:** 1.0
**API Version:** v1
**Last Updated:** January 19, 2026
**Maintained By:** Backend Team
