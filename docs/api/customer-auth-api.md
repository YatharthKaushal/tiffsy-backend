# Customer Authentication API

> **PROMPT**: Implement Firebase OTP authentication for the customer app. User enters phone number, receives OTP via Firebase Auth, verifies OTP, then syncs with backend. If new user, show registration form. If existing user, navigate to home. Store Firebase ID token and use it for all authenticated API calls. Implement FCM token registration for push notifications.

---

## Authentication Flow

```
1. User enters phone → Firebase sends OTP
2. User enters OTP → Firebase verifies, returns ID Token
3. App calls POST /api/auth/sync with Firebase ID Token
   → If isNewUser: true → Show registration form
   → If isNewUser: false → Navigate to home
4. (If new) App calls POST /api/auth/register with profile data
5. App stores user data, registers FCM token
```

---

## Headers

All endpoints (except sync/register) require:
```
Authorization: Bearer <firebase_id_token>
```

For sync and register, use Firebase ID Token in Authorization header (handled by `firebaseAuthMiddleware`).

---

## Endpoints

### 1. Sync User (Check if Exists)

**POST** `/api/auth/sync`

Check if user exists after Firebase OTP verification.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Request Body:**
```json
{}
```

**Response (200) - Existing User:**
```json
{
  "success": true,
  "message": "User authenticated",
  "data": {
    "user": {
      "_id": "6789user123abc456789ab01",
      "phone": "9876543210",
      "role": "CUSTOMER",
      "name": "John Doe",
      "email": "john@example.com",
      "dietaryPreferences": ["VEG"],
      "profileImage": "https://cdn.tiffsy.com/users/john.jpg",
      "status": "ACTIVE",
      "lastLoginAt": "2025-01-10T08:00:00.000Z",
      "createdAt": "2024-12-01T10:00:00.000Z"
    },
    "isNewUser": false,
    "isProfileComplete": true
  }
}
```

**Response (200) - New User:**
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

---

### 2. Register New User

**POST** `/api/auth/register`

Create new customer account after Firebase OTP verification.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "dietaryPreferences": ["VEG"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Min 2, max 100 chars |
| email | string | No | Valid email format |
| dietaryPreferences | array | No | `VEG`, `NON_VEG`, `VEGAN`, `JAIN`, `EGGETARIAN` |

**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "6789user123abc456789ab02",
      "phone": "9876543211",
      "role": "CUSTOMER",
      "name": "John Doe",
      "email": "john@example.com",
      "dietaryPreferences": ["VEG"],
      "status": "ACTIVE",
      "lastLoginAt": "2025-01-10T10:00:00.000Z",
      "createdAt": "2025-01-10T10:00:00.000Z"
    },
    "isProfileComplete": true
  }
}
```

**Response (409) - User Exists:**
```json
{
  "success": false,
  "message": "User already exists",
  "data": {
    "user": {...},
    "isProfileComplete": true
  }
}
```

---

### 3. Get Current User Profile

**GET** `/api/auth/me`

Get authenticated user's profile.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "User profile",
  "data": {
    "user": {
      "_id": "6789user123abc456789ab01",
      "phone": "9876543210",
      "role": "CUSTOMER",
      "name": "John Doe",
      "email": "john@example.com",
      "dietaryPreferences": ["VEG", "EGGETARIAN"],
      "profileImage": "https://cdn.tiffsy.com/users/john.jpg",
      "status": "ACTIVE",
      "lastLoginAt": "2025-01-10T08:00:00.000Z",
      "createdAt": "2024-12-01T10:00:00.000Z"
    }
  }
}
```

---

### 4. Update Profile

**PUT** `/api/auth/profile`

Update user profile details.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Request Body:**
```json
{
  "name": "John Doe Updated",
  "email": "john.new@example.com",
  "dietaryPreferences": ["VEG", "JAIN"],
  "profileImage": "https://cdn.tiffsy.com/users/john-new.jpg"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Min 2, max 100 chars |
| email | string | No | Valid email or null |
| dietaryPreferences | array | No | Dietary preferences |
| profileImage | string | No | Valid URL or null |

**Response (200):**
```json
{
  "success": true,
  "message": "Profile updated",
  "data": {
    "user": {
      "_id": "6789user123abc456789ab01",
      "phone": "9876543210",
      "name": "John Doe Updated",
      "email": "john.new@example.com",
      "dietaryPreferences": ["VEG", "JAIN"],
      "profileImage": "https://cdn.tiffsy.com/users/john-new.jpg"
    },
    "isProfileComplete": true
  }
}
```

---

### 5. Register FCM Token

**POST** `/api/auth/fcm-token`

Register device for push notifications.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Request Body:**
```json
{
  "fcmToken": "fMC8kJ2K3L4M5N6O7P8Q9R0S...",
  "deviceId": "device-uuid-12345"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| fcmToken | string | Yes | Firebase Cloud Messaging token |
| deviceId | string | No | Unique device identifier |

**Response (200):**
```json
{
  "success": true,
  "message": "FCM token registered"
}
```

---

### 6. Remove FCM Token (Logout)

**DELETE** `/api/auth/fcm-token`

Remove FCM token on logout.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Request Body:**
```json
{
  "fcmToken": "fMC8kJ2K3L4M5N6O7P8Q9R0S..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "FCM token removed"
}
```

---

## Data Model

```typescript
interface User {
  _id: string;
  phone: string;                    // 10 digits
  role: "CUSTOMER";
  name?: string;
  email?: string;
  dietaryPreferences?: ("VEG" | "NON_VEG" | "VEGAN" | "JAIN" | "EGGETARIAN")[];
  profileImage?: string;
  firebaseUid?: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DELETED";
  lastLoginAt?: Date;
  fcmTokens: { token: string; deviceId?: string; registeredAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
}
```

---

## UI Implementation Notes

1. **Login Screen**: Phone input with country code (+91), Firebase OTP flow
2. **OTP Screen**: 6-digit input, auto-submit on complete, resend timer (30s)
3. **Registration Screen**: Name (required), email (optional), dietary preferences (multi-select chips)
4. **Profile Screen**: Edit name, email, preferences, profile image
5. **Storage**: Store Firebase ID token for API calls, refresh before expiry
6. **Error Handling**: Handle Firebase errors (invalid OTP, too many attempts, etc.)
