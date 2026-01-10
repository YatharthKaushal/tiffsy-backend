# Admin Frontend Implementation Prompts (React Native)

Use these prompts sequentially with Claude to build the admin dashboard mobile app. Each prompt is self-contained with API context.

---

## Pre-requisites Prompt (Run First)

```
I'm building an admin dashboard mobile app for Tiffsy (a tiffin/meal delivery service) using React Native CLI (no Expo).

Tech Stack:
- React Native CLI (no Expo)
- TypeScript
- React Navigation v6 (stack + drawer/bottom tabs)
- React Query (TanStack Query) for data fetching
- Axios for API calls
- React Hook Form + Zod for form validation
- AsyncStorage for token persistence
- React Native Paper OR custom components for UI

Base API URL: `http://10.0.2.2:5000/api` (Android emulator) or `http://localhost:5000/api` (iOS)

Authentication:
- Admin logs in with username/password
- JWT token stored in AsyncStorage
- All API calls include: `Authorization: Bearer <token>`

Admin Login API:
POST /api/auth/admin/login
Request: { "username": "admin", "password": "Admin@123" }
Response: { "success": true, "data": { "token": "...", "user": { "_id", "name", "role": "ADMIN" } } }

Please set up:
1. Auth context with login/logout + AsyncStorage persistence
2. Navigation structure:
   - Auth Stack (Login)
   - Main Drawer/Tab Navigator (Dashboard, Zones, Kitchens, Subscriptions, Orders, Users)
3. API client with auth interceptor (attach token, handle 401)
4. Common components: Button, Input, Card, Badge, Modal, LoadingSpinner
5. Login screen with form validation

Keep code clean and modular. Use proper TypeScript types.
```

---

## 1. Zone Management Prompt

```
Implement Zone Management for the React Native admin app.

## Context
Zones are delivery areas based on pincode (1 pincode = 1 zone). Admin can create, update, activate/deactivate zones, and toggle ordering.

## API Endpoints

### GET /api/zones
Fetch zones with filters.
Query: ?city=Mumbai&status=ACTIVE&search=400&page=1&limit=20
Response:
{
  "success": true,
  "data": {
    "zones": [{
      "_id": "6789abc123def456789abc01",
      "pincode": "400001",
      "name": "Fort",
      "city": "Mumbai",
      "state": "Maharashtra",
      "status": "ACTIVE",
      "orderingEnabled": true,
      "timezone": "Asia/Kolkata",
      "displayOrder": 1
    }],
    "pagination": { "total": 45, "page": 1, "limit": 20, "pages": 3 }
  }
}

### POST /api/zones
Create zone.
Request: { "pincode": "400003", "name": "Mandvi", "city": "Mumbai", "state": "Maharashtra", "timezone": "Asia/Kolkata", "status": "INACTIVE", "orderingEnabled": true, "displayOrder": 3 }
Response: { "success": true, "data": { "zone": {...} }, "message": "Zone created successfully" }

### PUT /api/zones/:id
Update zone (except pincode).
Request: { "name": "Fort Area", "city": "Mumbai", "displayOrder": 1 }

### PATCH /api/zones/:id/activate
Activate zone.

### PATCH /api/zones/:id/deactivate
Deactivate zone.

### PATCH /api/zones/:id/ordering
Toggle ordering.
Request: { "orderingEnabled": false }

### DELETE /api/zones/:id
Delete zone (fails if kitchens assigned).

### GET /api/zones/cities
Get distinct cities for filter dropdown.
Response: { "success": true, "data": { "cities": ["Mumbai", "Pune"] } }

## Requirements

1. **Zones List Screen** (`ZonesScreen`)
   - FlatList with zone cards showing: Pincode, Name, City, Status badge, Ordering toggle
   - Pull-to-refresh
   - Search bar (by pincode/name)
   - Filter chips/dropdown: City, Status (All/Active/Inactive)
   - FAB or header button: "Add Zone"
   - Infinite scroll pagination

2. **Zone Card Component**
   - Pincode (bold), Name, City
   - Status badge (green ACTIVE / gray INACTIVE)
   - Ordering toggle switch
   - Tap card to open edit modal/screen
   - Swipe actions or long-press menu: Edit, Delete

3. **Create/Edit Zone Modal or Screen**
   - Form fields: Pincode (6 digits, required, disabled on edit), Name, City, State, Timezone (picker, default: Asia/Kolkata), Display Order
   - Validation with Zod
   - Save button with loading state

4. **Actions**
   - Toggle ordering (inline switch)
   - Toggle status (activate/deactivate)
   - Delete with confirmation alert

5. **Status Badges**
   - ACTIVE: green background
   - INACTIVE: gray background

6. **Error Handling**
   - Show toast/snackbar on success/error
   - Handle duplicate pincode error (409)

Use React Query for data fetching/mutations. Create reusable components.
```

---

## 2. Kitchen Management Prompt

```
Implement Kitchen Management for the React Native admin app.

## Context
Kitchens can be TIFFSY (company-owned) or PARTNER. Admin can create kitchens, assign zones, manage flags (authorized/premium/gourmet), and control status.

## API Endpoints

### GET /api/kitchens
Fetch kitchens with filters.
Query: ?type=TIFFSY&status=ACTIVE&zoneId=xxx&search=central&page=1&limit=20
Response:
{
  "success": true,
  "data": {
    "kitchens": [{
      "_id": "6789def123abc456789def01",
      "name": "Tiffsy Central Kitchen",
      "code": "KIT-A2B3C",
      "type": "TIFFSY",
      "authorizedFlag": true,
      "premiumFlag": false,
      "gourmetFlag": false,
      "logo": "https://cdn.tiffsy.com/...",
      "cuisineTypes": ["North Indian", "South Indian"],
      "address": { "addressLine1": "...", "locality": "Andheri", "city": "Mumbai", "pincode": "400069" },
      "zonesServed": [{ "_id": "...", "pincode": "400001", "name": "Fort" }],
      "operatingHours": {
        "lunch": { "startTime": "10:00", "endTime": "14:00" },
        "dinner": { "startTime": "18:00", "endTime": "22:00" }
      },
      "contactPhone": "9876543210",
      "status": "ACTIVE",
      "isAcceptingOrders": true,
      "averageRating": 4.5,
      "totalRatings": 1250
    }],
    "pagination": { "total": 12, "page": 1, "limit": 20, "pages": 1 }
  }
}

### POST /api/kitchens
Create kitchen.
Request: {
  "name": "Spice Garden Kitchen",
  "type": "PARTNER",
  "authorizedFlag": false,
  "premiumFlag": true,
  "cuisineTypes": ["North Indian"],
  "address": { "addressLine1": "...", "locality": "...", "city": "Mumbai", "pincode": "400013" },
  "zonesServed": ["zone_id_1", "zone_id_2"],
  "operatingHours": { "lunch": { "startTime": "11:00", "endTime": "15:00" } },
  "contactPhone": "9876543211",
  "ownerName": "Raj Sharma",
  "ownerPhone": "9876543212"
}

### PUT /api/kitchens/:id
Update kitchen details.

### PATCH /api/kitchens/:id/flags
Update flags.
Request: { "authorizedFlag": true, "premiumFlag": true, "gourmetFlag": false }

### PATCH /api/kitchens/:id/zones
Update zones served.
Request: { "zonesServed": ["zone_id_1", "zone_id_2", "zone_id_3"] }

### PATCH /api/kitchens/:id/activate
Activate kitchen.

### PATCH /api/kitchens/:id/deactivate
Deactivate kitchen.

### PATCH /api/kitchens/:id/suspend
Suspend kitchen.
Request: { "reason": "Quality issues reported" }

### PATCH /api/kitchens/:id/accepting-orders
Toggle order acceptance.
Request: { "isAcceptingOrders": false }

### DELETE /api/kitchens/:id
Soft delete kitchen.

## Requirements

1. **Kitchens List Screen** (`KitchensScreen`)
   - FlatList with kitchen cards
   - Search bar
   - Filter chips: Type (All/TIFFSY/PARTNER), Status
   - FAB: "Add Kitchen"
   - Pull-to-refresh, infinite scroll

2. **Kitchen Card Component**
   - Logo thumbnail (or placeholder icon)
   - Name, Code, Type badge
   - Status badge, Rating stars
   - Zones count chip
   - "Accepting Orders" indicator (green dot or toggle)
   - Tap to navigate to detail screen

3. **Kitchen Detail Screen** (`KitchenDetailScreen`)
   - Header: Logo, Name, Code, Type badge, Status badge
   - Sections (collapsible or tabs):
     - **Info**: Description, Cuisine Types, Contact, Owner (for PARTNER)
     - **Address**: Full address display
     - **Zones**: List of zones served with "Edit" button
     - **Hours**: Operating hours for Lunch/Dinner
     - **Flags**: Authorized, Premium, Gourmet toggles
   - Action buttons: Edit, Activate/Deactivate, Suspend, Toggle Accepting Orders

4. **Create Kitchen Screen** (multi-step or scrollable form)
   - Step 1: Basic Info (Name, Type, Description, Cuisine Types)
   - Step 2: Address (AddressLine1, Locality, City, Pincode)
   - Step 3: Contact (Phone, Email, Owner for PARTNER)
   - Step 4: Zones (multi-select picker)
   - Step 5: Hours (time pickers)

5. **Zone Selection Modal**
   - Searchable list of zones
   - Checkboxes for multi-select
   - Show selected count

6. **Status Badges**
   - ACTIVE: green
   - INACTIVE: gray
   - PENDING_APPROVAL: yellow/amber
   - SUSPENDED: red

7. **Type Badges**
   - TIFFSY: blue
   - PARTNER: purple

Use time picker component for operating hours. Create reusable zone picker.
```

---

## 3. Subscription Plan Management Prompt

```
Implement Subscription Plan Management for the React Native admin app.

## Context
Plans are voucher packages customers purchase (7/14/30/60 day plans). Admin creates plans with pricing, voucher config, and can view all customer subscriptions.

## API Endpoints

### GET /api/subscriptions/plans
Fetch plans.
Query: ?status=ACTIVE&page=1&limit=20
Response:
{
  "success": true,
  "data": {
    "plans": [{
      "_id": "6789plan123abc456789ab01",
      "name": "Weekly Starter",
      "description": "Perfect for trying out Tiffsy meals",
      "durationDays": 7,
      "vouchersPerDay": 2,
      "voucherValidityDays": 90,
      "price": 699,
      "originalPrice": 999,
      "totalVouchers": 14,
      "coverageRules": { "includesAddons": false, "mealTypes": ["BOTH"] },
      "displayOrder": 1,
      "badge": "STARTER",
      "features": ["14 meal vouchers", "Valid for 90 days"],
      "status": "ACTIVE"
    }],
    "pagination": { "total": 5, "page": 1, "limit": 20, "pages": 1 }
  }
}

### POST /api/subscriptions/plans
Create plan.
Request: {
  "name": "Bi-Weekly Plan",
  "description": "Two weeks of delicious meals",
  "durationDays": 14,
  "vouchersPerDay": 2,
  "voucherValidityDays": 90,
  "price": 1299,
  "originalPrice": 1799,
  "coverageRules": { "includesAddons": false, "mealTypes": ["BOTH"] },
  "displayOrder": 2,
  "badge": "POPULAR",
  "features": ["28 meal vouchers", "Valid for 90 days"],
  "status": "INACTIVE"
}

### PUT /api/subscriptions/plans/:id
Update plan (cannot change durationDays or vouchersPerDay).

### PATCH /api/subscriptions/plans/:id/activate
Activate plan.

### PATCH /api/subscriptions/plans/:id/deactivate
Deactivate plan.

### PATCH /api/subscriptions/plans/:id/archive
Archive plan (permanent).

### GET /api/subscriptions/admin/all
View all customer subscriptions.
Query: ?status=ACTIVE&page=1&limit=20
Response:
{
  "success": true,
  "data": {
    "subscriptions": [{
      "_id": "6789sub123abc456789ab001",
      "userId": { "_id": "...", "name": "John Doe", "phone": "9876543210" },
      "planId": { "_id": "...", "name": "Weekly Starter", "durationDays": 7 },
      "status": "ACTIVE",
      "purchasedAt": "2025-01-05T10:00:00.000Z",
      "expiresAt": "2025-04-05T10:00:00.000Z",
      "vouchersIssued": 14,
      "vouchersUsed": 5,
      "vouchersRemaining": 9,
      "amountPaid": 699,
      "paymentMethod": "UPI"
    }],
    "pagination": { "total": 150, "page": 1, "limit": 20, "pages": 8 }
  }
}

### POST /api/subscriptions/:id/admin-cancel
Cancel subscription with refund.
Request: { "reason": "Customer requested", "issueRefund": true, "refundAmount": 500 }

## Requirements

1. **Subscriptions Screen** with Top Tabs: Plans | Subscriptions

2. **Plans Tab**
   - FlatList of plan cards
   - Plan Card: Name, Duration badge, Price (with strikethrough original), Vouchers count, Status badge
   - Show discount percentage
   - FAB: "Add Plan"
   - Filter chips: Status (All/Active/Inactive/Archived)
   - Tap card to edit

3. **Create/Edit Plan Screen**
   - Name, Description (multiline)
   - Duration picker (7, 14, 30, 60 days) - disabled on edit
   - Vouchers per day (1-4) - disabled on edit
   - Price, Original Price inputs
   - Badge text input
   - Features: Dynamic list (add/remove items)
   - Valid From/Till: Date pickers (optional)
   - Status toggle

4. **Subscriptions Tab**
   - FlatList of subscription cards
   - Card: Customer name/phone, Plan name, Status badge, Vouchers progress (5/14 used), Amount
   - Filter chips: Status (All/Active/Expired/Cancelled)
   - Tap to view details

5. **Subscription Detail Modal/Screen**
   - Customer info section
   - Plan info section
   - Voucher usage progress bar with numbers
   - Payment info
   - Cancel button (if active)

6. **Cancel Subscription Modal**
   - Reason input (required)
   - Issue refund switch
   - Refund amount input (if issuing refund)

7. **Status Badges**
   - Plans: ACTIVE (green), INACTIVE (gray), ARCHIVED (red)
   - Subscriptions: ACTIVE (green), EXPIRED (gray), CANCELLED (red)

Create a reusable progress bar component for voucher usage.
```

---

## 4. Orders Management Prompt

```
Implement Orders Management for the React Native admin app.

## Context
Orders can be MEAL_MENU (subscription-based with vouchers) or ON_DEMAND_MENU (direct purchase). Admin views orders, filters by status, and can cancel with refund.

## Status Flow
PLACED -> ACCEPTED -> PREPARING -> READY -> PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED
Alternate: PLACED -> REJECTED, Any -> CANCELLED, Any -> FAILED

## API Endpoints

### GET /api/orders/admin/all
Fetch orders.
Query: ?status=PLACED&menuType=MEAL_MENU&kitchenId=xxx&dateFrom=2025-01-01&page=1&limit=20
Response:
{
  "success": true,
  "data": {
    "orders": [{
      "_id": "6789ord123abc456789ab001",
      "orderNumber": "ORD-20250110-A2B3C",
      "userId": { "_id": "...", "name": "John Doe", "phone": "9876543210" },
      "kitchenId": { "_id": "...", "name": "Tiffsy Central Kitchen" },
      "zoneId": { "_id": "...", "pincode": "400001", "name": "Fort" },
      "menuType": "MEAL_MENU",
      "mealWindow": "LUNCH",
      "status": "PLACED",
      "paymentStatus": "PAID",
      "grandTotal": 299,
      "amountPaid": 42,
      "voucherUsage": { "voucherCount": 2 },
      "itemCount": 2,
      "placedAt": "2025-01-10T08:30:00.000Z",
      "estimatedDeliveryTime": "2025-01-10T12:30:00.000Z"
    }],
    "pagination": { "total": 245, "page": 1, "limit": 20, "pages": 13 }
  }
}

### GET /api/orders/:id
Full order details including items, address, charges, statusTimeline.

### GET /api/orders/admin/stats
Response:
{
  "success": true,
  "data": {
    "today": { "total": 156, "placed": 12, "preparing": 15, "delivered": 70, "cancelled": 6 },
    "byMenuType": { "MEAL_MENU": 120, "ON_DEMAND_MENU": 36 },
    "revenue": { "today": 45600, "thisWeek": 320000, "thisMonth": 1250000 }
  }
}

### PATCH /api/orders/:id/admin-cancel
Cancel order.
Request: { "reason": "Customer reported incorrect address", "issueRefund": true, "restoreVouchers": true }

## Requirements

1. **Orders Screen** (`OrdersScreen`)
   - Stats summary cards at top (horizontal scroll):
     - Today's Total, Placed (pending), Preparing, Delivered, Cancelled
     - Revenue Today
   - Status filter tabs (horizontal scroll): All, Placed, Accepted, Preparing, Ready, Out for Delivery, Delivered, Cancelled
   - Order list below

2. **Order Card Component**
   - Order number (bold)
   - Customer name, phone (tap to call)
   - Kitchen name
   - Menu type badge (MEAL/ON_DEMAND), Meal window badge (LUNCH/DINNER)
   - Status badge (color-coded)
   - Amount, Time ago ("5 min ago")
   - Item count
   - Tap to view details

3. **Order Detail Screen** (`OrderDetailScreen`)
   - Header: Order#, Status badge
   - Customer section: Name, Phone (with call button), Email
   - Delivery address section (full address)
   - Items section: List of items with quantity, addons
   - Pricing breakdown: Subtotal, Fees, Taxes, Discount, Total
   - Voucher info (if used)
   - Special instructions (if any)
   - Status Timeline: Vertical stepper showing each status with timestamp
   - Actions: Cancel button (if cancellable)

4. **Cancel Order Modal**
   - Reason input (required)
   - Issue refund switch
   - Restore vouchers switch (if vouchers used)
   - Confirm button

5. **Status Badges** (background colors)
   - PLACED: blue
   - ACCEPTED: cyan
   - PREPARING: amber/yellow
   - READY: orange
   - PICKED_UP: purple
   - OUT_FOR_DELIVERY: indigo
   - DELIVERED: green
   - CANCELLED: red
   - REJECTED: red
   - FAILED: dark red

6. **Menu Type Badges**
   - MEAL_MENU: green outline
   - ON_DEMAND_MENU: blue outline

7. **Pull-to-refresh** on order list

8. **Auto-refresh** every 30 seconds (or manual refresh button)

Create StatusTimeline component showing vertical steps. Format dates as relative time for < 24h.
```

---

## 5. Customer & User Management Prompt

```
Implement User Management for the React Native admin app.

## Context
Manage all user types: CUSTOMER, KITCHEN_STAFF, DRIVER, ADMIN. Admin can view, create staff/drivers/admins, activate/deactivate/suspend accounts.

## Roles
- CUSTOMER: App users (self-register via Firebase OTP) - view only
- KITCHEN_STAFF: Kitchen employees (admin creates, needs kitchenId)
- DRIVER: Delivery personnel (admin creates)
- ADMIN: System administrators (admin creates, needs username/password)

## API Endpoints

### GET /api/admin/users
Fetch users.
Query: ?role=CUSTOMER&status=ACTIVE&search=john&page=1&limit=20
Response:
{
  "success": true,
  "data": {
    "users": [{
      "_id": "6789user123abc456789ab01",
      "phone": "9876543210",
      "role": "CUSTOMER",
      "name": "John Doe",
      "email": "john@example.com",
      "dietaryPreferences": ["VEG"],
      "status": "ACTIVE",
      "lastLoginAt": "2025-01-10T08:00:00.000Z"
    }],
    "pagination": { "total": 1250, "page": 1, "limit": 20, "pages": 63 }
  }
}

For KITCHEN_STAFF includes:
"kitchenId": { "_id": "...", "name": "Tiffsy Central Kitchen" }

### GET /api/admin/users/:id
Full user details with stats.

### POST /api/admin/users
Create staff/driver/admin.

Kitchen Staff: { "phone": "9876543225", "role": "KITCHEN_STAFF", "name": "Suresh Patel", "kitchenId": "xxx" }
Driver: { "phone": "9876543230", "role": "DRIVER", "name": "Vijay Singh" }
Admin: { "phone": "9876543240", "role": "ADMIN", "name": "New Admin", "username": "newadmin", "password": "SecurePass@123" }

### PUT /api/admin/users/:id
Update user.

### PATCH /api/admin/users/:id/activate
Activate user.

### PATCH /api/admin/users/:id/deactivate
Deactivate user.

### PATCH /api/admin/users/:id/suspend
Request: { "reason": "Repeated order cancellations" }

### DELETE /api/admin/users/:id
Soft delete.

### POST /api/admin/users/:id/reset-password
Request: { "newPassword": "NewSecure@456" }

### GET /api/admin/dashboard
Dashboard stats.

## Requirements

1. **Users Screen** with Top Tabs: Customers | Staff | Drivers | Admins

2. **Each Tab shows FlatList**
   - Search bar
   - User cards with: Name, Phone, Role badge, Status badge, Last login
   - For Staff: Show kitchen name
   - FAB on Staff/Drivers/Admins tabs: "Add User"

3. **User Card Component**
   - Avatar placeholder or profile image
   - Name (bold), Phone
   - Role badge, Status badge
   - Last login time (relative)
   - Tap to view details

4. **User Detail Screen**
   - Header: Avatar, Name, Role badge, Status badge
   - Contact: Phone (tap to call), Email
   - Role-specific info:
     - CUSTOMER: Dietary preferences, Order stats, Subscription status, Addresses
     - KITCHEN_STAFF: Assigned kitchen, Orders processed
     - ADMIN: Username
   - Actions: Edit, Activate/Deactivate, Suspend, Delete
   - For ADMIN: Reset Password option

5. **Create User Screen**
   - Role picker first (KITCHEN_STAFF, DRIVER, ADMIN)
   - Common fields: Phone, Name, Email
   - KITCHEN_STAFF: Kitchen picker (required)
   - ADMIN: Username, Password inputs
   - Form validation

6. **Suspend User Modal**
   - Reason input (required)
   - Confirm button

7. **Reset Password Modal** (for ADMIN)
   - New password input (min 8 chars)
   - Confirm button

8. **Status Badges**
   - ACTIVE: green
   - INACTIVE: gray
   - SUSPENDED: red

9. **Role Badges**
   - CUSTOMER: blue
   - KITCHEN_STAFF: purple
   - DRIVER: orange
   - ADMIN: red

Create kitchen picker as a searchable modal for staff creation.
```

---

## 6. Dashboard & Final Integration Prompt

```
Implement the main Dashboard and finalize navigation for the React Native admin app.

## API Endpoint

### GET /api/admin/dashboard
Response:
{
  "success": true,
  "data": {
    "users": { "totalCustomers": 12500, "activeCustomers": 11800, "newCustomersToday": 45, "totalStaff": 25, "totalDrivers": 50 },
    "orders": { "totalToday": 856, "pendingOrders": 45, "completedToday": 680, "cancelledToday": 11 },
    "revenue": { "today": 125000, "thisWeek": 850000, "thisMonth": 3500000 },
    "subscriptions": { "activeSubscriptions": 2500, "newSubscriptionsToday": 25 },
    "kitchens": { "totalActive": 12, "acceptingOrders": 10 },
    "zones": { "totalActive": 45, "orderingEnabled": 42 }
  }
}

## Requirements

1. **Dashboard Screen** (`DashboardScreen`)
   - Header: "Dashboard", User info (name, logout button)
   - Pull-to-refresh

   - **Stats Cards Grid** (2 columns):
     - Customers: totalCustomers (+newToday)
     - Active Subscriptions
     - Orders Today
     - Revenue Today (₹ formatted)
     - Pending Orders (highlight if > 0)
     - Active Kitchens
     - Active Zones

   - **Quick Actions Row** (horizontal scroll):
     - "View Pending Orders" -> navigate to Orders with PLACED filter
     - "Add Kitchen" -> navigate to Create Kitchen
     - "Add Zone" -> navigate to Create Zone

   - **Today's Summary Section**:
     - Orders: Completed / Total
     - Cancelled: count
     - Revenue breakdown (Today, Week, Month)

2. **Navigation Structure**
   - Drawer Navigator OR Bottom Tab Navigator:
     - Dashboard (home icon)
     - Zones (map-marker icon)
     - Kitchens (store icon)
     - Subscriptions (card icon)
     - Orders (package icon)
     - Users (people icon)

   - Header on each screen with:
     - Menu/back button
     - Screen title
     - Optional action buttons

3. **Common Components to Finalize**
   - StatCard: Icon, Label, Value, optional sub-value
   - Badge: Colored background with text
   - EmptyState: Icon, message, optional action button
   - LoadingState: Centered spinner
   - ErrorState: Message with retry button
   - ConfirmDialog: Title, message, confirm/cancel buttons
   - Toast/Snackbar: Success/error messages

4. **App-wide Patterns**
   - Loading skeletons for lists
   - Pull-to-refresh everywhere
   - Empty states for empty lists
   - Error states with retry
   - Confirm before destructive actions

5. **Theme**
   - Primary color: Tiffsy brand color
   - Consistent spacing (8px grid)
   - Consistent typography
   - Status colors: green (success), red (error), amber (warning), gray (inactive)

6. **Polish**
   - Splash screen
   - App icon
   - Handle offline state
   - Keyboard aware scroll views for forms

Create a cohesive, polished admin app with consistent styling throughout.
```

---

## Usage Notes

1. **Run prompts in order** - Start with Pre-requisites, then each module
2. **One module at a time** - Complete and test each before moving to next
3. **Reference API docs** - Full API documentation is in the same folder
4. **Test on device/emulator** - Verify touch interactions work well
5. **Handle both platforms** - Test on both iOS and Android

## Recommended Libraries

```
# Navigation
@react-navigation/native
@react-navigation/stack
@react-navigation/bottom-tabs
@react-navigation/drawer

# Data Fetching
@tanstack/react-query
axios

# Forms
react-hook-form
@hookform/resolvers
zod

# Storage
@react-native-async-storage/async-storage

# UI (choose one)
react-native-paper
# OR build custom components

# Utilities
react-native-vector-icons
date-fns
react-native-toast-message
```
