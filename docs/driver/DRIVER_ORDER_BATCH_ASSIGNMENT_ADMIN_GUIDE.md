# Driver Order & Batch Assignment Management - Admin Guide

## Table of Contents
1. [Implementation Prompts for Claude (START HERE)](#implementation-prompts-for-claude-start-here)
2. [Overview](#overview)
3. [Admin Use Cases](#admin-use-cases)
4. [Driver-Batch Assignment Workflow](#driver-batch-assignment-workflow)
5. [API Endpoints Reference](#api-endpoints-reference)
6. [Data Models](#data-models)
7. [UI Requirements](#ui-requirements)
8. [Error Handling](#error-handling)
9. [Testing Scenarios](#testing-scenarios)
10. [Implementation Checklist](#implementation-checklist)

---

## IMPLEMENTATION PROMPTS FOR CLAUDE (START HERE)

Use these prompts sequentially to build the Driver-Batch Assignment Management UI for admins. Each prompt is self-contained and can be copy-pasted directly to Claude in your frontend project.

### Prompt 1: Setup Service Layer for Driver-Batch Management

```
I need to create a service layer for managing driver-batch assignments in my admin app.

Create a new file at `src/services/driverBatchService.js` with the following API functions:

DRIVER ASSIGNMENT QUERIES:
1. getDriverWithBatches(driverId) - GET /api/admin/drivers/:driverId/batches
   - Returns driver info with all their assigned batches (active, completed, cancelled)

2. getAllDriversWithActiveDeliveries() - GET /api/admin/drivers/active-deliveries
   - Returns list of all drivers with their current active batch assignments

3. getUnassignedBatches() - GET /api/delivery/admin/batches?status=READY_FOR_DISPATCH
   - Returns batches that are ready but don't have drivers assigned yet

4. getBatchDetails(batchId) - GET /api/delivery/batches/:batchId
   - Returns complete batch details including driver, orders, and delivery status

BATCH ASSIGNMENT OPERATIONS:
5. reassignBatch(batchId, newDriverId, reason) - PATCH /api/delivery/batches/:batchId/reassign
   - Moves batch from current driver to a new driver

6. cancelBatch(batchId, reason) - PATCH /api/delivery/batches/:batchId/cancel
   - Cancels batch and removes driver assignment

7. manualAssignBatch(batchId, driverId) - PATCH /api/delivery/batches/:batchId/assign-driver
   - Manually assigns unassigned batch to a driver

DRIVER AVAILABILITY:
8. getAvailableDrivers(zoneId, mealWindow) - GET /api/admin/drivers/available
   - Returns drivers who are active, approved, and have capacity for new batches
   - Filter by zone and meal window

9. getDriverCapacity(driverId) - GET /api/admin/drivers/:driverId/capacity
   - Returns driver's current workload (active batches, pending deliveries, capacity)

Each function should:
- Use axios with the base URL from env variables
- Include JWT token from localStorage in Authorization header
- Handle errors with try-catch
- Return { success, data, message, error } format
- Include proper JSDoc comments

Example structure:
```javascript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const getAuthHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  },
});

export const driverBatchService = {
  async getDriverWithBatches(driverId) {
    try {
      const response = await axios.get(
        `${API_URL}/api/admin/drivers/${driverId}/batches`,
        getAuthHeaders()
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch driver batches',
        error
      };
    }
  },

  // Implement remaining 8 functions following the same pattern
};
```

Make sure all functions follow REST conventions and handle edge cases like driver not found, batch already assigned, etc.
```

### Prompt 2: Create Active Drivers & Deliveries Dashboard

```
I need to create a dashboard showing all drivers with their current active deliveries and batch assignments.

Create `src/pages/admin/DriverDeliveriesDashboard.jsx` with these features:

**Page Layout:**
- Page title: "Driver Deliveries & Batch Assignments"
- Subtitle: Real-time view of all active deliveries

**Summary Cards (Top Row):**
1. Active Drivers (count of drivers with batches)
2. Batches In Progress (count)
3. Total Deliveries Today (count)
4. Unassigned Batches (count, red badge if > 0)

**Main Content - Driver Cards Grid:**

Each driver card shows:

**Header:**
- Driver avatar/photo
- Driver name (bold, large)
- Driver phone (clickable to call)
- Vehicle info (type + number)
- Status indicator (green dot = active delivering, gray = idle)

**Current Assignments:**
- List of assigned batches (if any):
  - For each batch:
    * Batch number (e.g., BATCH-20260117-Z1-00001)
    * Status badge (DISPATCHED, IN_PROGRESS, etc.)
    * Kitchen name + Zone
    * Order count (e.g., "8/12 delivered")
    * Progress bar showing delivery completion
    * Estimated completion time

**Quick Stats:**
- Total Deliveries Today: {count}
- Success Rate: {percentage}%
- Current Active Orders: {count}

**Actions:**
- [View Full Details] button
- [Reassign Batch] button (if has active batch)
- [View Driver Profile] button

**Filters & Search:**
- Search by driver name or phone
- Filter by status (All, Active, Idle, Offline)
- Filter by zone
- Sort by: Name, Active deliveries, Success rate

**Empty State:**
- If no drivers have active deliveries:
  - "No active deliveries at the moment"
  - "Drivers will appear here when they accept batches"

**Real-time Updates:**
- Auto-refresh every 30 seconds
- Show "Updated X seconds ago"
- Manual refresh button

Use API: driverBatchService.getAllDriversWithActiveDeliveries()

Implement with:
- Responsive grid (1 col mobile, 2 tablet, 3 desktop)
- Loading skeletons
- Error handling with retry
- Real-time status indicators
```

### Prompt 3: Create Driver Batch Details View

```
I need a detailed view showing a specific driver's batch assignments and delivery history.

Create `src/pages/admin/DriverBatchDetailsPage.jsx` (or modal) with these sections:

**Driver Header:**
- Large avatar
- Name, phone, email
- Vehicle info (type, number, model)
- Status badge (ACTIVE, INACTIVE, etc.)
- Approval status badge
- Overall stats (total deliveries, success rate)

**Active Batches Section:**
Title: "Active Assignments"

For each active batch (DISPATCHED, IN_PROGRESS):
- Batch card with:
  - Batch number (large, bold, copyable)
  - Kitchen name + Zone
  - Meal window badge (LUNCH/DINNER)
  - Status badge
  - Order count with progress: "5/8 delivered"
  - Visual progress bar
  - Delivery sequence list:
    * Show each order in sequence
    * #1, #2, #3... with sequence number
    * Customer name (partial: "John D.")
    * Delivery address (short: "123 Main St, Area")
    * Status icon (✅ delivered, 🚚 in progress, ⏳ pending)
  - Timestamps:
    * Assigned at: {time}
    * Picked up at: {time}
    * Estimated completion: {time}
  - Actions:
    * [View Full Batch Details] button
    * [Reassign to Another Driver] button (warning)
    * [View on Map] button (optional)

**Completed Batches Section:**
Title: "Recent Completed Batches (Last 7 days)"

Table view:
- Batch Number
- Date & Time
- Kitchen + Zone
- Orders (delivered/failed)
- Completion Time
- Status (COMPLETED/PARTIAL_COMPLETE)
- [View Details] link

**Statistics Card:**
- Today's Deliveries: {count}
- This Week: {count}
- Success Rate: {percentage}%
- Average Delivery Time: {minutes} min
- Failed Deliveries: {count}

**Activity Timeline:**
Show recent driver activities:
- "Delivered order ORD-123 - 2 mins ago"
- "Picked up batch BATCH-456 - 15 mins ago"
- "Accepted batch BATCH-789 - 1 hour ago"
- Format: icon + action + relative time

**Action Buttons (Top Right):**
- [View Driver Profile]
- [Contact Driver] (opens phone dialer)
- [View Performance Report]

Use APIs:
- driverBatchService.getDriverWithBatches(driverId)
- driverBatchService.getDriverCapacity(driverId)

Implement with:
- Tabs for Active/Completed/All batches
- Responsive layout
- Loading states
- Real-time status updates
```

### Prompt 4: Create Batch Reassignment Interface

```
I need a comprehensive interface for reassigning batches between drivers when issues occur.

Create `src/components/admin/ReassignBatchFlow.jsx` with these features:

**Trigger Scenarios:**
This component can be opened from:
1. Driver dashboard (reassign specific batch)
2. Batch details page (reassign this batch)
3. Unassigned batches list (assign to driver)

**Step 1: Current Assignment Info**

Show current state:
- Batch Number (large, bold)
- Current Driver (if any):
  - Name, phone
  - Vehicle info
  - Assigned at timestamp
  - Current status (DISPATCHED/IN_PROGRESS)
- Batch Details:
  - Kitchen name + Zone
  - Meal window
  - Order count
  - Pickup address
  - Delivery addresses count
- Reason for reassignment prompt:
  - "Why are you reassigning this batch?"
  - Textarea (required, min 10 chars)
  - Common reasons (quick select chips):
    * "Driver unavailable - personal emergency"
    * "Vehicle breakdown"
    * "Driver sick/injured"
    * "Driver requested change"
    * "Performance issues"
    * "Zone coverage change"
    * "Other (specify below)"

**Step 2: Select New Driver**

Show available drivers:

**Filter Options:**
- Same zone only (toggle, recommended on by default)
- Available capacity only (toggle, on by default)
- Active status only (toggle, on by default)

**Driver Selection Cards:**

For each available driver, show card with:
- Avatar + Name
- Phone number
- Vehicle type + number
- Current workload:
  - Active batches: {count}
  - Pending deliveries: {count}
  - Capacity indicator (visual bar: green=available, yellow=busy, red=full)
- Zone coverage (highlight if matches batch zone)
- Distance from pickup point (if available)
- Success rate: {percentage}%
- Last delivery: {relative time}
- [Select This Driver] button

**Sorting Options:**
- Closest to pickup point
- Lowest workload
- Highest success rate
- Recently active

**Empty State:**
If no available drivers:
- "No available drivers found"
- "Try adjusting filters or contact drivers directly"
- [Contact Offline Drivers] button

**Step 3: Confirmation**

Show summary before confirming:
- Old Assignment:
  - Driver: {name}
  - Assigned at: {time}
- New Assignment:
  - Driver: {name}
  - Will be assigned at: {now}
- Batch Info:
  - Batch number
  - Order count
  - Kitchen + Zone
- Reason: {entered reason}

Warning messages:
- "Current driver will be notified immediately"
- "New driver will receive assignment notification"
- "Orders will be updated with new driver info"

Actions:
- [Cancel] (go back)
- [Confirm Reassignment] (primary, blue)

**Step 4: Processing & Success**

During API call:
- Show loading spinner
- "Reassigning batch..."
- Disable all buttons

On success:
- Success animation (checkmark)
- "Batch reassigned successfully"
- Show new assignment details
- Auto-close after 2 seconds
- Refresh parent data

On error:
- Error message: "Failed to reassign: {error}"
- [Try Again] button
- [Cancel] button

Use APIs:
- driverBatchService.getAvailableDrivers(zoneId, mealWindow)
- driverBatchService.reassignBatch(batchId, newDriverId, reason)
- driverBatchService.getDriverCapacity(driverId) for each driver

Implement with:
- Multi-step wizard UI
- Form validation
- Loading states
- Error handling
- Responsive design
```

### Prompt 5: Create Unassigned Batches Management

```
I need a page for managing batches that are ready for dispatch but don't have drivers assigned yet.

Create `src/pages/admin/UnassignedBatchesPage.jsx` with:

**Page Header:**
- Title: "Unassigned Batches"
- Count badge: "{count} batches waiting for drivers" (red if > 0)
- Alert banner if count > 5: "⚠️ High number of unassigned batches. Consider manual assignment."

**Filters:**
- Kitchen dropdown
- Zone dropdown
- Meal window (LUNCH/DINNER)
- Date (Today/Custom)
- Sort by: Created time, Order count, Zone

**Batch Cards Grid:**

Each unassigned batch card shows:

**Header:**
- Batch number (large, bold)
- Status badge: "READY_FOR_DISPATCH" (orange)
- Created timestamp (with urgency indicator: red if > 30 mins old)

**Details:**
- Kitchen name (with icon)
- Zone name + code (with badge)
- Meal window badge
- Order count: "{count} orders"
- Estimated delivery time
- Pickup address (truncated)

**Urgency Indicators:**
- Green dot: Just created (< 10 mins)
- Yellow dot: Waiting 10-30 mins
- Red dot: Waiting > 30 mins (urgent!)

**Actions:**
- [Assign Driver] button (primary, blue)
- [View Orders] button (secondary)
- [Cancel Batch] button (danger, text only)

**Click [Assign Driver]:**
Opens driver selection modal:
- Shows available drivers for this zone
- Same interface as reassignment (Step 2 from Prompt 4)
- But without "reason" field (new assignment, not reassignment)
- Calls: driverBatchService.manualAssignBatch(batchId, driverId)

**Quick Assignment Feature:**
For admins who know driver IDs:
- Text input: "Enter driver phone or ID"
- [Quick Assign] button
- Searches drivers and assigns immediately

**Bulk Actions (Optional):**
- Checkboxes on each card
- "Select all in zone" option
- [Assign All to Auto-Dispatch] button
- [Cancel Selected] button

**Statistics Cards (Top):**
- Total Unassigned: {count}
- Oldest Unassigned: {time} ago
- By Zone breakdown (pie chart or list)
- Average wait time: {minutes} mins

**Empty State:**
- "All batches are assigned! 🎉"
- "Batches will appear here when they're ready for dispatch"

**Real-time Updates:**
- Auto-refresh every 15 seconds (faster than other pages)
- Sound notification when new unassigned batch appears (optional)
- Badge updates in real-time

Use APIs:
- driverBatchService.getUnassignedBatches()
- driverBatchService.getAvailableDrivers(zoneId, mealWindow)
- driverBatchService.manualAssignBatch(batchId, driverId)

Implement with:
- Urgent visual indicators
- Quick action buttons
- Real-time notifications
- Responsive grid
```

### Prompt 6: Create Batch Cancellation Dialog

```
I need a dialog for canceling batches with proper validation and warnings.

Create `src/components/admin/CancelBatchDialog.jsx` with:

**Dialog Header:**
- Title: "Cancel Batch"
- Batch number display
- Warning icon (red)

**Batch Information:**
Display read-only:
- Batch Number
- Kitchen name + Zone
- Driver (if assigned): Name, phone
- Order count: "{count} orders"
- Current status badge
- Created at timestamp

**Cancellation Reason:**
- Label: "Reason for Cancellation *"
- Textarea (required, min 10 chars, max 500)
- Character counter
- Placeholder: "Provide a clear reason for canceling this batch..."

**Common Reasons (Quick Select):**
Clickable chips that auto-fill textarea:
- "Kitchen closed unexpectedly"
- "Weather emergency / natural disaster"
- "Zone delivery suspended"
- "No drivers available"
- "System error / technical issue"
- "Customer cancellations exceeded threshold"
- "Other (specify below)"

**Impact Warning Box:**
Red/orange background with warning icon:

"⚠️ Canceling this batch will:"
- Remove driver assignment (if assigned)
- Notify driver and customers
- Set all {count} orders back to READY status
- Make orders available for new batch assignment
- Record cancellation in audit logs

**Restrictions:**
If batch status is COMPLETED or PARTIAL_COMPLETE:
- Show error: "Cannot cancel completed batches"
- Disable all inputs
- Only show [Close] button

If batch has orders with status DELIVERED:
- Show error: "Cannot cancel batch with delivered orders"
- List delivered orders
- Suggest: "Contact support for special handling"

**Confirmation Checkbox:**
- Checkbox: "I understand this action cannot be undone"
- Required before submit button enables

**Action Buttons:**
- [Go Back] (secondary, left)
- [Confirm Cancellation] (danger, red, right)
  - Disabled if:
    * Reason < 10 chars
    * Confirmation checkbox not checked
    * Batch is completed
    * Has delivered orders

**Processing State:**
- Show loading spinner
- "Canceling batch..."
- Disable all buttons

**Success:**
- Success message: "Batch cancelled successfully"
- Show impact summary:
  - "Driver unassigned: {driver name}"
  - "Orders unassigned: {count}"
  - "Orders returned to READY status"
- Auto-close after 3 seconds

**Error:**
- Show error message
- Keep dialog open
- [Retry] and [Cancel] buttons

Use API:
- driverBatchService.cancelBatch(batchId, reason)

After success:
- Close dialog
- Refresh parent data
- Show toast notification
- Update batch list/details

Implement with:
- Form validation
- Loading states
- Warning indicators
- Confirmation safeguards
```

### Prompt 7: Create Driver Capacity Indicator Component

```
I need a reusable component to show driver capacity/workload status.

Create `src/components/admin/DriverCapacityIndicator.jsx` with:

**Props:**
- driverId: string
- showDetails: boolean (default: false)
- size: 'small' | 'medium' | 'large' (default: 'medium')

**Fetches:**
- driverBatchService.getDriverCapacity(driverId)

**Returns Data:**
```json
{
  "activeBatches": 2,
  "totalActiveOrders": 15,
  "pendingDeliveries": 8,
  "maxCapacity": 20,
  "capacityPercentage": 75,
  "status": "BUSY" // AVAILABLE, BUSY, FULL, OFFLINE
}
```

**Visual Display:**

**Small Size:**
- Just a colored dot:
  - Green: AVAILABLE (< 50% capacity)
  - Yellow: BUSY (50-90% capacity)
  - Red: FULL (> 90% capacity)
  - Gray: OFFLINE
- Tooltip on hover shows details

**Medium Size:**
- Progress bar showing capacity:
  - Width: {capacityPercentage}%
  - Color: green (< 50%), yellow (50-90%), red (> 90%)
- Text below: "15/20 orders" or "Available"

**Large Size:**
- Card layout with:
  - Title: "Driver Capacity"
  - Large progress circle/bar
  - Stats:
    * Active Batches: {count}
    * Active Orders: {count}
    * Pending Deliveries: {count}
    * Available Slots: {remaining}
  - Status badge (AVAILABLE/BUSY/FULL)
  - Last updated: {relative time}

**Show Details Mode:**
If showDetails=true, display:
- List of active batches:
  - Batch number
  - Order count
  - Status
- Estimated completion time
- Recommended action:
  - If FULL: "Driver at capacity. Consider reassignment."
  - If BUSY: "Driver can accept 1-2 more batches"
  - If AVAILABLE: "Driver available for new batches"

**Loading State:**
- Skeleton loader (shimmer effect)
- Matches size variant

**Error State:**
- Show "?" icon with tooltip
- "Unable to fetch capacity"

**Refresh:**
- Auto-refresh every 60 seconds
- Manual refresh button (if size=large)

Use this component in:
- Driver selection dialogs
- Driver cards on dashboard
- Driver detail pages
- Reassignment flows

Implement with:
- Memoization (React.memo)
- Efficient re-renders
- Smooth animations
- Accessible tooltips
```

### Prompt 8: Create Driver-Batch Assignment History

```
I need a page showing historical data of batch assignments and changes.

Create `src/pages/admin/BatchAssignmentHistory.jsx` with:

**Page Header:**
- Title: "Batch Assignment History"
- Subtitle: "Track all batch assignments, reassignments, and cancellations"

**Filters:**
- Date range picker (default: Last 7 days)
- Driver dropdown (All/Specific driver)
- Kitchen dropdown
- Zone dropdown
- Action type:
  - All
  - New Assignment
  - Reassignment
  - Cancellation
  - Completion
- Status filter

**History Timeline:**

Display as vertical timeline:

Each entry shows:
- Timestamp (date + time, relative on hover)
- Action type icon:
  - 🆕 New assignment (green)
  - 🔄 Reassignment (blue)
  - ❌ Cancellation (red)
  - ✅ Completion (green)
- Main content:
  - "Batch {number} {action} {driver name}"
  - Examples:
    * "Batch BATCH-123 assigned to Rajesh Kumar"
    * "Batch BATCH-456 reassigned from John to Alice"
    * "Batch BATCH-789 cancelled by Admin"
- Details card (expandable):
  - Batch info (kitchen, zone, order count)
  - Driver info (name, phone, vehicle)
  - Reason (if reassignment/cancellation)
  - Performed by: Admin name
  - Related orders list
- Actions:
  - [View Batch Details]
  - [View Driver Profile]

**Statistics Cards (Top):**
- Total Assignments: {count}
- Reassignments: {count} ({percentage}% of total)
- Cancellations: {count}
- Average Assignment Duration: {time}
- Most Active Driver: {name} ({count} batches)

**Export Options:**
- [Export to CSV] button
- Downloads filtered history data
- Includes: Date, Batch#, Driver, Action, Reason, Orders, Status

**Pagination:**
- Show 50 entries per page
- Infinite scroll OR page numbers

**Search:**
- Search by batch number, driver name, or reason text
- Real-time search (debounced)

Use APIs:
- Get audit logs filtered by entity type = BATCH
- Filter by action types related to assignment
- Group by batch for better readability

Implement with:
- Timeline visualization
- Expandable cards
- Date range filtering
- Export functionality
```

### Prompt 9: Add Routes and Navigation

```
TASK: Integrate all driver-batch management pages into the admin app routing and navigation.

**1. Update `src/App.jsx` or router configuration:**

Add these routes under admin-protected routes:
- `/admin/driver-deliveries` → DriverDeliveriesDashboard (main page)
- `/admin/drivers/:id/batches` → DriverBatchDetailsPage
- `/admin/unassigned-batches` → UnassignedBatchesPage
- `/admin/batch-assignment-history` → BatchAssignmentHistory

**2. Update admin sidebar navigation:**

Add Driver Deliveries section to `src/components/AdminSidebar.jsx`:

```javascript
{
  title: 'Driver Deliveries',
  icon: <TruckIcon />, // or delivery icon
  items: [
    {
      title: 'Active Deliveries',
      path: '/admin/driver-deliveries',
      icon: <TruckIcon />,
      badge: activeDriversCount, // dynamic count
    },
    {
      title: 'Unassigned Batches',
      path: '/admin/unassigned-batches',
      icon: <AlertIcon />,
      badge: unassignedBatchesCount, // red badge if > 0
      badgeColor: 'red',
    },
    {
      title: 'Assignment History',
      path: '/admin/batch-assignment-history',
      icon: <HistoryIcon />,
    },
  ],
}
```

**3. Add badge counters:**

Create hooks for real-time counts:

`src/hooks/useActiveDeliveryCounts.js`:
- Fetches active drivers count
- Fetches unassigned batches count
- Polls every 30 seconds
- Returns { activeDrivers, unassignedBatches, loading, error }
- Use in sidebar for badge display

**4. Add dashboard widgets:**

On main admin dashboard (`/admin/dashboard`), add quick access cards:

**Active Deliveries Card:**
- Shows count of drivers with active batches
- Shows count of in-progress deliveries
- [View All] button → links to /admin/driver-deliveries

**Unassigned Batches Alert:**
- Only show if unassignedCount > 0
- Red alert banner
- "{count} batches need driver assignment"
- [Assign Now] button → links to /admin/unassigned-batches

**5. Add breadcrumbs:**

Update breadcrumb component to show:
- Admin → Driver Deliveries → Active Deliveries
- Admin → Driver Deliveries → Unassigned Batches
- Admin → Drivers → {Driver Name} → Batch Assignments

**6. Protected route wrapper:**

Ensure routes use admin authentication:
```javascript
<Route
  path="/admin/driver-deliveries/*"
  element={
    <RequireAuth roles={['ADMIN']}>
      <Routes>
        <Route path="" element={<DriverDeliveriesDashboard />} />
        <Route path=":driverId/batches" element={<DriverBatchDetailsPage />} />
      </Routes>
    </RequireAuth>
  }
/>
```

**7. Add quick actions:**

In driver management pages (from previous docs), add quick action button:
- "View Batch Assignments" button
- Links to `/admin/drivers/:id/batches`

Test navigation, ensure back button works, and active states are highlighted in sidebar.
```

### Prompt 10: Add Real-time Updates and Polish

```
I need to add real-time features and polish to the driver-batch management system.

**1. Real-time Status Updates:**

Create `src/hooks/useRealtimeBatchUpdates.js`:
- WebSocket connection OR polling every 20 seconds
- Subscribes to batch status changes
- Updates UI automatically when:
  - Driver accepts batch
  - Batch status changes (DISPATCHED → IN_PROGRESS → COMPLETED)
  - Driver picks up batch
  - Order delivered/failed
  - Batch reassigned
  - Batch cancelled

**2. Live Driver Status Indicators:**

Create `src/hooks/useDriverOnlineStatus.js`:
- Shows if driver is online/offline
- Green dot = online (active in last 5 mins)
- Gray dot = offline
- Updates based on driver's last activity timestamp

**3. Notification System:**

Add toast notifications for:
- New unassigned batch created → "New batch awaiting assignment"
- Batch reassignment successful → "Batch reassigned to {driver}"
- Driver goes offline with active batch → "⚠️ {driver} went offline with active batch"
- Batch completion → "Batch {number} completed by {driver}"
- High unassigned batch count → "⚠️ {count} unassigned batches"

**4. Sound Alerts (Optional):**

Add sound notifications for:
- Critical: Driver offline with active batch
- Warning: Unassigned batch waiting > 30 mins
- Info: Batch completed successfully
- Toggle in settings to enable/disable

**5. Loading States:**

Implement skeleton loaders:
- Driver card skeleton (shimmer effect)
- Batch list skeleton
- Details page skeleton
- Match actual component layout

**6. Empty States:**

Design friendly empty states:
- No active deliveries:
  - Illustration: Delivery truck with "All quiet"
  - "No deliveries in progress"
  - "Drivers will appear here when they accept batches"
- No unassigned batches:
  - Celebration icon
  - "All batches assigned!"
  - "Great job managing deliveries"
- No history:
  - Clock icon
  - "No assignment history yet"

**7. Error Handling:**

Comprehensive error handling:
- Network errors: Show retry button with exponential backoff
- API errors: Display specific error messages
- Validation errors: Inline form errors
- Permission errors: Redirect with message
- Timeout errors: "Taking longer than usual" with retry

**8. Performance Optimizations:**

- Memoize expensive computations (React.memo, useMemo)
- Virtualize long lists (react-window for 100+ items)
- Debounce search inputs (300ms)
- Lazy load images and heavy components
- Cache API responses (5 min stale-while-revalidate)

**9. Accessibility:**

- Keyboard shortcuts:
  - `Ctrl/Cmd + R` → Refresh data
  - `Ctrl/Cmd + F` → Focus search
  - `Escape` → Close modals
  - `Arrow keys` → Navigate cards
- ARIA labels for all interactive elements
- Focus trap in modals
- Screen reader announcements for status changes
- High contrast mode support
- Tab order makes sense

**10. Mobile Responsiveness:**

- Test all pages on mobile (375px width)
- Driver cards: Single column on mobile
- Reassignment flow: Full screen on mobile
- Tables: Horizontal scroll or card view
- Touch-friendly buttons (min 44px tap target)
- Swipe gestures for navigation (optional)

**11. Visual Polish:**

- Consistent color scheme:
  - Green: Success, available, active
  - Yellow: Warning, busy, expiring soon
  - Red: Error, full capacity, urgent
  - Blue: Info, primary actions
  - Gray: Inactive, disabled
- Smooth transitions (300ms ease)
- Hover effects on interactive elements
- Focus rings for keyboard navigation
- Consistent spacing (8px grid system)
- Drop shadows for elevation
- Loading progress indicators

**12. Data Export:**

Add export functionality:
- [Export to CSV] on all list pages
- Includes filtered/sorted data
- Format: UTF-8, Excel-compatible
- Filename: `driver-batches-{date}.csv`
- Shows download progress

**13. Audit Logging:**

Log all admin actions:
- Batch reassignments (with reason)
- Manual assignments
- Cancellations
- Display in Activity Log component
- Include: timestamp, admin name, action, entity, reason

**14. Help & Documentation:**

Add help tooltips:
- Info icons (?) next to complex features
- Hover to show explanation
- "Learn more" links to documentation
- Onboarding tour for new admins (optional)

After these improvements, the Driver-Batch Assignment Management system will be production-ready with excellent UX!
```

---

## Overview

### What is Driver-Batch Assignment Management?

This system allows admins to **monitor and manage the assignment of delivery batches to drivers**, handling situations like driver unavailability, vehicle issues, or reassignment needs. Unlike the general batch management system, this focuses specifically on the **driver-batch relationship** from an admin perspective.

### Key Admin Responsibilities

1. **Monitor Active Deliveries**: See which drivers have which batches in real-time
2. **Handle Driver Issues**: Reassign batches when drivers face problems
3. **Assign Unassigned Batches**: Manually assign batches that don't have drivers
4. **Track Assignment History**: View all assignments, reassignments, and cancellations
5. **Manage Driver Workload**: Ensure drivers aren't overloaded or underutilized

### When Admins Need This System

**Common Scenarios:**
- Driver calls in sick mid-shift with active batch
- Vehicle breakdown during delivery
- Driver performance issues requiring batch removal
- No drivers accepted auto-dispatched batch
- Emergency reassignment due to traffic/accidents
- Balancing workload across drivers
- Investigating delivery issues

---

## Admin Use Cases

### Use Case 1: Driver Vehicle Breakdown

**Scenario:** Driver Rajesh's bike breaks down with 5 pending deliveries.

**Admin Actions:**
1. View Rajesh's active batches on Driver Deliveries Dashboard
2. Click batch to see details (5 orders, 3 delivered, 2 pending)
3. Click [Reassign Batch]
4. Enter reason: "Vehicle breakdown - bike not starting"
5. View available drivers in same zone
6. Select available driver with capacity
7. Confirm reassignment
8. System notifies both drivers
9. New driver receives updated batch with 2 pending orders
10. Rajesh's batch is removed from his assignments

**Expected Outcome:**
- Batch seamlessly transferred to new driver
- Customers receive updated delivery information
- No delivery failures
- Both drivers notified

---

### Use Case 2: No Driver Accepted Batch

**Scenario:** Lunch batch for Zone 2 was dispatched 30 minutes ago but no driver accepted it.

**Admin Actions:**
1. Notification: "Batch BATCH-123 unassigned for 30+ minutes"
2. Navigate to Unassigned Batches page
3. See batch with red urgency indicator
4. Click [Assign Driver]
5. View available drivers for Zone 2
6. Sort by: "Lowest workload"
7. Select driver with only 1 active batch
8. Manual assignment confirmed
9. Driver immediately notified
10. Batch moves to DISPATCHED status

**Expected Outcome:**
- Batch gets driver before customers affected
- Kitchen doesn't waste prepared food
- Delivery happens within time window

---

### Use Case 3: Driver Performance Issue

**Scenario:** Driver has failed 3 deliveries today due to not following procedures.

**Admin Actions:**
1. View driver's batch details page
2. See active batch with 2 failed orders
3. Review failure reasons: "Did not call customer", "Did not attempt delivery"
4. Click [Reassign Batch] on active batch
5. Enter reason: "Performance issues - multiple failed deliveries without proper attempt"
6. Select high-performing driver
7. Confirm reassignment
8. Separately: Suspend driver account (from Driver Management)
9. Add suspension reason linking to batch reassignment

**Expected Outcome:**
- Remaining orders delivered properly by reliable driver
- Poor-performing driver removed from active deliveries
- Admin has audit trail for HR/disciplinary action

---

### Use Case 4: Balancing Workload

**Scenario:** Driver A has 3 batches (18 orders) while Driver B has 0 batches in same zone.

**Admin Actions:**
1. View Active Deliveries Dashboard
2. See workload imbalance
3. Click Driver A's profile
4. View their 3 batches
5. Identify batch that's still DISPATCHED (not picked up yet)
6. Click [Reassign Batch]
7. Enter reason: "Workload balancing - redistributing for efficiency"
8. Select Driver B (showing AVAILABLE status)
9. Confirm reassignment
10. Monitor both drivers now have balanced workload

**Expected Outcome:**
- Deliveries happen faster
- Driver A not overwhelmed
- Driver B utilized effectively
- Better overall delivery times

---

### Use Case 5: Emergency Zone Issue

**Scenario:** Heavy rain causes flooding in Zone 3, making deliveries unsafe.

**Admin Actions:**
1. View all batches for Zone 3
2. See 4 active batches with different drivers
3. Bulk action: Select all Zone 3 batches
4. Click [Cancel Selected Batches]
5. Enter reason: "Weather emergency - heavy flooding makes Zone 3 unsafe for delivery"
6. Confirm cancellation
7. All 4 batches cancelled
8. Orders returned to READY status
9. Customers notified of delay
10. Can reschedule for later or next meal window

**Expected Outcome:**
- Driver safety prioritized
- Customers informed proactively
- Orders can be rescheduled when safe
- Clear audit trail of emergency action

---

## Driver-Batch Assignment Workflow

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: BATCH CREATION & DISPATCH                              │
└─────────────────────────────────────────────────────────────────┘

Auto-Batching System (Backend):
├─ Groups READY orders by kitchen+zone+mealWindow
├─ Creates batch with status: COLLECTING
└─ After cutoff time: Status → READY_FOR_DISPATCH

Admin Dispatch:
├─ Admin triggers dispatch (or auto-dispatch runs)
├─ Batch status: READY_FOR_DISPATCH
└─ Batch now visible to drivers for acceptance


┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: DRIVER ACCEPTANCE (Normal Flow)                        │
└─────────────────────────────────────────────────────────────────┘

Driver App:
├─ Driver sees available batches for their zone
├─ Driver reviews: kitchen, order count, earnings, delivery area
├─ Driver clicks [Accept Batch]
│
Backend Processing (Atomic):
├─ Check: Batch still available (not accepted by another driver)
├─ Assign: batch.driverId = driver._id
├─ Update: All orders.driverId = driver._id
├─ Create: DeliveryAssignment for each order
├─ Change Status: READY_FOR_DISPATCH → DISPATCHED
└─ Notify: Driver confirmed, customers notified

Admin View Updates:
├─ Batch moves from "Unassigned" to "Driver's Active Batches"
├─ Driver card shows new batch assignment
└─ Real-time update on dashboard


┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: ADMIN INTERVENTION - REASSIGNMENT                      │
└─────────────────────────────────────────────────────────────────┘

Trigger: Admin clicks [Reassign Batch]

Step 1: Capture Reason
├─ Admin enters reason (required, min 10 chars)
├─ Examples:
│  ├─ "Driver vehicle breakdown"
│  ├─ "Driver sick/emergency"
│  ├─ "Performance issues"
│  └─ "Workload balancing"
└─ Reason stored in audit log

Step 2: Select New Driver
├─ Admin views available drivers
├─ Filter by:
│  ├─ Same zone (recommended)
│  ├─ Available capacity
│  └─ Active status
├─ Each driver shows:
│  ├─ Current workload (capacity indicator)
│  ├─ Active batches count
│  ├─ Success rate
│  └─ Distance from pickup (optional)
└─ Admin selects new driver

Step 3: Confirm Reassignment
├─ Admin reviews summary:
│  ├─ Old driver: {name}
│  ├─ New driver: {name}
│  ├─ Batch: {number}
│  ├─ Orders: {count}
│  └─ Reason: {text}
└─ Admin clicks [Confirm]

Backend Processing:
├─ API: PATCH /api/delivery/batches/:batchId/reassign
├─ Validate:
│  ├─ Batch exists and not COMPLETED
│  ├─ New driver is ACTIVE and APPROVED
│  ├─ New driver has capacity
│  └─ Reason provided
├─ Update:
│  ├─ batch.driverId = newDriver._id
│  ├─ batch.driverAssignedAt = now
│  ├─ All orders.driverId = newDriver._id
│  └─ All deliveryAssignments.driverId = newDriver._id
├─ Notify:
│  ├─ Old driver: "Batch reassigned"
│  ├─ New driver: "New batch assigned to you"
│  └─ Customers: "Driver updated" (optional)
├─ Audit Log:
│  ├─ Action: REASSIGN_BATCH
│  ├─ Batch ID, Old Driver, New Driver
│  ├─ Admin ID, Reason
│  └─ Timestamp
└─ Response: Success with updated batch

Admin View Updates:
├─ Batch removed from old driver's list
├─ Batch added to new driver's list
├─ Success toast notification
└─ Dashboard reflects change


┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: ADMIN INTERVENTION - MANUAL ASSIGNMENT                 │
└─────────────────────────────────────────────────────────────────┘

Scenario: Batch never got accepted by any driver

Admin Actions:
├─ Views Unassigned Batches page
├─ Sees batch with urgency indicator (red if > 30 mins old)
├─ Clicks [Assign Driver]
│
Driver Selection:
├─ Same as reassignment Step 2
├─ Shows available drivers for batch zone
├─ Admin selects driver
└─ No reason required (new assignment, not reassignment)

Backend Processing:
├─ API: PATCH /api/delivery/batches/:batchId/assign-driver
├─ Validate:
│  ├─ Batch status is READY_FOR_DISPATCH
│  ├─ Batch has no driver assigned (driverId = null)
│  └─ Selected driver is valid
├─ Assign:
│  ├─ batch.driverId = driver._id
│  ├─ batch.status = DISPATCHED
│  ├─ batch.driverAssignedAt = now
│  ├─ Update all orders with driverId
│  └─ Create deliveryAssignments
├─ Notify:
│  ├─ Driver: "New batch assigned"
│  └─ Customers: "Driver assigned, on the way"
└─ Audit Log: MANUAL_ASSIGN_BATCH

Admin View Updates:
├─ Batch removed from Unassigned Batches
├─ Batch appears in driver's active assignments
└─ Success notification


┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: ADMIN INTERVENTION - BATCH CANCELLATION                │
└─────────────────────────────────────────────────────────────────┘

Scenario: Batch cannot be delivered (kitchen issue, zone issue, etc.)

Admin Actions:
├─ Clicks [Cancel Batch]
├─ Enters cancellation reason (required)
├─ Examples:
│  ├─ "Kitchen closed unexpectedly"
│  ├─ "Weather emergency"
│  ├─ "Zone delivery suspended"
│  └─ "No drivers available"
└─ Confirms cancellation

Backend Processing:
├─ API: PATCH /api/delivery/batches/:batchId/cancel
├─ Validate:
│  ├─ Batch not COMPLETED or PARTIAL_COMPLETE
│  ├─ No orders with status DELIVERED
│  └─ Reason provided
├─ Update:
│  ├─ batch.status = CANCELLED
│  ├─ batch.cancellationReason = reason
│  ├─ All orders: batchId = null, driverId = null
│  ├─ All orders: status back to READY
│  └─ All deliveryAssignments: status = CANCELLED
├─ Notify:
│  ├─ Driver: "Batch cancelled: {reason}"
│  ├─ Customers: "Delivery delayed/cancelled"
│  └─ Kitchen: "Orders unbatched"
├─ Audit Log: CANCEL_BATCH
└─ Response: Orders available for new batch

Admin View Updates:
├─ Batch removed from driver's assignments
├─ Batch status shows CANCELLED
├─ Orders back in READY pool
└─ Can be re-batched for later


┌─────────────────────────────────────────────────────────────────┐
│ PHASE 6: MONITORING & TRACKING                                  │
└─────────────────────────────────────────────────────────────────┘

Admin Dashboard:
├─ Real-time view of all drivers with active batches
├─ Capacity indicators (available, busy, full)
├─ Unassigned batch count (with alerts)
├─ Quick actions for intervention
└─ Auto-refresh every 30 seconds

Assignment History:
├─ Complete audit trail of all assignments
├─ Reassignments with reasons
├─ Cancellations with impact
├─ Filterable by driver, date, action type
└─ Exportable for reporting

Driver Performance:
├─ View individual driver's batch history
├─ Success rate and completion stats
├─ Reassignment frequency (flag if high)
└─ Link to driver management for actions
```

---

## API Endpoints Reference

### Driver-Batch Query Endpoints

#### 1. Get Driver with All Batches

**Endpoint:** `GET /api/admin/drivers/:driverId/batches`

**Purpose:** Fetch specific driver's batch assignments (active, completed, cancelled)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by batch status |
| `dateFrom` | date | - | Start date |
| `dateTo` | date | - | End date |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

**Request Example:**
```bash
GET /api/admin/drivers/65driver123/batches?status=IN_PROGRESS
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Driver batches retrieved",
  "data": {
    "driver": {
      "_id": "65driver123",
      "name": "Rajesh Kumar",
      "phone": "+919998887776",
      "vehicleType": "BIKE",
      "vehicleNumber": "MH12AB1234",
      "status": "ACTIVE",
      "approvalStatus": "APPROVED"
    },
    "activeBatches": [
      {
        "_id": "65batch123",
        "batchNumber": "BATCH-20260117-Z1-00001",
        "kitchenId": {
          "name": "Kitchen A"
        },
        "zoneId": {
          "name": "Zone 1",
          "code": "Z1"
        },
        "status": "IN_PROGRESS",
        "orderCount": 12,
        "totalDelivered": 8,
        "totalFailed": 0,
        "driverAssignedAt": "2026-01-17T11:35:00.000Z",
        "pickedUpAt": "2026-01-17T11:45:00.000Z"
      }
    ],
    "completedBatches": [
      // Recent completed batches
    ],
    "stats": {
      "totalBatches": 45,
      "completedBatches": 42,
      "cancelledBatches": 3,
      "totalDeliveries": 523,
      "successRate": 96.5
    }
  }
}
```

---

#### 2. Get All Drivers with Active Deliveries

**Endpoint:** `GET /api/admin/drivers/active-deliveries`

**Purpose:** Dashboard view of all drivers with current active batch assignments

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `zoneId` | string | - | Filter by zone |
| `status` | string | - | Filter by driver status |

**Request Example:**
```bash
GET /api/admin/drivers/active-deliveries
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Active drivers retrieved",
  "data": {
    "drivers": [
      {
        "_id": "65driver123",
        "name": "Rajesh Kumar",
        "phone": "+919998887776",
        "vehicleType": "BIKE",
        "vehicleNumber": "MH12AB1234",
        "status": "ACTIVE",
        "activeBatches": [
          {
            "_id": "65batch123",
            "batchNumber": "BATCH-20260117-Z1-00001",
            "kitchenId": {
              "name": "Kitchen A"
            },
            "zoneId": {
              "name": "Zone 1"
            },
            "status": "IN_PROGRESS",
            "orderCount": 12,
            "totalDelivered": 8,
            "totalFailed": 0,
            "estimatedCompletion": "2026-01-17T13:00:00.000Z"
          }
        ],
        "todayStats": {
          "deliveries": 35,
          "successRate": 97.1,
          "activeOrders": 4
        }
      },
      // More drivers...
    ],
    "summary": {
      "totalActiveDrivers": 15,
      "totalActiveBatches": 18,
      "totalActiveOrders": 145
    }
  }
}
```

---

#### 3. Get Unassigned Batches

**Endpoint:** `GET /api/delivery/admin/batches?status=READY_FOR_DISPATCH&driverId=null`

**Purpose:** List all batches waiting for driver assignment

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | READY_FOR_DISPATCH | Must be READY_FOR_DISPATCH |
| `kitchenId` | string | - | Filter by kitchen |
| `zoneId` | string | - | Filter by zone |
| `mealWindow` | string | - | LUNCH or DINNER |

**Request Example:**
```bash
GET /api/delivery/admin/batches?status=READY_FOR_DISPATCH
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Unassigned batches retrieved",
  "data": {
    "batches": [
      {
        "_id": "65batch456",
        "batchNumber": "BATCH-20260117-Z2-00005",
        "kitchenId": {
          "_id": "65kitchen123",
          "name": "Kitchen B"
        },
        "zoneId": {
          "_id": "65zone124",
          "name": "Zone 2",
          "code": "Z2"
        },
        "status": "READY_FOR_DISPATCH",
        "driverId": null,
        "orderCount": 8,
        "mealWindow": "LUNCH",
        "dispatchedAt": "2026-01-17T11:40:00.000Z",
        "windowEndTime": "2026-01-17T11:30:00.000Z",
        "createdAt": "2026-01-17T10:15:00.000Z",
        "waitingMinutes": 35
      }
    ],
    "total": 3
  }
}
```

---

#### 4. Get Available Drivers for Assignment

**Endpoint:** `GET /api/admin/drivers/available`

**Purpose:** List drivers who can accept batch assignments

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `zoneId` | string | ✓ Yes | Zone for the batch |
| `mealWindow` | string | ✗ | LUNCH or DINNER |

**Request Example:**
```bash
GET /api/admin/drivers/available?zoneId=65zone123&mealWindow=LUNCH
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Available drivers retrieved",
  "data": {
    "drivers": [
      {
        "_id": "65driver789",
        "name": "Amit Singh",
        "phone": "+919876543210",
        "vehicleType": "SCOOTER",
        "vehicleNumber": "DL10CD5678",
        "status": "ACTIVE",
        "approvalStatus": "APPROVED",
        "zonesServed": ["65zone123", "65zone124"],
        "capacity": {
          "activeBatches": 1,
          "activeOrders": 8,
          "maxCapacity": 20,
          "availableSlots": 12,
          "capacityPercentage": 40,
          "status": "AVAILABLE"
        },
        "stats": {
          "totalDeliveries": 234,
          "successRate": 98.3
        },
        "lastActivity": "2026-01-17T12:30:00.000Z",
        "distanceFromPickup": 2.5
      },
      // More available drivers...
    ]
  }
}
```

---

#### 5. Get Driver Capacity

**Endpoint:** `GET /api/admin/drivers/:driverId/capacity`

**Purpose:** Check driver's current workload and capacity

**Request Example:**
```bash
GET /api/admin/drivers/65driver123/capacity
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Driver capacity retrieved",
  "data": {
    "capacity": {
      "activeBatches": 2,
      "totalActiveOrders": 15,
      "deliveredToday": 8,
      "pendingDeliveries": 7,
      "maxCapacity": 20,
      "availableSlots": 5,
      "capacityPercentage": 75,
      "status": "BUSY",
      "canAcceptMore": true,
      "recommendedMaxNew": 1
    },
    "activeBatches": [
      {
        "batchId": "65batch123",
        "batchNumber": "BATCH-20260117-Z1-00001",
        "orderCount": 8,
        "delivered": 5,
        "pending": 3,
        "status": "IN_PROGRESS"
      },
      {
        "batchId": "65batch124",
        "batchNumber": "BATCH-20260117-Z1-00002",
        "orderCount": 7,
        "delivered": 3,
        "pending": 4,
        "status": "IN_PROGRESS"
      }
    ]
  }
}
```

---

### Batch Assignment Operation Endpoints

#### 6. Reassign Batch to Different Driver

**Endpoint:** `PATCH /api/delivery/batches/:batchId/reassign`

**Purpose:** Move batch from current driver to a new driver

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `batchId` | string | Batch ID to reassign |

**Request Body:**
```json
{
  "newDriverId": "65driver789",
  "reason": "Original driver vehicle breakdown - reassigning to available driver"
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `newDriverId` | string | ✓ Yes | ID of new driver |
| `reason` | string | ✓ Yes | Reason for reassignment (min 10 chars) |

**Request Example:**
```bash
PATCH /api/delivery/batches/65batch123/reassign
Authorization: Bearer <token>
Content-Type: application/json

{
  "newDriverId": "65driver789",
  "reason": "Original driver vehicle breakdown - reassigning to available driver"
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
      "batchNumber": "BATCH-20260117-Z1-00001",
      "driverId": "65driver789",
      "previousDriverId": "65driver123",
      "driverAssignedAt": "2026-01-17T13:00:00.000Z",
      "reassignmentReason": "Original driver vehicle breakdown - reassigning to available driver",
      "status": "DISPATCHED"
    },
    "ordersUpdated": 12,
    "assignmentsUpdated": 12,
    "notifications": {
      "oldDriverNotified": true,
      "newDriverNotified": true,
      "customersNotified": true
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Batch already completed, invalid status
- `404 Not Found`: Batch or driver not found
- `409 Conflict`: New driver at capacity or not available

---

#### 7. Manually Assign Driver to Unassigned Batch

**Endpoint:** `PATCH /api/delivery/batches/:batchId/assign-driver`

**Purpose:** Assign driver to batch that has no driver

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `batchId` | string | Batch ID to assign |

**Request Body:**
```json
{
  "driverId": "65driver789"
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `driverId` | string | ✓ Yes | ID of driver to assign |

**Request Example:**
```bash
PATCH /api/delivery/batches/65batch456/assign-driver
Authorization: Bearer <token>
Content-Type: application/json

{
  "driverId": "65driver789"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Driver assigned to batch",
  "data": {
    "batch": {
      "_id": "65batch456",
      "batchNumber": "BATCH-20260117-Z2-00005",
      "driverId": "65driver789",
      "driverAssignedAt": "2026-01-17T13:10:00.000Z",
      "status": "DISPATCHED"
    },
    "driver": {
      "_id": "65driver789",
      "name": "Amit Singh",
      "phone": "+919876543210"
    },
    "ordersUpdated": 8
  }
}
```

**Error Responses:**
- `400 Bad Request`: Batch already has driver, invalid status
- `404 Not Found`: Batch or driver not found
- `409 Conflict`: Driver at capacity or not approved

---

#### 8. Cancel Batch

**Endpoint:** `PATCH /api/delivery/batches/:batchId/cancel`

**Purpose:** Cancel batch and remove driver assignment

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `batchId` | string | Batch ID to cancel |

**Request Body:**
```json
{
  "reason": "Kitchen closed unexpectedly due to power outage"
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reason` | string | ✓ Yes | Cancellation reason (min 10 chars) |

**Request Example:**
```bash
PATCH /api/delivery/batches/65batch123/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Kitchen closed unexpectedly due to power outage"
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
      "cancellationReason": "Kitchen closed unexpectedly due to power outage",
      "cancelledAt": "2026-01-17T13:15:00.000Z",
      "cancelledBy": "65admin123"
    },
    "impact": {
      "ordersUnbatched": 12,
      "driverUnassigned": true,
      "ordersReturnedToReady": true
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Batch already completed, has delivered orders
- `404 Not Found`: Batch not found
- `403 Forbidden`: Cannot cancel completed batches

---

## Data Models

### Batch Schema (Relevant Fields for Driver Assignment)

```javascript
{
  _id: ObjectId,
  batchNumber: String, // "BATCH-20260117-Z1-00001"

  // Driver Assignment
  driverId: ObjectId (ref: "User"), // Currently assigned driver
  driverAssignedAt: Date,
  previousDriverId: ObjectId, // For reassignment tracking
  reassignmentReason: String,
  reassignedBy: ObjectId (ref: "User"), // Admin who reassigned
  reassignedAt: Date,

  // Batch Details
  kitchenId: ObjectId (ref: "Kitchen"),
  zoneId: ObjectId (ref: "Zone"),
  menuType: String, // MEAL_MENU, ON_DEMAND_MENU
  mealWindow: String, // LUNCH, DINNER

  // Status
  status: String, // COLLECTING, READY_FOR_DISPATCH, DISPATCHED, IN_PROGRESS, COMPLETED, PARTIAL_COMPLETE, CANCELLED

  // Order Tracking
  orderIds: [ObjectId],
  orderCount: Number,
  totalDelivered: Number,
  totalFailed: Number,

  // Timestamps
  createdAt: Date,
  dispatchedAt: Date,
  pickedUpAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  cancellationReason: String,
  cancelledBy: ObjectId,

  // Configuration
  maxBatchSize: Number, // Max orders (default: 15)
  sequencePolicy: String, // DRIVER_CHOICE, SYSTEM_OPTIMIZED, LOCKED

  // Delivery Sequence
  deliverySequence: [
    {
      orderId: ObjectId,
      sequenceNumber: Number,
      estimatedArrival: Date
    }
  ]
}
```

### Driver Capacity Model (Computed)

```javascript
{
  driverId: ObjectId,

  // Current Workload
  activeBatches: Number, // Count of batches with status DISPATCHED or IN_PROGRESS
  totalActiveOrders: Number, // Total orders across all active batches
  pendingDeliveries: Number, // Orders not yet delivered
  deliveredToday: Number,

  // Capacity
  maxCapacity: Number, // Max concurrent orders (configurable per driver, default: 20)
  availableSlots: Number, // maxCapacity - totalActiveOrders
  capacityPercentage: Number, // (totalActiveOrders / maxCapacity) * 100

  // Status
  status: String, // AVAILABLE (<50%), BUSY (50-90%), FULL (>90%), OFFLINE
  canAcceptMore: Boolean,
  recommendedMaxNew: Number, // How many more orders driver can handle

  // Activity
  lastDelivery: Date,
  lastActivity: Date,
  isOnline: Boolean // Active in last 5 minutes
}
```

### Driver-Batch Assignment Audit Log

```javascript
{
  _id: ObjectId,

  // Action Details
  action: String, // NEW_ASSIGNMENT, REASSIGNMENT, CANCELLATION, COMPLETION
  entityType: String, // BATCH
  entityId: ObjectId, // Batch ID

  // Actors
  performedBy: ObjectId (ref: "User"), // Admin who performed action
  oldDriverId: ObjectId, // For reassignments
  newDriverId: ObjectId, // For reassignments/new assignments

  // Context
  reason: String, // For reassignments and cancellations
  details: Object, // Additional contextual info

  // Metadata
  timestamp: Date,
  ipAddress: String,
  userAgent: String
}
```

---

## UI Requirements

### Active Deliveries Dashboard

**Route:** `/admin/driver-deliveries`

**Layout:**
- Full-width page
- 4 summary cards at top
- Main content: Driver cards grid
- Filters sidebar (collapsible)

**Driver Cards:**
- Card size: ~350px width, auto height
- Grid: 3 columns desktop, 2 tablet, 1 mobile
- Spacing: 16px gap
- Hover effect: subtle lift with shadow

**Card Content:**
- Header: Avatar (60px circle) + Name + Phone
- Vehicle info below name (smaller text)
- Status dot (8px circle, green/gray)
- Active batches section:
  - Each batch as nested card
  - Batch number (bold)
  - Kitchen + Zone (text)
  - Progress bar (green fill, gray background)
  - "8/12 delivered" text
- Quick stats grid (2x2)
- Action buttons row

**Colors:**
- Green: #10B981 (success, available, active)
- Yellow: #F59E0B (warning, busy)
- Red: #EF4444 (danger, full, urgent)
- Blue: #3B82F6 (primary actions)
- Gray: #6B7280 (inactive, secondary)

**Interactions:**
- Hover: Card lifts 4px, shadow increases
- Click card: Navigate to driver detail page
- Click batch: Opens batch detail modal
- Click [Reassign]: Opens reassignment flow

---

### Driver Batch Details Page

**Route:** `/admin/drivers/:id/batches`

**Layout:**
- Two-column layout (desktop):
  - Left: Driver info + stats (30%)
  - Right: Batches list (70%)
- Single column (mobile): Stack vertically

**Driver Info Card:**
- Large avatar (120px)
- Name (H1)
- Contact info (clickable icons)
- Vehicle details
- Status badges
- Stats grid (4 metrics)
- Action buttons (stacked)

**Batches Section:**
- Tabs: Active | Completed | All
- Each batch as expandable card
- Batch header (always visible):
  - Batch number + status badge
  - Kitchen + Zone
  - Order count with progress
  - Timestamp
- Expanded view:
  - Delivery sequence list
  - Each order with status icon
  - Timeline visualization
  - Action buttons

**Visual Timeline:**
- Vertical line connecting delivery points
- Each point: Circle (green/yellow/red) + Order info
- Connect with dotted line
- Sequence numbers prominent

---

### Reassignment Flow Modal

**Layout:** Full-screen modal on mobile, large centered modal on desktop

**Step Indicators:**
- Top progress bar: 3 steps
- Step 1: Current Info & Reason (33%)
- Step 2: Select Driver (66%)
- Step 3: Confirm (100%)

**Step 1 - Reason:**
- Read-only batch info card
- Textarea: Reason (full width)
- Quick select chips below
- Character counter (bottom-right)
- [Cancel] [Next] buttons

**Step 2 - Driver Selection:**
- Filter toggles (top)
- Driver cards grid (scrollable)
- Each card:
  - Avatar + Name
  - Capacity indicator (visual bar)
  - Stats (compact)
  - [Select] button
- Selected card: Blue border, checkmark
- [Back] [Next] buttons (Next disabled until selection)

**Step 3 - Confirmation:**
- Two-column summary (Before | After)
- Batch info in center
- Reason display
- Warning box (yellow background)
- [Back] [Confirm Reassignment] buttons

**Processing State:**
- Full-screen overlay
- Centered spinner
- "Reassigning batch..." text
- Disable all interactions

**Success State:**
- Checkmark animation
- Success message
- Auto-close after 2 seconds
- OR [View Driver] [Close] buttons

---

### Unassigned Batches Page

**Route:** `/admin/unassigned-batches`

**Layout:**
- Alert banner (if count > 5): Red, top of page
- Filters bar below
- Batch cards grid
- Pagination bottom

**Urgency Indicators:**
Visual indicators based on waiting time:
- < 10 mins: Green left border (2px)
- 10-30 mins: Yellow left border + yellow dot
- > 30 mins: Red left border + pulsing red dot + "URGENT" badge

**Batch Card:**
- Left border (colored by urgency)
- Urgency dot (top-right, 12px)
- Batch number (large, bold)
- Status badge
- Kitchen icon + name
- Zone badge
- Order count (large)
- Wait time (e.g., "Waiting 35 minutes")
- [Assign Driver] button (primary, full width)
- [View Orders] [Cancel] links (text, small)

**Empty State:**
- Celebration icon (large, centered)
- "All batches assigned!"
- "Great job managing deliveries"
- Green checkmark animation

---

## Error Handling

### API Error Scenarios

1. **Driver Not Available**
- 409 Conflict: "Driver is at capacity"
- UI: Show error toast, keep dialog open
- Suggest: Refresh driver list, select different driver

2. **Batch Already Assigned**
- 409 Conflict: "Batch already accepted by another driver"
- UI: Error toast, close reassignment dialog
- Action: Refresh batch list

3. **Cannot Cancel Completed Batch**
- 400 Bad Request: "Cannot cancel completed batches"
- UI: Disable cancel button, show info message
- Explain: Completed batches cannot be modified

4. **Driver Not in Zone**
- 400 Bad Request: "Driver does not serve this zone"
- UI: Filter out non-zone drivers, show warning
- Suggest: "Select driver from same zone"

5. **Validation Errors**
- 400 Bad Request: "Reason must be at least 10 characters"
- UI: Inline error below textarea, red border
- Real-time validation as user types

### Frontend Error Handling Patterns

**Service Layer Error Wrapping:**
```javascript
export const driverBatchService = {
  async reassignBatch(batchId, newDriverId, reason) {
    try {
      const response = await axios.patch(
        `${API_URL}/api/delivery/batches/${batchId}/reassign`,
        { newDriverId, reason },
        getAuthHeaders()
      );
      return { success: true, data: response.data };
    } catch (error) {
      // Specific error handling
      if (error.response?.status === 409) {
        return {
          success: false,
          message: error.response.data.message || 'Driver not available',
          errorType: 'CONFLICT',
          error
        };
      }

      if (error.response?.status === 400) {
        return {
          success: false,
          message: error.response.data.message || 'Invalid request',
          errorType: 'VALIDATION',
          error
        };
      }

      // Generic error
      return {
        success: false,
        message: 'Failed to reassign batch. Please try again.',
        error
      };
    }
  }
};
```

**Component Error Display:**
```javascript
const [error, setError] = useState(null);

const handleReassign = async () => {
  setError(null);
  setLoading(true);

  const result = await driverBatchService.reassignBatch(batchId, newDriverId, reason);

  setLoading(false);

  if (!result.success) {
    // Show error
    setError(result.message);
    toast.error(result.message);

    // Keep dialog open for user to fix
    return;
  }

  // Success
  toast.success('Batch reassigned successfully');
  onSuccess();
  onClose();
};
```

### User-Friendly Error Messages

| Technical Error | User-Friendly Message |
|----------------|----------------------|
| "Driver capacity exceeded" | "This driver is currently at maximum capacity. Please select a different driver." |
| "Batch status invalid" | "This batch cannot be reassigned in its current status. Please refresh and try again." |
| "Driver not approved" | "This driver is not approved for deliveries. Please select an approved driver." |
| "Zone mismatch" | "This driver does not serve the required zone. Please filter by zone and select again." |
| "Network error" | "Unable to connect. Please check your internet connection and try again." |

### Retry Logic

```javascript
async function reassignBatchWithRetry(batchId, newDriverId, reason, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await driverBatchService.reassignBatch(batchId, newDriverId, reason);

    if (result.success) {
      return result;
    }

    // Don't retry on validation/conflict errors (client errors 4xx)
    if (result.errorType === 'VALIDATION' || result.errorType === 'CONFLICT') {
      return result;
    }

    // Retry on server errors (5xx) with exponential backoff
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  return { success: false, message: 'Failed after multiple attempts' };
}
```

---

## Testing Scenarios

### Manual Testing Checklist

#### Driver Deliveries Dashboard

- [ ] Page loads and displays all active drivers correctly
- [ ] Summary cards show accurate counts
- [ ] Driver cards display current batch assignments
- [ ] Progress bars reflect actual delivery progress
- [ ] Capacity indicators show correct status (AVAILABLE, BUSY, FULL)
- [ ] Search filters results by driver name
- [ ] Zone filter shows only drivers in selected zone
- [ ] Real-time updates work (auto-refresh every 30 seconds)
- [ ] Refresh button reloads data
- [ ] Empty state shows when no active deliveries
- [ ] Loading state displays while fetching data
- [ ] Error state shows with retry button on failure
- [ ] Clicking driver card navigates to detail page
- [ ] Clicking batch opens batch detail modal
- [ ] Reassign button opens reassignment flow

#### Driver Batch Details Page

- [ ] Driver information displays correctly
- [ ] Driver stats are accurate (deliveries, success rate)
- [ ] Active batches section shows current assignments
- [ ] Completed batches section shows history
- [ ] Delivery sequence displays in correct order
- [ ] Status icons reflect actual order status
- [ ] Progress bars accurate
- [ ] Timestamps formatted correctly (relative and absolute)
- [ ] Activity timeline shows recent actions
- [ ] [View Driver Profile] navigates correctly
- [ ] [Contact Driver] opens phone dialer
- [ ] [Reassign Batch] opens reassignment dialog
- [ ] Real-time updates work

#### Reassignment Flow

- [ ] Step 1: Batch info displays correctly
- [ ] Step 1: Reason textarea validates (min 10 chars)
- [ ] Step 1: Quick select chips auto-fill textarea
- [ ] Step 1: Character counter updates real-time
- [ ] Step 1: [Next] disabled until valid reason
- [ ] Step 2: Available drivers load correctly
- [ ] Step 2: Filters work (same zone, capacity, status)
- [ ] Step 2: Capacity indicators accurate
- [ ] Step 2: Driver selection highlights card with border
- [ ] Step 2: [Next] disabled until driver selected
- [ ] Step 3: Summary shows correct before/after state
- [ ] Step 3: Warning message displays
- [ ] [Confirm] triggers API call with loading state
- [ ] Success: Shows success message and closes
- [ ] Success: Parent data refreshes
- [ ] Success: Toast notification appears
- [ ] Error: Shows error message, keeps dialog open
- [ ] Error: Allows retry
- [ ] [Back] buttons navigate to previous step
- [ ] [Cancel] closes dialog from any step

#### Unassigned Batches Page

- [ ] Page loads unassigned batches correctly
- [ ] Alert banner shows if count > 5
- [ ] Urgency indicators display correctly:
  - [ ] Green for < 10 mins
  - [ ] Yellow for 10-30 mins
  - [ ] Red + pulse for > 30 mins
- [ ] Filters work (kitchen, zone, meal window)
- [ ] Sort options work correctly
- [ ] Batch cards show all required info
- [ ] [Assign Driver] opens driver selection
- [ ] Driver selection loads available drivers
- [ ] Manual assignment completes successfully
- [ ] Batch moves from unassigned to assigned after action
- [ ] Empty state shows when no unassigned batches
- [ ] Real-time updates work (every 15 seconds)
- [ ] Pagination works if many batches

#### Batch Cancellation

- [ ] Cancel dialog opens with batch info
- [ ] Reason textarea validates (min 10 chars)
- [ ] Quick select reasons work
- [ ] Character counter updates
- [ ] Impact warning displays correctly
- [ ] Confirmation checkbox required
- [ ] [Confirm] disabled until checkbox checked + valid reason
- [ ] Cannot cancel completed batches (error shown)
- [ ] Cannot cancel with delivered orders (error shown)
- [ ] Successful cancellation:
  - [ ] API call completes
  - [ ] Success message shown
  - [ ] Batch removed from driver's list
  - [ ] Orders returned to READY status
  - [ ] Toast notification appears
- [ ] Error handling works correctly

#### Driver Capacity Indicator

- [ ] Small size: Colored dot displays correctly
- [ ] Small size: Tooltip shows details on hover
- [ ] Medium size: Progress bar shows capacity percentage
- [ ] Medium size: Text displays "X/Y orders"
- [ ] Large size: Full card with stats
- [ ] Colors accurate:
  - [ ] Green: AVAILABLE (< 50%)
  - [ ] Yellow: BUSY (50-90%)
  - [ ] Red: FULL (> 90%)
  - [ ] Gray: OFFLINE
- [ ] Auto-refresh every 60 seconds
- [ ] Manual refresh button works (large size)
- [ ] Loading skeleton displays while fetching
- [ ] Error state shows if fetch fails

#### Assignment History

- [ ] Timeline displays all assignment events
- [ ] Each entry shows correct info (timestamp, action, driver, batch)
- [ ] Action type icons display correctly
- [ ] Filters work (date range, driver, action type)
- [ ] Search works (by batch number, driver name, reason)
- [ ] Expandable cards show full details
- [ ] Export to CSV downloads correct data
- [ ] Pagination or infinite scroll works
- [ ] Empty state shows if no history

#### Edge Cases

- [ ] Network failure: Retry button works
- [ ] Slow connection: Loading states don't timeout prematurely
- [ ] Driver goes offline while being selected: Error handled
- [ ] Batch completed during reassignment: Error shown
- [ ] Multiple admins reassigning same batch: Conflict handled
- [ ] Driver at exact capacity: Status shows correctly
- [ ] All drivers unavailable: Empty state with message
- [ ] Very long reasons: Character limit enforced
- [ ] Special characters in reason: Handled correctly
- [ ] Batch with 0 pending orders: Cannot reassign (error)

#### Mobile Responsiveness

- [ ] Dashboard: Single column layout on mobile
- [ ] Driver cards: Full width on mobile
- [ ] Reassignment flow: Full screen on mobile
- [ ] Step indicators: Condensed on mobile
- [ ] Action buttons: Full width on mobile
- [ ] Filters: Collapsible sidebar on mobile
- [ ] Tables: Convert to cards or horizontal scroll
- [ ] Touch interactions: Buttons are tap-friendly (min 44px)
- [ ] Modals: Full screen on mobile

---

## Implementation Checklist

### Backend Fixes (If Needed)

- [ ] Verify batch reassignment endpoint exists and works
- [ ] Verify manual driver assignment endpoint exists
- [ ] Add batch cancellation with reason tracking (if missing)
- [ ] Add driver capacity calculation endpoint
- [ ] Add available drivers query endpoint
- [ ] Test all endpoints with Postman/Insomnia
- [ ] Add audit logging for reassignments
- [ ] Add notifications for reassignment events
- [ ] Update API documentation

### Frontend Implementation

**Service Layer:**
- [ ] Create `src/services/driverBatchService.js`
- [ ] Implement `getDriverWithBatches(driverId)`
- [ ] Implement `getAllDriversWithActiveDeliveries()`
- [ ] Implement `getUnassignedBatches()`
- [ ] Implement `getBatchDetails(batchId)`
- [ ] Implement `reassignBatch(batchId, newDriverId, reason)`
- [ ] Implement `cancelBatch(batchId, reason)`
- [ ] Implement `manualAssignBatch(batchId, driverId)`
- [ ] Implement `getAvailableDrivers(zoneId, mealWindow)`
- [ ] Implement `getDriverCapacity(driverId)`

**Pages:**
- [ ] Create `src/pages/admin/DriverDeliveriesDashboard.jsx`
- [ ] Create `src/pages/admin/DriverBatchDetailsPage.jsx`
- [ ] Create `src/pages/admin/UnassignedBatchesPage.jsx`
- [ ] Create `src/pages/admin/BatchAssignmentHistory.jsx`

**Components:**
- [ ] Create `src/components/admin/ReassignBatchFlow.jsx`
- [ ] Create `src/components/admin/CancelBatchDialog.jsx`
- [ ] Create `src/components/admin/DriverCapacityIndicator.jsx`
- [ ] Create `src/components/admin/DriverBatchCard.jsx`
- [ ] Create `src/components/admin/BatchDetailModal.jsx`

**Routing:**
- [ ] Add `/admin/driver-deliveries` route
- [ ] Add `/admin/drivers/:id/batches` route
- [ ] Add `/admin/unassigned-batches` route
- [ ] Add `/admin/batch-assignment-history` route
- [ ] Add protected route wrapper (admin only)
- [ ] Update admin sidebar with new navigation items
- [ ] Add badge counts to sidebar

**Hooks:**
- [ ] Create `src/hooks/useRealtimeBatchUpdates.js`
- [ ] Create `src/hooks/useDriverOnlineStatus.js`
- [ ] Create `src/hooks/useActiveDeliveryCounts.js`

**Features:**
- [ ] Implement real-time updates (polling or WebSocket)
- [ ] Add auto-refresh functionality
- [ ] Implement toast notifications
- [ ] Add loading states (skeletons)
- [ ] Add empty states
- [ ] Add error handling with retry
- [ ] Implement filters and search
- [ ] Add pagination
- [ ] Add export to CSV functionality

**Polish:**
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] Loading states
- [ ] Error states
- [ ] Empty states
- [ ] Smooth animations and transitions
- [ ] Consistent color scheme
- [ ] Proper spacing and typography

### Testing

**Unit Tests:**
- [ ] Test driver batch service functions
- [ ] Test error handling logic
- [ ] Test data transformations

**Integration Tests:**
- [ ] Test reassignment flow end-to-end
- [ ] Test manual assignment flow
- [ ] Test cancellation flow
- [ ] Test filters and search

**E2E Tests:**
- [ ] Test complete reassignment workflow
- [ ] Test unassigned batch assignment
- [ ] Test batch cancellation
- [ ] Test error scenarios

**Manual Testing:**
- [ ] Complete manual testing checklist (see Testing Scenarios)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile testing (iOS Safari, Android Chrome)
- [ ] Performance testing with large datasets

### Documentation

- [ ] Update API documentation
- [ ] Document reassignment workflow
- [ ] Create admin user guide
- [ ] Add inline code comments
- [ ] Document error codes and handling

### Deployment

- [ ] Deploy backend changes (if any)
- [ ] Deploy frontend changes
- [ ] Test in staging environment
- [ ] Verify real-time updates work
- [ ] Monitor error logs for first 24 hours
- [ ] Train admin users on new features

---

## Summary

This documentation provides a complete guide for implementing **Driver-Batch Assignment Management** specifically focused on the admin's ability to:

1. **Monitor** which drivers have which batches
2. **Reassign** batches when drivers face issues
3. **Manually assign** unassigned batches to drivers
4. **Cancel** batches when needed
5. **Track** all assignment history and changes

**Key Differences from General Batch Management:**

| General Batch Management | Driver-Batch Assignment Management |
|-------------------------|-----------------------------------|
| Focus: Order lifecycle | Focus: Driver-batch relationship |
| All orders and batches | Driver-centric view |
| Auto-batching system | Manual intervention |
| Analytics and reporting | Operational management |
| Kitchen and zone views | Driver workload views |

This system complements the general batch management by providing admins with the tools to handle real-world delivery issues and optimize driver utilization.

**Implementation Priority:**
1. Driver Deliveries Dashboard (high visibility)
2. Reassignment Flow (most critical feature)
3. Unassigned Batches Management (prevents delays)
4. Driver Batch Details (detailed view)
5. Assignment History (audit trail)

By following the 10 prompts sequentially, you'll build a complete, production-ready Driver-Batch Assignment Management system for the admin panel.

---

**Document Version:** 1.0
**Last Updated:** 2026-01-17
**Prepared For:** Tiffsy Admin Panel Integration
