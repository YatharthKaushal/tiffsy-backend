# Driver Order & Batch Management - Admin UI Integration Guide

## Table of Contents
1. [Overview](#overview)
2. [IMPLEMENTATION PROMPTS FOR CLAUDE (START HERE)](#implementation-prompts-for-claude-start-here)
3. [System Architecture](#system-architecture)
4. [Complete Workflow](#complete-workflow)
5. [API Endpoints Reference](#api-endpoints-reference)
6. [Data Models](#data-models)
7. [UI Requirements & Mockups](#ui-requirements--mockups)
8. [Implementation Guide](#implementation-guide)
9. [Error Handling](#error-handling)
10. [Testing Scenarios](#testing-scenarios)

---

## Overview

The backend implements a comprehensive order and batch management system for efficient delivery operations:

**Key Features:**
- **Order Management:** Track orders from placement to delivery
- **Auto-Batching:** Automatically group orders by kitchen, zone, and meal window
- **Driver Assignment:** Assign batches to drivers for delivery
- **Delivery Tracking:** Real-time status updates and proof of delivery
- **Performance Analytics:** Driver statistics and delivery success rates
- **Admin Controls:** Override capabilities, batch reassignment, cancellation

**Current Status:** Backend fully implemented ✅ | Admin UI integration needed ❌

**Base URL:** `http://localhost:4000/api` (development) or `https://your-domain.com/api` (production)

---

## IMPLEMENTATION PROMPTS FOR CLAUDE (START HERE)

**IMPORTANT:** These are step-by-step prompts to build the complete Order & Batch Management admin UI from scratch. Give these prompts to Claude one by one or in sequence.

---

### 🎯 PROMPT 1: Setup Project Structure & Service Layer

```
I need to build an Order and Batch Management admin interface. The backend API is already implemented and running.

TASK: Set up the project structure and create the API service layer.

1. Create the following folder structure:
   src/
   ├── pages/admin/
   │   ├── OrdersDashboard.jsx
   │   ├── OrderDetailsPage.jsx
   │   ├── BatchesDashboard.jsx
   │   ├── BatchDetailsPage.jsx
   │   ├── BatchOperationsPage.jsx
   │   └── DeliveryAnalytics.jsx
   ├── components/admin/orders/
   │   ├── OrderTable.jsx
   │   ├── OrderDetailModal.jsx
   │   ├── UpdateOrderStatusModal.jsx
   │   ├── CancelOrderDialog.jsx
   │   └── OrderStatusTimeline.jsx
   ├── components/admin/batches/
   │   ├── BatchTable.jsx
   │   ├── BatchDetailModal.jsx
   │   ├── ReassignBatchDialog.jsx
   │   ├── CancelBatchDialog.jsx
   │   ├── AutoBatchForm.jsx
   │   ├── DispatchBatchForm.jsx
   │   └── DeliveryStatsCard.jsx
   └── services/
       └── orderBatchService.js

2. Create `src/services/orderBatchService.js` with the following API methods:

   ORDER MANAGEMENT:
   - getAllOrders(filters) - GET /api/orders/admin/all
   - getOrderDetails(orderId) - GET /api/orders/:id
   - updateOrderStatus(orderId, status, notes) - PATCH /api/orders/admin/:id/status
   - cancelOrder(orderId, reason, initiateRefund) - PATCH /api/orders/:id/admin-cancel

   BATCH MANAGEMENT:
   - getAllBatches(filters) - GET /api/delivery/admin/batches
   - getBatchDetails(batchId) - GET /api/delivery/batches/:batchId
   - triggerAutoBatch(filters) - POST /api/delivery/auto-batch
   - dispatchBatches(filters) - POST /api/delivery/dispatch
   - reassignBatch(batchId, newDriverId, reason) - PATCH /api/delivery/batches/:batchId/reassign
   - cancelBatch(batchId, reason) - PATCH /api/delivery/batches/:batchId/cancel

   ANALYTICS:
   - getDeliveryStats(filters) - GET /api/delivery/admin/stats

   CONFIGURATION:
   - getBatchConfig() - GET /api/delivery/config
   - updateBatchConfig(config) - PUT /api/delivery/config

3. All API calls should:
   - Include Authorization header: `Bearer ${localStorage.getItem('authToken')}`
   - Use BASE_URL from environment variable or default to 'http://localhost:4000/api'
   - Handle errors properly with try-catch
   - Return parsed JSON responses

4. Add proper TypeScript types or JSDoc comments for all methods.

Please implement this service layer with proper error handling.
```

---

### 🎯 PROMPT 2: Build Orders Dashboard Page

```
TASK: Create the main Orders Dashboard page with filters, search, and table view.

Build `src/pages/admin/OrdersDashboard.jsx` with:

FEATURES:

1. Tabbed navigation with counts:
   - All Orders (total count)
   - Active (PLACED, ACCEPTED, PREPARING, READY)
   - Out for Delivery (PICKED_UP, OUT_FOR_DELIVERY)
   - Delivered (DELIVERED)
   - Failed (FAILED)
   - Cancelled (CANCELLED)

2. Filters & Search:
   - Search bar: "Search by order number or customer phone..."
   - Kitchen dropdown filter
   - Zone dropdown filter
   - Driver dropdown filter (show "Unassigned" option)
   - Date range picker (Today, Yesterday, Last 7 days, Last 30 days, Custom)
   - Status filter (all order statuses)
   - Menu type filter (MEAL_MENU, ON_DEMAND_MENU)

3. Table columns:
   - Order Number (e.g., ORD-20260117-00123)
   - Customer Name & Phone
   - Kitchen Name & Zone
   - Driver Name & Phone (or "Unassigned")
   - Status Badge (colored by status)
   - Payment Status Badge
   - Total Amount (₹)
   - Placed At (time)
   - Actions dropdown (View Details, Update Status, Cancel)

4. Pagination:
   - Show "Page X of Y"
   - Total orders count
   - Previous/Next buttons
   - Items per page: 20

5. Real-time Updates:
   - Auto-refresh every 30 seconds (optional)
   - [Refresh] button

6. Quick Stats Summary (at top):
   - Total Orders Today
   - Active Deliveries
   - Success Rate Today
   - Failed Today

7. Click on row to open order details modal

Use API: orderBatchService.getAllOrders(filters)

Implement with proper state management, loading states, and error handling.
```

---

### 🎯 PROMPT 3: Build Order Details Modal

```
TASK: Create comprehensive order details modal.

Build `src/components/admin/orders/OrderDetailModal.jsx` with:

LAYOUT SECTIONS:

1. Header:
   - Order Number (large, bold)
   - Status Badge (current status)
   - Payment Status Badge
   - Placed At timestamp
   - Estimated Delivery Time
   - [Update Status] [Cancel Order] buttons

2. Customer Information Card:
   - Name, Phone
   - Delivery Address (full address)
   - [View on Map] button (opens Google Maps with coordinates)
   - Special Instructions (if any)

3. Order Items Card:
   - List each item:
     * Item name
     * Quantity
     * Unit Price
     * Total Price
     * Addons (if any)
   - Subtotal
   - Delivery Fee
   - Service Fee
   - Packaging Fee
   - Tax Amount
   - Discount (if applied)
   - GRAND TOTAL (bold, large)

4. Kitchen Information Card:
   - Kitchen Name
   - Zone Name & Code
   - Menu Type (MEAL_MENU / ON_DEMAND_MENU)
   - Meal Window (LUNCH / DINNER, if applicable)

5. Delivery Information Card:
   - Driver Name & Phone (or "Not Assigned")
   - Vehicle Info (type + number)
   - Batch Number (if batched) with [View Batch] button
   - Proof of Delivery (if delivered):
     * Type (OTP / SIGNATURE / PHOTO)
     * Value/Image
     * Verified At timestamp

6. Status Timeline (Vertical Timeline):
   Display all status changes chronologically:
   - Icon based on status
   - Status name
   - Timestamp
   - Updated by (user name)
   - Notes (if any)

   Example:
   ✅ DELIVERED         12:05 PM  by Rajesh Kumar
   🚚 OUT FOR DELIVERY  11:50 AM  by Rajesh Kumar
   📦 PICKED UP         11:45 AM  by Rajesh Kumar
   ✓ READY              11:30 AM  by Kitchen A
   👨‍🍳 PREPARING          10:05 AM  by Kitchen A
   ✓ ACCEPTED           10:05 AM  by Kitchen A
   📝 PLACED            10:00 AM  by John Doe

7. Action Buttons (at bottom):
   - [Close]
   - [Update Status]
   - [Cancel Order]
   - [Contact Customer] (open phone dialer)

Use APIs:
- orderBatchService.getOrderDetails(orderId)

Implement with smooth animations, responsive design, and proper data formatting.
```

---

### 🎯 PROMPT 4: Build Update Order Status Modal

```
TASK: Create modal for admin to update order status manually.

Build `src/components/admin/orders/UpdateOrderStatusModal.jsx` with:

FEATURES:

1. Status Selection:
   - Dropdown with all valid statuses:
     * PLACED
     * ACCEPTED
     * REJECTED
     * PREPARING
     * READY
     * PICKED_UP
     * OUT_FOR_DELIVERY
     * DELIVERED
     * CANCELLED
     * FAILED

2. Notes/Reason Field:
   - Textarea: "Reason for status change (optional)"
   - Placeholder: "e.g., Customer confirmed delivery via phone"

3. Visual Indicators:
   - Show current status → new status arrow
   - Warning if status change is unusual (e.g., DELIVERED → PLACED)

4. Confirmation:
   - [Cancel] [Update Status] buttons
   - Loading state during API call
   - Success toast: "Order status updated to {status}"
   - Error toast if fails

5. Side Effects Display:
   - Show what will happen:
     * "Order will be marked as delivered"
     * "Driver will be notified"
     * "Customer will receive notification"

API:
- orderBatchService.updateOrderStatus(orderId, status, notes)

After success:
- Close modal
- Refresh order details
- Show success notification

Implement with validation and proper error handling.
```

---

### 🎯 PROMPT 5: Build Cancel Order Dialog

```
TASK: Create dialog for admin to cancel orders.

Build `src/components/admin/orders/CancelOrderDialog.jsx` with:

FEATURES:

1. Cancellation Reason:
   - Textarea: "Reason for cancellation" (required, min 10 chars)
   - Common reasons chips (clickable to auto-fill):
     * Customer requested cancellation
     * Wrong order placed
     * Kitchen closed unexpectedly
     * Driver unavailable
     * Other

2. Refund Options:
   - Checkbox: "Initiate refund" (checked by default if payment made)
   - Show payment amount if applicable
   - Disable if not paid yet

3. Order Information Summary:
   - Order Number
   - Customer Name
   - Total Amount
   - Current Status

4. Warning Message:
   - "⚠️ This action cannot be undone"
   - "Customer will be notified"
   - "Vouchers will be restored (if used)"

5. Confirmation:
   - [Go Back] [Confirm Cancellation] buttons
   - Loading state during API call
   - Success toast: "Order cancelled successfully"
   - Error toast if fails

API:
- orderBatchService.cancelOrder(orderId, reason, initiateRefund)

After success:
- Close dialog
- Refresh order list/details
- Show success notification

Implement with proper validation and user confirmation.
```

---

### 🎯 PROMPT 6: Build Batches Dashboard Page

```
TASK: Create the main Batches Dashboard page.

Build `src/pages/admin/BatchesDashboard.jsx` with:

FEATURES:

1. Tabbed navigation with counts:
   - All Batches
   - Collecting (accepting orders)
   - Ready for Dispatch (waiting for driver)
   - Dispatched (driver accepted)
   - In Progress (delivery ongoing)
   - Completed
   - Cancelled

2. Filters:
   - Kitchen dropdown
   - Zone dropdown
   - Driver dropdown
   - Date range picker
   - Meal Window (LUNCH / DINNER)

3. Action Buttons (top-right):
   - [Auto-Batch Orders] button (green)
   - [Dispatch Batches] button (blue)
   - [Batch Operations] link

4. Table columns:
   - Batch Number (e.g., BATCH-20260117-Z1-00001)
   - Kitchen Name
   - Zone Name & Code
   - Driver Name & Phone (or "Not Assigned")
   - Meal Window badge
   - Order Count (e.g., "12/15" - current/max)
   - Status Badge (colored)
   - Created At
   - Actions dropdown (View, Reassign, Cancel)

5. Batch Statistics Summary (top cards):
   - Active Batches: {count}
   - Orders in Transit: {count}
   - Completion Rate Today: {percentage}%
   - Average Batch Size: {number}

6. Pagination & Loading states

7. Click row to view batch details

Use API: orderBatchService.getAllBatches(filters)

Implement with real-time updates and proper state management.
```

---

### 🎯 PROMPT 7: Build Batch Details Page/Modal

```
TASK: Create comprehensive batch details view.

Build `src/pages/admin/BatchDetailsPage.jsx` (or modal) with:

LAYOUT SECTIONS:

1. Header:
   - Batch Number (large)
   - Status Badge
   - Kitchen Name & Zone
   - Meal Window Badge
   - Action buttons: [Reassign Driver] [Cancel Batch] [Refresh]

2. Driver Information Card:
   - Driver Name & Phone
   - Vehicle Info (type + number)
   - Assigned At timestamp
   - Picked Up At timestamp
   - [Call Driver] button
   - [Reassign Driver] button

3. Batch Statistics Card:
   - Total Orders: {count}
   - Delivered: {count} (green)
   - Pending: {count} (yellow)
   - Failed: {count} (red)
   - Success Rate: {percentage}%
   - Progress bar visualization

4. Delivery Sequence (List):
   Display orders in delivery sequence:
   Each item shows:
   - Sequence number (#1, #2, #3)
   - Order Number
   - Customer Name
   - Delivery Address (short)
   - Status Badge
   - Estimated/Actual delivery time
   - [View Order] button

   Visual indicators:
   - ✅ Green checkmark if delivered
   - 🚚 Truck icon if in progress
   - ⏳ Clock icon if pending
   - ❌ Red X if failed

5. Batch Timeline:
   - Created At
   - Dispatched At
   - Driver Assigned At
   - Picked Up At
   - Completed At (if completed)
   - Each with timestamp and user

6. Map View (optional):
   - Show all delivery locations
   - Driver's current location
   - Delivery route

Use APIs:
- orderBatchService.getBatchDetails(batchId)

Implement with real-time status updates and responsive design.
```

---

### 🎯 PROMPT 8: Build Batch Operations Page

```
TASK: Create page for triggering auto-batching and dispatch operations.

Build `src/pages/admin/BatchOperationsPage.jsx` with:

THREE MAIN SECTIONS:

1. AUTO-BATCHING SECTION:
   Title: "Auto-Batch Orders"
   Description: "Group READY orders into delivery batches"

   Form Fields:
   - Meal Window dropdown (LUNCH / DINNER / Both)
   - Kitchen dropdown (All / Select Kitchen)
   - Zone dropdown (All / Select Zone)
   - [Preview] button (shows how many batches will be created)

   Preview Display:
   - Ready Orders: {count}
   - Expected Batches: ~{count}
   - Max Orders per Batch: {maxBatchSize}

   - [Trigger Auto-Batch] button (primary, green)

   After clicking:
   - Show loading spinner
   - Display results:
     * Batches Created: {count}
     * Batches Updated: {count}
     * Orders Processed: {count}
     * List of batch numbers created
   - Success message

2. DISPATCH BATCHES SECTION:
   Title: "Dispatch Batches"
   Description: "Make batches available for driver acceptance"

   Form Fields:
   - Meal Window dropdown (LUNCH / DINNER)
   - Show cutoff time status:
     * ✅ "Cutoff time passed (11:30 AM)" - green
     * ⏳ "Waiting for cutoff (11:30 AM)" - yellow with countdown
   - Kitchen dropdown (optional)

   Preview Display:
   - COLLECTING Batches: {count}
   - Total Orders: {count}

   - [Dispatch Batches] button (primary, blue)
   - Disabled if cutoff time not passed

   After clicking:
   - Show loading spinner
   - Display results:
     * Batches Dispatched: {count}
     * List of batch numbers
   - Success message

3. CONFIGURATION SECTION:
   Title: "Batch Configuration"

   Form Fields:
   - Max Batch Size: Number input (1-25) [Default: 15]
   - Failed Order Policy: Radio buttons
     * Return to Kitchen
     * No Return
   - Auto Dispatch: Toggle switch
     * If enabled: Delay input (minutes after cutoff)
   - Sequence Policy: Dropdown
     * Driver Choice
     * System Optimized
     * Locked

   - [Save Configuration] button

   Show current config values on load

APIs:
- orderBatchService.triggerAutoBatch(filters)
- orderBatchService.dispatchBatches(filters)
- orderBatchService.getBatchConfig()
- orderBatchService.updateBatchConfig(config)

Implement with proper loading states, success/error messages, and validation.
```

---

### 🎯 PROMPT 9: Build Delivery Analytics Dashboard

```
TASK: Create comprehensive delivery analytics and reports page.

Build `src/pages/admin/DeliveryAnalytics.jsx` with:

FEATURES:

1. Date Range Filter (top):
   - Presets: Today, Yesterday, Last 7 days, Last 30 days, This Month, Custom
   - Additional Filters: Zone, Driver, Kitchen

2. Overall Performance Cards (4-column grid):
   - Total Deliveries
     * Large number
     * Comparison with previous period (e.g., "+12% from last week")
   - Success Rate
     * Large percentage
     * Green/red indicator
   - Total Failed
     * Number with red indicator
   - Average Delivery Time
     * Duration in minutes

3. Success Rate by Zone (Table):
   Columns:
   - Zone Name
   - Total Deliveries
   - Delivered Count
   - Failed Count
   - Success Rate % (with progress bar)
   - Sort by each column

4. Top Performing Drivers (Table):
   Columns:
   - Rank (#1, #2, #3...)
   - Driver Name & Phone
   - Total Deliveries
   - Success Rate % (with progress bar)
   - Active Deliveries
   - Badge for top 3 (🥇🥈🥉)

5. Performance by Meal Window (Chart):
   - Bar chart or pie chart
   - LUNCH vs DINNER
   - Show: Total Orders, Success Rate for each

6. Failure Reasons Breakdown (Pie Chart):
   - CUSTOMER_UNAVAILABLE: {count} ({percentage}%)
   - WRONG_ADDRESS: {count} ({percentage}%)
   - CUSTOMER_UNREACHABLE: {count} ({percentage}%)
   - ADDRESS_NOT_FOUND: {count} ({percentage}%)
   - CUSTOMER_REFUSED: {count} ({percentage}%)
   - OTHER: {count} ({percentage}%)

7. Delivery Trends Chart (Line Graph):
   - X-axis: Date/Time
   - Y-axis: Number of Deliveries
   - Lines: Total, Successful, Failed

8. Export Reports Button:
   - [Export to CSV] button
   - Downloads report with all data

Use API: orderBatchService.getDeliveryStats(filters)

Implement with interactive charts (use Chart.js, Recharts, or similar), responsive grid, and smooth animations.
```

---

### 🎯 PROMPT 10: Build Reassign and Cancel Batch Dialogs

```
TASK: Create dialogs for reassigning batches to different drivers and cancelling batches.

Build two components:

1. `src/components/admin/batches/ReassignBatchDialog.jsx`:

   FEATURES:
   - Title: "Reassign Batch - {batchNumber}"
   - Current Driver Info:
     * Name, Phone
     * Vehicle info
     * Assigned at time
   - New Driver Selection:
     * Searchable dropdown of active, approved drivers
     * Show driver info: name, phone, vehicle, current active deliveries
     * Filter: only show drivers with capacity
   - Reason for Reassignment:
     * Textarea (required, min 10 chars)
     * Common reasons chips:
       - Original driver unavailable
       - Vehicle breakdown
       - Driver requested change
       - Performance issues
   - Batch Info:
     * Order count
     * Zone
     * Kitchen
   - Warning: "Driver will be notified immediately"
   - [Cancel] [Reassign Batch] buttons

   API: orderBatchService.reassignBatch(batchId, newDriverId, reason)


2. `src/components/admin/batches/CancelBatchDialog.jsx`:

   FEATURES:
   - Title: "Cancel Batch - {batchNumber}"
   - Batch Information:
     * Batch Number
     * Kitchen & Zone
     * Driver (if assigned)
     * Order Count
     * Current Status
   - Cancellation Reason:
     * Textarea (required, min 10 chars)
     * Common reasons:
       - Kitchen closed unexpectedly
       - Weather emergency
       - Zone unavailable
       - System error
   - Impact Summary:
     * "All {count} orders will be unbatched"
     * "Driver will be notified"
     * "Orders will return to READY status"
     * "Available for new batch assignment"
   - Restrictions:
     * Show error if batch is COMPLETED or PARTIAL_COMPLETE
     * "Cannot cancel completed batches"
   - Warning: "⚠️ This action cannot be undone"
   - [Go Back] [Confirm Cancellation] buttons

   API: orderBatchService.cancelBatch(batchId, reason)

Both dialogs:
- Loading states during API calls
- Success toasts on completion
- Error toasts with specific messages
- Close on success
- Refresh parent data

Implement with proper validation and user feedback.
```

---

### 🎯 PROMPT 11: Build Order Status Timeline Component

```
TASK: Create reusable visual timeline component for order status history.

Build `src/components/admin/orders/OrderStatusTimeline.jsx` with:

FEATURES:

1. Vertical Timeline Layout:
   - Each status change is a timeline node
   - Connected by vertical line
   - Most recent at top (reverse chronological)

2. Each Timeline Node:
   - Icon based on status:
     * 📝 PLACED
     * ✓ ACCEPTED
     * 👨‍🍳 PREPARING
     * ✓ READY
     * 📦 PICKED_UP
     * 🚚 OUT_FOR_DELIVERY
     * ✅ DELIVERED
     * ❌ REJECTED/FAILED/CANCELLED

   - Status Name (bold)
   - Timestamp (formatted: "Jan 17, 12:05 PM")
   - Updated By: User name and role
   - Notes (if any, shown in gray text)

3. Visual Styling:
   - Icon in colored circle (matched to status)
   - Connecting line between nodes
   - Current status highlighted/emphasized
   - Past statuses grayed out slightly

4. Responsive Design:
   - Mobile: single column
   - Desktop: can show additional details

Props:
- statusTimeline: array of {status, timestamp, updatedBy, notes}
- currentStatus: string

Use relative time formatting (e.g., "2 hours ago" for recent, full date for older).

Implement with smooth CSS animations and good visual hierarchy.
```

---

### 🎯 PROMPT 12: Add Routes and Navigation

```
TASK: Integrate all pages into the admin panel routing and navigation.

1. ADD ROUTES (in your router config):
   ```jsx
   import OrdersDashboard from './pages/admin/OrdersDashboard';
   import OrderDetailsPage from './pages/admin/OrderDetailsPage';
   import BatchesDashboard from './pages/admin/BatchesDashboard';
   import BatchDetailsPage from './pages/admin/BatchDetailsPage';
   import BatchOperationsPage from './pages/admin/BatchOperationsPage';
   import DeliveryAnalytics from './pages/admin/DeliveryAnalytics';

   <Route path="/admin/orders" element={<OrdersDashboard />} />
   <Route path="/admin/orders/:id" element={<OrderDetailsPage />} />
   <Route path="/admin/batches" element={<BatchesDashboard />} />
   <Route path="/admin/batches/:id" element={<BatchDetailsPage />} />
   <Route path="/admin/batch-operations" element={<BatchOperationsPage />} />
   <Route path="/admin/analytics/delivery" element={<DeliveryAnalytics />} />
   ```

2. ADD NAVIGATION LINKS (in admin sidebar):
   ```jsx
   <NavLink to="/admin/orders">
     <ShoppingBagIcon />
     Orders
     {activeOrdersCount > 0 && <Badge>{activeOrdersCount}</Badge>}
   </NavLink>

   <NavLink to="/admin/batches">
     <PackageIcon />
     Batches
     {activeBatchesCount > 0 && <Badge>{activeBatchesCount}</Badge>}
   </NavLink>

   <NavLink to="/admin/batch-operations">
     <SettingsIcon />
     Batch Operations
   </NavLink>

   <NavLink to="/admin/analytics/delivery">
     <BarChartIcon />
     Delivery Analytics
   </NavLink>
   ```

3. FETCH ACTIVE COUNTS:
   - Active orders: getAllOrders({status: 'OUT_FOR_DELIVERY'})
   - Active batches: getAllBatches({status: 'IN_PROGRESS'})
   - Update counts every minute

4. BREADCRUMBS:
   - Add breadcrumb navigation on detail pages
   - Orders > Order Details > ORD-20260117-00123
   - Batches > Batch Details > BATCH-20260117-Z1-00001

5. PROTECT ROUTES:
   - Require admin authentication
   - Redirect to login if not authenticated
   - Check admin role

Implement with proper route guards and active link highlighting.
```

---

### 🎯 PROMPT 13: Add Real-time Updates & Polish

```
TASK: Add real-time features and final polish.

1. REAL-TIME UPDATES:
   - Auto-refresh orders list every 30 seconds
   - Auto-refresh batches list every 30 seconds
   - Show "Updated X seconds ago" indicator
   - [Pause Auto-refresh] toggle
   - Manual [Refresh] button

2. NOTIFICATIONS:
   - Toast notifications for:
     * New orders placed
     * Batch status changes
     * Driver accepting batch
     * Order delivered/failed
   - Sound notification (optional, with toggle)

3. SEARCH OPTIMIZATION:
   - Debounce search input (300ms)
   - Show "Searching..." indicator
   - Highlight search terms in results

4. DATA EXPORT:
   - Add [Export to CSV] buttons on lists
   - Export current filtered data
   - Format: Order Number, Customer, Status, Amount, etc.

5. LOADING STATES:
   - Skeleton loaders for tables and cards
   - Loading spinners for buttons
   - Progress bars for batch operations

6. EMPTY STATES:
   - "No orders found" with illustration
   - "No batches available" with helpful message
   - "No data for selected date range"

7. ERROR STATES:
   - Network error with retry button
   - API error messages displayed clearly
   - Fallback UI for failed data loads

8. PERFORMANCE:
   - Virtualize long tables (use react-window)
   - Lazy load images
   - Memoize expensive calculations
   - Optimize re-renders

9. ACCESSIBILITY:
   - Keyboard navigation for all actions
   - ARIA labels for all interactive elements
   - Focus management in modals
   - Screen reader announcements for status changes

10. RESPONSIVE DESIGN:
    - Mobile: Stack cards vertically, simplify tables
    - Tablet: 2-column layouts
    - Desktop: Full table layouts with all columns

11. TESTING:
    - Test all CRUD operations
    - Test edge cases (empty data, errors, slow network)
    - Test on different devices and browsers
    - Test with keyboard only (accessibility)

Please review and polish all components for production readiness.
```

---

### 📋 IMPLEMENTATION CHECKLIST

Use this checklist to track progress:

#### Setup
- [ ] Project structure created
- [ ] API service layer implemented
- [ ] Environment variables configured
- [ ] Authentication setup complete

#### Orders Module
- [ ] Orders Dashboard
- [ ] Order Details Modal
- [ ] Update Order Status Modal
- [ ] Cancel Order Dialog
- [ ] Order Status Timeline

#### Batches Module
- [ ] Batches Dashboard
- [ ] Batch Details Page
- [ ] Batch Operations Page
- [ ] Auto-Batch Form
- [ ] Dispatch Batch Form
- [ ] Reassign Batch Dialog
- [ ] Cancel Batch Dialog

#### Analytics
- [ ] Delivery Analytics Dashboard
- [ ] Statistics Cards
- [ ] Charts and Graphs
- [ ] Export Reports

#### Integration
- [ ] All routes configured
- [ ] Navigation added
- [ ] Badge counts working
- [ ] Breadcrumbs implemented
- [ ] All API endpoints tested

#### Features
- [ ] Real-time updates
- [ ] Auto-refresh
- [ ] Notifications
- [ ] Search with debounce
- [ ] Data export
- [ ] Map integration (optional)

#### Polish
- [ ] Loading states
- [ ] Error handling
- [ ] Empty states
- [ ] Responsive design
- [ ] Accessibility
- [ ] Performance optimized

---

## System Architecture

### Core Concepts

**1. Order**
- Individual customer order with items, pricing, and delivery details
- Linked to customer, kitchen, zone, and driver
- Tracks complete lifecycle with status timeline

**2. Delivery Batch**
- Collection of orders from same kitchen+zone for same meal window
- Assigned to single driver for efficient batch delivery
- Max 15 orders per batch (configurable)
- Tracks delivery sequence and completion stats

**3. Delivery Assignment**
- Individual tracking record for each order in a batch
- Contains driver acknowledgment, location tracking, and proof of delivery
- Handles failure scenarios with reasons

**4. Meal Windows**
- LUNCH: Orders for lunch time delivery
- DINNER: Orders for dinner time delivery
- Each window has cutoff time for order placement

---

### Order Flow Diagram

```
CUSTOMER ORDERS → KITCHEN ACCEPTS → AUTO-BATCHING → BATCH DISPATCH →
DRIVER ACCEPTS → PICKUP → DELIVERY → COMPLETION

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: ORDER PLACEMENT & KITCHEN PROCESSING                   │
└─────────────────────────────────────────────────────────────────┘

Customer places order
├─ Status: PLACED
├─ Kitchen receives notification
└─ Waiting for kitchen acceptance

Kitchen accepts order
├─ Status: ACCEPTED → PREPARING
├─ Kitchen prepares food
└─ When ready: Status → READY

Kitchen rejects order
├─ Status: REJECTED
├─ Reason recorded
├─ Refund initiated if paid
└─ Order ends


┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: AUTO-BATCHING (Admin Triggered or Scheduled)          │
└─────────────────────────────────────────────────────────────────┘

Admin triggers auto-batch
├─ POST /api/delivery/auto-batch
├─ Finds all READY orders
├─ Groups by: kitchen + zone + mealWindow
│   Example: Kitchen A + Zone 1 + LUNCH = Batch 1
│   Example: Kitchen A + Zone 2 + LUNCH = Batch 2
│   Example: Kitchen A + Zone 1 + DINNER = Batch 3
├─ Creates/updates batches (max 15 orders each)
├─ Sets batch status: COLLECTING
└─ Returns: batches created/updated, orders processed


┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: BATCH DISPATCH (After Meal Window Cutoff)             │
└─────────────────────────────────────────────────────────────────┘

Admin triggers dispatch (after cutoff time)
├─ POST /api/delivery/dispatch
├─ Validates cutoff time passed
├─ Finds COLLECTING batches with orders
├─ Changes batch status: COLLECTING → READY_FOR_DISPATCH
├─ Drivers can now see and accept batches
└─ Returns: batches dispatched


┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: DRIVER BATCH ACCEPTANCE                                │
└─────────────────────────────────────────────────────────────────┘

Driver views available batches
├─ GET /api/delivery/available-batches
├─ Shows READY_FOR_DISPATCH batches
└─ Details: kitchen, zone, order count, earnings estimate

Driver accepts batch
├─ POST /api/delivery/batches/:batchId/accept
├─ Atomic assignment (prevents double-acceptance)
├─ Batch status: READY_FOR_DISPATCH → DISPATCHED
├─ All orders in batch: driverId assigned
├─ DeliveryAssignment created for each order
├─ OTP generated for each delivery
└─ Returns: batch, orders, pickup address


┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: PICKUP & DELIVERY                                      │
└─────────────────────────────────────────────────────────────────┘

Driver marks batch as picked up
├─ PATCH /api/delivery/batches/:batchId/pickup
├─ Batch status: DISPATCHED → IN_PROGRESS
├─ All orders: READY → PICKED_UP → OUT_FOR_DELIVERY
├─ Driver starts delivering in sequence
└─ Timestamp recorded

Driver delivers each order
├─ PATCH /api/delivery/orders/:orderId/status
├─ Order status: OUT_FOR_DELIVERY → DELIVERED
├─ Proof of delivery: OTP / SIGNATURE / PHOTO
├─ Timestamp recorded
└─ Next order in sequence

Driver handles failed delivery
├─ Order status: OUT_FOR_DELIVERY → FAILED
├─ Failure reason: CUSTOMER_UNAVAILABLE, WRONG_ADDRESS, etc.
├─ Customer contact attempts tracked
└─ Return to kitchen (optional based on config)


┌─────────────────────────────────────────────────────────────────┐
│ PHASE 6: BATCH COMPLETION                                       │
└─────────────────────────────────────────────────────────────────┘

Driver completes batch
├─ PATCH /api/delivery/batches/:batchId/complete
├─ Validates all orders have final status (DELIVERED or FAILED)
├─ Batch status: IN_PROGRESS → COMPLETED or PARTIAL_COMPLETE
├─ Updates counters: totalDelivered, totalFailed
├─ Driver earnings calculated
└─ Batch archived
```

---

### Admin Intervention Points

Admins can intervene at any stage:
- **Override Order Status:** Change any order to any status
- **Cancel Orders:** Admin cancel with refund
- **Reassign Batches:** Move batch to different driver
- **Cancel Batches:** Cancel entire batch, remove driver assignment
- **Manual Dispatch:** Dispatch batches before cutoff time
- **View Analytics:** Monitor performance, success rates, delivery times

---

## Complete Workflow

### For Admins Managing Orders

```
ADMIN DASHBOARD
├─ View All Orders
│  ├─ Filter: status, kitchen, zone, driver, date
│  ├─ Search: order number, customer phone
│  └─ Actions: View details, update status, cancel
│
├─ View All Batches
│  ├─ Filter: status, kitchen, zone, driver, date
│  ├─ Search: batch number
│  └─ Actions: View details, reassign, cancel
│
├─ Trigger Auto-Batching
│  ├─ Groups READY orders into batches
│  └─ Creates new batches or adds to existing COLLECTING batches
│
├─ Dispatch Batches
│  ├─ After meal window cutoff
│  └─ Makes batches available for driver acceptance
│
├─ Monitor Active Deliveries
│  ├─ Track driver locations (optional)
│  ├─ View delivery progress
│  └─ Intervene if needed (reassign, contact driver)
│
└─ Analytics & Reports
   ├─ Delivery success rates
   ├─ Driver performance
   ├─ Zone-wise metrics
   └─ Revenue and order trends
```

---

## API Endpoints Reference

### Authentication
All admin endpoints require:
- **Header:** `Authorization: Bearer <JWT_TOKEN>`
- **Middleware:** Admin role required

---

## ORDER MANAGEMENT ENDPOINTS

### 1. Get All Orders (Admin)

**Endpoint:** `GET /api/orders/admin/all`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `userId` | string | - | Filter by customer ID |
| `kitchenId` | string | - | Filter by kitchen ID |
| `zoneId` | string | - | Filter by zone ID |
| `driverId` | string | - | Filter by driver ID |
| `status` | string | - | Filter by order status |
| `menuType` | string | - | MEAL_MENU or ON_DEMAND_MENU |
| `dateFrom` | date | - | Start date (ISO format) |
| `dateTo` | date | - | End date (ISO format) |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

**Request Example:**
```bash
GET /api/orders/admin/all?status=OUT_FOR_DELIVERY&page=1&limit=20
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Orders retrieved successfully",
  "data": {
    "orders": [
      {
        "_id": "65order123",
        "orderNumber": "ORD-20260117-00123",
        "userId": {
          "_id": "65user123",
          "name": "John Doe",
          "phone": "+919876543210"
        },
        "kitchenId": {
          "_id": "65kitchen123",
          "name": "Kitchen A",
          "zone": {
            "name": "Zone 1",
            "code": "Z1"
          }
        },
        "zoneId": "65zone123",
        "driverId": {
          "_id": "65driver123",
          "name": "Rajesh Kumar",
          "phone": "+919998887776",
          "vehicleNumber": "MH12AB1234"
        },
        "batchId": "65batch123",
        "menuType": "MEAL_MENU",
        "mealWindow": "LUNCH",
        "status": "OUT_FOR_DELIVERY",
        "paymentStatus": "PAID",
        "subtotal": 250,
        "grandTotal": 280,
        "items": [
          {
            "menuItemId": "65item123",
            "name": "Paneer Butter Masala",
            "quantity": 1,
            "unitPrice": 150,
            "totalPrice": 150
          },
          {
            "menuItemId": "65item124",
            "name": "Dal Tadka",
            "quantity": 1,
            "unitPrice": 100,
            "totalPrice": 100
          }
        ],
        "deliveryAddress": {
          "street": "123 Main Street",
          "area": "Downtown",
          "city": "Mumbai",
          "coordinates": {
            "lat": 19.0760,
            "lng": 72.8777
          }
        },
        "placedAt": "2026-01-17T10:00:00.000Z",
        "estimatedDeliveryTime": "2026-01-17T12:30:00.000Z",
        "pickedUpAt": "2026-01-17T11:45:00.000Z",
        "outForDeliveryAt": "2026-01-17T11:50:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "pages": 8
    }
  }
}
```

---

### 2. Get Single Order Details

**Endpoint:** `GET /api/orders/:id`

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Order ID (MongoDB ObjectId) |

**Request Example:**
```bash
GET /api/orders/65order123
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Order retrieved successfully",
  "data": {
    "order": {
      "_id": "65order123",
      "orderNumber": "ORD-20260117-00123",
      // ... all order fields ...
      "statusTimeline": [
        {
          "status": "PLACED",
          "timestamp": "2026-01-17T10:00:00.000Z",
          "updatedBy": "65user123"
        },
        {
          "status": "ACCEPTED",
          "timestamp": "2026-01-17T10:05:00.000Z",
          "updatedBy": "65kitchen123"
        },
        {
          "status": "PREPARING",
          "timestamp": "2026-01-17T10:05:00.000Z",
          "updatedBy": "65kitchen123"
        },
        {
          "status": "READY",
          "timestamp": "2026-01-17T11:30:00.000Z",
          "updatedBy": "65kitchen123"
        },
        {
          "status": "PICKED_UP",
          "timestamp": "2026-01-17T11:45:00.000Z",
          "updatedBy": "65driver123"
        },
        {
          "status": "OUT_FOR_DELIVERY",
          "timestamp": "2026-01-17T11:50:00.000Z",
          "updatedBy": "65driver123"
        }
      ]
    }
  }
}
```

---

### 3. Update Order Status (Admin Override)

**Endpoint:** `PATCH /api/orders/admin/:id/status`

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Order ID |

**Request Body:**
```json
{
  "status": "DELIVERED",
  "notes": "Admin marked as delivered after customer confirmation"
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | enum | ✓ Yes | New order status |
| `notes` | string | ✗ | Reason/notes for change |

**Order Status Values:**
- Kitchen: PLACED, ACCEPTED, REJECTED, PREPARING, READY
- Delivery: PICKED_UP, OUT_FOR_DELIVERY, DELIVERED
- Terminal: CANCELLED, FAILED

**Request Example:**
```bash
PATCH /api/orders/admin/65order123/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "DELIVERED",
  "notes": "Customer confirmed delivery via phone"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Order status updated successfully",
  "data": {
    "order": {
      "_id": "65order123",
      "status": "DELIVERED",
      "deliveredAt": "2026-01-17T12:15:00.000Z",
      // ... rest of order
    }
  }
}
```

**Side Effects:**
- ✓ Status changed immediately (bypasses normal validation)
- ✓ Timeline entry created with admin ID and notes
- ✓ Relevant timestamps updated (deliveredAt, failedAt, etc.)
- ✓ Audit log created

---

### 4. Cancel Order (Admin)

**Endpoint:** `PATCH /api/orders/:id/admin-cancel`

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Order ID |

**Request Body:**
```json
{
  "reason": "Customer requested cancellation",
  "initiateRefund": true
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reason` | string | ✓ Yes | Cancellation reason |
| `initiateRefund` | boolean | ✗ | Whether to initiate refund (default: true) |

**Request Example:**
```bash
PATCH /api/orders/65order123/admin-cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Customer requested cancellation - wrong address",
  "initiateRefund": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "data": {
    "order": {
      "_id": "65order123",
      "status": "CANCELLED",
      "cancelledAt": "2026-01-17T11:00:00.000Z",
      "cancellationReason": "Customer requested cancellation - wrong address"
    },
    "refund": {
      "initiated": true,
      "amount": 280,
      "status": "PENDING"
    }
  }
}
```

**Side Effects:**
- ✓ Order status set to CANCELLED
- ✓ Vouchers restored to customer (if used)
- ✓ Refund initiated if payment was made
- ✓ Driver removed from order (if assigned)
- ✓ Batch order count updated
- ✓ Audit log created

---

## BATCH MANAGEMENT ENDPOINTS

### 5. Get All Batches (Admin)

**Endpoint:** `GET /api/delivery/admin/batches`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `kitchenId` | string | - | Filter by kitchen ID |
| `zoneId` | string | - | Filter by zone ID |
| `driverId` | string | - | Filter by driver ID |
| `status` | string | - | Filter by batch status |
| `dateFrom` | date | - | Start date (ISO format) |
| `dateTo` | date | - | End date (ISO format) |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

**Batch Status Values:**
- COLLECTING - Accepting new orders
- READY_FOR_DISPATCH - Window ended, waiting for driver
- DISPATCHED - Driver accepted batch
- IN_PROGRESS - Driver started delivery
- COMPLETED - All orders delivered
- PARTIAL_COMPLETE - Some orders failed
- CANCELLED - Batch cancelled

**Request Example:**
```bash
GET /api/delivery/admin/batches?status=IN_PROGRESS&page=1&limit=20
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Batches retrieved successfully",
  "data": {
    "batches": [
      {
        "_id": "65batch123",
        "batchNumber": "BATCH-20260117-Z1-00001",
        "kitchenId": {
          "_id": "65kitchen123",
          "name": "Kitchen A"
        },
        "zoneId": {
          "_id": "65zone123",
          "name": "Zone 1",
          "code": "Z1"
        },
        "driverId": {
          "_id": "65driver123",
          "name": "Rajesh Kumar",
          "phone": "+919998887776",
          "vehicleNumber": "MH12AB1234"
        },
        "menuType": "MEAL_MENU",
        "mealWindow": "LUNCH",
        "status": "IN_PROGRESS",
        "orderIds": ["65order123", "65order124", "65order125"],
        "orderCount": 3,
        "maxBatchSize": 15,
        "batchDate": "2026-01-17T00:00:00.000Z",
        "windowEndTime": "2026-01-17T11:30:00.000Z",
        "driverAssignedAt": "2026-01-17T11:35:00.000Z",
        "dispatchedAt": "2026-01-17T11:35:00.000Z",
        "pickedUpAt": "2026-01-17T11:45:00.000Z",
        "totalDelivered": 1,
        "totalFailed": 0,
        "sequencePolicy": "DRIVER_CHOICE",
        "creationType": "AUTO",
        "createdAt": "2026-01-17T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    },
    "summary": {
      "collecting": 5,
      "readyForDispatch": 8,
      "dispatched": 12,
      "inProgress": 15,
      "completed": 89,
      "partialComplete": 3,
      "cancelled": 2
    }
  }
}
```

---

### 6. Get Single Batch Details

**Endpoint:** `GET /api/delivery/batches/:batchId`

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `batchId` | string | Batch ID |

**Request Example:**
```bash
GET /api/delivery/batches/65batch123
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Batch retrieved successfully",
  "data": {
    "batch": {
      "_id": "65batch123",
      "batchNumber": "BATCH-20260117-Z1-00001",
      // ... all batch fields ...
      "deliverySequence": [
        {
          "orderId": "65order123",
          "sequenceNumber": 1,
          "estimatedArrival": "2026-01-17T12:00:00.000Z"
        },
        {
          "orderId": "65order124",
          "sequenceNumber": 2,
          "estimatedArrival": "2026-01-17T12:15:00.000Z"
        },
        {
          "orderId": "65order125",
          "sequenceNumber": 3,
          "estimatedArrival": "2026-01-17T12:30:00.000Z"
        }
      ]
    },
    "orders": [
      // Populated order objects with delivery address
    ],
    "assignments": [
      {
        "_id": "65assign123",
        "orderId": "65order123",
        "driverId": "65driver123",
        "batchId": "65batch123",
        "sequenceInBatch": 1,
        "status": "DELIVERED",
        "assignedAt": "2026-01-17T11:35:00.000Z",
        "acknowledgedAt": "2026-01-17T11:36:00.000Z",
        "pickedUpAt": "2026-01-17T11:45:00.000Z",
        "deliveredAt": "2026-01-17T12:05:00.000Z",
        "proofOfDelivery": {
          "type": "OTP",
          "value": "1234",
          "verifiedAt": "2026-01-17T12:05:00.000Z"
        }
      }
      // ... more assignments
    ]
  }
}
```

---

### 7. Trigger Auto-Batching

**Endpoint:** `POST /api/delivery/auto-batch`

**Description:** Groups all READY orders into batches by kitchen+zone+mealWindow

**Request Body:** (Optional filters)
```json
{
  "kitchenId": "65kitchen123",
  "zoneId": "65zone123",
  "mealWindow": "LUNCH"
}
```

**Request Example:**
```bash
POST /api/delivery/auto-batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "mealWindow": "LUNCH"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Auto-batching completed successfully",
  "data": {
    "batchesCreated": 5,
    "batchesUpdated": 3,
    "ordersProcessed": 48,
    "batches": [
      {
        "_id": "65batch123",
        "batchNumber": "BATCH-20260117-Z1-00001",
        "kitchenId": "65kitchen123",
        "zoneId": "65zone123",
        "mealWindow": "LUNCH",
        "orderCount": 12,
        "status": "COLLECTING"
      },
      {
        "_id": "65batch124",
        "batchNumber": "BATCH-20260117-Z2-00001",
        "kitchenId": "65kitchen123",
        "zoneId": "65zone124",
        "mealWindow": "LUNCH",
        "orderCount": 8,
        "status": "COLLECTING"
      }
    ]
  }
}
```

**Side Effects:**
- ✓ Finds all orders with status ACCEPTED, PREPARING, or READY (unbatched)
- ✓ Groups by kitchen + zone + mealWindow
- ✓ Creates new batches or adds to existing COLLECTING batches
- ✓ Updates order documents with batchId
- ✓ Respects maxBatchSize (default: 15 orders per batch)

---

### 8. Dispatch Batches

**Endpoint:** `POST /api/delivery/dispatch`

**Description:** Marks COLLECTING batches as READY_FOR_DISPATCH after meal window cutoff

**Request Body:** (Optional filters)
```json
{
  "mealWindow": "LUNCH",
  "kitchenId": "65kitchen123"
}
```

**Request Example:**
```bash
POST /api/delivery/dispatch
Authorization: Bearer <token>
Content-Type: application/json

{
  "mealWindow": "LUNCH"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Batches dispatched successfully",
  "data": {
    "batchesDispatched": 8,
    "batches": [
      {
        "_id": "65batch123",
        "batchNumber": "BATCH-20260117-Z1-00001",
        "status": "READY_FOR_DISPATCH",
        "orderCount": 12,
        "mealWindow": "LUNCH"
      }
    ]
  }
}
```

**Side Effects:**
- ✓ Validates meal window cutoff time has passed
- ✓ Finds COLLECTING batches with orders
- ✓ Changes status to READY_FOR_DISPATCH
- ✓ Batches become visible to drivers for acceptance

---

### 9. Reassign Batch to Different Driver

**Endpoint:** `PATCH /api/delivery/batches/:batchId/reassign`

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `batchId` | string | Batch ID |

**Request Body:**
```json
{
  "newDriverId": "65driver456",
  "reason": "Original driver unavailable due to vehicle breakdown"
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `newDriverId` | string | ✓ Yes | ID of new driver |
| `reason` | string | ✓ Yes | Reason for reassignment |

**Request Example:**
```bash
PATCH /api/delivery/batches/65batch123/reassign
Authorization: Bearer <token>
Content-Type: application/json

{
  "newDriverId": "65driver456",
  "reason": "Original driver unavailable due to vehicle breakdown"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Batch reassigned successfully",
  "data": {
    "batch": {
      "_id": "65batch123",
      "driverId": "65driver456",
      "driverAssignedAt": "2026-01-17T12:00:00.000Z",
      // ... rest of batch
    },
    "ordersUpdated": 12,
    "assignmentsUpdated": 12
  }
}
```

**Side Effects:**
- ✓ Only works for DISPATCHED or IN_PROGRESS batches
- ✓ Updates batch.driverId to new driver
- ✓ Updates all orders in batch with new driverId
- ✓ Updates all delivery assignments with new driverId
- ✓ Notifies new driver
- ✓ Audit log created with reason

---

### 10. Cancel Batch

**Endpoint:** `PATCH /api/delivery/batches/:batchId/cancel`

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `batchId` | string | Batch ID |

**Request Body:**
```json
{
  "reason": "Kitchen closed unexpectedly"
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reason` | string | ✓ Yes | Reason for cancellation |

**Request Example:**
```bash
PATCH /api/delivery/batches/65batch123/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Kitchen closed unexpectedly"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Batch cancelled successfully",
  "data": {
    "batch": {
      "_id": "65batch123",
      "status": "CANCELLED",
      "cancellationReason": "Kitchen closed unexpectedly"
    },
    "ordersUnbatched": 12
  }
}
```

**Side Effects:**
- ✓ Cannot cancel COMPLETED or PARTIAL_COMPLETE batches
- ✓ Batch status set to CANCELLED
- ✓ All orders: batchId and driverId set to null
- ✓ All delivery assignments cancelled
- ✓ Orders return to READY status (available for new batch)
- ✓ Driver notified
- ✓ Audit log created

---

### 11. Get Delivery Statistics

**Endpoint:** `GET /api/delivery/admin/stats`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dateFrom` | date | - | Start date (ISO format) |
| `dateTo` | date | - | End date (ISO format) |
| `zoneId` | string | - | Filter by zone |
| `driverId` | string | - | Filter by driver |
| `kitchenId` | string | - | Filter by kitchen |

**Request Example:**
```bash
GET /api/delivery/admin/stats?dateFrom=2026-01-01&dateTo=2026-01-17
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Delivery statistics retrieved",
  "data": {
    "overall": {
      "totalBatches": 145,
      "totalDeliveries": 1876,
      "totalDelivered": 1798,
      "totalFailed": 78,
      "successRate": "95.84"
    },
    "byZone": [
      {
        "zoneId": "65zone123",
        "zoneName": "Zone 1",
        "totalDeliveries": 456,
        "delivered": 440,
        "failed": 16,
        "successRate": "96.49"
      },
      {
        "zoneId": "65zone124",
        "zoneName": "Zone 2",
        "totalDeliveries": 389,
        "delivered": 370,
        "failed": 19,
        "successRate": "95.12"
      }
    ],
    "byDriver": [
      {
        "driverId": "65driver123",
        "driverName": "Rajesh Kumar",
        "totalDeliveries": 156,
        "delivered": 148,
        "failed": 8,
        "successRate": "94.87"
      }
    ],
    "byMealWindow": {
      "LUNCH": {
        "totalDeliveries": 945,
        "delivered": 905,
        "failed": 40,
        "successRate": "95.77"
      },
      "DINNER": {
        "totalDeliveries": 931,
        "delivered": 893,
        "failed": 38,
        "successRate": "95.92"
      }
    }
  }
}
```

---

### 12. Get Batch Configuration

**Endpoint:** `GET /api/delivery/config`

**Request Example:**
```bash
GET /api/delivery/config
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Batch configuration retrieved",
  "data": {
    "config": {
      "maxBatchSize": 15,
      "failedOrderPolicy": "RETURN_TO_KITCHEN",
      "autoDispatchEnabled": true,
      "autoDispatchDelay": 30,
      "sequencePolicy": "DRIVER_CHOICE",
      "lunchCutoffTime": "11:30",
      "dinnerCutoffTime": "18:30"
    }
  }
}
```

---

### 13. Update Batch Configuration

**Endpoint:** `PUT /api/delivery/config`

**Request Body:**
```json
{
  "maxBatchSize": 20,
  "failedOrderPolicy": "NO_RETURN",
  "autoDispatchDelay": 45
}
```

**Body Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `maxBatchSize` | number | Max orders per batch (1-25) |
| `failedOrderPolicy` | enum | RETURN_TO_KITCHEN or NO_RETURN |
| `autoDispatchDelay` | number | Minutes after cutoff before auto-dispatch |
| `sequencePolicy` | enum | DRIVER_CHOICE, SYSTEM_OPTIMIZED, LOCKED |

**Request Example:**
```bash
PUT /api/delivery/config
Authorization: Bearer <token>
Content-Type: application/json

{
  "maxBatchSize": 20,
  "failedOrderPolicy": "NO_RETURN"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Configuration updated successfully",
  "data": {
    "config": {
      "maxBatchSize": 20,
      "failedOrderPolicy": "NO_RETURN",
      // ... rest of config
    }
  }
}
```

**Side Effects:**
- ✓ Config updated in database
- ✓ Applies to future batches immediately
- ✓ Audit log created

---

## Data Models

### Order Schema

**File:** [schema/order.schema.js](schema/order.schema.js)

```typescript
interface Order {
  _id: ObjectId;
  orderNumber: string;              // ORD-YYYYMMDD-XXXXX (auto-generated)

  // References
  userId: ObjectId;                 // Customer
  kitchenId: ObjectId;
  zoneId: ObjectId;
  driverId?: ObjectId;              // Assigned driver
  batchId?: ObjectId;               // Delivery batch

  // Order Details
  menuType: "MEAL_MENU" | "ON_DEMAND_MENU";
  mealWindow?: "LUNCH" | "DINNER"; // For MEAL_MENU
  items: Array<{
    menuItemId: ObjectId;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    addons?: Array<{name: string, price: number}>;
  }>;

  // Pricing
  subtotal: number;
  grandTotal: number;
  amountPaid: number;
  charges: {
    deliveryFee: number;
    serviceFee: number;
    packagingFee: number;
    handlingFee: number;
    taxAmount: number;
  };
  discount?: {
    couponId?: ObjectId;
    discountAmount: number;
    discountType: "PERCENTAGE" | "FIXED";
  };
  voucherUsage?: {
    voucherIds: ObjectId[];
    voucherCount: number;
    mainCoursesCovered: number;
  };

  // Status
  status: "PLACED" | "ACCEPTED" | "REJECTED" | "PREPARING" | "READY" |
          "PICKED_UP" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "FAILED";
  statusTimeline: Array<{
    status: string;
    timestamp: Date;
    updatedBy: ObjectId;
    notes?: string;
  }>;

  // Payment
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  paymentMethod: "UPI" | "CARD" | "WALLET" | "NETBANKING" | "VOUCHER_ONLY" | "OTHER";
  paymentId?: string;
  paymentDetails?: object;

  // Delivery
  deliveryAddressId: ObjectId;
  deliveryAddress: {
    street: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  estimatedDeliveryTime?: Date;
  proofOfDelivery?: {
    type: "OTP" | "SIGNATURE" | "PHOTO";
    value: string;
    verifiedAt: Date;
  };

  // Timestamps
  placedAt: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  preparingAt?: Date;
  readyAt?: Date;
  pickedUpAt?: Date;
  outForDeliveryAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  cancelledAt?: Date;

  // Metadata
  isAutoOrder: boolean;             // From subscription
  scheduledFor?: Date;
  specialInstructions?: string;     // Max 500 chars
  rejectionReason?: string;
  cancellationReason?: string;
  failureReason?: string;
  rating?: {
    stars: number;                  // 1-5
    comment?: string;
    ratedAt: Date;
  };

  createdAt: Date;
  updatedAt: Date;
}
```

**Order Status Flow:**
```
PLACED → ACCEPTED → PREPARING → READY → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED
   ↓        ↓                                                              ↓
REJECTED  CANCELLED                                                     FAILED
```

---

### Delivery Batch Schema

**File:** [schema/deliveryBatch.schema.js](schema/deliveryBatch.schema.js)

```typescript
interface DeliveryBatch {
  _id: ObjectId;
  batchNumber: string;              // BATCH-YYYYMMDD-ZONECODE-XXXXX

  // References
  kitchenId: ObjectId;
  zoneId: ObjectId;
  driverId?: ObjectId;
  orderIds: ObjectId[];             // Max maxBatchSize (default: 15)

  // Meal Context
  menuType: "MEAL_MENU" | "ON_DEMAND_MENU";
  mealWindow: "LUNCH" | "DINNER";

  // Status
  status: "COLLECTING" | "READY_FOR_DISPATCH" | "DISPATCHED" |
          "IN_PROGRESS" | "COMPLETED" | "PARTIAL_COMPLETE" | "CANCELLED";

  // Configuration
  maxBatchSize: number;             // Default: 15
  failedOrderPolicy: "NO_RETURN" | "RETURN_TO_KITCHEN";
  creationType: "AUTO" | "MANUAL";

  // Delivery Sequence
  sequencePolicy: "DRIVER_CHOICE" | "SYSTEM_OPTIMIZED" | "LOCKED";
  deliverySequence: Array<{
    orderId: ObjectId;
    sequenceNumber: number;
    estimatedArrival?: Date;
  }>;

  // Timestamps
  batchDate: Date;                  // Date of batch (YYYY-MM-DD)
  windowEndTime: Date;              // Cutoff time for order acceptance
  driverAssignedAt?: Date;
  dispatchedAt?: Date;
  pickedUpAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;

  // Stats
  totalDelivered: number;
  totalFailed: number;
  failedOrders: Array<{
    orderId: ObjectId;
    reason: string;
    returnedToKitchen: boolean;
  }>;

  // Metadata
  cancellationReason?: string;
  createdBy?: ObjectId;
  modifiedBy?: ObjectId;

  createdAt: Date;
  updatedAt: Date;
}
```

**Batch Status Flow:**
```
COLLECTING → READY_FOR_DISPATCH → DISPATCHED → IN_PROGRESS → COMPLETED
                                                                  ↓
                                                          PARTIAL_COMPLETE
     ↓
CANCELLED
```

---

### Delivery Assignment Schema

**File:** [schema/deliveryAssignment.schema.js](schema/deliveryAssignment.schema.js)

```typescript
interface DeliveryAssignment {
  _id: ObjectId;

  // References
  orderId: ObjectId;
  driverId: ObjectId;
  batchId: ObjectId;
  sequenceInBatch: number;

  // Assignment
  assignedBy: "SYSTEM" | "KITCHEN_STAFF" | "ADMIN";
  assignedByUserId?: ObjectId;
  assignedAt: Date;

  // Status
  status: "ASSIGNED" | "ACKNOWLEDGED" | "PICKED_UP" | "EN_ROUTE" |
          "ARRIVED" | "DELIVERED" | "FAILED" | "RETURNED" | "CANCELLED";

  // Timestamps
  acknowledgedAt?: Date;
  pickedUpAt?: Date;
  enRouteAt?: Date;
  arrivedAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  returnedAt?: Date;
  cancelledAt?: Date;

  // Proof of Delivery
  proofOfDelivery?: {
    type: "OTP" | "SIGNATURE" | "PHOTO";
    value: string;                  // OTP code, signature image URL, photo URL
    verifiedAt: Date;
  };
  otp?: string;                     // Auto-generated 4-digit OTP

  // Failure Handling
  failureReason?: "CUSTOMER_UNAVAILABLE" | "WRONG_ADDRESS" |
                  "CUSTOMER_REFUSED" | "ADDRESS_NOT_FOUND" |
                  "CUSTOMER_UNREACHABLE" | "OTHER";
  failureNotes?: string;
  customerContactAttempts: Array<{
    timestamp: Date;
    method: "CALL" | "SMS" | "APP_NOTIFICATION";
    outcome: "NO_ANSWER" | "PHONE_OFF" | "WRONG_NUMBER" | "CONTACTED";
  }>;

  // Location Tracking
  lastKnownLocation?: {
    lat: number;
    lng: number;
    timestamp: Date;
  };
  locationHistory: Array<{          // Max 50 entries
    lat: number;
    lng: number;
    timestamp: Date;
  }>;

  createdAt: Date;
  updatedAt: Date;
}
```

**Failure Reasons:**
- `CUSTOMER_UNAVAILABLE` - Customer not at location
- `WRONG_ADDRESS` - Address incorrect or incomplete
- `CUSTOMER_REFUSED` - Customer refused to accept order
- `ADDRESS_NOT_FOUND` - Unable to locate address
- `CUSTOMER_UNREACHABLE` - Cannot contact customer
- `OTHER` - Other reasons (with notes)

---

## UI Requirements & Mockups

### 1. Orders Dashboard Page

**Route:** `/admin/orders`

**Features:**
- ✓ Tabbed view by status
- ✓ Search by order number or customer phone
- ✓ Filter by kitchen, zone, driver, date range
- ✓ Real-time status updates
- ✓ Quick actions (view details, update status, cancel)

**Layout Example:**
```
┌──────────────────────────────────────────────────────────────────┐
│  Orders Management                                 [Refresh]      │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  [All (1876)] [Active (345)] [Out for Delivery (156)]           │
│  [Delivered (1456)] [Failed (78)] [Cancelled (41)]               │
│                                                                    │
│  [Search order #...]  [Kitchen ▼] [Zone ▼] [Date Range]         │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Order #        Customer      Kitchen   Driver    Status    │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ ORD-2026...   John Doe      Kit A     Rajesh    🚚 OFD    │  │
│  │ #00123        +91 987...    Zone 1    Kumar     12:05 PM  │  │
│  │                                                            │  │
│  │ ORD-2026...   Jane Smith    Kit B     Amit      ✅ Done   │  │
│  │ #00124        +91 876...    Zone 2    Sharma    11:45 AM  │  │
│  │                                                            │  │
│  │ ORD-2026...   Bob Brown     Kit A     Priya     ❌ Failed │  │
│  │ #00125        +91 765...    Zone 1    Singh    11:30 AM  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ← Previous    Page 1 of 94    Next →                             │
└──────────────────────────────────────────────────────────────────┘
```

---

### 2. Order Details Modal

**Trigger:** Click on an order

**Sections:**
1. Order Header (order #, status, timestamps)
2. Customer Info (name, phone, address on map)
3. Items List (with prices)
4. Pricing Breakdown
5. Driver Info (if assigned)
6. Batch Info (if batched)
7. Status Timeline
8. Admin Actions

**Layout Example:**
```
┌──────────────────────────────────────────────────────────────────┐
│  Order Details - ORD-20260117-00123                    [Close]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Status: 🚚 OUT FOR DELIVERY      Placed: Jan 17, 10:00 AM      │
│                                    ETA: 12:30 PM                  │
│                                                                    │
│  ┌─ Customer ────────────────────────────────────────────────┐  │
│  │  John Doe                                                  │  │
│  │  +91 9876543210                                           │  │
│  │  📍 123 Main Street, Downtown, Mumbai                     │  │
│  │  [View on Map]                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ Items ───────────────────────────────────────────────────┐  │
│  │  1x Paneer Butter Masala                          ₹150    │  │
│  │  1x Dal Tadka                                     ₹100    │  │
│  │  ────────────────────────────────────────────────────     │  │
│  │  Subtotal                                         ₹250    │  │
│  │  Delivery Fee                                     ₹20     │  │
│  │  Service Fee                                      ₹5      │  │
│  │  Tax (GST 5%)                                     ₹5      │  │
│  │  ────────────────────────────────────────────────────     │  │
│  │  TOTAL                                           ₹280    │  │
│  │  Status: ✅ PAID (UPI)                                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ Delivery ────────────────────────────────────────────────┐  │
│  │  Driver: Rajesh Kumar (+91 9998887776)                    │  │
│  │  Vehicle: Scooter - MH12AB1234                            │  │
│  │  Batch: BATCH-20260117-Z1-00001 (Order 1 of 3)           │  │
│  │  [View Batch Details]                                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ Status Timeline ─────────────────────────────────────────┐  │
│  │  🚚 OUT FOR DELIVERY      11:50 AM  by Rajesh Kumar      │  │
│  │  📦 PICKED UP             11:45 AM  by Rajesh Kumar      │  │
│  │  ✓ READY                  11:30 AM  by Kitchen A         │  │
│  │  👨‍🍳 PREPARING              10:05 AM  by Kitchen A         │  │
│  │  ✓ ACCEPTED               10:05 AM  by Kitchen A         │  │
│  │  📝 PLACED                10:00 AM  by John Doe          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  [Cancel Order] [Update Status ▼] [Contact Customer]            │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

### 3. Batches Dashboard Page

**Route:** `/admin/batches`

**Features:**
- ✓ Tabbed view by status
- ✓ Search by batch number
- ✓ Filter by kitchen, zone, driver, date range
- ✓ Quick actions (view details, reassign, cancel)
- ✓ Auto-batch and dispatch buttons

**Layout Example:**
```
┌──────────────────────────────────────────────────────────────────┐
│  Batch Management                 [Auto-Batch] [Dispatch]        │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  [All (145)] [Collecting (5)] [Ready (8)] [Dispatched (12)]     │
│  [In Progress (15)] [Completed (89)] [Cancelled (2)]             │
│                                                                    │
│  [Search batch #...]  [Kitchen ▼] [Zone ▼] [Date Range]         │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Batch #         Kitchen   Zone  Driver   Orders  Status    │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ BATCH-2026...  Kit A      Z1    Rajesh   3/15   🚚 Active │  │
│  │ Z1-00001       Meal Lunch        Kumar          11:45 AM  │  │
│  │                                                            │  │
│  │ BATCH-2026...  Kit B      Z2    Amit     12/15  ⏳ Ready  │  │
│  │ Z2-00001       Meal Lunch        Sharma          11:30 AM  │  │
│  │                                                            │  │
│  │ BATCH-2026...  Kit A      Z1    Priya    8/15   ✅ Done   │  │
│  │ Z1-00002       Meal Lunch        Singh           10:45 AM  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ← Previous    Page 1 of 8    Next →                             │
└──────────────────────────────────────────────────────────────────┘
```

---

### 4. Batch Details Page

**Route:** `/admin/batches/:id`

**Sections:**
1. Batch Header (number, status, timestamps)
2. Driver Info (if assigned)
3. Kitchen & Zone Info
4. Orders List (with delivery sequence)
5. Delivery Stats
6. Admin Actions

**Layout Example:**
```
┌──────────────────────────────────────────────────────────────────┐
│  Batch Details - BATCH-20260117-Z1-00001               [Close]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Status: 🚚 IN PROGRESS                                          │
│  Kitchen: Kitchen A (Zone 1)     Meal: Lunch                     │
│  Window End: 11:30 AM            Dispatched: 11:35 AM            │
│                                                                    │
│  ┌─ Driver ──────────────────────────────────────────────────┐  │
│  │  Rajesh Kumar (+91 9998887776)                            │  │
│  │  Vehicle: Scooter - MH12AB1234                            │  │
│  │  Assigned: 11:35 AM                                       │  │
│  │  Picked Up: 11:45 AM                                      │  │
│  │  [Reassign Driver]                                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ Delivery Stats ──────────────────────────────────────────┐  │
│  │  Total Orders: 3              Delivered: 1                 │  │
│  │  Pending: 2                   Failed: 0                    │  │
│  │  Success Rate: 100% (so far)                              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ Orders in Sequence ──────────────────────────────────────┐  │
│  │  #1  ✅ ORD-20260117-00123                                │  │
│  │      John Doe - 123 Main St                               │  │
│  │      Delivered: 12:05 PM                                  │  │
│  │                                                            │  │
│  │  #2  🚚 ORD-20260117-00124                                │  │
│  │      Jane Smith - 456 Oak Ave                             │  │
│  │      ETA: 12:15 PM                                        │  │
│  │                                                            │  │
│  │  #3  ⏳ ORD-20260117-00125                                │  │
│  │      Bob Brown - 789 Pine Rd                              │  │
│  │      ETA: 12:30 PM                                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  [Cancel Batch] [View on Map]                                    │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

### 5. Auto-Batch Trigger Page

**Route:** `/admin/batch-operations`

**Features:**
- ✓ Trigger auto-batching with filters
- ✓ View batching results
- ✓ Dispatch batches after cutoff
- ✓ Configure batch settings

**Layout Example:**
```
┌──────────────────────────────────────────────────────────────────┐
│  Batch Operations                                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─ Auto-Batching ───────────────────────────────────────────┐  │
│  │                                                            │  │
│  │  Create batches from READY orders                         │  │
│  │                                                            │  │
│  │  Meal Window:  [Lunch ▼]                                  │  │
│  │  Kitchen:      [All Kitchens ▼]                           │  │
│  │  Zone:         [All Zones ▼]                              │  │
│  │                                                            │  │
│  │  Ready Orders: 48                                         │  │
│  │  Expected Batches: ~4 (max 15 orders each)               │  │
│  │                                                            │  │
│  │  [Trigger Auto-Batch]                                     │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ Dispatch Batches ────────────────────────────────────────┐  │
│  │                                                            │  │
│  │  Mark batches as ready for driver acceptance              │  │
│  │                                                            │  │
│  │  Meal Window:  [Lunch ▼]                                  │  │
│  │  Cutoff Time:  11:30 AM  ✅ Passed                        │  │
│  │                                                            │  │
│  │  COLLECTING Batches: 8                                    │  │
│  │  Total Orders: 96                                         │  │
│  │                                                            │  │
│  │  [Dispatch Batches]                                       │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ Configuration ───────────────────────────────────────────┐  │
│  │  Max Batch Size:  [15 ▼] orders                          │  │
│  │  Failed Policy:   [Return to Kitchen ▼]                   │  │
│  │  Auto Dispatch:   [✓] Enabled  Delay: [30] mins          │  │
│  │                                                            │  │
│  │  [Save Configuration]                                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

### 6. Delivery Analytics Dashboard

**Route:** `/admin/analytics/delivery`

**Features:**
- ✓ Overall success rate
- ✓ By zone breakdown
- ✓ By driver performance
- ✓ By meal window
- ✓ Time-based trends
- ✓ Export reports

**Layout Example:**
```
┌──────────────────────────────────────────────────────────────────┐
│  Delivery Analytics                              [Export Report]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Date Range: [Last 30 Days ▼]  Zone: [All ▼]  Driver: [All ▼]   │
│                                                                    │
│  ┌─ Overall Performance ─────────────────────────────────────┐  │
│  │  Total Deliveries: 1,876      Success Rate: 95.84%        │  │
│  │  Delivered: 1,798             Failed: 78                   │  │
│  │  Total Batches: 145           Avg per Batch: 12.9          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ By Zone ─────────────────────────────────────────────────┐  │
│  │  Zone 1:  456 deliveries  |  96.49% success  |  16 failed │  │
│  │  Zone 2:  389 deliveries  |  95.12% success  |  19 failed │  │
│  │  Zone 3:  345 deliveries  |  94.78% success  |  18 failed │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ Top Performers ──────────────────────────────────────────┐  │
│  │  1. Rajesh Kumar     156 orders  |  94.87% success       │  │
│  │  2. Amit Sharma      145 orders  |  96.55% success       │  │
│  │  3. Priya Singh      134 orders  |  93.28% success       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ By Meal Window ──────────────────────────────────────────┐  │
│  │  Lunch:   945 orders  |  95.77% success                   │  │
│  │  Dinner:  931 orders  |  95.92% success                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ Failure Reasons ─────────────────────────────────────────┐  │
│  │  Customer Unavailable:     32 (41%)                        │  │
│  │  Wrong Address:            18 (23%)                        │  │
│  │  Customer Unreachable:     15 (19%)                        │  │
│  │  Address Not Found:        10 (13%)                        │  │
│  │  Customer Refused:          3 (4%)                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Implementation Guide

### Step 1: Create Service File

Create `src/services/orderBatchService.js`:

```javascript
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

const getAuthHeader = () => ({
  'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
});

export const orderBatchService = {
  // ORDER MANAGEMENT

  // Get all orders with filters
  getAllOrders: async (filters = {}) => {
    const params = new URLSearchParams({
      page: filters.page || 1,
      limit: filters.limit || 20,
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.kitchenId && { kitchenId: filters.kitchenId }),
      ...(filters.zoneId && { zoneId: filters.zoneId }),
      ...(filters.driverId && { driverId: filters.driverId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.menuType && { menuType: filters.menuType }),
      ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
      ...(filters.dateTo && { dateTo: filters.dateTo }),
    });

    const response = await fetch(`${API_BASE}/orders/admin/all?${params}`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) throw new Error('Failed to fetch orders');
    return response.json();
  },

  // Get order details
  getOrderDetails: async (orderId) => {
    const response = await fetch(`${API_BASE}/orders/${orderId}`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) throw new Error('Failed to fetch order details');
    return response.json();
  },

  // Update order status (admin override)
  updateOrderStatus: async (orderId, status, notes) => {
    const response = await fetch(`${API_BASE}/orders/admin/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, notes }),
    });

    if (!response.ok) throw new Error('Failed to update order status');
    return response.json();
  },

  // Cancel order
  cancelOrder: async (orderId, reason, initiateRefund = true) => {
    const response = await fetch(`${API_BASE}/orders/${orderId}/admin-cancel`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason, initiateRefund }),
    });

    if (!response.ok) throw new Error('Failed to cancel order');
    return response.json();
  },

  // BATCH MANAGEMENT

  // Get all batches with filters
  getAllBatches: async (filters = {}) => {
    const params = new URLSearchParams({
      page: filters.page || 1,
      limit: filters.limit || 20,
      ...(filters.kitchenId && { kitchenId: filters.kitchenId }),
      ...(filters.zoneId && { zoneId: filters.zoneId }),
      ...(filters.driverId && { driverId: filters.driverId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
      ...(filters.dateTo && { dateTo: filters.dateTo }),
    });

    const response = await fetch(`${API_BASE}/delivery/admin/batches?${params}`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) throw new Error('Failed to fetch batches');
    return response.json();
  },

  // Get batch details
  getBatchDetails: async (batchId) => {
    const response = await fetch(`${API_BASE}/delivery/batches/${batchId}`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) throw new Error('Failed to fetch batch details');
    return response.json();
  },

  // Trigger auto-batching
  triggerAutoBatch: async (filters = {}) => {
    const response = await fetch(`${API_BASE}/delivery/auto-batch`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filters),
    });

    if (!response.ok) throw new Error('Failed to trigger auto-batch');
    return response.json();
  },

  // Dispatch batches
  dispatchBatches: async (filters = {}) => {
    const response = await fetch(`${API_BASE}/delivery/dispatch`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filters),
    });

    if (!response.ok) throw new Error('Failed to dispatch batches');
    return response.json();
  },

  // Reassign batch to different driver
  reassignBatch: async (batchId, newDriverId, reason) => {
    const response = await fetch(`${API_BASE}/delivery/batches/${batchId}/reassign`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ newDriverId, reason }),
    });

    if (!response.ok) throw new Error('Failed to reassign batch');
    return response.json();
  },

  // Cancel batch
  cancelBatch: async (batchId, reason) => {
    const response = await fetch(`${API_BASE}/delivery/batches/${batchId}/cancel`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) throw new Error('Failed to cancel batch');
    return response.json();
  },

  // STATISTICS & ANALYTICS

  // Get delivery statistics
  getDeliveryStats: async (filters = {}) => {
    const params = new URLSearchParams({
      ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
      ...(filters.dateTo && { dateTo: filters.dateTo }),
      ...(filters.zoneId && { zoneId: filters.zoneId }),
      ...(filters.driverId && { driverId: filters.driverId }),
      ...(filters.kitchenId && { kitchenId: filters.kitchenId }),
    });

    const response = await fetch(`${API_BASE}/delivery/admin/stats?${params}`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) throw new Error('Failed to fetch delivery stats');
    return response.json();
  },

  // CONFIGURATION

  // Get batch configuration
  getBatchConfig: async () => {
    const response = await fetch(`${API_BASE}/delivery/config`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) throw new Error('Failed to fetch batch config');
    return response.json();
  },

  // Update batch configuration
  updateBatchConfig: async (config) => {
    const response = await fetch(`${API_BASE}/delivery/config`, {
      method: 'PUT',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) throw new Error('Failed to update batch config');
    return response.json();
  },
};
```

---

### Step 2: Create UI Components

**Component Structure:**
```
src/
├── pages/
│   └── admin/
│       ├── OrdersDashboard.jsx
│       ├── OrderDetailsPage.jsx
│       ├── BatchesDashboard.jsx
│       ├── BatchDetailsPage.jsx
│       ├── BatchOperationsPage.jsx
│       └── DeliveryAnalytics.jsx
├── components/
│   └── admin/
│       ├── OrderTable.jsx
│       ├── OrderDetailModal.jsx
│       ├── UpdateOrderStatusModal.jsx
│       ├── CancelOrderDialog.jsx
│       ├── BatchTable.jsx
│       ├── BatchDetailModal.jsx
│       ├── ReassignBatchDialog.jsx
│       ├── CancelBatchDialog.jsx
│       ├── AutoBatchForm.jsx
│       ├── DispatchBatchForm.jsx
│       ├── DeliveryStatsCard.jsx
│       └── OrderStatusTimeline.jsx
└── services/
    └── orderBatchService.js
```

---

### Step 3: Add Routes

```javascript
import OrdersDashboard from './pages/admin/OrdersDashboard';
import OrderDetailsPage from './pages/admin/OrderDetailsPage';
import BatchesDashboard from './pages/admin/BatchesDashboard';
import BatchDetailsPage from './pages/admin/BatchDetailsPage';
import BatchOperationsPage from './pages/admin/BatchOperationsPage';
import DeliveryAnalytics from './pages/admin/DeliveryAnalytics';

<Route path="/admin/orders" element={<OrdersDashboard />} />
<Route path="/admin/orders/:id" element={<OrderDetailsPage />} />
<Route path="/admin/batches" element={<BatchesDashboard />} />
<Route path="/admin/batches/:id" element={<BatchDetailsPage />} />
<Route path="/admin/batch-operations" element={<BatchOperationsPage />} />
<Route path="/admin/analytics/delivery" element={<DeliveryAnalytics />} />
```

---

### Step 4: Add Navigation

```javascript
<NavLink to="/admin/orders">
  <Icon name="shopping-bag" />
  Orders
  {activeOrdersCount > 0 && <Badge>{activeOrdersCount}</Badge>}
</NavLink>

<NavLink to="/admin/batches">
  <Icon name="package" />
  Batches
  {activeBatchesCount > 0 && <Badge>{activeBatchesCount}</Badge>}
</NavLink>

<NavLink to="/admin/batch-operations">
  <Icon name="settings" />
  Batch Operations
</NavLink>

<NavLink to="/admin/analytics/delivery">
  <Icon name="bar-chart" />
  Delivery Analytics
</NavLink>
```

---

## Error Handling

### Common Error Scenarios

**1. Auto-Batch Before Cutoff Time**
```javascript
// Error: "Cannot dispatch before window cutoff time"
// Solution: Wait until cutoff time or manually override
```

**2. Reassign Completed Batch**
```javascript
// Error: "Cannot reassign completed batch"
// Solution: Only reassign DISPATCHED or IN_PROGRESS batches
```

**3. Cancel Batch with Delivered Orders**
```javascript
// Error: "Cannot cancel batch with delivered orders"
// Solution: Can only cancel if no orders are delivered yet
```

**4. Delete Driver with Active Deliveries**
```javascript
// Error: "Cannot delete driver with pending deliveries"
// Solution: Reassign active batches first, then delete
```

**5. Update Order Status Invalid Transition**
```javascript
// Note: Admin override allows any transition
// No validation errors for status updates
```

---

## Testing Scenarios

### Manual Testing Checklist

#### Test 1: View All Orders
- [ ] Navigate to orders dashboard
- [ ] Verify orders are displayed with correct info
- [ ] Test filtering by status
- [ ] Test filtering by kitchen
- [ ] Test filtering by zone
- [ ] Test filtering by driver
- [ ] Test date range filter
- [ ] Test search by order number
- [ ] Test search by customer phone
- [ ] Verify pagination works

#### Test 2: View Order Details
- [ ] Click on an order
- [ ] Verify all order info is displayed
- [ ] Check customer details
- [ ] Verify items list with pricing
- [ ] Check driver info (if assigned)
- [ ] Verify batch info (if batched)
- [ ] Check status timeline
- [ ] Test "View on Map" link

#### Test 3: Update Order Status
- [ ] Open order details
- [ ] Click "Update Status"
- [ ] Select new status
- [ ] Add notes
- [ ] Submit update
- [ ] Verify status changed
- [ ] Check timeline updated
- [ ] Verify timestamp recorded

#### Test 4: Cancel Order
- [ ] Open order details
- [ ] Click "Cancel Order"
- [ ] Enter cancellation reason
- [ ] Choose refund option
- [ ] Confirm cancellation
- [ ] Verify order status changed to CANCELLED
- [ ] Check refund initiated (if paid)
- [ ] Verify vouchers restored

#### Test 5: View All Batches
- [ ] Navigate to batches dashboard
- [ ] Verify batches are displayed
- [ ] Test filtering by status
- [ ] Test filtering by kitchen
- [ ] Test filtering by zone
- [ ] Test filtering by driver
- [ ] Test date range filter
- [ ] Verify pagination works

#### Test 6: View Batch Details
- [ ] Click on a batch
- [ ] Verify batch info is displayed
- [ ] Check driver details
- [ ] Verify orders list with sequence
- [ ] Check delivery stats
- [ ] Test "View on Map" link

#### Test 7: Trigger Auto-Batching
- [ ] Navigate to batch operations
- [ ] Select meal window
- [ ] Select kitchen (optional)
- [ ] Check ready orders count
- [ ] Click "Trigger Auto-Batch"
- [ ] Verify batches created
- [ ] Check orders were batched
- [ ] Verify batch size limits respected

#### Test 8: Dispatch Batches
- [ ] Navigate to batch operations
- [ ] Select meal window
- [ ] Verify cutoff time passed
- [ ] Check COLLECTING batches count
- [ ] Click "Dispatch Batches"
- [ ] Verify batches moved to READY_FOR_DISPATCH
- [ ] Check drivers can see batches

#### Test 9: Reassign Batch
- [ ] Open batch details (DISPATCHED or IN_PROGRESS)
- [ ] Click "Reassign Driver"
- [ ] Select new driver
- [ ] Enter reason
- [ ] Confirm reassignment
- [ ] Verify batch driver updated
- [ ] Check orders updated with new driver
- [ ] Verify assignments updated

#### Test 10: Cancel Batch
- [ ] Open batch details (not completed)
- [ ] Click "Cancel Batch"
- [ ] Enter cancellation reason
- [ ] Confirm cancellation
- [ ] Verify batch status changed to CANCELLED
- [ ] Check orders unbatched
- [ ] Verify driver removed

#### Test 11: View Delivery Analytics
- [ ] Navigate to delivery analytics
- [ ] Select date range
- [ ] Verify overall stats displayed
- [ ] Check zone-wise breakdown
- [ ] Verify driver performance metrics
- [ ] Check meal window stats
- [ ] View failure reasons breakdown
- [ ] Test export report

#### Test 12: Configure Batch Settings
- [ ] Navigate to batch operations
- [ ] Update max batch size
- [ ] Change failed order policy
- [ ] Toggle auto dispatch
- [ ] Update dispatch delay
- [ ] Save configuration
- [ ] Verify settings applied to new batches

#### Test 13: Error Scenarios
- [ ] Try dispatching before cutoff (should fail)
- [ ] Try reassigning completed batch (should fail)
- [ ] Try cancelling batch with delivered orders (should fail)
- [ ] Test network failure handling
- [ ] Test expired auth token (should redirect)

#### Test 14: Real-time Updates
- [ ] Have driver accept batch (verify admin sees update)
- [ ] Have driver pickup batch (verify status update)
- [ ] Have driver deliver order (verify count update)
- [ ] Test multiple admins viewing same batch

---

## Document Version
- **Version:** 1.0
- **Last Updated:** January 17, 2026
- **Backend Status:** Fully Implemented ✅
- **Admin UI Status:** Needs Integration ❌

---

*This documentation covers complete driver order and batch management for admin panel. All backend endpoints are fully functional and ready for frontend integration.*
