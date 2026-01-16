# Driver Order History API Integration Guide

## Overview
This document provides complete API specifications for integrating the **Driver Order History** feature into the driver's mobile/web application. This allows drivers to view their currently assigned orders and delivery history.

---

## Table of Contents
1. [Base URL & Authentication](#base-url--authentication)
2. [API Endpoint: Get Driver Orders](#api-endpoint-get-driver-orders)
3. [Request Specifications](#request-specifications)
4. [Response Specifications](#response-specifications)
5. [Order Status Flow](#order-status-flow)
6. [Integration Instructions](#integration-instructions)
7. [Error Handling](#error-handling)
8. [Testing Guide](#testing-guide)

---

## Base URL & Authentication

### Base URL
```
http://localhost:5005/api
```

**Production URL**: Replace with your production server URL (e.g., `https://api.yourapp.com/api`)

### Authentication
All driver endpoints require authentication via Bearer token.

**Header Required:**
```http
Authorization: Bearer <JWT_TOKEN>
```

**User Role Required:** `DRIVER` or `ADMIN`

---

## API Endpoint: Get Driver Orders

### Endpoint
```http
GET /api/orders/driver
```

### Description
Retrieves all orders currently assigned to the authenticated driver. Returns only orders that are in active delivery status.

### Access Control
- **Role Required**: `DRIVER` or `ADMIN`
- **Authentication**: Required (Bearer token)

---

## Request Specifications

### HTTP Method
```
GET
```

### Headers
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Query Parameters
**None required** - The endpoint automatically fetches orders for the authenticated driver based on the JWT token.

### Request Example

#### cURL
```bash
curl -X GET "http://localhost:5005/api/orders/driver" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

#### JavaScript (Fetch API)
```javascript
const token = localStorage.getItem('driverToken');

fetch('http://localhost:5005/api/orders/driver', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('Active orders:', data.data.orders);
    }
  })
  .catch(error => console.error('Error:', error));
```

#### Axios
```javascript
import axios from 'axios';

const token = localStorage.getItem('driverToken');

axios.get('http://localhost:5005/api/orders/driver', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
  .then(response => {
    if (response.data.success) {
      console.log('Active orders:', response.data.data.orders);
    }
  })
  .catch(error => console.error('Error:', error));
```

---

## Response Specifications

### Success Response (200 OK)

#### Response Structure
```json
{
  "success": true,
  "message": "Driver orders retrieved",
  "data": {
    "orders": [
      {
        "_id": "673d4e8f1234567890abcdef",
        "orderNumber": "ORD-20260115-A7B3C",
        "userId": {
          "_id": "673d4e8f1234567890abc001",
          "name": "John Doe",
          "phone": "+919876543210"
        },
        "kitchenId": {
          "_id": "673d4e8f1234567890abc002",
          "name": "Delhi Kitchen",
          "address": {
            "addressLine1": "123 Main Street",
            "locality": "Connaught Place",
            "city": "New Delhi",
            "pincode": "110001"
          }
        },
        "zoneId": "673d4e8f1234567890abc003",
        "deliveryAddressId": "673d4e8f1234567890abc004",
        "deliveryAddress": {
          "addressLine1": "456 Park Avenue",
          "addressLine2": "Apartment 12B",
          "landmark": "Near Metro Station",
          "locality": "Rohini",
          "city": "New Delhi",
          "pincode": "110085",
          "contactName": "John Doe",
          "contactPhone": "+919876543210",
          "coordinates": {
            "latitude": 28.7041,
            "longitude": 77.1025
          }
        },
        "menuType": "MEAL_MENU",
        "mealWindow": "DINNER",
        "items": [
          {
            "menuItemId": "673d4e8f1234567890abc005",
            "name": "Chicken Biryani",
            "quantity": 2,
            "unitPrice": 250,
            "totalPrice": 500,
            "isMainCourse": true,
            "addons": [
              {
                "addonId": "673d4e8f1234567890abc006",
                "name": "Extra Raita",
                "quantity": 1,
                "unitPrice": 30,
                "totalPrice": 30
              }
            ]
          },
          {
            "menuItemId": "673d4e8f1234567890abc007",
            "name": "Gulab Jamun",
            "quantity": 1,
            "unitPrice": 80,
            "totalPrice": 80,
            "isMainCourse": false,
            "addons": []
          }
        ],
        "subtotal": 610,
        "charges": {
          "deliveryFee": 40,
          "serviceFee": 20,
          "packagingFee": 15,
          "handlingFee": 10,
          "taxAmount": 32.25,
          "taxBreakdown": [
            {
              "taxType": "GST",
              "rate": 5,
              "amount": 32.25
            }
          ]
        },
        "discount": null,
        "grandTotal": 727.25,
        "voucherUsage": {
          "voucherIds": [],
          "voucherCount": 0,
          "mainCoursesCovered": 0
        },
        "amountPaid": 727.25,
        "paymentStatus": "PAID",
        "paymentMethod": "UPI",
        "paymentId": "pay_abc123xyz456",
        "status": "OUT_FOR_DELIVERY",
        "statusTimeline": [
          {
            "status": "PLACED",
            "timestamp": "2026-01-15T10:30:00.000Z",
            "updatedBy": "673d4e8f1234567890abc001",
            "notes": "Order placed by customer"
          },
          {
            "status": "ACCEPTED",
            "timestamp": "2026-01-15T10:32:00.000Z",
            "updatedBy": "673d4e8f1234567890abc008",
            "notes": "Order accepted by kitchen"
          },
          {
            "status": "PREPARING",
            "timestamp": "2026-01-15T10:32:05.000Z",
            "updatedBy": "673d4e8f1234567890abc008",
            "notes": "Preparation started automatically"
          },
          {
            "status": "READY",
            "timestamp": "2026-01-15T11:15:00.000Z",
            "updatedBy": "673d4e8f1234567890abc008",
            "notes": "Food ready for pickup"
          },
          {
            "status": "PICKED_UP",
            "timestamp": "2026-01-15T11:25:00.000Z",
            "updatedBy": "673d4e8f1234567890abc009",
            "notes": "Picked up by driver"
          },
          {
            "status": "OUT_FOR_DELIVERY",
            "timestamp": "2026-01-15T11:25:05.000Z",
            "updatedBy": "673d4e8f1234567890abc009",
            "notes": "Driver left for delivery"
          }
        ],
        "batchId": "673d4e8f1234567890abc010",
        "driverId": "673d4e8f1234567890abc009",
        "estimatedDeliveryTime": "2026-01-15T12:00:00.000Z",
        "pickedUpAt": "2026-01-15T11:25:00.000Z",
        "outForDeliveryAt": "2026-01-15T11:25:05.000Z",
        "deliveryNotes": "Please call on arrival",
        "specialInstructions": "Extra spicy, no onions",
        "placedAt": "2026-01-15T10:30:00.000Z",
        "createdAt": "2026-01-15T10:30:00.000Z",
        "updatedAt": "2026-01-15T11:25:05.000Z"
      }
    ]
  }
}
```

#### Response Fields Description

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `message` | String | Human-readable response message |
| `data.orders` | Array | List of orders assigned to the driver |

**Order Object Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `_id` | String | Unique order ID (MongoDB ObjectId) |
| `orderNumber` | String | Human-readable order number (e.g., "ORD-20260115-A7B3C") |
| `userId` | Object | Customer details (populated) |
| `userId.name` | String | Customer's full name |
| `userId.phone` | String | Customer's phone number |
| `kitchenId` | Object | Kitchen details (populated) |
| `kitchenId.name` | String | Kitchen name |
| `kitchenId.address` | Object | Kitchen's physical address |
| `deliveryAddress` | Object | Complete delivery address snapshot |
| `deliveryAddress.coordinates` | Object | GPS coordinates for navigation |
| `menuType` | String | Order type: `"MEAL_MENU"` or `"ON_DEMAND_MENU"` |
| `mealWindow` | String | Meal timing: `"LUNCH"` or `"DINNER"` (only for MEAL_MENU) |
| `items` | Array | List of ordered items with addons |
| `items[].name` | String | Item name |
| `items[].quantity` | Number | Item quantity |
| `items[].isMainCourse` | Boolean | Whether item is a main course |
| `subtotal` | Number | Total items cost before charges |
| `charges` | Object | Breakdown of all fees and taxes |
| `grandTotal` | Number | Final order total (including all charges) |
| `amountPaid` | Number | Amount paid by customer |
| `paymentStatus` | String | Payment status: `"PAID"`, `"PENDING"`, etc. |
| `status` | String | Current order status (see status flow below) |
| `statusTimeline` | Array | Complete history of status changes |
| `batchId` | String | Delivery batch ID (if part of a batch) |
| `driverId` | String | ID of assigned driver (your ID) |
| `estimatedDeliveryTime` | String (ISO Date) | Expected delivery time |
| `pickedUpAt` | String (ISO Date) | Timestamp when order was picked up |
| `outForDeliveryAt` | String (ISO Date) | Timestamp when delivery started |
| `deliveryNotes` | String | Special delivery instructions |
| `specialInstructions` | String | Customer's special food instructions |

---

### Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied. Driver role required."
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to retrieve driver orders"
}
```

---

## Order Status Flow

### Active Delivery Statuses (Returned by API)
The API **only returns orders** with these statuses:

| Status | Description |
|--------|-------------|
| `PICKED_UP` | Driver has picked up the order from kitchen |
| `OUT_FOR_DELIVERY` | Driver is on the way to deliver |

### Complete Status Lifecycle (For Reference)
```
PLACED → ACCEPTED → PREPARING → READY → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED
                                                                      ↘ FAILED
```

**Other Possible Statuses** (not returned by this endpoint):
- `PLACED`: Order just placed, not yet assigned
- `ACCEPTED`: Kitchen accepted the order
- `PREPARING`: Kitchen is preparing food
- `READY`: Food ready, waiting for driver pickup
- `DELIVERED`: Successfully delivered
- `CANCELLED`: Order cancelled
- `REJECTED`: Order rejected by kitchen
- `FAILED`: Delivery failed

---

## Integration Instructions

### Step-by-Step Implementation Guide

#### 1. **Create API Service File**
Create a file `services/orderService.js` in your driver app:

```javascript
// services/orderService.js
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5005/api';

// Get auth token from storage
const getAuthToken = () => {
  return localStorage.getItem('driverToken'); // or AsyncStorage for React Native
};

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to all requests
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

// Get driver's active orders
export const getDriverOrders = async () => {
  try {
    const response = await apiClient.get('/orders/driver');
    return response.data;
  } catch (error) {
    console.error('Error fetching driver orders:', error);
    throw error;
  }
};

export default {
  getDriverOrders
};
```

#### 2. **Create Order History Component**

**For React/React Native:**

```javascript
// components/OrderHistory.jsx
import React, { useState, useEffect } from 'react';
import { getDriverOrders } from '../services/orderService';

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrders();

    // Optional: Poll for updates every 30 seconds
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await getDriverOrders();

      if (response.success) {
        setOrders(response.data.orders);
        setError(null);
      } else {
        setError(response.message);
      }
    } catch (err) {
      setError('Failed to fetch orders. Please try again.');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && orders.length === 0) {
    return <div>Loading orders...</div>;
  }

  if (error) {
    return (
      <div>
        <p>Error: {error}</p>
        <button onClick={fetchOrders}>Retry</button>
      </div>
    );
  }

  if (orders.length === 0) {
    return <div>No active deliveries assigned to you.</div>;
  }

  return (
    <div>
      <h2>Active Deliveries ({orders.length})</h2>
      {orders.map(order => (
        <OrderCard key={order._id} order={order} />
      ))}
    </div>
  );
};

const OrderCard = ({ order }) => {
  return (
    <div className="order-card">
      <h3>Order #{order.orderNumber}</h3>

      {/* Customer Info */}
      <div className="customer-info">
        <h4>Customer</h4>
        <p>{order.userId.name}</p>
        <p>{order.userId.phone}</p>
      </div>

      {/* Delivery Address */}
      <div className="delivery-address">
        <h4>Delivery Address</h4>
        <p>{order.deliveryAddress.addressLine1}</p>
        <p>{order.deliveryAddress.locality}, {order.deliveryAddress.city}</p>
        <p>Landmark: {order.deliveryAddress.landmark}</p>
        {order.deliveryNotes && <p>Note: {order.deliveryNotes}</p>}
      </div>

      {/* Order Items */}
      <div className="order-items">
        <h4>Items ({order.items.length})</h4>
        {order.items.map((item, idx) => (
          <div key={idx}>
            <p>{item.name} x {item.quantity}</p>
            {item.addons.map((addon, i) => (
              <p key={i} style={{ marginLeft: '20px' }}>
                + {addon.name} x {addon.quantity}
              </p>
            ))}
          </div>
        ))}
      </div>

      {/* Status */}
      <div className="status">
        <span className={`badge ${order.status.toLowerCase()}`}>
          {order.status.replace('_', ' ')}
        </span>
      </div>

      {/* Navigate Button */}
      <button onClick={() => navigateToAddress(order.deliveryAddress.coordinates)}>
        Navigate to Address
      </button>
    </div>
  );
};

const navigateToAddress = (coordinates) => {
  if (coordinates && coordinates.latitude && coordinates.longitude) {
    // Open in Google Maps
    const url = `https://www.google.com/maps/dir/?api=1&destination=${coordinates.latitude},${coordinates.longitude}`;
    window.open(url, '_blank');
  }
};

export default OrderHistory;
```

#### 3. **Add State Management (Optional)**

**Using Redux:**

```javascript
// redux/orderSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getDriverOrders } from '../services/orderService';

export const fetchDriverOrders = createAsyncThunk(
  'orders/fetchDriverOrders',
  async (_, { rejectWithValue }) => {
    try {
      const response = await getDriverOrders();
      if (response.success) {
        return response.data.orders;
      }
      return rejectWithValue(response.message);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const orderSlice = createSlice({
  name: 'orders',
  initialState: {
    orders: [],
    loading: false,
    error: null
  },
  reducers: {
    clearOrders: (state) => {
      state.orders = [];
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDriverOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDriverOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.orders = action.payload;
      })
      .addCase(fetchDriverOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { clearOrders } = orderSlice.actions;
export default orderSlice.reducer;
```

#### 4. **Display Key Information**

**Important Data to Show Drivers:**

✅ **Essential Information:**
- Order number
- Customer name & phone (for contact)
- Delivery address with GPS coordinates
- Delivery notes/special instructions
- Order items (so driver can verify with kitchen)
- Current status
- Estimated delivery time

✅ **Useful Features to Add:**
- Call customer button
- Navigate to address button (Google Maps integration)
- Mark as delivered button
- Report issue button
- Pull to refresh

---

## Error Handling

### Common Error Scenarios & Solutions

| Error Code | Scenario | Solution |
|------------|----------|----------|
| 401 | Token expired or invalid | Redirect to login, refresh token |
| 403 | User is not a driver | Show "Access denied" message |
| 500 | Server error | Show retry button, log error |
| Network Error | No internet connection | Show offline message, queue retry |

### Error Handling Example

```javascript
const handleOrderFetch = async () => {
  try {
    const response = await getDriverOrders();
    setOrders(response.data.orders);
  } catch (error) {
    if (error.response) {
      // Server responded with error
      switch (error.response.status) {
        case 401:
          // Redirect to login
          navigation.navigate('Login');
          break;
        case 403:
          Alert.alert('Access Denied', 'You must be logged in as a driver');
          break;
        case 500:
          Alert.alert('Server Error', 'Please try again later');
          break;
        default:
          Alert.alert('Error', error.response.data.message);
      }
    } else if (error.request) {
      // Network error
      Alert.alert('Network Error', 'Please check your internet connection');
    } else {
      // Other errors
      Alert.alert('Error', 'Something went wrong');
    }
  }
};
```

---

## Testing Guide

### Manual Testing Checklist

#### Prerequisites
1. ✅ Driver account created and logged in
2. ✅ Valid JWT token stored
3. ✅ At least one order assigned to the driver

#### Test Cases

**Test Case 1: Fetch Active Orders**
```bash
# Expected: Returns list of orders with status PICKED_UP or OUT_FOR_DELIVERY
curl -X GET "http://localhost:5005/api/orders/driver" \
  -H "Authorization: Bearer YOUR_DRIVER_TOKEN"
```

**Expected Result:**
- Status: 200 OK
- Response contains orders array
- Each order has complete delivery address
- Each order has customer contact info

**Test Case 2: No Active Orders**
```bash
# When driver has no active deliveries
# Expected: Returns empty orders array
```

**Expected Result:**
```json
{
  "success": true,
  "message": "Driver orders retrieved",
  "data": {
    "orders": []
  }
}
```

**Test Case 3: Unauthorized Access**
```bash
# Request without token
curl -X GET "http://localhost:5005/api/orders/driver"
```

**Expected Result:**
- Status: 401 Unauthorized
- Error message about authentication

**Test Case 4: Non-Driver User**
```bash
# Request with customer token instead of driver token
curl -X GET "http://localhost:5005/api/orders/driver" \
  -H "Authorization: Bearer CUSTOMER_TOKEN"
```

**Expected Result:**
- Status: 403 Forbidden
- Error message about driver role required

---

## Additional Related Endpoints

While this document focuses on the **Get Driver Orders** endpoint, here are related endpoints you might need:

### Update Delivery Status
```http
PATCH /api/orders/:orderId/delivery-status
```
Used to update order status (mark as delivered, failed, etc.)

### Get Order Details
```http
GET /api/orders/:orderId
```
Get complete details of a specific order

---

## Support & Contact

**Backend Issues:**
- Check server logs in `d:\AIB Innovations\Tiffsy\New Backend\backend`
- Verify `.env` file has correct `PORT=5005`
- Ensure MongoDB connection is active

**API Questions:**
- Refer to the controller: `src/order/order.controller.js` (line 1507)
- Check route definition: `src/order/order.routes.js` (line 69)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-15 | Initial documentation created |

---

## Summary

**What You Need:**
1. ✅ Endpoint: `GET /api/orders/driver`
2. ✅ Auth: Bearer token in header
3. ✅ Returns: Orders with status `PICKED_UP` or `OUT_FOR_DELIVERY`
4. ✅ Sorted by: Most recent pickup first

**What To Display:**
- Customer name & phone
- Delivery address with GPS
- Order items
- Special instructions
- Current status

**What To Build:**
- Service layer for API calls
- Order list component
- Order detail cards
- Navigation integration
- Call customer functionality
- Delivery status update (separate endpoint)

Good luck with your integration! 🚀
