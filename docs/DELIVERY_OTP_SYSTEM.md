# Delivery OTP Verification System

## Overview
The Tiffsy delivery system uses OTP (One-Time Password) verification to ensure secure and verified food delivery. This document explains the complete OTP flow from order assignment to delivery completion.

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [OTP Lifecycle](#otp-lifecycle)
3. [Backend API Reference](#backend-api-reference)
4. [Driver App Implementation Guide](#driver-app-implementation-guide)
5. [Customer App Implementation Guide](#customer-app-implementation-guide)
6. [Error Handling](#error-handling)
7. [Security Considerations](#security-considerations)

---

## System Architecture

### Database Models

#### DeliveryAssignment Schema
```javascript
{
  orderId: ObjectId,
  driverId: ObjectId,
  batchId: ObjectId,
  status: String, // "ASSIGNED", "ACKNOWLEDGED", "PICKED_UP", "EN_ROUTE", "ARRIVED", "DELIVERED"

  proofOfDelivery: {
    type: String,        // "OTP", "SIGNATURE", "PHOTO"
    otp: String,         // 4-digit OTP
    otpVerified: Boolean,
    verifiedAt: Date,
    verifiedBy: String
  }
}
```

#### Order Schema
```javascript
{
  status: String, // "PLACED", "ACCEPTED", "PREPARING", "READY", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"
  driverId: ObjectId,
  batchId: ObjectId,

  proofOfDelivery: {
    type: String,      // "OTP", "SIGNATURE", "PHOTO"
    value: String,     // OTP value or URL
    verifiedAt: Date
  }
}
```

---

## OTP Lifecycle

### Phase 1: OTP Generation (Automatic)
**When:** Driver accepts a batch
**Who:** Backend system (automatic)
**What:** 4-digit OTP is generated for each order in the batch

```
Driver accepts batch
    ↓
Backend calls: assignment.generateOtp()
    ↓
4-digit OTP created (e.g., "4827")
    ↓
OTP stored in DeliveryAssignment.proofOfDelivery.otp
```

### Phase 2: OTP Display to Customer
**When:** Order is out for delivery
**Who:** Customer app
**What:** Customer can view their OTP to verify driver

```
Order status: "OUT_FOR_DELIVERY"
    ↓
Customer opens order details
    ↓
Customer sees: "Your OTP: 4827"
    ↓
Customer prepares to share OTP with driver
```

### Phase 3: OTP Verification (At Delivery)
**When:** Driver arrives and marks order as delivered
**Who:** Driver app
**What:** Driver enters OTP provided by customer

```
Driver arrives at location
    ↓
Driver updates status to "ARRIVED"
    ↓
Driver clicks "Mark as Delivered"
    ↓
App shows OTP input dialog
    ↓
Driver enters OTP from customer
    ↓
Backend verifies OTP
    ↓
If correct: Order marked DELIVERED
If wrong: Error shown, driver retries
```

---

## Backend API Reference

### 1. Accept Batch (Driver)
**Endpoint:** `POST /api/delivery/batches/:batchId/accept`
**Auth:** Driver or Admin
**Description:** Driver accepts a batch. OTP is auto-generated for all orders.

**Request:**
```http
POST /api/delivery/batches/507f1f77bcf86cd799439011/accept
Authorization: Bearer <driver_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Batch accepted",
  "data": {
    "batch": {
      "_id": "507f1f77bcf86cd799439011",
      "batchNumber": "BTH-20260114-001",
      "status": "DISPATCHED",
      "orderIds": ["6966c3b6820784414a6cf18c", "..."]
    },
    "orders": [
      {
        "_id": "6966c3b6820784414a6cf18c",
        "orderNumber": "ORD-20260114-ABC12",
        "deliveryAddress": {
          "addressLine1": "123 Main Street",
          "locality": "Green Park",
          "city": "Mumbai",
          "pincode": "400001",
          "contactPhone": "+919876543210"
        },
        "status": "READY"
      }
    ],
    "deliveries": [...]
  }
}
```

**Note:** OTP is generated internally but not returned in this response for security.

---

### 2. Get My Batch (Driver)
**Endpoint:** `GET /api/delivery/my-batch`
**Auth:** Driver or Admin
**Description:** Get driver's current active batch with all order details.

**Request:**
```http
GET /api/delivery/my-batch
Authorization: Bearer <driver_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Current batch retrieved",
  "data": {
    "batch": {
      "_id": "507f1f77bcf86cd799439011",
      "batchNumber": "BTH-20260114-001",
      "status": "IN_PROGRESS"
    },
    "orders": [
      {
        "_id": "6966c3b6820784414a6cf18c",
        "orderNumber": "ORD-20260114-ABC12",
        "status": "OUT_FOR_DELIVERY",
        "assignmentStatus": "EN_ROUTE",
        "sequenceNumber": 1,
        "deliveryAddress": {
          "addressLine1": "123 Main Street",
          "contactPhone": "+919876543210"
        }
      }
    ],
    "summary": {
      "totalOrders": 5,
      "delivered": 2,
      "pending": 3,
      "failed": 0
    }
  }
}
```

---

### 3. Update Delivery Status (Driver)
**Endpoint:** `PATCH /api/delivery/orders/:orderId/status`
**Auth:** Driver or Admin
**Description:** Update the delivery status of an order. Use this to mark as delivered with OTP.

**Request (Mark as Delivered with OTP):**
```http
PATCH /api/delivery/orders/6966c3b6820784414a6cf18c/status
Authorization: Bearer <driver_token>
Content-Type: application/json

{
  "status": "DELIVERED",
  "notes": "Delivered to customer",
  "proofOfDelivery": {
    "type": "OTP",
    "otp": "4827"
  }
}
```

**Request Body Schema:**
```typescript
{
  status: "EN_ROUTE" | "ARRIVED" | "DELIVERED" | "FAILED",
  notes?: string,
  failureReason?: "CUSTOMER_UNAVAILABLE" | "WRONG_ADDRESS" | "CUSTOMER_REFUSED" | "ADDRESS_NOT_FOUND" | "CUSTOMER_UNREACHABLE" | "OTHER",
  proofOfDelivery?: {
    type: "OTP" | "SIGNATURE" | "PHOTO",
    otp?: string,           // Required if type is "OTP"
    signatureUrl?: string,  // Required if type is "SIGNATURE"
    photoUrl?: string       // Required if type is "PHOTO"
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Delivery status updated",
  "data": {
    "order": {
      "_id": "6966c3b6820784414a6cf18c",
      "status": "DELIVERED",
      "deliveredAt": "2026-01-14T13:30:00.000Z",
      "proofOfDelivery": {
        "type": "OTP",
        "value": "4827",
        "verifiedAt": "2026-01-14T13:30:00.000Z"
      }
    },
    "assignment": {
      "status": "DELIVERED",
      "proofOfDelivery": {
        "type": "OTP",
        "otp": "4827",
        "otpVerified": true,
        "verifiedAt": "2026-01-14T13:30:00.000Z",
        "verifiedBy": "CUSTOMER"
      }
    },
    "batchProgress": {
      "delivered": 3,
      "failed": 0,
      "total": 5
    }
  }
}
```

**Error Response - Wrong OTP (500):**
```json
{
  "success": false,
  "message": "Failed to update delivery status",
  "data": null,
  "error": null
}
```

**Note:** When OTP verification fails, the backend will throw an error from `assignment.verifyOtp()`. The current implementation returns a generic 500 error.

---

### 4. Get Order Details (Customer)
**Endpoint:** `GET /api/orders/:orderId` (Customer Order API)
**Auth:** Customer
**Description:** Customer views their order details including OTP when driver is en route.

**Request:**
```http
GET /api/orders/6966c3b6820784414a6cf18c
Authorization: Bearer <customer_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "6966c3b6820784414a6cf18c",
      "orderNumber": "ORD-20260114-ABC12",
      "status": "OUT_FOR_DELIVERY",
      "deliveryAddress": {...},
      "items": [...],
      "driverId": {
        "_id": "6964ddeb598dd8980a844e61",
        "name": "Rajesh Kumar",
        "phone": "+919876543210"
      }
    },
    "deliveryOtp": "4827"  // ⚠️ TODO: This needs to be added to customer order endpoint
  }
}
```

**⚠️ IMPORTANT:** The customer order endpoint needs to be updated to include the OTP from DeliveryAssignment when the order is out for delivery.

---

## Driver App Implementation Guide

### Screen: Active Deliveries List

**UI Components:**
- List of all orders in current batch
- Each order card shows:
  - Order number
  - Customer address
  - Sequence number
  - Status badge (Pending, En Route, Delivered)
  - Quick action buttons

**Example UI:**
```
┌─────────────────────────────────────┐
│  🏠 Order #ORD-20260114-ABC12       │
│  📍 123 Main St, Green Park         │
│  #1 in sequence                     │
│  Status: [Pending]                  │
│  ┌──────────┐  ┌──────────────┐    │
│  │ Navigate │  │ Mark En Route│    │
│  └──────────┘  └──────────────┘    │
└─────────────────────────────────────┘
```

**Implementation:**

```typescript
// GET current batch
const response = await fetch(`${API_BASE_URL}/api/delivery/my-batch`, {
  headers: {
    'Authorization': `Bearer ${driverToken}`
  }
});

const { data } = await response.json();
const { batch, orders, summary } = data;

// Render list
orders.sort((a, b) => a.sequenceNumber - b.sequenceNumber).map(order => (
  <OrderCard
    order={order}
    onNavigate={() => openMaps(order.deliveryAddress)}
    onUpdateStatus={(status) => updateOrderStatus(order._id, status)}
  />
));
```

---

### Screen: Delivery Detail View

**UI Components:**
- Full order details
- Customer contact
- Delivery address with map
- Status update buttons:
  - "I'm on my way" (EN_ROUTE)
  - "I've arrived" (ARRIVED)
  - "Complete delivery" (DELIVERED)
- OTP input dialog

**Status Update Flow:**

```typescript
const updateOrderStatus = async (orderId: string, status: string) => {
  try {
    // For EN_ROUTE and ARRIVED - simple status update
    if (status === 'EN_ROUTE' || status === 'ARRIVED') {
      const response = await fetch(
        `${API_BASE_URL}/api/delivery/orders/${orderId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${driverToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: status,
            notes: status === 'EN_ROUTE'
              ? 'Driver is on the way'
              : 'Driver has arrived at location'
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      const result = await response.json();

      // Show success message
      showToast('Status updated successfully');

      // Refresh the order list
      refreshMyBatch();

    } else if (status === 'DELIVERED') {
      // Show OTP input dialog
      showOtpDialog(orderId);
    }

  } catch (error) {
    showToast('Error updating status: ' + error.message);
  }
};
```

---

### Screen: OTP Verification Dialog

**UI Components:**
- 4-digit OTP input field
- Verify button
- Cancel button
- Error message display

**Example UI:**
```
┌─────────────────────────────────────┐
│  Complete Delivery                  │
├─────────────────────────────────────┤
│  Enter OTP from customer:           │
│                                     │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐          │
│  │ 4 │ │ 8 │ │ 2 │ │ 7 │          │
│  └───┘ └───┘ └───┘ └───┘          │
│                                     │
│  ┌──────────┐  ┌──────────────┐   │
│  │  Cancel  │  │    Verify    │   │
│  └──────────┘  └──────────────┘   │
└─────────────────────────────────────┘
```

**Implementation:**

```typescript
const showOtpDialog = (orderId: string) => {
  // Show modal with OTP input
  setOtpDialogVisible(true);
  setCurrentOrderId(orderId);
  setOtpValue('');
  setOtpError('');
};

const verifyAndCompleteDelivery = async () => {
  try {
    // Validate OTP format
    if (!/^\d{4}$/.test(otpValue)) {
      setOtpError('Please enter a valid 4-digit OTP');
      return;
    }

    // Show loading
    setVerifying(true);

    // Call API to verify and mark delivered
    const response = await fetch(
      `${API_BASE_URL}/api/delivery/orders/${currentOrderId}/status`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${driverToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'DELIVERED',
          notes: 'Delivered and verified with OTP',
          proofOfDelivery: {
            type: 'OTP',
            otp: otpValue
          }
        })
      }
    );

    const result = await response.json();

    if (!result.success) {
      // OTP verification failed
      setOtpError('Invalid OTP. Please check with customer and try again.');
      setOtpValue(''); // Clear input
      return;
    }

    // Success!
    setOtpDialogVisible(false);
    showToast('✅ Delivery completed successfully!');

    // Refresh batch to show updated status
    refreshMyBatch();

    // Navigate back to batch list
    navigation.goBack();

  } catch (error) {
    setOtpError('Error verifying OTP. Please try again.');
    console.error('OTP verification error:', error);
  } finally {
    setVerifying(false);
  }
};
```

---

### Complete Driver Flow Example

```typescript
// Step 1: Driver navigates to delivery location
const handleNavigate = (address) => {
  const coords = `${address.coordinates.latitude},${address.coordinates.longitude}`;
  Linking.openURL(`google.maps://?daddr=${coords}`);
};

// Step 2: Driver marks as "On my way"
const handleStartDelivery = async (orderId) => {
  await updateOrderStatus(orderId, 'EN_ROUTE');
};

// Step 3: Driver marks as "Arrived"
const handleMarkArrived = async (orderId) => {
  await updateOrderStatus(orderId, 'ARRIVED');
};

// Step 4: Driver completes delivery with OTP
const handleCompleteDelivery = async (orderId) => {
  // This will show OTP dialog
  await updateOrderStatus(orderId, 'DELIVERED');
};

// OTP Dialog Component
const OtpVerificationDialog = ({ visible, orderId, onClose, onSuccess }) => {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!/^\d{4}$/.test(otp)) {
      setError('Please enter a valid 4-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/delivery/orders/${orderId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${driverToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: 'DELIVERED',
            notes: 'Delivered and verified with OTP',
            proofOfDelivery: {
              type: 'OTP',
              otp: otp
            }
          })
        }
      );

      const result = await response.json();

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError('Invalid OTP. Please check with customer.');
        setOtp('');
      }
    } catch (err) {
      setError('Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <Text style={styles.title}>Complete Delivery</Text>
        <Text style={styles.subtitle}>Enter OTP from customer:</Text>

        <TextInput
          style={styles.otpInput}
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={4}
          placeholder="0000"
          autoFocus
        />

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        <View style={styles.buttonRow}>
          <Button title="Cancel" onPress={onClose} />
          <Button
            title={loading ? "Verifying..." : "Verify"}
            onPress={handleVerify}
            disabled={loading}
          />
        </View>
      </View>
    </Modal>
  );
};
```

---

## Customer App Implementation Guide

### Screen: Order Tracking

**UI Components:**
- Order status timeline
- Driver details (when assigned)
- OTP display (when out for delivery)
- Live tracking map (optional)

**Example UI:**
```
┌─────────────────────────────────────┐
│  Order #ORD-20260114-ABC12         │
├─────────────────────────────────────┤
│  ✅ Order Placed                    │
│  ✅ Kitchen Accepted                │
│  ✅ Preparing Food                  │
│  ✅ Ready for Pickup                │
│  🚗 Out for Delivery                │
│  ⭕ Delivered                       │
├─────────────────────────────────────┤
│  Your Delivery Driver:              │
│  Rajesh Kumar                       │
│  📞 +91 98765 43210                 │
├─────────────────────────────────────┤
│  🔐 Your Delivery OTP:              │
│  ╔═══════════════════════════════╗ │
│  ║                               ║ │
│  ║          4  8  2  7          ║ │
│  ║                               ║ │
│  ╚═══════════════════════════════╝ │
│                                     │
│  Share this OTP with driver to      │
│  complete your delivery             │
└─────────────────────────────────────┘
```

**Implementation:**

```typescript
const OrderTrackingScreen = ({ orderId }) => {
  const [order, setOrder] = useState(null);
  const [deliveryOtp, setDeliveryOtp] = useState(null);

  useEffect(() => {
    fetchOrderDetails();

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchOrderDetails, 30000);
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/orders/${orderId}`,
        {
          headers: {
            'Authorization': `Bearer ${customerToken}`
          }
        }
      );

      const result = await response.json();

      if (result.success) {
        setOrder(result.data.order);

        // ⚠️ TODO: Backend needs to include OTP in response
        // For now, you may need to fetch from a separate endpoint
        if (result.data.deliveryOtp) {
          setDeliveryOtp(result.data.deliveryOtp);
        }
      }
    } catch (error) {
      console.error('Error fetching order:', error);
    }
  };

  const showOtp = order?.status === 'OUT_FOR_DELIVERY' ||
                  order?.status === 'PICKED_UP';

  return (
    <ScrollView>
      {/* Order Status Timeline */}
      <OrderTimeline status={order?.status} />

      {/* Driver Details */}
      {order?.driverId && (
        <DriverInfoCard driver={order.driverId} />
      )}

      {/* OTP Display - Only show when out for delivery */}
      {showOtp && deliveryOtp && (
        <View style={styles.otpContainer}>
          <Text style={styles.otpLabel}>🔐 Your Delivery OTP:</Text>
          <View style={styles.otpBox}>
            <Text style={styles.otpValue}>{deliveryOtp}</Text>
          </View>
          <Text style={styles.otpHint}>
            Share this OTP with your delivery driver to complete the delivery
          </Text>
        </View>
      )}

      {/* Order Items */}
      <OrderItemsList items={order?.items} />
    </ScrollView>
  );
};
```

---

## Error Handling

### Common Error Scenarios

#### 1. Wrong OTP Entered by Driver

**Current Behavior:**
- Backend throws error from `verifyOtp()` method
- Returns 500 status with generic message

**Expected Handling:**
```typescript
// In driver app
if (!result.success) {
  if (result.message.includes('OTP') || result.message.includes('Invalid')) {
    showError('❌ Invalid OTP. Please verify with customer and try again.');
  } else {
    showError('❌ Failed to complete delivery. Please try again.');
  }
}
```

**Recommended Backend Improvement:**
```javascript
// In delivery.controller.js - Line 650
if (proofOfDelivery.type === "OTP") {
  const isValid = await assignment.verifyOtp(proofOfDelivery.otp);
  if (!isValid) {
    return sendResponse(res, 400, false, "Invalid OTP provided");
  }
}
```

#### 2. Customer Cannot See OTP

**Possible Causes:**
- Order status not "OUT_FOR_DELIVERY"
- Customer order endpoint not returning OTP
- DeliveryAssignment not created

**Debugging:**
```typescript
// Check if assignment exists
const assignment = await DeliveryAssignment.findOne({ orderId });
console.log('Assignment:', assignment);
console.log('OTP:', assignment?.proofOfDelivery?.otp);
```

#### 3. Driver Doesn't Have Order in Batch

**Error Response:**
```json
{
  "success": false,
  "message": "Not assigned to this order"
}
```

**Handling:**
```typescript
if (!result.success && result.message.includes('Not assigned')) {
  showError('You are not assigned to this order');
  // Redirect to batch list
  navigation.navigate('MyBatch');
}
```

---

## Security Considerations

### 1. OTP Storage
- ✅ OTP is stored in DeliveryAssignment (driver side)
- ✅ OTP is 4 digits (balance between security and usability)
- ⚠️ OTP should NOT be sent to driver in API responses
- ⚠️ OTP should ONLY be visible to customer

### 2. OTP Transmission
- ✅ OTP is transmitted over HTTPS
- ✅ Driver must manually enter OTP (not auto-filled)
- ✅ Customer verbally shares OTP with driver

### 3. OTP Verification
- ✅ Server-side verification only
- ✅ Stored as plain text (acceptable for low-value 4-digit codes)
- ⚠️ Consider adding attempt limits (max 3 tries)

### 4. Access Control
- ✅ Driver can only update their assigned orders
- ✅ Customer can only view their own orders
- ✅ Admin can override (for support cases)

---

## Testing Checklist

### Backend Testing
- [ ] OTP is generated when batch is accepted
- [ ] OTP is 4 digits numeric
- [ ] OTP verification succeeds with correct OTP
- [ ] OTP verification fails with wrong OTP
- [ ] OTP is not returned to driver in any endpoint
- [ ] Order status updates correctly after OTP verification

### Driver App Testing
- [ ] Status buttons show/hide based on current status
- [ ] "Mark as Delivered" shows OTP dialog
- [ ] OTP input accepts 4 digits only
- [ ] Wrong OTP shows error message
- [ ] Correct OTP completes delivery
- [ ] Batch list refreshes after delivery
- [ ] Success message shown after completion

### Customer App Testing
- [ ] OTP is visible when order is "OUT_FOR_DELIVERY"
- [ ] OTP is hidden before driver starts delivery
- [ ] OTP is large and readable
- [ ] Order status updates after delivery
- [ ] Driver contact info is visible

---

## Backend Enhancements Needed

### 1. Add OTP to Customer Order Endpoint
**File:** `src/order/order.controller.js`

```javascript
// In getOrderById function
const order = await Order.findById(orderId).populate('driverId', 'name phone');

// Add OTP if order is out for delivery
let deliveryOtp = null;
if (['OUT_FOR_DELIVERY', 'PICKED_UP'].includes(order.status)) {
  const assignment = await DeliveryAssignment.findOne({ orderId });
  if (assignment?.proofOfDelivery?.otp) {
    deliveryOtp = assignment.proofOfDelivery.otp;
  }
}

return sendResponse(res, 200, true, "Order retrieved", {
  order,
  deliveryOtp
});
```

### 2. Improve OTP Verification Error Response
**File:** `src/delivery/delivery.controller.js`

```javascript
// Line ~650 - Replace try/catch around verifyOtp
if (proofOfDelivery.type === "OTP") {
  const isValid = await assignment.verifyOtp(proofOfDelivery.otp);
  if (!isValid) {
    return sendResponse(res, 400, false, "Invalid OTP. Please verify with customer.");
  }
}
```

### 3. Add OTP Regeneration Endpoint (Optional)
**Use Case:** Customer didn't receive OTP or driver needs new one

```javascript
// New endpoint: POST /api/delivery/orders/:orderId/regenerate-otp
export async function regenerateOtp(req, res) {
  try {
    const { orderId } = req.params;
    const driverId = req.user._id;

    const assignment = await DeliveryAssignment.findOne({ orderId, driverId });
    if (!assignment) {
      return sendResponse(res, 403, false, "Not assigned to this order");
    }

    await assignment.generateOtp();

    return sendResponse(res, 200, true, "OTP regenerated successfully");
  } catch (error) {
    return sendResponse(res, 500, false, "Failed to regenerate OTP");
  }
}
```

---

## Summary for Driver Frontend Team

### Quick Implementation Steps

1. **Install Dependencies** (if needed)
   ```bash
   npm install react-native-modal
   ```

2. **Create OTP Dialog Component**
   - 4-digit number input
   - Verify and Cancel buttons
   - Error message display

3. **Update Delivery Detail Screen**
   - Add "I'm on my way" button → calls API with status "EN_ROUTE"
   - Add "I've arrived" button → calls API with status "ARRIVED"
   - Add "Complete Delivery" button → shows OTP dialog

4. **Implement OTP Verification**
   - User enters 4-digit OTP
   - Call `PATCH /api/delivery/orders/:orderId/status` with:
     ```json
     {
       "status": "DELIVERED",
       "proofOfDelivery": {
         "type": "OTP",
         "otp": "1234"
       }
     }
     ```
   - Handle success: dismiss dialog, show success, refresh list
   - Handle error: show error message, allow retry

5. **Handle Status Flow**
   ```
   ASSIGNED → (driver accepts) → ACKNOWLEDGED
   ACKNOWLEDGED → (picks up from kitchen) → PICKED_UP
   PICKED_UP → (starts driving) → EN_ROUTE
   EN_ROUTE → (reaches location) → ARRIVED
   ARRIVED → (enters OTP) → DELIVERED
   ```

### API Endpoints You'll Use

| Action | Method | Endpoint | Body |
|--------|--------|----------|------|
| Get current batch | GET | `/api/delivery/my-batch` | - |
| Mark en route | PATCH | `/api/delivery/orders/:id/status` | `{ status: "EN_ROUTE" }` |
| Mark arrived | PATCH | `/api/delivery/orders/:id/status` | `{ status: "ARRIVED" }` |
| Complete with OTP | PATCH | `/api/delivery/orders/:id/status` | `{ status: "DELIVERED", proofOfDelivery: { type: "OTP", otp: "1234" } }` |
| Mark failed | PATCH | `/api/delivery/orders/:id/status` | `{ status: "FAILED", failureReason: "CUSTOMER_UNAVAILABLE" }` |

### Testing
Use these test values:
- Test Order ID: Get from `/api/delivery/my-batch`
- Test OTP: Will be generated automatically (4 digits)
- Auth Token: Your driver JWT token

---

## Questions or Issues?

Contact the backend team if:
- OTP verification always fails
- Customer cannot see OTP
- Status updates return errors
- Need additional endpoints

**Last Updated:** January 14, 2026
**Backend Version:** v1.0
**Document Version:** 1.0
