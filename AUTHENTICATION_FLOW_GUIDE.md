# Authentication Flow Guide for Frontend

## Overview
This document explains the complete authentication flow for all user types in the Tiffsy backend, including the proper sequence of API calls and error handling.

---

## Table of Contents
1. [Authentication Flow Overview](#authentication-flow-overview)
2. [User Roles](#user-roles)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [Error Handling](#error-handling)
6. [Common Issues & Solutions](#common-issues--solutions)
7. [Code Examples](#code-examples)

---

## Authentication Flow Overview

### High-Level Flow
```
1. User enters phone number
2. Firebase sends OTP
3. User enters OTP
4. Firebase verifies OTP → Returns ID Token
5. Frontend calls /api/auth/sync with token
6. Backend checks if user exists and returns profile
7. If new user → redirect to registration
8. If existing user → proceed to app
```

### Critical Rule
⚠️ **ALWAYS call `/api/auth/sync` immediately after Firebase OTP verification**

This endpoint:
- Links Firebase UID to the user's database record
- Updates last login timestamp
- Returns user profile and role information
- Determines if user needs to complete registration

---

## User Roles

### Role Types
| Role | Description | Registration Endpoint | Approval Required |
|------|-------------|----------------------|-------------------|
| `CUSTOMER` | Regular app users | `/api/auth/register` | No |
| `KITCHEN_STAFF` | Kitchen staff managing orders | `/api/auth/register-kitchen` | Yes (Admin) |
| `DRIVER` | Delivery drivers | `/api/auth/register-driver` | Yes (Admin) |
| `ADMIN` | System administrators | Manual creation only | N/A |

---

## Step-by-Step Implementation

### Phase 1: Firebase OTP Authentication

```javascript
// 1. Send OTP via Firebase
const confirmation = await auth().signInWithPhoneNumber(phoneNumber);

// 2. Verify OTP
const result = await confirmation.confirm(otpCode);

// 3. Get Firebase ID Token
const idToken = await result.user.getIdToken();
```

### Phase 2: Sync with Backend

**CRITICAL:** This must happen immediately after Firebase authentication.

```javascript
// Call sync endpoint
const response = await fetch('https://your-api.com/api/auth/sync', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    // Optional: can send device info, etc.
  })
});

const data = await response.json();
```

### Phase 3: Handle Sync Response

```javascript
if (data.success) {
  if (data.data.isNewUser) {
    // User doesn't exist - redirect to registration
    navigation.navigate('Registration');
  } else {
    // Existing user - handle based on role and status
    const user = data.data.user;

    switch(user.role) {
      case 'CUSTOMER':
        // Check if profile is complete
        if (data.data.isProfileComplete) {
          navigation.navigate('CustomerHome');
        } else {
          navigation.navigate('CompleteProfile');
        }
        break;

      case 'KITCHEN_STAFF':
        // Check kitchen approval status
        if (data.data.kitchenApprovalStatus === 'PENDING') {
          navigation.navigate('KitchenApprovalPending', {
            message: data.data.message,
            kitchen: data.data.kitchen
          });
        } else if (data.data.kitchenApprovalStatus === 'REJECTED') {
          navigation.navigate('KitchenRejected', {
            reason: data.data.rejectionReason
          });
        } else {
          navigation.navigate('KitchenDashboard');
        }
        break;

      case 'DRIVER':
        // Check driver approval status
        if (data.data.approvalStatus === 'PENDING') {
          navigation.navigate('DriverApprovalPending', {
            message: data.data.message
          });
        } else if (data.data.approvalStatus === 'REJECTED') {
          navigation.navigate('DriverRejected', {
            reason: data.data.rejectionReason
          });
        } else if (data.data.approvalStatus === 'APPROVED') {
          navigation.navigate('DriverHome');
        }
        break;

      case 'ADMIN':
        // Admins typically use web portal with username/password
        navigation.navigate('AdminDashboard');
        break;
    }
  }
}
```

### Phase 4: Registration (if new user)

#### For Customers
```javascript
const response = await fetch('https://your-api.com/api/auth/register', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: "John Doe",
    email: "john@example.com", // Optional
    dietaryPreferences: ["VEG", "VEGAN"] // Optional: VEG, NON_VEG, VEGAN, JAIN, EGGETARIAN
  })
});
```

#### For Kitchen Staff
```javascript
const response = await fetch('https://your-api.com/api/auth/register-kitchen', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: "Kitchen Manager Name",
    kitchenName: "My Cloud Kitchen",
    ownerName: "Owner Name",
    ownerPhone: "9876543210",
    address: {
      addressLine1: "123 Main Street",
      addressLine2: "Near Park", // Optional
      locality: "Downtown",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      coordinates: {
        latitude: 19.0760,
        longitude: 72.8777
      }
    },
    zonesServed: ["zone_id_1", "zone_id_2"], // Array of zone ObjectIds
    cuisineTypes: ["North Indian", "Chinese"], // Optional
    contactPhone: "9876543210",
    contactEmail: "kitchen@example.com", // Optional
    description: "Delicious home-style food", // Optional
    operatingHours: {
      lunch: {
        startTime: "11:00",
        endTime: "15:00"
      },
      dinner: {
        startTime: "18:00",
        endTime: "22:00"
      },
      onDemand: {
        startTime: "09:00",
        endTime: "23:00",
        isAlwaysOpen: false
      }
    }
  })
});
```

#### For Drivers
```javascript
const response = await fetch('https://your-api.com/api/auth/register-driver', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: "Driver Name",
    email: "driver@example.com", // Optional
    driverDetails: {
      licenseNumber: "MH01234567890",
      licenseImageUrl: "https://cloudinary.com/...",
      licenseExpiryDate: "2026-12-31",
      vehicleName: "Honda Activa",
      vehicleNumber: "MH01AB1234",
      vehicleType: "SCOOTER", // BIKE, SCOOTER, BICYCLE, OTHER
      vehicleDocuments: [
        {
          type: "RC", // RC, INSURANCE, PUC, OTHER
          imageUrl: "https://cloudinary.com/...",
          expiryDate: "2025-12-31" // Optional
        }
      ]
    }
  })
});
```

---

## API Endpoints Reference

### Base URL
```
https://your-api.com/api
```

### Authentication Endpoints

#### 1. Sync User (REQUIRED after Firebase auth)
```
POST /api/auth/sync
Authorization: Bearer {firebase_id_token}
```

**Request Body:** Empty or optional metadata
```json
{}
```

**Response (Existing User):**
```json
{
  "success": true,
  "message": "User authenticated",
  "data": {
    "user": {
      "_id": "user_id",
      "phone": "9800000001",
      "name": "User Name",
      "role": "CUSTOMER",
      "status": "ACTIVE",
      "email": "user@example.com",
      "dietaryPreferences": ["VEG"],
      "profileImage": "url",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "isNewUser": false,
    "isProfileComplete": true
  }
}
```

**Response (New User):**
```json
{
  "success": true,
  "message": "User not found",
  "data": {
    "user": null,
    "isNewUser": true,
    "isProfileComplete": false
  }
}
```

**Response (Kitchen Staff - Pending Approval):**
```json
{
  "success": true,
  "message": "Kitchen staff authenticated - kitchen pending",
  "data": {
    "user": { /* user object */ },
    "kitchen": {
      "_id": "kitchen_id",
      "name": "Demo Kitchen",
      "code": "KIT-ABC123",
      "status": "PENDING_APPROVAL"
    },
    "isNewUser": false,
    "isProfileComplete": true,
    "kitchenApprovalStatus": "PENDING",
    "message": "Your kitchen registration is pending admin approval."
  }
}
```

**Response (Driver - Pending Approval):**
```json
{
  "success": true,
  "message": "Driver pending approval",
  "data": {
    "user": { /* user object */ },
    "isNewUser": false,
    "isProfileComplete": true,
    "approvalStatus": "PENDING",
    "message": "Your driver registration is pending admin approval."
  }
}
```

#### 2. Register Customer
```
POST /api/auth/register
Authorization: Bearer {firebase_id_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "dietaryPreferences": ["VEG", "VEGAN"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": { /* full user object */ },
    "isNewUser": false,
    "isProfileComplete": true
  }
}
```

#### 3. Register Kitchen Staff
```
POST /api/auth/register-kitchen
Authorization: Bearer {firebase_id_token}
Content-Type: application/json
```

**Request Body:** See Phase 4 example above

**Response:**
```json
{
  "success": true,
  "message": "Kitchen registered successfully",
  "data": {
    "user": { /* user object with role: KITCHEN_STAFF */ },
    "kitchen": {
      "_id": "kitchen_id",
      "name": "My Cloud Kitchen",
      "code": "KIT-XYZ789",
      "status": "PENDING_APPROVAL",
      "type": "PARTNER"
    },
    "isNewUser": false,
    "requiresApproval": true,
    "message": "Kitchen registration submitted. Awaiting admin approval."
  }
}
```

#### 4. Register Driver
```
POST /api/auth/register-driver
Authorization: Bearer {firebase_id_token}
Content-Type: application/json
```

**Request Body:** See Phase 4 example above

**Response:**
```json
{
  "success": true,
  "message": "Driver registered successfully",
  "data": {
    "user": {
      /* user object with role: DRIVER */
      "approvalStatus": "PENDING"
    },
    "isNewUser": false,
    "requiresApproval": true,
    "message": "Driver registration submitted. Awaiting admin approval."
  }
}
```

#### 5. Get Current User Profile
```
GET /api/auth/me
Authorization: Bearer {firebase_id_token}
```

**Response:**
```json
{
  "success": true,
  "message": "User profile retrieved",
  "data": {
    "user": { /* full user object */ }
  }
}
```

#### 6. Update Profile
```
PUT /api/auth/profile
Authorization: Bearer {firebase_id_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "email": "newemail@example.com",
  "dietaryPreferences": ["VEG"],
  "profileImage": "https://cloudinary.com/..."
}
```

#### 7. Register FCM Token (for push notifications)
```
POST /api/auth/fcm-token
Authorization: Bearer {firebase_id_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "token": "fcm_device_token_here"
}
```

---

## Error Handling

### Common HTTP Status Codes

| Status Code | Meaning | Action |
|-------------|---------|--------|
| 200 | Success | Process response data |
| 400 | Bad Request | Check request body/params |
| 401 | Unauthorized | Refresh Firebase token and retry |
| 403 | Forbidden | User suspended/inactive or access denied |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Show error message, retry later |

### Error Response Format
```json
{
  "success": false,
  "message": "Error message",
  "data": null,
  "error": "Detailed error description"
}
```

### Handling Token Expiration
Firebase ID tokens expire after 1 hour. Always refresh before making API calls:

```javascript
async function getValidToken() {
  const user = auth().currentUser;
  if (!user) {
    throw new Error('Not authenticated');
  }

  // Force refresh if token is close to expiration
  return await user.getIdToken(true);
}

// Use in API calls
const token = await getValidToken();
fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## Common Issues & Solutions

### Issue 1: "403 Forbidden - Access denied to this kitchen"

**Cause:** Kitchen staff user's `firebaseUid` is not linked in the database.

**Solution:** Ensure `/api/auth/sync` is called immediately after Firebase OTP verification.

```javascript
// ❌ WRONG - Skipping sync
const token = await firebaseUser.getIdToken();
fetch('/api/kitchens/dashboard', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// ✅ CORRECT - Call sync first
const token = await firebaseUser.getIdToken();

// 1. Sync user
const syncResponse = await fetch('/api/auth/sync', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
const syncData = await syncResponse.json();

// 2. Then access dashboard
const dashboardResponse = await fetch('/api/kitchens/dashboard', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Issue 2: "User not found" after registration

**Cause:** Registration was called but sync wasn't called again afterward.

**Solution:** After successful registration, call `/api/auth/sync` again to get the updated user profile.

```javascript
// 1. Register user
const registerResponse = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ name: 'John Doe' })
});

// 2. Sync again to get updated profile
const syncResponse = await fetch('/api/auth/sync', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});

const userData = await syncResponse.json();
// Now proceed to home screen
```

### Issue 3: "Kitchen ID is required" error

**Cause:** Kitchen staff trying to access dashboard before kitchen is approved.

**Solution:** Check `kitchenApprovalStatus` in sync response:

```javascript
const syncData = await syncResponse.json();

if (syncData.data.kitchenApprovalStatus === 'PENDING') {
  // Show pending approval screen
  showPendingScreen(syncData.data.message);
} else if (syncData.data.kitchenApprovalStatus === 'REJECTED') {
  // Show rejection screen with reason
  showRejectionScreen(syncData.data.rejectionReason);
} else {
  // Kitchen is approved, proceed to dashboard
  navigateToDashboard();
}
```

### Issue 4: Driver can't access app

**Cause:** Driver approval status not checked.

**Solution:** Always check `approvalStatus` for drivers:

```javascript
const user = syncData.data.user;

if (user.role === 'DRIVER') {
  switch(syncData.data.approvalStatus) {
    case 'PENDING':
      showMessage('Your registration is pending approval');
      navigateToPendingScreen();
      break;
    case 'REJECTED':
      showMessage(`Registration rejected: ${syncData.data.rejectionReason}`);
      navigateToRejectionScreen();
      break;
    case 'APPROVED':
      navigateToDriverDashboard();
      break;
  }
}
```

---

## Code Examples

### Complete Authentication Flow (React Native)

```javascript
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://your-api.com/api';

// Step 1: Send OTP
export const sendOTP = async (phoneNumber) => {
  try {
    // Format: +919876543210
    const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
    return { success: true, confirmation };
  } catch (error) {
    console.error('Send OTP error:', error);
    return { success: false, error: error.message };
  }
};

// Step 2: Verify OTP
export const verifyOTP = async (confirmation, otpCode) => {
  try {
    const result = await confirmation.confirm(otpCode);
    return { success: true, user: result.user };
  } catch (error) {
    console.error('Verify OTP error:', error);
    return { success: false, error: error.message };
  }
};

// Step 3: Sync with backend (CRITICAL)
export const syncUser = async () => {
  try {
    const user = auth().currentUser;
    if (!user) {
      throw new Error('Not authenticated with Firebase');
    }

    const idToken = await user.getIdToken(true);

    const response = await fetch(`${API_BASE_URL}/auth/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Sync failed');
    }

    // Store user data locally
    if (data.data.user) {
      await AsyncStorage.setItem('user', JSON.stringify(data.data.user));
    }

    return data.data;
  } catch (error) {
    console.error('Sync user error:', error);
    throw error;
  }
};

// Step 4: Register new user
export const registerCustomer = async (userData) => {
  try {
    const user = auth().currentUser;
    const idToken = await user.getIdToken(true);

    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    // Sync again to get updated profile
    return await syncUser();
  } catch (error) {
    console.error('Register customer error:', error);
    throw error;
  }
};

// Complete authentication handler
export const handleAuthentication = async (phoneNumber, otpCode) => {
  try {
    // 1. Send OTP
    const otpResult = await sendOTP(phoneNumber);
    if (!otpResult.success) {
      throw new Error(otpResult.error);
    }

    // 2. Verify OTP
    const verifyResult = await verifyOTP(otpResult.confirmation, otpCode);
    if (!verifyResult.success) {
      throw new Error(verifyResult.error);
    }

    // 3. Sync with backend
    const syncData = await syncUser();

    // 4. Handle based on user state
    if (syncData.isNewUser) {
      // New user - redirect to registration
      return {
        action: 'REGISTER',
        data: syncData
      };
    } else {
      // Existing user - check role and status
      const user = syncData.user;

      // Check for approval statuses
      if (user.role === 'KITCHEN_STAFF' && syncData.kitchenApprovalStatus) {
        if (syncData.kitchenApprovalStatus === 'PENDING') {
          return {
            action: 'KITCHEN_PENDING',
            data: syncData
          };
        } else if (syncData.kitchenApprovalStatus === 'REJECTED') {
          return {
            action: 'KITCHEN_REJECTED',
            data: syncData
          };
        }
      }

      if (user.role === 'DRIVER' && syncData.approvalStatus) {
        if (syncData.approvalStatus === 'PENDING') {
          return {
            action: 'DRIVER_PENDING',
            data: syncData
          };
        } else if (syncData.approvalStatus === 'REJECTED') {
          return {
            action: 'DRIVER_REJECTED',
            data: syncData
          };
        }
      }

      // User is active and approved
      return {
        action: 'NAVIGATE_HOME',
        data: syncData,
        role: user.role
      };
    }
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
};
```

### API Helper Functions

```javascript
// Create reusable API client
class APIClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async getAuthToken() {
    const user = auth().currentUser;
    if (!user) {
      throw new Error('Not authenticated');
    }
    return await user.getIdToken(true);
  }

  async request(endpoint, options = {}) {
    try {
      const token = await this.getAuthToken();

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error(`API request error [${endpoint}]:`, error);
      throw error;
    }
  }

  // Auth endpoints
  async sync() {
    return this.request('/auth/sync', { method: 'POST' });
  }

  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async registerKitchen(kitchenData) {
    return this.request('/auth/register-kitchen', {
      method: 'POST',
      body: JSON.stringify(kitchenData)
    });
  }

  async registerDriver(driverData) {
    return this.request('/auth/register-driver', {
      method: 'POST',
      body: JSON.stringify(driverData)
    });
  }

  async getProfile() {
    return this.request('/auth/me', { method: 'GET' });
  }

  async updateProfile(profileData) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  }

  // Kitchen endpoints
  async getKitchenDashboard() {
    return this.request('/kitchens/dashboard', { method: 'GET' });
  }

  async getMyKitchen() {
    return this.request('/kitchens/my-kitchen', { method: 'GET' });
  }
}

// Usage
const api = new APIClient('https://your-api.com/api');

// In your component
const handleLogin = async () => {
  try {
    const syncData = await api.sync();

    if (syncData.data.isNewUser) {
      navigation.navigate('Register');
    } else {
      // Get kitchen dashboard for kitchen staff
      if (syncData.data.user.role === 'KITCHEN_STAFF') {
        const dashboard = await api.getKitchenDashboard();
        navigation.navigate('KitchenDashboard', { dashboard: dashboard.data });
      }
    }
  } catch (error) {
    Alert.alert('Error', error.message);
  }
};
```

---

## Testing Checklist

### For Frontend Developers

- [ ] OTP flow works correctly
- [ ] `/api/auth/sync` is called immediately after Firebase auth
- [ ] New user registration flows work (Customer, Kitchen, Driver)
- [ ] Existing user login works for all roles
- [ ] Token refresh logic is implemented
- [ ] Approval pending states are handled (Kitchen, Driver)
- [ ] Error messages are displayed properly
- [ ] FCM token registration works
- [ ] Profile update functionality works
- [ ] Logout clears all stored data

### Test User Credentials

```
Customer: +919800000101
Kitchen Staff: +919800000001 (Demo Kitchen assigned)
Driver: Create via /api/auth/register-driver
```

---

## Support & Questions

If you encounter issues not covered in this guide:

1. Check the browser/app console for error messages
2. Verify Firebase token is valid and not expired
3. Ensure `/api/auth/sync` was called after Firebase auth
4. Check backend logs for detailed error information
5. Contact backend team with:
   - Error message
   - User phone number
   - Request/response logs
   - Steps to reproduce

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-19 | 1.0 | Initial documentation |

---

**Last Updated:** January 19, 2026
**Maintained By:** Backend Team
**API Version:** v1
