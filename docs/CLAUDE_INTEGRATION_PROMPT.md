# Claude Frontend Integration Prompt for Driver Order History

## Context
You are building the **Driver Order History** feature for a food delivery app. The backend API is ready and documented. Your task is to integrate this API into the driver's mobile/web application.

---

## Your Task
Build a complete **Order History/Active Deliveries** screen for drivers that:

1. **Fetches** active delivery orders from the backend
2. **Displays** order details in an intuitive UI
3. **Allows** drivers to:
   - View customer contact information
   - See complete delivery address with GPS coordinates
   - Navigate to delivery location (Google Maps integration)
   - Call the customer
   - View order items and special instructions
   - See current order status

---

## API Documentation Location
**Complete API documentation is available at:**
```
docs/DRIVER_ORDER_HISTORY_API.md
```

**Read this file first** - it contains all endpoint details, request/response formats, and integration examples.

---

## Key Requirements

### 1. API Integration
- **Endpoint**: `GET /api/orders/driver`
- **Base URL**: `http://localhost:5005/api` (update for production)
- **Authentication**: Bearer token required in header
- **Returns**: Only orders with status `PICKED_UP` or `OUT_FOR_DELIVERY`

### 2. UI/UX Requirements

#### Essential Information to Display:
- ✅ Order number (e.g., "ORD-20260115-A7B3C")
- ✅ Customer name and phone number
- ✅ Complete delivery address with landmark
- ✅ GPS coordinates for navigation
- ✅ List of order items with quantities
- ✅ Special delivery notes
- ✅ Food preparation instructions
- ✅ Current order status badge
- ✅ Estimated delivery time

#### Required Actions:
- ✅ Call customer button (tel: link)
- ✅ Navigate to address button (Google Maps deep link)
- ✅ Pull-to-refresh functionality
- ✅ Auto-refresh every 30 seconds (optional but recommended)
- ✅ Empty state when no active deliveries

### 3. Error Handling
Handle these scenarios gracefully:
- ❌ No internet connection
- ❌ Expired authentication token (401) → redirect to login
- ❌ Access denied (403) → show error message
- ❌ Server error (500) → show retry button
- ❌ Empty orders list → show "No active deliveries" message

### 4. Code Structure

**Create these files:**

```
src/
├── services/
│   └── orderService.js          # API calls
├── components/
│   ├── OrderHistory.jsx         # Main container
│   ├── OrderCard.jsx            # Individual order display
│   └── EmptyState.jsx           # No orders UI
├── redux/ (optional)
│   └── orderSlice.js            # State management
└── utils/
    └── mapUtils.js              # Google Maps integration
```

---

## Step-by-Step Implementation

### Step 1: Read the API Documentation
```bash
Open and read: docs/DRIVER_ORDER_HISTORY_API.md
```
This file contains:
- Complete request/response examples
- Authentication details
- Field descriptions
- Error codes
- Testing guide

### Step 2: Create API Service
Create `services/orderService.js` with:
- Axios/fetch configuration
- Authentication token injection
- Error handling
- Response parsing

**Example from docs:**
```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5005/api';

export const getDriverOrders = async () => {
  const token = localStorage.getItem('driverToken');
  const response = await axios.get('/orders/driver', {
    baseURL: API_BASE_URL,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.data;
};
```

### Step 3: Build UI Components

**OrderCard Component Requirements:**
```javascript
// Display these fields from API response:
- order.orderNumber
- order.userId.name
- order.userId.phone
- order.deliveryAddress.addressLine1
- order.deliveryAddress.locality
- order.deliveryAddress.landmark
- order.deliveryAddress.coordinates
- order.items (array)
- order.status
- order.deliveryNotes
- order.specialInstructions
```

**Actions to implement:**
```javascript
// Call customer
const callCustomer = (phone) => {
  window.location.href = `tel:${phone}`;
};

// Navigate to address
const navigate = (coordinates) => {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${coordinates.latitude},${coordinates.longitude}`;
  window.open(url, '_blank');
};
```

### Step 4: Add State Management (Optional)
- Use Redux Toolkit or Context API
- Store orders list
- Handle loading/error states
- Implement auto-refresh logic

### Step 5: Testing
Test these scenarios:
1. ✅ Fetch orders successfully
2. ✅ Display multiple orders
3. ✅ Handle empty orders list
4. ✅ Handle network errors
5. ✅ Handle authentication errors
6. ✅ Call customer functionality
7. ✅ Navigate to address functionality
8. ✅ Pull-to-refresh

---

## Response Format Example

When you call `GET /api/orders/driver`, you'll receive:

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
          "name": "John Doe",
          "phone": "+919876543210"
        },
        "deliveryAddress": {
          "addressLine1": "456 Park Avenue",
          "locality": "Rohini",
          "city": "New Delhi",
          "pincode": "110085",
          "coordinates": {
            "latitude": 28.7041,
            "longitude": 77.1025
          }
        },
        "items": [...],
        "status": "OUT_FOR_DELIVERY",
        "deliveryNotes": "Call on arrival",
        ...
      }
    ]
  }
}
```

**Access data like this:**
```javascript
const response = await getDriverOrders();
const orders = response.data.orders;

orders.forEach(order => {
  console.log(order.orderNumber);
  console.log(order.userId.name);
  console.log(order.deliveryAddress.addressLine1);
});
```

---

## Important Notes

### Authentication
- **Token must be included** in every request
- Token format: `Bearer <JWT_TOKEN>`
- If 401 error, redirect to login
- Store token securely (localStorage/AsyncStorage)

### Order Status
The API **only returns** orders with these statuses:
- `PICKED_UP` - Driver has picked up from kitchen
- `OUT_FOR_DELIVERY` - Driver is on the way

Other statuses (`DELIVERED`, `FAILED`, etc.) won't be returned.

### GPS Coordinates
Always check if coordinates exist before using:
```javascript
if (order.deliveryAddress.coordinates?.latitude) {
  // Safe to use coordinates
  navigateToAddress(order.deliveryAddress.coordinates);
}
```

### Refresh Strategy
Implement either:
- **Pull-to-refresh** (manual)
- **Auto-refresh** every 30 seconds (recommended)
- **Real-time updates** via WebSocket (future enhancement)

---

## Design Recommendations

### Order Card Layout
```
┌─────────────────────────────────────┐
│ Order #ORD-20260115-A7B3C           │
│ [OUT FOR DELIVERY]                  │
├─────────────────────────────────────┤
│ 👤 Customer: John Doe               │
│ 📞 +91 9876543210  [CALL]          │
├─────────────────────────────────────┤
│ 📍 Delivery Address:                │
│ 456 Park Avenue                     │
│ Rohini, New Delhi - 110085          │
│ 🚩 Landmark: Near Metro Station     │
│ [NAVIGATE] 🗺️                       │
├─────────────────────────────────────┤
│ 📦 Items (2):                       │
│ • Chicken Biryani x2                │
│   + Extra Raita x1                  │
│ • Gulab Jamun x1                    │
├─────────────────────────────────────┤
│ 📝 Notes: Call on arrival           │
│ ⚠️  Instructions: Extra spicy       │
└─────────────────────────────────────┘
```

### Status Badge Colors
```css
PICKED_UP → Yellow/Orange (#FFA500)
OUT_FOR_DELIVERY → Blue (#2196F3)
DELIVERED → Green (#4CAF50)
FAILED → Red (#F44336)
```

---

## Deliverables

When you're done, you should have:

1. ✅ Working API integration with authentication
2. ✅ Order list screen displaying all active deliveries
3. ✅ Individual order cards with all required information
4. ✅ Call customer functionality
5. ✅ Navigate to address functionality
6. ✅ Error handling for all scenarios
7. ✅ Loading states and empty states
8. ✅ Pull-to-refresh or auto-refresh
9. ✅ Responsive design (mobile-first)
10. ✅ Clean, maintainable code with comments

---

## Testing Checklist

Before marking as complete, test:

- [ ] Fetch orders successfully with valid token
- [ ] Display multiple orders correctly
- [ ] Show empty state when no orders
- [ ] Handle 401 error (redirect to login)
- [ ] Handle 403 error (show access denied)
- [ ] Handle 500 error (show retry button)
- [ ] Handle network errors (show offline message)
- [ ] Call customer button works
- [ ] Navigate button opens Google Maps
- [ ] Pull-to-refresh works
- [ ] Auto-refresh updates orders (if implemented)
- [ ] UI is responsive on different screen sizes
- [ ] Loading indicators show during API calls

---

## Questions to Ask Before Starting

1. **What framework are you using?**
   - React / React Native / Vue / Angular / Flutter?

2. **What styling library?**
   - CSS / Tailwind / Material-UI / Styled Components?

3. **State management?**
   - Redux / Context API / MobX / None?

4. **Do you have the auth token?**
   - How is it stored? (localStorage, AsyncStorage, etc.)
   - How to get it in the API service?

5. **Design system?**
   - Do you have existing components for buttons, cards, badges?
   - Any color scheme or design guidelines?

---

## Reference Files

📄 **Complete API Documentation:**
```
docs/DRIVER_ORDER_HISTORY_API.md
```

📁 **Backend Source Code (for reference):**
```
src/order/order.controller.js (line 1507)
src/order/order.routes.js (line 69)
schema/order.schema.js
```

---

## Example Claude Prompt

**Use this prompt when asking Claude to build this:**

```
I need you to build a Driver Order History feature for my food delivery app.

Context:
- I have a backend API ready at http://localhost:5005/api
- Complete API documentation is in docs/DRIVER_ORDER_HISTORY_API.md
- I'm using [React/React Native/Vue/etc.]
- Authentication: Bearer token stored in localStorage

Requirements:
1. Read the API documentation in docs/DRIVER_ORDER_HISTORY_API.md
2. Create an API service to fetch driver orders
3. Build a UI to display active deliveries with:
   - Customer name and phone
   - Delivery address
   - Order items
   - Call and Navigate buttons
4. Handle all errors gracefully
5. Add pull-to-refresh

Please implement this following the structure and examples in the documentation.
```

---

## Success Criteria

Your implementation is complete when:

✅ A driver can see all their active deliveries
✅ Each order shows complete customer and delivery information
✅ Driver can call the customer with one tap
✅ Driver can navigate to delivery address with one tap
✅ All error scenarios are handled gracefully
✅ UI is clean, intuitive, and mobile-friendly
✅ Code is well-structured and maintainable

---

**Good luck with your integration!** 🚀

For any questions about the API, refer to `docs/DRIVER_ORDER_HISTORY_API.md`.
