# Driver Profile Management API Documentation

## Overview
Complete API specification for driver profile management in the food delivery application. Drivers can view and update their profile information, vehicle details, and request document updates.

---

## Table of Contents
1. [Base URL & Authentication](#base-url--authentication)
2. [API Endpoints Overview](#api-endpoints-overview)
3. [Get Driver Profile](#1-get-driver-profile)
4. [Update Driver Profile](#2-update-driver-profile)
5. [Update Vehicle Details](#3-update-vehicle-details)
6. [Update Profile Image](#4-update-profile-image)
7. [Request Document Update](#5-request-document-update)
8. [Get Driver Statistics](#6-get-driver-statistics)
9. [Error Handling](#error-handling)
10. [Integration Guide](#integration-guide)

---

## Base URL & Authentication

### Base URL
```
http://localhost:5005/api
```

### Authentication
All driver endpoints require authentication via Bearer token.

**Header Required:**
```http
Authorization: Bearer <JWT_TOKEN>
```

**User Role Required:** `DRIVER` or `ADMIN`

---

## API Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/driver/profile` | Get complete driver profile with stats |
| PUT | `/api/driver/profile` | Update basic profile (name, email, image) |
| PATCH | `/api/driver/vehicle` | Update vehicle details |
| PATCH | `/api/driver/profile/image` | Update profile image only |
| POST | `/api/driver/documents/request` | Request sensitive document update |
| GET | `/api/driver/stats` | Get delivery statistics |

---

## 1. Get Driver Profile

### Endpoint
```http
GET /api/driver/profile
```

### Description
Retrieves complete driver profile including personal information, vehicle details, approval status, and delivery statistics.

### Request

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Query Parameters
None

### Response

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Driver profile retrieved",
  "data": {
    "profile": {
      "_id": "673d4e8f1234567890abcdef",
      "phone": "9876543210",
      "name": "Rajesh Kumar",
      "email": "rajesh.kumar@example.com",
      "profileImage": "https://cloudinary.com/image123.jpg",
      "status": "ACTIVE",
      "approvalStatus": "APPROVED",
      "driverDetails": {
        "licenseNumber": "DL1234567890",
        "licenseImageUrl": "https://cloudinary.com/license123.jpg",
        "licenseExpiryDate": "2026-12-31T00:00:00.000Z",
        "vehicleName": "Honda Activa",
        "vehicleNumber": "DL01AB1234",
        "vehicleType": "SCOOTER",
        "vehicleDocuments": [
          {
            "type": "RC",
            "imageUrl": "https://cloudinary.com/rc123.jpg",
            "expiryDate": "2027-06-30T00:00:00.000Z"
          },
          {
            "type": "INSURANCE",
            "imageUrl": "https://cloudinary.com/insurance123.jpg",
            "expiryDate": "2025-12-31T00:00:00.000Z"
          }
        ]
      },
      "lastLoginAt": "2026-01-15T10:30:00.000Z",
      "createdAt": "2025-06-01T08:00:00.000Z",
      "updatedAt": "2026-01-15T10:30:00.000Z"
    },
    "stats": {
      "totalDeliveries": 156,
      "deliveredCount": 148,
      "failedCount": 3,
      "activeCount": 2,
      "successRate": 94.87
    }
  }
}
```

#### Response Fields

**Profile Object:**

| Field | Type | Description |
|-------|------|-------------|
| `_id` | String | Driver's unique ID |
| `phone` | String | Driver's phone number (10 digits) |
| `name` | String | Driver's full name |
| `email` | String | Driver's email address |
| `profileImage` | String | Profile image URL |
| `status` | String | Account status: `ACTIVE`, `INACTIVE`, `SUSPENDED`, `DELETED` |
| `approvalStatus` | String | Approval status: `PENDING`, `APPROVED`, `REJECTED` |
| `driverDetails` | Object | Vehicle and document details |
| `driverDetails.licenseNumber` | String | Driving license number |
| `driverDetails.licenseImageUrl` | String | License image URL |
| `driverDetails.licenseExpiryDate` | Date | License expiry date |
| `driverDetails.vehicleName` | String | Vehicle name/model |
| `driverDetails.vehicleNumber` | String | Vehicle registration number |
| `driverDetails.vehicleType` | String | `BIKE`, `SCOOTER`, `BICYCLE`, `OTHER` |
| `driverDetails.vehicleDocuments` | Array | Vehicle documents (RC, Insurance, PUC) |
| `lastLoginAt` | Date | Last login timestamp |
| `createdAt` | Date | Account creation date |
| `updatedAt` | Date | Last update timestamp |

**Stats Object:**

| Field | Type | Description |
|-------|------|-------------|
| `totalDeliveries` | Number | Total orders assigned |
| `deliveredCount` | Number | Successfully delivered orders |
| `failedCount` | Number | Failed deliveries |
| `activeCount` | Number | Currently active deliveries |
| `successRate` | Number | Success percentage (0-100) |

### Example Request

```javascript
const token = localStorage.getItem('driverToken');

fetch('http://localhost:5005/api/driver/profile', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => {
    console.log('Profile:', data.data.profile);
    console.log('Stats:', data.data.stats);
  });
```

---

## 2. Update Driver Profile

### Endpoint
```http
PUT /api/driver/profile
```

### Description
Updates basic driver profile information. Only name, email, and profileImage can be updated through this endpoint.

### Request

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Body Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | String | No | Driver's full name (2-100 chars) |
| `email` | String | No | Valid email address |
| `profileImage` | String | No | Valid image URL |

**Note:** At least one field must be provided.

#### Request Body Example
```json
{
  "name": "Rajesh Kumar Singh",
  "email": "rajesh.new@example.com",
  "profileImage": "https://cloudinary.com/new-image.jpg"
}
```

### Response

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "profile": {
      "_id": "673d4e8f1234567890abcdef",
      "phone": "9876543210",
      "name": "Rajesh Kumar Singh",
      "email": "rajesh.new@example.com",
      "profileImage": "https://cloudinary.com/new-image.jpg",
      "updatedAt": "2026-01-15T11:00:00.000Z"
    }
  }
}
```

### Example Request

```javascript
const updateProfile = async (name, email) => {
  const token = localStorage.getItem('driverToken');

  const response = await fetch('http://localhost:5005/api/driver/profile', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, email })
  });

  return response.json();
};
```

---

## 3. Update Vehicle Details

### Endpoint
```http
PATCH /api/driver/vehicle
```

### Description
Updates vehicle information. Drivers can update vehicle name, number, and type.

### Request

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Body Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `vehicleName` | String | No | Vehicle name/model (2-100 chars) |
| `vehicleNumber` | String | No | Registration number (e.g., DL01AB1234) |
| `vehicleType` | String | No | `BIKE`, `SCOOTER`, `BICYCLE`, `OTHER` |

**Note:** At least one field must be provided.

#### Request Body Example
```json
{
  "vehicleName": "Hero Splendor Plus",
  "vehicleNumber": "DL02CD5678",
  "vehicleType": "BIKE"
}
```

### Response

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Vehicle details updated successfully",
  "data": {
    "vehicleDetails": {
      "vehicleName": "Hero Splendor Plus",
      "vehicleNumber": "DL02CD5678",
      "vehicleType": "BIKE"
    }
  }
}
```

### Validation Rules

**Vehicle Number Format:**
- Pattern: `^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$`
- Example: `DL01AB1234` (State Code + District + Series + Number)
- Automatically converted to uppercase

### Example Request

```javascript
const updateVehicle = async (vehicleName, vehicleNumber, vehicleType) => {
  const token = localStorage.getItem('driverToken');

  const response = await fetch('http://localhost:5005/api/driver/vehicle', {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      vehicleName,
      vehicleNumber,
      vehicleType
    })
  });

  return response.json();
};
```

---

## 4. Update Profile Image

### Endpoint
```http
PATCH /api/driver/profile/image
```

### Description
Updates only the profile image. Useful for quick profile picture changes.

### Request

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Body Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `profileImage` | String | Yes | Valid image URL |

#### Request Body Example
```json
{
  "profileImage": "https://cloudinary.com/new-profile-pic.jpg"
}
```

### Response

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Profile image updated successfully",
  "data": {
    "profileImage": "https://cloudinary.com/new-profile-pic.jpg"
  }
}
```

### Example Request

```javascript
const updateProfileImage = async (imageUrl) => {
  const token = localStorage.getItem('driverToken');

  const response = await fetch('http://localhost:5005/api/driver/profile/image', {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ profileImage: imageUrl })
  });

  return response.json();
};
```

---

## 5. Request Document Update

### Endpoint
```http
POST /api/driver/documents/request
```

### Description
Submit a request to update sensitive documents (license, RC, insurance, PUC). These require admin approval and cannot be directly edited by drivers.

### Request

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Body Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `documentType` | String | Yes | `LICENSE`, `RC`, `INSURANCE`, `PUC`, `OTHER` |
| `reason` | String | Yes | Reason for update (10-500 chars) |
| `currentValue` | String | No | Current document value/number |
| `requestedValue` | String | No | Requested new value/number |

#### Request Body Example
```json
{
  "documentType": "LICENSE",
  "reason": "License number correction - typo in original submission",
  "currentValue": "DL1234567890",
  "requestedValue": "DL1234567891"
}
```

### Response

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Document update request submitted. Admin will review and update your documents.",
  "data": {
    "request": {
      "driverId": "673d4e8f1234567890abcdef",
      "driverName": "Rajesh Kumar",
      "documentType": "LICENSE",
      "reason": "License number correction - typo in original submission",
      "currentValue": "DL1234567890",
      "requestedValue": "DL1234567891",
      "requestedAt": "2026-01-15T11:30:00.000Z"
    }
  }
}
```

### Document Types

| Type | Description |
|------|-------------|
| `LICENSE` | Driving license |
| `RC` | Registration Certificate |
| `INSURANCE` | Vehicle insurance |
| `PUC` | Pollution Under Control certificate |
| `OTHER` | Other documents |

### Example Request

```javascript
const requestDocumentUpdate = async (documentType, reason, currentValue, requestedValue) => {
  const token = localStorage.getItem('driverToken');

  const response = await fetch('http://localhost:5005/api/driver/documents/request', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      documentType,
      reason,
      currentValue,
      requestedValue
    })
  });

  return response.json();
};
```

---

## 6. Get Driver Statistics

### Endpoint
```http
GET /api/driver/stats
```

### Description
Retrieves delivery performance statistics for the driver.

### Request

#### Headers
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Response

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Driver statistics retrieved",
  "data": {
    "stats": {
      "totalDeliveries": 156,
      "deliveredCount": 148,
      "failedCount": 3,
      "activeCount": 2,
      "successRate": 94.87
    }
  }
}
```

### Example Request

```javascript
const getDriverStats = async () => {
  const token = localStorage.getItem('driverToken');

  const response = await fetch('http://localhost:5005/api/driver/stats', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  return response.json();
};
```

---

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error message"
}
```

**Causes:**
- Invalid vehicle number format
- Invalid email format
- Missing required fields
- Invalid document type

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

**Cause:** Missing or invalid JWT token

#### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied. Driver role required."
}
```

**Cause:** User is not a driver

#### 404 Not Found
```json
{
  "success": false,
  "message": "Driver profile not found"
}
```

**Cause:** Driver account doesn't exist or is deleted

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to update profile"
}
```

**Cause:** Server error

---

## Integration Guide

### Complete Profile Management Component

```javascript
// services/driverService.js
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5005/api';

const getAuthToken = () => localStorage.getItem('driverToken');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const driverProfileService = {
  // Get profile
  getProfile: async () => {
    const response = await apiClient.get('/driver/profile');
    return response.data;
  },

  // Update profile
  updateProfile: async (data) => {
    const response = await apiClient.put('/driver/profile', data);
    return response.data;
  },

  // Update vehicle
  updateVehicle: async (data) => {
    const response = await apiClient.patch('/driver/vehicle', data);
    return response.data;
  },

  // Update image
  updateImage: async (imageUrl) => {
    const response = await apiClient.patch('/driver/profile/image', {
      profileImage: imageUrl
    });
    return response.data;
  },

  // Request document update
  requestDocumentUpdate: async (data) => {
    const response = await apiClient.post('/driver/documents/request', data);
    return response.data;
  },

  // Get stats
  getStats: async () => {
    const response = await apiClient.get('/driver/stats');
    return response.data;
  }
};
```

### React Component Example

```javascript
// components/DriverProfile.jsx
import React, { useState, useEffect } from 'react';
import { driverProfileService } from '../services/driverService';

const DriverProfile = () => {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    vehicleName: '',
    vehicleNumber: '',
    vehicleType: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await driverProfileService.getProfile();
      if (response.success) {
        setProfile(response.data.profile);
        setStats(response.data.stats);
        setFormData({
          name: response.data.profile.name || '',
          email: response.data.profile.email || '',
          vehicleName: response.data.profile.driverDetails?.vehicleName || '',
          vehicleNumber: response.data.profile.driverDetails?.vehicleNumber || '',
          vehicleType: response.data.profile.driverDetails?.vehicleType || ''
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      // Update basic profile
      await driverProfileService.updateProfile({
        name: formData.name,
        email: formData.email
      });

      // Update vehicle details
      await driverProfileService.updateVehicle({
        vehicleName: formData.vehicleName,
        vehicleNumber: formData.vehicleNumber,
        vehicleType: formData.vehicleType
      });

      alert('Profile updated successfully!');
      setEditing(false);
      fetchProfile();
    } catch (error) {
      alert('Failed to update profile: ' + error.message);
    }
  };

  if (loading) return <div>Loading profile...</div>;

  return (
    <div className="driver-profile">
      <h1>Driver Profile</h1>

      {/* Profile Info */}
      <div className="profile-section">
        <img src={profile?.profileImage} alt="Profile" />
        <h2>{profile?.name}</h2>
        <p>{profile?.phone}</p>
        <p>{profile?.email}</p>
        <span className={`badge ${profile?.approvalStatus?.toLowerCase()}`}>
          {profile?.approvalStatus}
        </span>
      </div>

      {/* Statistics */}
      <div className="stats-section">
        <h3>Delivery Statistics</h3>
        <div className="stats-grid">
          <div>Total Deliveries: {stats?.totalDeliveries}</div>
          <div>Delivered: {stats?.deliveredCount}</div>
          <div>Failed: {stats?.failedCount}</div>
          <div>Active: {stats?.activeCount}</div>
          <div>Success Rate: {stats?.successRate}%</div>
        </div>
      </div>

      {/* Edit Form */}
      {editing ? (
        <div className="edit-form">
          <input
            type="text"
            placeholder="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <input
            type="text"
            placeholder="Vehicle Name"
            value={formData.vehicleName}
            onChange={(e) => setFormData({ ...formData, vehicleName: e.target.value })}
          />
          <input
            type="text"
            placeholder="Vehicle Number"
            value={formData.vehicleNumber}
            onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
          />
          <select
            value={formData.vehicleType}
            onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
          >
            <option value="">Select Type</option>
            <option value="BIKE">Bike</option>
            <option value="SCOOTER">Scooter</option>
            <option value="BICYCLE">Bicycle</option>
            <option value="OTHER">Other</option>
          </select>
          <button onClick={handleUpdate}>Save Changes</button>
          <button onClick={() => setEditing(false)}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)}>Edit Profile</button>
      )}

      {/* Vehicle Info */}
      <div className="vehicle-section">
        <h3>Vehicle Details</h3>
        <p>Name: {profile?.driverDetails?.vehicleName}</p>
        <p>Number: {profile?.driverDetails?.vehicleNumber}</p>
        <p>Type: {profile?.driverDetails?.vehicleType}</p>
      </div>
    </div>
  );
};

export default DriverProfile;
```

---

## Field Restrictions

### Editable Fields (By Driver)
- ✅ Name
- ✅ Email
- ✅ Profile Image
- ✅ Vehicle Name
- ✅ Vehicle Number
- ✅ Vehicle Type

### Read-Only Fields (Admin Only)
- ❌ Phone Number
- ❌ License Number
- ❌ License Image
- ❌ License Expiry Date
- ❌ Vehicle Documents (RC, Insurance, PUC)
- ❌ Approval Status
- ❌ Account Status

**To update restricted fields:** Use the "Request Document Update" endpoint, and admin will review and update manually.

---

## Testing Checklist

### Manual Testing

**Test Case 1: Get Profile**
```bash
curl -X GET "http://localhost:5005/api/driver/profile" \
  -H "Authorization: Bearer YOUR_DRIVER_TOKEN"
```
Expected: Profile with stats returned

**Test Case 2: Update Profile**
```bash
curl -X PUT "http://localhost:5005/api/driver/profile" \
  -H "Authorization: Bearer YOUR_DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Name", "email": "new@example.com"}'
```
Expected: Profile updated successfully

**Test Case 3: Update Vehicle**
```bash
curl -X PATCH "http://localhost:5005/api/driver/vehicle" \
  -H "Authorization: Bearer YOUR_DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vehicleName": "Honda Activa", "vehicleNumber": "DL01AB1234", "vehicleType": "SCOOTER"}'
```
Expected: Vehicle details updated

**Test Case 4: Invalid Vehicle Number**
```bash
curl -X PATCH "http://localhost:5005/api/driver/vehicle" \
  -H "Authorization: Bearer YOUR_DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vehicleNumber": "INVALID"}'
```
Expected: 400 error with validation message

---

## Summary

**What Drivers Can Do:**
1. ✅ View complete profile with statistics
2. ✅ Update name, email, and profile image
3. ✅ Update vehicle name, number, and type
4. ✅ Request document updates (admin approval required)
5. ✅ View delivery performance statistics

**Protected Fields:**
- License details (require admin approval)
- Vehicle documents (require admin approval)
- Phone number (immutable)
- Approval status (admin controlled)

**Key Features:**
- Role-based access control
- Comprehensive validation
- Statistics tracking
- Document update workflow
- Complete audit logging

---

## Support

**Backend Files:**
- Controller: `src/driver/driver.controller.js`
- Routes: `src/driver/driver.routes.js`
- Validation: `src/driver/driver.validation.js`
- Schema: `schema/user.schema.js`

**For Questions:**
- Check server logs for debugging
- Verify JWT token is valid
- Ensure driver account is approved (`approvalStatus: "APPROVED"`)
- Confirm account status is `ACTIVE`

---

**Ready to integrate!** 🚀
