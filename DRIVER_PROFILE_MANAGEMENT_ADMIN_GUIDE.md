# Driver Profile Management - Admin UI Integration Guide

## Table of Contents
1. [Overview](#overview)
2. [IMPLEMENTATION PROMPTS FOR CLAUDE (START HERE)](#implementation-prompts-for-claude-start-here)
3. [Complete Admin Workflow](#complete-admin-workflow)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [Data Models](#data-models)
6. [UI Requirements & Mockups](#ui-requirements--mockups)
7. [Implementation Guide](#implementation-guide)
8. [Error Handling](#error-handling)
9. [Testing Scenarios](#testing-scenarios)

---

## Overview

The backend provides comprehensive driver profile management capabilities for admins to:
- **View & Search** all drivers with filtering
- **Manage Status** (activate, deactivate, suspend, delete)
- **Approve/Reject** new driver registrations
- **Edit Profile** details and vehicle information
- **View Statistics** (deliveries, success rate, activity)
- **Track Activity** through audit logs
- **Manage Documents** (license, vehicle docs)

**Current Status:** Backend fully implemented ✅ | Admin UI integration needed ❌

**Base URL:** `http://localhost:4000/api` (development) or `https://your-domain.com/api` (production)

---

## IMPLEMENTATION PROMPTS FOR CLAUDE (START HERE)

**IMPORTANT:** These are step-by-step prompts to build the complete Driver Profile Management admin UI from scratch. Give these prompts to Claude one by one or in sequence.

---

### 🎯 PROMPT 1: Setup Project Structure & Service Layer

```
I need to build a Driver Profile Management admin interface. The backend API is already implemented and running.

TASK: Set up the project structure and create the API service layer.

1. Create the following folder structure:
   src/
   ├── pages/admin/
   │   ├── DriversListPage.jsx
   │   ├── DriverDetailPage.jsx
   │   └── PendingDriversPage.jsx
   ├── components/admin/drivers/
   │   ├── DriverTable.jsx
   │   ├── DriverDetailModal.jsx
   │   ├── EditDriverModal.jsx
   │   ├── SuspendDriverDialog.jsx
   │   ├── DriverStatsCard.jsx
   │   ├── DriverActivityLog.jsx
   │   └── ImageViewer.jsx
   └── services/
       └── driverManagementService.js

2. Create `src/services/driverManagementService.js` with the following API methods:
   - getDrivers(filters) - GET /api/admin/users?role=DRIVER
   - getPendingDrivers(page, limit) - GET /api/admin/drivers/pending
   - getDriverDetails(driverId) - GET /api/admin/users/:id
   - getDriverStats(driverId) - GET /api/driver/stats
   - updateDriver(driverId, updates) - PUT /api/admin/users/:id
   - updateVehicle(updates) - PATCH /api/driver/vehicle
   - approveDriver(driverId) - PATCH /api/admin/drivers/:id/approve
   - rejectDriver(driverId, reason) - PATCH /api/admin/drivers/:id/reject
   - activateDriver(driverId) - PATCH /api/admin/users/:id/activate
   - deactivateDriver(driverId) - PATCH /api/admin/users/:id/deactivate
   - suspendDriver(driverId, reason) - PATCH /api/admin/users/:id/suspend
   - deleteDriver(driverId) - DELETE /api/admin/users/:id
   - getAuditLogs(filters) - GET /api/admin/audit-logs

3. All API calls should:
   - Include Authorization header: `Bearer ${localStorage.getItem('authToken')}`
   - Use BASE_URL from environment variable or default to 'http://localhost:4000/api'
   - Handle errors properly with try-catch
   - Return parsed JSON responses

4. Add proper TypeScript types or JSDoc comments for all methods.

Please implement this service layer with proper error handling.
```

---

### 🎯 PROMPT 2: Build Drivers List Page (Main Dashboard)

```
TASK: Create the main Drivers List page with filters, search, and table view.

Build `src/pages/admin/DriversListPage.jsx` with:

FEATURES:
1. Tabbed navigation:
   - All Drivers
   - Active Only
   - Inactive
   - Suspended
   - Pending Approval (show count badge)

2. Search & Filters:
   - Search bar: "Search by name or phone..."
   - Status dropdown filter (ACTIVE, INACTIVE, SUSPENDED, DELETED)
   - Approval status filter (PENDING, APPROVED, REJECTED)
   - Sort by: Registration Date, Last Login, Total Deliveries

3. Table columns:
   - Profile (avatar + name)
   - Phone Number
   - Vehicle Info (type + number in subtitle)
   - Status Badge (colored: green=ACTIVE, gray=INACTIVE, red=SUSPENDED)
   - Approval Badge (yellow=PENDING, green=APPROVED, red=REJECTED)
   - Total Deliveries
   - Success Rate (percentage)
   - Last Login (relative time: "2 hours ago")
   - Actions dropdown (View, Edit, Activate/Deactivate, Suspend, Delete)

4. Pagination:
   - Show "Page X of Y"
   - Previous/Next buttons
   - Items per page: 20

5. Loading states, empty states, error states

6. Click on row to navigate to driver detail page

Use the driverManagementService.getDrivers() API.

Please implement with proper state management (useState, useEffect), loading spinners, and error handling.
```

---

### 🎯 PROMPT 3: Build Driver Detail Page/Modal

```
TASK: Create the Driver Detail page that shows complete driver information.

Build `src/pages/admin/DriverDetailPage.jsx` (or modal) with:

LAYOUT SECTIONS:

1. Header:
   - Profile image (large)
   - Name, phone, email
   - Status badges (status + approval status)
   - Quick action buttons: [Edit Profile] [Activate/Deactivate] [Suspend] [Delete]

2. Statistics Card:
   - Total Deliveries: {number}
   - Success Rate: {percentage}%
   - Active Deliveries: {number}
   - Failed Deliveries: {number}
   - Display as 4-column grid with icons

3. Personal Information Card:
   - Name (with edit icon)
   - Phone (read-only)
   - Email (with edit icon)
   - Registration Date
   - Last Login

4. License Information Card:
   - License Number
   - Expiry Date (with warning icon if < 30 days)
   - License Image (clickable thumbnail, opens ImageViewer)

5. Vehicle Information Card:
   - Vehicle Name (editable)
   - Vehicle Number (editable)
   - Vehicle Type (editable dropdown)
   - [Edit Vehicle Details] button

6. Vehicle Documents Card:
   - List each document (RC, Insurance, PUC):
     * Document type badge
     * Expiry date (with color: green if valid, yellow if <30 days, red if expired)
     * Thumbnail image
     * [View Document] button (opens ImageViewer)

7. Recent Activity Tab:
   - Show last 10 audit log entries
   - Format: "Jan 17, 3:00 PM - SUSPENDED by Admin User"
   - Show reason if applicable
   - [Load More] button

Use APIs:
- driverManagementService.getDriverDetails(driverId)
- driverManagementService.getDriverStats(driverId)
- driverManagementService.getAuditLogs({userId: driverId})

Implement with tabs/sections, proper spacing, and responsive design.
```

---

### 🎯 PROMPT 4: Build Edit Driver Modal

```
TASK: Create modal for editing driver profile and vehicle details.

Build `src/components/admin/drivers/EditDriverModal.jsx` with:

TWO FORMS:

1. Edit Personal Information:
   - Name (text input, required, 2-100 chars)
   - Email (email input, optional, valid email format)
   - [Cancel] [Save Changes] buttons

2. Edit Vehicle Information:
   - Vehicle Name (text input)
   - Vehicle Number (text input, uppercase, format: MH12AB1234)
   - Vehicle Type (dropdown: BIKE, SCOOTER, BICYCLE, OTHER)
   - [Cancel] [Save Changes] buttons

FEATURES:
- Modal opens with current values pre-filled
- Validation errors displayed inline
- Loading state on submit
- Success toast: "Profile updated successfully"
- Error toast if API fails
- Auto-close on success
- Refresh parent data after save

APIs:
- driverManagementService.updateDriver(driverId, {name, email})
- driverManagementService.updateVehicle({vehicleName, vehicleNumber, vehicleType})

Implement with form validation, loading states, and proper UX.
```

---

### 🎯 PROMPT 5: Build Status Management Dialogs

```
TASK: Create dialogs for Activate, Deactivate, Suspend, and Delete actions.

Build `src/components/admin/drivers/StatusManagementDialogs.jsx` with:

1. ACTIVATE DIALOG:
   - Simple confirmation: "Activate {driverName}?"
   - Description: "Driver will be able to login and accept deliveries."
   - [Cancel] [Activate] buttons

2. DEACTIVATE DIALOG:
   - Simple confirmation: "Deactivate {driverName}?"
   - Description: "Driver will be temporarily blocked from login."
   - [Cancel] [Deactivate] buttons

3. SUSPEND DIALOG:
   - Title: "Suspend Driver - {driverName}"
   - Textarea: "Reason for suspension" (required, min 10 chars)
   - Common reasons dropdown/chips:
     * Multiple customer complaints
     * Unprofessional behavior
     * Failed to complete deliveries
     * Document verification required
   - Warning: "⚠️ Driver will be immediately blocked from login"
   - [Cancel] [Suspend Driver] buttons

4. DELETE DIALOG:
   - Title: "Delete Driver - {driverName}"
   - Warning: "⚠️ This is a permanent action. The driver will be soft-deleted."
   - Safety note: "Cannot delete if driver has active deliveries."
   - Confirmation checkbox: "I understand this cannot be undone"
   - [Cancel] [Delete Driver] buttons (red/danger)

FEATURES:
- Show loading spinner during API call
- Disable buttons while loading
- Success toasts on completion
- Error toasts with specific messages (e.g., "Cannot delete driver with pending deliveries")
- Close dialog on success
- Refresh parent component data

APIs:
- driverManagementService.activateDriver(driverId)
- driverManagementService.deactivateDriver(driverId)
- driverManagementService.suspendDriver(driverId, reason)
- driverManagementService.deleteDriver(driverId)

Implement with proper validation and error handling.
```

---

### 🎯 PROMPT 6: Build Pending Drivers Approval Page

```
TASK: Create page for reviewing and approving/rejecting pending driver registrations.

Build `src/pages/admin/PendingDriversPage.jsx` with:

FEATURES:

1. Header:
   - Title: "Pending Driver Approvals"
   - Count badge: "Total: {count}"
   - [Refresh] button

2. Driver Cards Grid (2-3 columns):
   Each card shows:
   - Profile image
   - Name, Phone
   - Registration date
   - Vehicle: {type} - {number}
   - [View Details] button

3. Driver Detail View (modal or side panel):
   When [View Details] clicked, show:

   - Personal Info (name, phone, email, registration date)

   - License Details:
     * License Number
     * Expiry Date (with warnings)
     * License Image (large, zoomable)
     * [View Full Size] button

   - Vehicle Information:
     * Vehicle Name
     * Vehicle Number
     * Vehicle Type

   - Vehicle Documents (expandable sections):
     * RC (Registration Certificate)
       - Expiry date with status indicator
       - Document image (zoomable)
     * Insurance
       - Expiry date with status indicator
       - Document image (zoomable)
     * PUC (Pollution Certificate)
       - Expiry date with status indicator
       - Document image (zoomable)

   - Action Buttons at bottom:
     * [Reject] (red, opens rejection dialog)
     * [Approve Driver] (green, opens confirmation)

4. Approve Confirmation Dialog:
   - "Approve {driverName} as a driver?"
   - [Cancel] [Confirm Approval] buttons

5. Reject Dialog:
   - Title: "Reject Driver Registration"
   - Textarea: "Reason for rejection" (required, min 10 chars)
   - Common reasons:
     * License document is unclear or unverifiable
     * Vehicle documents are expired
     * Information doesn't match documents
     * Incomplete documentation
   - [Cancel] [Submit Rejection] buttons

APIs:
- driverManagementService.getPendingDrivers(page, limit)
- driverManagementService.approveDriver(driverId)
- driverManagementService.rejectDriver(driverId, reason)

Implement with pagination, image viewer, and proper UX flow.
```

---

### 🎯 PROMPT 7: Build Driver Activity Log Component

```
TASK: Create component to display driver activity/audit logs.

Build `src/components/admin/drivers/DriverActivityLog.jsx` with:

FEATURES:

1. Filters:
   - Action type dropdown: All, APPROVE_DRIVER, REJECT_DRIVER, ACTIVATE, DEACTIVATE, SUSPEND, DELETE, UPDATE
   - Date range picker: Last 7 days, Last 30 days, Custom range

2. Timeline View:
   Each log entry shows:
   - Icon based on action (✅ approve, ❌ reject, 🔴 suspend, etc.)
   - Date & Time: "Jan 17, 2026 3:00 PM"
   - Action: "SUSPENDED by Admin User"
   - Details: Reason, what changed, etc.
   - Expand/collapse for full details

3. Pagination:
   - Load more button
   - Or infinite scroll

4. Empty state: "No activity found"

API:
- driverManagementService.getAuditLogs({userId: driverId, page, limit, action, dateFrom, dateTo})

Implement with smooth animations and good visual hierarchy.
```

---

### 🎯 PROMPT 8: Build Image Viewer Component

```
TASK: Create reusable image viewer for license and document images.

Build `src/components/admin/drivers/ImageViewer.jsx` with:

FEATURES:

1. Full-screen modal overlay
2. Large image display (centered)
3. Zoom controls:
   - Zoom in button
   - Zoom out button
   - Reset zoom button
   - Mouse wheel zoom
4. Pan/drag to move zoomed image
5. Download button
6. Close button (X in top-right)
7. Navigation arrows (if multiple images)
8. Keyboard shortcuts:
   - Esc to close
   - Arrow keys to navigate
   - + / - to zoom

Props:
- images: array of {url, title}
- initialIndex: number
- onClose: function

Use a library like `react-image-lightbox` or build custom with CSS transforms.
```

---

### 🎯 PROMPT 9: Add Routes and Navigation

```
TASK: Integrate all pages into the admin panel routing and navigation.

1. ADD ROUTES (in your router config):
   ```jsx
   import DriversListPage from './pages/admin/DriversListPage';
   import DriverDetailPage from './pages/admin/DriverDetailPage';
   import PendingDriversPage from './pages/admin/PendingDriversPage';

   <Route path="/admin/drivers" element={<DriversListPage />} />
   <Route path="/admin/drivers/:id" element={<DriverDetailPage />} />
   <Route path="/admin/drivers/pending" element={<PendingDriversPage />} />
   ```

2. ADD NAVIGATION LINKS (in admin sidebar):
   ```jsx
   <NavLink to="/admin/drivers">
     <UsersIcon />
     Drivers
   </NavLink>

   <NavLink to="/admin/drivers/pending">
     <ClockIcon />
     Pending Approvals
     {pendingCount > 0 && <Badge variant="warning">{pendingCount}</Badge>}
   </NavLink>
   ```

3. FETCH PENDING COUNT:
   - Call driverManagementService.getPendingDrivers(1, 1) in sidebar
   - Extract total count from pagination
   - Display badge if count > 0

4. PROTECT ROUTES:
   - Ensure admin authentication required
   - Redirect to login if not authenticated
   - Check admin role

Implement with proper route guards and navigation highlighting.
```

---

### 🎯 PROMPT 10: Add UI Polish and Final Testing

```
TASK: Polish the UI and ensure everything works smoothly.

1. CONSISTENCY:
   - Use consistent colors for status badges:
     * Active: green-500
     * Inactive: gray-500
     * Suspended: red-500
     * Pending: yellow-500
     * Approved: green-500
     * Rejected: red-500

   - Consistent spacing (Tailwind: space-y-4, gap-4, p-4)
   - Consistent button styles
   - Consistent card/modal shadows

2. LOADING STATES:
   - Skeleton loaders for tables
   - Spinner for buttons during API calls
   - Loading overlay for modals

3. EMPTY STATES:
   - "No drivers found" with helpful message
   - "No pending approvals" with celebration icon
   - "No activity yet" in logs

4. ERROR STATES:
   - Toast notifications for errors
   - Inline validation errors
   - Network error retry buttons

5. RESPONSIVE DESIGN:
   - Mobile: stack columns vertically
   - Tablet: 2-column layout
   - Desktop: full table layout

6. ACCESSIBILITY:
   - Proper ARIA labels
   - Keyboard navigation
   - Focus states
   - Screen reader friendly

7. PERFORMANCE:
   - Debounce search input (300ms)
   - Memoize heavy computations
   - Lazy load images
   - Paginate large lists

8. TESTING:
   - Test all CRUD operations
   - Test error scenarios (network failures, validation errors)
   - Test with different data states (empty, loading, error, success)
   - Test on different screen sizes

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

#### Pages
- [ ] Drivers List Page
- [ ] Driver Detail Page
- [ ] Pending Drivers Page

#### Components
- [ ] Driver Table
- [ ] Driver Detail Modal
- [ ] Edit Driver Modal
- [ ] Status Management Dialogs
- [ ] Driver Stats Card
- [ ] Activity Log Component
- [ ] Image Viewer

#### Integration
- [ ] Routes configured
- [ ] Navigation added
- [ ] Pending count badge working
- [ ] All API endpoints tested

#### Polish
- [ ] Loading states
- [ ] Error handling
- [ ] Empty states
- [ ] Responsive design
- [ ] Accessibility
- [ ] Performance optimized

---

## Complete Admin Workflow

```
┌──────────────────────────────────────────────────────────────────┐
│ PHASE 1: DRIVER REGISTRATION APPROVAL                            │
└──────────────────────────────────────────────────────────────────┘

Step 1: View Pending Drivers
├─ GET /api/admin/drivers/pending
├─ Shows drivers with approvalStatus="PENDING"
└─ Admin reviews: license, vehicle docs, details

Step 2: Review Driver Details
├─ Click driver → View full profile
├─ Check license image quality
├─ Verify vehicle documents (RC, Insurance, PUC)
└─ Validate expiry dates

Step 3: Approve or Reject
├─ APPROVE: PATCH /api/admin/drivers/:id/approve
│   └─ Driver can now login and accept deliveries
│
└─ REJECT: PATCH /api/admin/drivers/:id/reject
    ├─ Must provide rejection reason
    └─ Driver blocked from logging in


┌──────────────────────────────────────────────────────────────────┐
│ PHASE 2: DRIVER LIST & SEARCH MANAGEMENT                         │
└──────────────────────────────────────────────────────────────────┘

View All Drivers
├─ GET /api/admin/users?role=DRIVER
├─ Filter by: status, approvalStatus, search (name/phone)
├─ Pagination: page, limit
└─ Shows: name, phone, vehicle, status, approvals, last login

Search & Filter Options:
├─ By Status: ACTIVE, INACTIVE, SUSPENDED, DELETED
├─ By Approval: PENDING, APPROVED, REJECTED
├─ By Name or Phone: search query
└─ Sort by: registration date, last login, deliveries


┌──────────────────────────────────────────────────────────────────┐
│ PHASE 3: VIEW & EDIT DRIVER PROFILE                              │
└──────────────────────────────────────────────────────────────────┘

View Driver Profile
├─ GET /api/admin/users/:id
├─ Shows complete profile:
│   ├─ Personal: name, phone, email, profile image
│   ├─ Status: active/inactive/suspended, approval status
│   ├─ License: number, image, expiry date
│   ├─ Vehicle: name, number, type
│   ├─ Documents: RC, Insurance, PUC with expiry dates
│   ├─ Statistics: total deliveries, success rate
│   └─ Activity: last login, registration date
│
└─ Admin Actions Available:
    ├─ Edit profile (name, email)
    ├─ Update vehicle details
    ├─ Activate/Deactivate/Suspend
    ├─ View delivery history
    └─ View audit logs

Edit Driver Profile
├─ PUT /api/admin/users/:id
├─ Editable fields: name, email
└─ Audit logged

Update Vehicle Details
├─ PATCH /api/driver/vehicle (as admin)
├─ Fields: vehicleName, vehicleNumber, vehicleType
└─ Vehicle number validated (format: MH12AB1234)


┌──────────────────────────────────────────────────────────────────┐
│ PHASE 4: DRIVER STATUS MANAGEMENT                                │
└──────────────────────────────────────────────────────────────────┘

Activate Driver
├─ PATCH /api/admin/users/:id/activate
├─ Sets status to ACTIVE
└─ Driver can login and work

Deactivate Driver
├─ PATCH /api/admin/users/:id/deactivate
├─ Sets status to INACTIVE
└─ Driver cannot login (temporary)

Suspend Driver (with reason)
├─ PATCH /api/admin/users/:id/suspend
├─ Requires suspension reason
├─ Records: suspensionReason, suspendedAt, suspendedBy
└─ Driver blocked from login

Delete Driver (soft delete)
├─ DELETE /api/admin/users/:id
├─ Safety check: prevents deletion if active deliveries
├─ Sets status to DELETED
└─ Driver permanently blocked


┌──────────────────────────────────────────────────────────────────┐
│ PHASE 5: DRIVER STATISTICS & ANALYTICS                           │
└──────────────────────────────────────────────────────────────────┘

View Driver Stats
├─ GET /api/driver/stats (with driver's userId)
├─ Metrics:
│   ├─ totalDeliveries: All orders assigned
│   ├─ deliveredCount: Successfully delivered
│   ├─ failedCount: Failed deliveries
│   ├─ activeCount: Currently in progress
│   └─ successRate: Percentage (deliveredCount/total)
│
└─ Also available in GET /api/admin/users/:id response


┌──────────────────────────────────────────────────────────────────┐
│ PHASE 6: AUDIT LOGS & ACTIVITY TRACKING                          │
└──────────────────────────────────────────────────────────────────┘

View Driver Activity
├─ GET /api/admin/audit-logs?userId=:driverId
├─ Filter by: action, entityType, dateFrom, dateTo
├─ Shows:
│   ├─ What action was performed
│   ├─ Who performed it (admin name)
│   ├─ When it happened
│   └─ Details (reason for suspension/rejection, etc.)
│
└─ Tracked Actions:
    ├─ APPROVE_DRIVER, REJECT_DRIVER
    ├─ ACTIVATE, DEACTIVATE, SUSPEND
    ├─ UPDATE (profile changes)
    └─ DELETE
```

---

## API Endpoints Reference

### Authentication
All admin endpoints require:
- **Header:** `Authorization: Bearer <JWT_TOKEN>`
- **Middleware:** Admin role required

---

### 1. Get All Drivers (with filters)

**Endpoint:** `GET /api/admin/users`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `role` | string | - | Filter by role (use "DRIVER") |
| `status` | string | - | ACTIVE, INACTIVE, SUSPENDED, DELETED |
| `approvalStatus` | string | - | PENDING, APPROVED, REJECTED |
| `search` | string | - | Search by name or phone |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

**Request Example:**
```bash
GET /api/admin/users?role=DRIVER&status=ACTIVE&page=1&limit=20
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      {
        "_id": "65abc123def456789",
        "phone": "+919876543210",
        "name": "Rajesh Kumar",
        "email": "rajesh@example.com",
        "profileImage": "https://storage.googleapis.com/bucket/profiles/abc.jpg",
        "role": "DRIVER",
        "status": "ACTIVE",
        "approvalStatus": "APPROVED",
        "driverDetails": {
          "licenseNumber": "MH1220200012345",
          "vehicleName": "Honda Activa",
          "vehicleNumber": "MH12AB1234",
          "vehicleType": "SCOOTER"
        },
        "lastLoginAt": "2026-01-17T10:30:00.000Z",
        "createdAt": "2026-01-10T08:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 145,
      "pages": 8
    },
    "counts": {
      "total": 145,
      "byRole": {
        "DRIVER": 145
      },
      "byStatus": {
        "ACTIVE": 120,
        "INACTIVE": 15,
        "SUSPENDED": 5,
        "DELETED": 5
      }
    }
  }
}
```

---

### 2. Get Pending Drivers

**Endpoint:** `GET /api/admin/drivers/pending`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

**Request Example:**
```bash
GET /api/admin/drivers/pending?page=1&limit=20
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Pending drivers retrieved",
  "data": {
    "drivers": [
      {
        "_id": "65abc123def456789",
        "phone": "+919876543210",
        "name": "Amit Sharma",
        "email": "amit@example.com",
        "role": "DRIVER",
        "status": "ACTIVE",
        "approvalStatus": "PENDING",
        "driverDetails": {
          "licenseNumber": "DL0220200098765",
          "licenseImageUrl": "https://storage.googleapis.com/bucket/licenses/xyz.jpg",
          "licenseExpiryDate": "2027-06-15T00:00:00.000Z",
          "vehicleName": "Royal Enfield",
          "vehicleNumber": "DL02AB9876",
          "vehicleType": "BIKE",
          "vehicleDocuments": [
            {
              "type": "RC",
              "imageUrl": "https://storage.googleapis.com/bucket/docs/rc_123.jpg",
              "expiryDate": "2028-03-20T00:00:00.000Z"
            },
            {
              "type": "INSURANCE",
              "imageUrl": "https://storage.googleapis.com/bucket/docs/ins_456.jpg",
              "expiryDate": "2026-12-31T00:00:00.000Z"
            }
          ]
        },
        "createdAt": "2026-01-17T09:15:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 8,
      "pages": 1
    }
  }
}
```

---

### 3. Get Driver Profile Details

**Endpoint:** `GET /api/admin/users/:id`

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Driver's user ID (MongoDB ObjectId) |

**Request Example:**
```bash
GET /api/admin/users/65abc123def456789
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "user": {
      "_id": "65abc123def456789",
      "phone": "+919876543210",
      "firebaseUid": "firebase_uid_abc123",
      "name": "Rajesh Kumar",
      "email": "rajesh@example.com",
      "profileImage": "https://storage.googleapis.com/bucket/profiles/abc.jpg",
      "role": "DRIVER",
      "status": "ACTIVE",
      "approvalStatus": "APPROVED",
      "approvalDetails": {
        "approvedBy": "65admin123",
        "approvedAt": "2026-01-10T10:00:00.000Z"
      },
      "driverDetails": {
        "licenseNumber": "MH1220200012345",
        "licenseImageUrl": "https://storage.googleapis.com/bucket/licenses/xyz.jpg",
        "licenseExpiryDate": "2027-06-15T00:00:00.000Z",
        "vehicleName": "Honda Activa",
        "vehicleNumber": "MH12AB1234",
        "vehicleType": "SCOOTER",
        "vehicleDocuments": [
          {
            "type": "RC",
            "imageUrl": "https://storage.googleapis.com/bucket/docs/rc_123.jpg",
            "expiryDate": "2028-03-20T00:00:00.000Z"
          },
          {
            "type": "INSURANCE",
            "imageUrl": "https://storage.googleapis.com/bucket/docs/ins_456.jpg",
            "expiryDate": "2026-12-31T00:00:00.000Z"
          },
          {
            "type": "PUC",
            "imageUrl": "https://storage.googleapis.com/bucket/docs/puc_789.jpg",
            "expiryDate": "2026-06-30T00:00:00.000Z"
          }
        ]
      },
      "lastLoginAt": "2026-01-17T08:30:00.000Z",
      "createdAt": "2026-01-10T08:00:00.000Z",
      "updatedAt": "2026-01-17T08:30:00.000Z"
    }
  }
}
```

---

### 4. Update Driver Profile

**Endpoint:** `PUT /api/admin/users/:id`

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Driver's user ID |

**Request Body:**
```json
{
  "name": "Rajesh Kumar Sharma",
  "email": "rajesh.new@example.com"
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | ✗ | Driver's full name |
| `email` | string | ✗ | Driver's email address |

**Request Example:**
```bash
PUT /api/admin/users/65abc123def456789
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Rajesh Kumar Sharma",
  "email": "rajesh.new@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "user": {
      "_id": "65abc123def456789",
      "name": "Rajesh Kumar Sharma",
      "email": "rajesh.new@example.com",
      // ... rest of user object
    }
  }
}
```

---

### 5. Approve Driver Registration

**Endpoint:** `PATCH /api/admin/drivers/:id/approve`

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Driver's user ID |

**Request Example:**
```bash
PATCH /api/admin/drivers/65abc123def456789/approve
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Driver approved successfully",
  "data": {
    "user": {
      "_id": "65abc123def456789",
      "approvalStatus": "APPROVED",
      "approvalDetails": {
        "approvedBy": "65admin123",
        "approvedAt": "2026-01-17T14:30:00.000Z"
      },
      // ... rest of user object
    }
  }
}
```

**Side Effects:**
- ✓ `approvalStatus` set to `"APPROVED"`
- ✓ `approvalDetails.approvedBy` set to admin's ID
- ✓ `approvalDetails.approvedAt` set to current timestamp
- ✓ Audit log created with action `"APPROVE_DRIVER"`
- ✓ Driver can now login and accept deliveries

---

### 6. Reject Driver Registration

**Endpoint:** `PATCH /api/admin/drivers/:id/reject`

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Driver's user ID |

**Request Body:**
```json
{
  "reason": "License document is unclear and unverifiable"
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reason` | string | ✓ Yes | Reason for rejection (shown to driver) |

**Request Example:**
```bash
PATCH /api/admin/drivers/65abc123def456789/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Vehicle registration certificate has expired. Please upload a valid RC document."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Driver rejected",
  "data": {
    "user": {
      "_id": "65abc123def456789",
      "approvalStatus": "REJECTED",
      "approvalDetails": {
        "rejectedBy": "65admin123",
        "rejectedAt": "2026-01-17T14:35:00.000Z",
        "rejectionReason": "Vehicle registration certificate has expired. Please upload a valid RC document."
      },
      // ... rest of user object
    }
  }
}
```

**Side Effects:**
- ✓ `approvalStatus` set to `"REJECTED"`
- ✓ `approvalDetails.rejectedBy` set to admin's ID
- ✓ `approvalDetails.rejectedAt` set to current timestamp
- ✓ `approvalDetails.rejectionReason` stores the reason
- ✓ Audit log created with action `"REJECT_DRIVER"`
- ✓ Driver CANNOT login (blocked with rejection message)

---

### 7. Activate Driver

**Endpoint:** `PATCH /api/admin/users/:id/activate`

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Driver's user ID |

**Request Example:**
```bash
PATCH /api/admin/users/65abc123def456789/activate
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User activated successfully",
  "data": {
    "user": {
      "_id": "65abc123def456789",
      "status": "ACTIVE",
      // ... rest of user object
    }
  }
}
```

**Side Effects:**
- ✓ `status` set to `"ACTIVE"`
- ✓ Driver can login
- ✓ Audit log created

---

### 8. Deactivate Driver

**Endpoint:** `PATCH /api/admin/users/:id/deactivate`

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Driver's user ID |

**Request Example:**
```bash
PATCH /api/admin/users/65abc123def456789/deactivate
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User deactivated successfully",
  "data": {
    "user": {
      "_id": "65abc123def456789",
      "status": "INACTIVE",
      // ... rest of user object
    }
  }
}
```

**Side Effects:**
- ✓ `status` set to `"INACTIVE"`
- ✓ Driver cannot login (temporary block)
- ✓ Audit log created

---

### 9. Suspend Driver (with reason)

**Endpoint:** `PATCH /api/admin/users/:id/suspend`

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Driver's user ID |

**Request Body:**
```json
{
  "reason": "Multiple customer complaints regarding delivery behavior"
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reason` | string | ✓ Yes | Reason for suspension |

**Request Example:**
```bash
PATCH /api/admin/users/65abc123def456789/suspend
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Multiple customer complaints regarding delivery behavior"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User suspended successfully",
  "data": {
    "user": {
      "_id": "65abc123def456789",
      "status": "SUSPENDED",
      "suspensionReason": "Multiple customer complaints regarding delivery behavior",
      "suspendedAt": "2026-01-17T15:00:00.000Z",
      "suspendedBy": "65admin123",
      // ... rest of user object
    }
  }
}
```

**Side Effects:**
- ✓ `status` set to `"SUSPENDED"`
- ✓ `suspensionReason` stores the reason
- ✓ `suspendedAt` set to current timestamp
- ✓ `suspendedBy` set to admin's ID
- ✓ Driver blocked from login
- ✓ Audit log created with reason

---

### 10. Delete Driver (Soft Delete)

**Endpoint:** `DELETE /api/admin/users/:id`

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Driver's user ID |

**Request Example:**
```bash
DELETE /api/admin/users/65abc123def456789
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User deleted successfully",
  "data": null
}
```

**Error Response (400 Bad Request) - Has Active Deliveries:**
```json
{
  "success": false,
  "message": "Cannot delete driver with pending deliveries. Please reassign active deliveries first.",
  "data": {
    "pendingDeliveries": 3,
    "orderIds": ["ORD-20260117-00123", "ORD-20260117-00124", "ORD-20260117-00125"]
  }
}
```

**Side Effects:**
- ✓ **Safety Check:** Prevents deletion if driver has orders with status `PICKED_UP` or `OUT_FOR_DELIVERY`
- ✓ `status` set to `"DELETED"`
- ✓ Driver permanently blocked
- ✓ Audit log created

---

### 11. Get Driver Statistics

**Endpoint:** `GET /api/driver/stats`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | ✗ | Driver's user ID (admin can query any driver) |

**Request Example:**
```bash
GET /api/driver/stats?userId=65abc123def456789
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Driver statistics retrieved",
  "data": {
    "stats": {
      "totalDeliveries": 156,
      "deliveredCount": 148,
      "failedCount": 5,
      "activeCount": 3,
      "successRate": "94.87"
    }
  }
}
```

**Metrics Explanation:**
- **totalDeliveries:** Total orders ever assigned to driver
- **deliveredCount:** Successfully delivered (status = DELIVERED)
- **failedCount:** Failed deliveries (status = FAILED)
- **activeCount:** Currently in progress (status = PICKED_UP or OUT_FOR_DELIVERY)
- **successRate:** Percentage (deliveredCount / totalDeliveries * 100)

---

### 12. Get Audit Logs (Driver Activity)

**Endpoint:** `GET /api/admin/audit-logs`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `userId` | string | - | Filter by driver's user ID |
| `action` | string | - | Filter by action (APPROVE_DRIVER, SUSPEND, etc.) |
| `entityType` | string | - | Filter by entity type (USER) |
| `entityId` | string | - | Filter by entity ID |
| `dateFrom` | date | - | Start date (ISO format) |
| `dateTo` | date | - | End date (ISO format) |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

**Request Example:**
```bash
GET /api/admin/audit-logs?userId=65abc123def456789&page=1&limit=20
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Audit logs retrieved",
  "data": {
    "logs": [
      {
        "_id": "65log123",
        "action": "SUSPEND",
        "entityType": "USER",
        "entityId": "65abc123def456789",
        "performedBy": {
          "_id": "65admin123",
          "name": "Admin User",
          "role": "ADMIN",
          "phone": "+919999999999"
        },
        "details": {
          "reason": "Multiple customer complaints regarding delivery behavior",
          "driverName": "Rajesh Kumar",
          "previousStatus": "ACTIVE"
        },
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "createdAt": "2026-01-17T15:00:00.000Z"
      },
      {
        "_id": "65log124",
        "action": "APPROVE_DRIVER",
        "entityType": "USER",
        "entityId": "65abc123def456789",
        "performedBy": {
          "_id": "65admin123",
          "name": "Admin User",
          "role": "ADMIN"
        },
        "details": {
          "driverName": "Rajesh Kumar",
          "phone": "+919876543210"
        },
        "createdAt": "2026-01-10T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "pages": 1
    }
  }
}
```

**Tracked Actions for Drivers:**
- `APPROVE_DRIVER` - Driver registration approved
- `REJECT_DRIVER` - Driver registration rejected
- `ACTIVATE` - Driver account activated
- `DEACTIVATE` - Driver account deactivated
- `SUSPEND` - Driver account suspended
- `DELETE` - Driver account deleted
- `UPDATE` - Profile information updated
- `CREATE` - Driver account created

---

### 13. Update Vehicle Details

**Endpoint:** `PATCH /api/driver/vehicle`

**Request Body:**
```json
{
  "vehicleName": "Honda Activa 6G",
  "vehicleNumber": "MH12CD5678",
  "vehicleType": "SCOOTER"
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vehicleName` | string | ✗ | Vehicle model name |
| `vehicleNumber` | string | ✗ | Vehicle registration number (format: MH12AB1234) |
| `vehicleType` | enum | ✗ | BIKE, SCOOTER, BICYCLE, OTHER |

**Request Example:**
```bash
PATCH /api/driver/vehicle
Authorization: Bearer <token>
Content-Type: application/json

{
  "vehicleName": "Honda Activa 6G",
  "vehicleNumber": "MH12CD5678",
  "vehicleType": "SCOOTER"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Vehicle details updated successfully",
  "data": {
    "driverDetails": {
      "licenseNumber": "MH1220200012345",
      "vehicleName": "Honda Activa 6G",
      "vehicleNumber": "MH12CD5678",
      "vehicleType": "SCOOTER",
      // ... rest of driver details
    }
  }
}
```

**Validation:**
- Vehicle number must match format: `DD##XX####` (2 letters + 1-2 digits + 0-3 letters + 4 digits)
- Vehicle type must be one of: BIKE, SCOOTER, BICYCLE, OTHER

---

## Data Models

### User Model (Driver Role)

**Schema Location:** [schema/user.schema.js](schema/user.schema.js)

```typescript
interface Driver {
  _id: ObjectId;
  phone: string;                    // Unique, normalized format
  firebaseUid: string;
  role: "DRIVER";
  name: string;
  email?: string;
  profileImage?: string;

  // Status Management
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DELETED";
  suspensionReason?: string;
  suspendedAt?: Date;
  suspendedBy?: ObjectId;           // Admin who suspended

  // Approval Workflow
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  approvalDetails: {
    approvedBy?: ObjectId;          // Admin who approved
    approvedAt?: Date;
    rejectedBy?: ObjectId;          // Admin who rejected
    rejectedAt?: Date;
    rejectionReason?: string;
  };

  // Driver Details
  driverDetails: {
    licenseNumber: string;
    licenseImageUrl: string;
    licenseExpiryDate?: Date;
    vehicleName: string;            // e.g., "Honda Activa"
    vehicleNumber: string;          // e.g., "MH12AB1234"
    vehicleType: "BIKE" | "SCOOTER" | "BICYCLE" | "OTHER";
    vehicleDocuments: Array<{
      type: "RC" | "INSURANCE" | "PUC" | "OTHER";
      imageUrl: string;
      expiryDate?: Date;
    }>;
  };

  // Metadata
  lastLoginAt?: Date;
  fcmTokens: string[];              // For push notifications
  createdAt: Date;
  updatedAt: Date;
}
```

**Status Values:**
| Status | Description | Can Login? |
|--------|-------------|------------|
| `ACTIVE` | Driver is active and can work | ✓ Yes (if approved) |
| `INACTIVE` | Temporarily deactivated | ✗ No |
| `SUSPENDED` | Suspended with reason | ✗ No |
| `DELETED` | Soft deleted | ✗ No |

**Approval Status Values:**
| Status | Description | Can Login? |
|--------|-------------|------------|
| `PENDING` | Awaiting admin review | ✗ No |
| `APPROVED` | Admin approved | ✓ Yes (if active) |
| `REJECTED` | Admin rejected | ✗ No |

**Vehicle Types:**
- `BIKE` - Motorcycle/bike
- `SCOOTER` - Scooter/scooty
- `BICYCLE` - Bicycle
- `OTHER` - Other vehicle types

**Vehicle Document Types:**
- `RC` - Registration Certificate (mandatory)
- `INSURANCE` - Vehicle Insurance (mandatory)
- `PUC` - Pollution Under Control Certificate (mandatory)
- `OTHER` - Other documents

---

### Audit Log Model

**Schema Location:** [schema/auditLog.schema.js](schema/auditLog.schema.js)

```typescript
interface AuditLog {
  _id: ObjectId;
  action: string;                   // APPROVE_DRIVER, SUSPEND, etc.
  entityType: "USER" | "ORDER" | "BATCH" | "ZONE" | "KITCHEN" | "CONFIG";
  entityId: ObjectId;               // Driver's user ID
  performedBy: ObjectId;            // Admin who performed action
  details: {                        // Flexible object with action-specific details
    reason?: string;
    driverName?: string;
    phone?: string;
    previousStatus?: string;
    newStatus?: string;
    changes?: object;
  };
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}
```

---

## UI Requirements & Mockups

### 1. Drivers List Page

**Route:** `/admin/drivers`

**Features:**
- ✓ Tabbed view: All / Active / Inactive / Suspended / Pending Approval
- ✓ Search by name or phone
- ✓ Filter by status and approval status
- ✓ Sort by: Registration date, Last login, Total deliveries
- ✓ Pagination controls
- ✓ Bulk actions (optional)
- ✓ Quick action buttons (Activate/Deactivate/Suspend)

**Table Columns:**
1. Profile (image + name)
2. Phone Number
3. Vehicle Info (type + number)
4. Status Badge
5. Approval Status Badge
6. Total Deliveries
7. Success Rate
8. Last Login
9. Actions (View, Edit, Status Menu)

**Layout Example:**
```
┌───────────────────────────────────────────────────────────────────┐
│  Drivers Management                                    [+ Add New] │
├───────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [All (145)] [Active (120)] [Inactive (15)] [Suspended (5)]       │
│  [Pending Approval (8)]                                            │
│                                                                     │
│  [Search by name or phone...]  [Filter: Status ▼] [Sort: Latest]  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Profile      Phone         Vehicle    Status  Deliveries   │  │
│  ├─────────────────────────────────────────────────────────────┤  │
│  │ [img] Rajesh +91 987...   Scooter   🟢 Active    148       │  │
│  │       Kumar               MH12AB...  ✓ Approved  94.8%     │  │
│  │                                                             │  │
│  │ [img] Amit   +91 876...   Bike      🔴 Suspend   89        │  │
│  │       Sharma              DL02CD...  ✓ Approved  91.2%     │  │
│  │                                                             │  │
│  │ [img] Priya  +91 765...   Bicycle   ⏸️ Inactive  45        │  │
│  │       Singh               MH01AB...  ✓ Approved  88.9%     │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ← Previous    Page 1 of 8    Next →                               │
└───────────────────────────────────────────────────────────────────┘
```

**API Calls:**
```javascript
// Fetch all drivers with filters
const fetchDrivers = async (filters) => {
  const params = new URLSearchParams({
    role: 'DRIVER',
    page: filters.page || 1,
    limit: filters.limit || 20,
    ...(filters.status && { status: filters.status }),
    ...(filters.approvalStatus && { approvalStatus: filters.approvalStatus }),
    ...(filters.search && { search: filters.search }),
  });

  const response = await fetch(`/api/admin/users?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  return response.json();
};

// Fetch pending drivers
const fetchPendingDrivers = async (page = 1) => {
  const response = await fetch(
    `/api/admin/drivers/pending?page=${page}&limit=20`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  return response.json();
};
```

---

### 2. Driver Detail Page/Modal

**Route:** `/admin/drivers/:id` or Modal

**Sections:**
1. **Profile Header**
   - Profile image
   - Name and contact info
   - Status badges
   - Quick actions (Activate/Deactivate/Suspend/Delete)

2. **Personal Information**
   - Name (editable)
   - Phone number (read-only)
   - Email (editable)
   - Registration date
   - Last login

3. **License Information**
   - License number
   - License image (expandable)
   - Expiry date (with warning if < 30 days)

4. **Vehicle Information**
   - Vehicle name (editable)
   - Vehicle number (editable)
   - Vehicle type (editable)

5. **Vehicle Documents**
   - RC (Registration Certificate) with expiry
   - Insurance with expiry
   - PUC with expiry
   - Each document expandable/zoomable

6. **Statistics**
   - Total deliveries
   - Success rate
   - Active deliveries
   - Failed deliveries

7. **Activity Log**
   - Recent actions performed on this driver
   - Status changes, approvals, suspensions

**Layout Example:**
```
┌──────────────────────────────────────────────────────────────────┐
│  Driver Profile - Rajesh Kumar                          [Close]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  [Profile Image]    Rajesh Kumar                           │  │
│  │                     +91 9876543210                         │  │
│  │                     rajesh@example.com                     │  │
│  │                                                            │  │
│  │                     🟢 Active  ✓ Approved                 │  │
│  │                                                            │  │
│  │  [Edit Profile] [Deactivate] [Suspend] [Delete]          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ Statistics ───────────────────────────────────────────────┐  │
│  │  Total Deliveries: 148    Success Rate: 94.87%            │  │
│  │  Active: 3               Failed: 5                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ License Information ──────────────────────────────────────┐  │
│  │  Number: MH1220200012345                                   │  │
│  │  Expiry: Jun 15, 2027 ✓                                   │  │
│  │  [View License Image]                                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ Vehicle Information ──────────────────────────────────────┐  │
│  │  Name: Honda Activa         [Edit]                         │  │
│  │  Number: MH12AB1234                                        │  │
│  │  Type: Scooter                                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ Vehicle Documents ────────────────────────────────────────┐  │
│  │  RC (Registration Certificate)                             │  │
│  │  Expiry: Mar 20, 2028 ✓     [View Document]              │  │
│  │                                                            │  │
│  │  Insurance                                                 │  │
│  │  Expiry: Dec 31, 2026 ⚠     [View Document]              │  │
│  │                                                            │  │
│  │  PUC (Pollution Certificate)                               │  │
│  │  Expiry: Jun 30, 2026 ⚠     [View Document]              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ Recent Activity ──────────────────────────────────────────┐  │
│  │  Jan 17, 2026 - Suspended by Admin User                   │  │
│  │  Reason: Multiple customer complaints                      │  │
│  │                                                            │  │
│  │  Jan 10, 2026 - Approved by Admin User                    │  │
│  │                                                            │  │
│  │  Jan 10, 2026 - Registered                                │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

**API Call:**
```javascript
// Fetch driver details
const fetchDriverDetails = async (driverId) => {
  const response = await fetch(`/api/admin/users/${driverId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  return response.json();
};

// Fetch driver statistics
const fetchDriverStats = async (driverId) => {
  const response = await fetch(`/api/driver/stats?userId=${driverId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  return response.json();
};

// Fetch driver activity logs
const fetchDriverActivity = async (driverId) => {
  const response = await fetch(
    `/api/admin/audit-logs?userId=${driverId}&page=1&limit=10`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  return response.json();
};
```

---

### 3. Edit Driver Profile Modal

**Trigger:** Click "Edit Profile" button

**Editable Fields:**
- Name (text input)
- Email (email input)
- Vehicle name (text input)
- Vehicle number (text input with validation)
- Vehicle type (dropdown)

**Layout Example:**
```
┌─────────────────────────────────────────────────────────┐
│  Edit Driver Profile                                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Personal Information                                     │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Name:  [Rajesh Kumar                              ] ││
│  │ Email: [rajesh@example.com                        ] ││
│  └─────────────────────────────────────────────────────┘│
│                                                           │
│  Vehicle Information                                      │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Vehicle Name:   [Honda Activa                     ] ││
│  │ Vehicle Number: [MH12AB1234                       ] ││
│  │ Vehicle Type:   [Scooter              ▼]           ││
│  └─────────────────────────────────────────────────────┘│
│                                                           │
│  [Cancel]                                [Save Changes]  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**API Calls:**
```javascript
// Update driver profile
const updateDriverProfile = async (driverId, updates) => {
  const response = await fetch(`/api/admin/users/${driverId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: updates.name,
      email: updates.email,
    }),
  });

  return response.json();
};

// Update vehicle details
const updateVehicleDetails = async (updates) => {
  const response = await fetch(`/api/driver/vehicle`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      vehicleName: updates.vehicleName,
      vehicleNumber: updates.vehicleNumber,
      vehicleType: updates.vehicleType,
    }),
  });

  return response.json();
};
```

---

### 4. Status Management Actions

**Actions Available:**
1. **Activate** - Simple confirmation
2. **Deactivate** - Simple confirmation
3. **Suspend** - Requires reason input
4. **Delete** - Confirmation with safety checks

#### Suspend Driver Dialog

**Layout Example:**
```
┌─────────────────────────────────────────────────────────┐
│  Suspend Driver - Rajesh Kumar                           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Please provide a reason for suspension:                 │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐│
│  │                                                       ││
│  │  [Type suspension reason here...]                    ││
│  │                                                       ││
│  │  Min 10 characters                                   ││
│  └─────────────────────────────────────────────────────┘│
│                                                           │
│  Common reasons:                                          │
│  • Multiple customer complaints                          │
│  • Unprofessional behavior                               │
│  • Failed to complete deliveries                         │
│  • Document verification required                        │
│                                                           │
│  ⚠️ Driver will be immediately blocked from login        │
│                                                           │
│  [Cancel]                              [Suspend Driver]  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**API Call:**
```javascript
// Suspend driver
const suspendDriver = async (driverId, reason) => {
  const response = await fetch(`/api/admin/users/${driverId}/suspend`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });

  return response.json();
};

// Activate driver
const activateDriver = async (driverId) => {
  const response = await fetch(`/api/admin/users/${driverId}/activate`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  return response.json();
};

// Deactivate driver
const deactivateDriver = async (driverId) => {
  const response = await fetch(`/api/admin/users/${driverId}/deactivate`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  return response.json();
};

// Delete driver
const deleteDriver = async (driverId) => {
  const response = await fetch(`/api/admin/users/${driverId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  return response.json();
};
```

---

### 5. Pending Drivers Approval Page

See [DRIVER_APPROVAL_INTEGRATION_GUIDE.md](DRIVER_APPROVAL_INTEGRATION_GUIDE.md) for complete details on approval workflow UI.

**Quick Reference:**
- List pending drivers
- View driver documents
- Approve with confirmation
- Reject with reason

---

### 6. Driver Activity Log Tab

**In Driver Detail Page:**

**Layout Example:**
```
┌──────────────────────────────────────────────────────────┐
│  Activity Log - Rajesh Kumar                              │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  Filter: [All Actions ▼]  Date: [Last 30 days ▼]         │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Jan 17, 2026 3:00 PM                               │  │
│  │ 🔴 SUSPENDED by Admin User                         │  │
│  │ Reason: Multiple customer complaints regarding     │  │
│  │ delivery behavior                                   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Jan 15, 2026 2:30 PM                               │  │
│  │ 📝 UPDATED by Admin User                           │  │
│  │ Changed: email from old@example.com to new@...     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Jan 10, 2026 10:00 AM                              │  │
│  │ ✅ APPROVED by Admin User                          │  │
│  │ Driver registration approved                        │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Jan 10, 2026 8:00 AM                               │  │
│  │ 📋 CREATED                                          │  │
│  │ Driver registered in the system                     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  [Load More]                                               │
└──────────────────────────────────────────────────────────┘
```

**API Call:**
```javascript
// Fetch audit logs for driver
const fetchDriverAuditLogs = async (driverId, filters) => {
  const params = new URLSearchParams({
    userId: driverId,
    page: filters.page || 1,
    limit: filters.limit || 20,
    ...(filters.action && { action: filters.action }),
    ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
    ...(filters.dateTo && { dateTo: filters.dateTo }),
  });

  const response = await fetch(`/api/admin/audit-logs?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  return response.json();
};
```

---

## Implementation Guide

### Step 1: Create Service File

Create `src/services/driverManagementService.js`:

```javascript
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

const getAuthHeader = () => ({
  'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
});

export const driverManagementService = {
  // List drivers with filters
  getDrivers: async (filters = {}) => {
    const params = new URLSearchParams({
      role: 'DRIVER',
      page: filters.page || 1,
      limit: filters.limit || 20,
      ...(filters.status && { status: filters.status }),
      ...(filters.approvalStatus && { approvalStatus: filters.approvalStatus }),
      ...(filters.search && { search: filters.search }),
    });

    const response = await fetch(`${API_BASE}/admin/users?${params}`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) throw new Error('Failed to fetch drivers');
    return response.json();
  },

  // Get pending drivers
  getPendingDrivers: async (page = 1, limit = 20) => {
    const response = await fetch(
      `${API_BASE}/admin/drivers/pending?page=${page}&limit=${limit}`,
      { headers: getAuthHeader() }
    );

    if (!response.ok) throw new Error('Failed to fetch pending drivers');
    return response.json();
  },

  // Get driver details
  getDriverDetails: async (driverId) => {
    const response = await fetch(`${API_BASE}/admin/users/${driverId}`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) throw new Error('Failed to fetch driver details');
    return response.json();
  },

  // Get driver statistics
  getDriverStats: async (driverId) => {
    const response = await fetch(`${API_BASE}/driver/stats?userId=${driverId}`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) throw new Error('Failed to fetch driver stats');
    return response.json();
  },

  // Update driver profile
  updateDriver: async (driverId, updates) => {
    const response = await fetch(`${API_BASE}/admin/users/${driverId}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) throw new Error('Failed to update driver');
    return response.json();
  },

  // Update vehicle details
  updateVehicle: async (updates) => {
    const response = await fetch(`${API_BASE}/driver/vehicle`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) throw new Error('Failed to update vehicle');
    return response.json();
  },

  // Approve driver
  approveDriver: async (driverId) => {
    const response = await fetch(`${API_BASE}/admin/drivers/${driverId}/approve`, {
      method: 'PATCH',
      headers: getAuthHeader(),
    });

    if (!response.ok) throw new Error('Failed to approve driver');
    return response.json();
  },

  // Reject driver
  rejectDriver: async (driverId, reason) => {
    const response = await fetch(`${API_BASE}/admin/drivers/${driverId}/reject`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) throw new Error('Failed to reject driver');
    return response.json();
  },

  // Activate driver
  activateDriver: async (driverId) => {
    const response = await fetch(`${API_BASE}/admin/users/${driverId}/activate`, {
      method: 'PATCH',
      headers: getAuthHeader(),
    });

    if (!response.ok) throw new Error('Failed to activate driver');
    return response.json();
  },

  // Deactivate driver
  deactivateDriver: async (driverId) => {
    const response = await fetch(`${API_BASE}/admin/users/${driverId}/deactivate`, {
      method: 'PATCH',
      headers: getAuthHeader(),
    });

    if (!response.ok) throw new Error('Failed to deactivate driver');
    return response.json();
  },

  // Suspend driver
  suspendDriver: async (driverId, reason) => {
    const response = await fetch(`${API_BASE}/admin/users/${driverId}/suspend`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) throw new Error('Failed to suspend driver');
    return response.json();
  },

  // Delete driver
  deleteDriver: async (driverId) => {
    const response = await fetch(`${API_BASE}/admin/users/${driverId}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete driver');
    }
    return response.json();
  },

  // Get audit logs
  getAuditLogs: async (filters = {}) => {
    const params = new URLSearchParams({
      page: filters.page || 1,
      limit: filters.limit || 20,
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.action && { action: filters.action }),
      ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
      ...(filters.dateTo && { dateTo: filters.dateTo }),
    });

    const response = await fetch(`${API_BASE}/admin/audit-logs?${params}`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) throw new Error('Failed to fetch audit logs');
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
│       ├── DriversListPage.jsx
│       ├── DriverDetailPage.jsx
│       └── PendingDriversPage.jsx
├── components/
│   └── admin/
│       ├── DriverTable.jsx
│       ├── DriverDetailModal.jsx
│       ├── EditDriverModal.jsx
│       ├── SuspendDriverDialog.jsx
│       ├── DriverStatsCard.jsx
│       ├── DriverActivityLog.jsx
│       └── ImageViewer.jsx
└── services/
    └── driverManagementService.js
```

---

### Step 3: Add Routes

Add to your admin routes:

```javascript
import DriversListPage from './pages/admin/DriversListPage';
import DriverDetailPage from './pages/admin/DriverDetailPage';
import PendingDriversPage from './pages/admin/PendingDriversPage';

<Route path="/admin/drivers" element={<DriversListPage />} />
<Route path="/admin/drivers/:id" element={<DriverDetailPage />} />
<Route path="/admin/drivers/pending" element={<PendingDriversPage />} />
```

---

### Step 4: Add Navigation

Add to admin sidebar:

```javascript
<NavLink to="/admin/drivers">
  <Icon name="users" />
  Drivers
</NavLink>

<NavLink to="/admin/drivers/pending">
  <Icon name="clock" />
  Pending Approvals
  {pendingCount > 0 && <Badge variant="warning">{pendingCount}</Badge>}
</NavLink>
```

---

## Error Handling

### Common Error Scenarios

**1. Network Errors**
```javascript
try {
  const data = await driverManagementService.getDrivers();
} catch (error) {
  if (error.message === 'Failed to fetch') {
    toast.error('Network error. Please check your connection.');
  } else {
    toast.error(error.message);
  }
}
```

**2. Authentication Errors (401)**
```javascript
if (response.status === 401) {
  toast.error('Session expired. Please login again.');
  redirectToLogin();
}
```

**3. Authorization Errors (403)**
```javascript
if (response.status === 403) {
  toast.error('You do not have permission to perform this action.');
}
```

**4. Validation Errors (400)**
```javascript
if (response.status === 400) {
  const error = await response.json();
  toast.error(error.message);
  // e.g., "Suspension reason is required"
  // e.g., "Cannot delete driver with pending deliveries"
}
```

**5. Not Found Errors (404)**
```javascript
if (response.status === 404) {
  toast.error('Driver not found.');
  redirectToDriversList();
}
```

**6. Server Errors (500)**
```javascript
if (response.status === 500) {
  toast.error('Server error. Please try again later.');
  logErrorToMonitoring(error);
}
```

---

## Testing Scenarios

### Manual Testing Checklist

#### Test 1: View All Drivers
- [ ] Navigate to drivers list page
- [ ] Verify all drivers are displayed
- [ ] Check pagination works correctly
- [ ] Test search by name
- [ ] Test search by phone
- [ ] Test filter by status
- [ ] Test filter by approval status
- [ ] Verify sorting works

#### Test 2: View Driver Details
- [ ] Click on a driver
- [ ] Verify all information is displayed correctly
- [ ] Check license image loads
- [ ] Verify vehicle documents load
- [ ] Check statistics are accurate
- [ ] Verify activity log shows recent actions

#### Test 3: Edit Driver Profile
- [ ] Click "Edit Profile"
- [ ] Update name and email
- [ ] Save changes
- [ ] Verify changes are reflected
- [ ] Check audit log entry created

#### Test 4: Update Vehicle Details
- [ ] Edit vehicle name
- [ ] Edit vehicle number (test validation)
- [ ] Change vehicle type
- [ ] Save changes
- [ ] Verify updates are reflected

#### Test 5: Approve Pending Driver
- [ ] Navigate to pending drivers
- [ ] Click on a pending driver
- [ ] View all documents
- [ ] Click "Approve"
- [ ] Confirm approval
- [ ] Verify driver removed from pending list
- [ ] Check driver can now login

#### Test 6: Reject Pending Driver
- [ ] Click on a pending driver
- [ ] Click "Reject"
- [ ] Try submitting without reason (should fail)
- [ ] Enter valid reason
- [ ] Submit rejection
- [ ] Verify driver removed from pending list
- [ ] Check driver sees rejection reason on mobile

#### Test 7: Activate Driver
- [ ] Find inactive driver
- [ ] Click "Activate"
- [ ] Confirm action
- [ ] Verify status changed to ACTIVE
- [ ] Check audit log entry

#### Test 8: Deactivate Driver
- [ ] Find active driver
- [ ] Click "Deactivate"
- [ ] Confirm action
- [ ] Verify status changed to INACTIVE
- [ ] Check audit log entry

#### Test 9: Suspend Driver
- [ ] Find active driver
- [ ] Click "Suspend"
- [ ] Try submitting without reason (should fail)
- [ ] Enter valid reason
- [ ] Submit suspension
- [ ] Verify status changed to SUSPENDED
- [ ] Check suspension details saved
- [ ] Verify audit log entry

#### Test 10: Delete Driver
- [ ] Find driver with NO active deliveries
- [ ] Click "Delete"
- [ ] Confirm deletion
- [ ] Verify driver status changed to DELETED
- [ ] Try to delete driver WITH active deliveries (should fail)
- [ ] Verify error message about pending deliveries

#### Test 11: View Driver Statistics
- [ ] Open driver details
- [ ] Verify total deliveries count
- [ ] Check success rate calculation
- [ ] Verify active deliveries count
- [ ] Check failed deliveries count

#### Test 12: View Activity Log
- [ ] Open driver activity log
- [ ] Verify all actions are logged
- [ ] Check admin names are shown
- [ ] Verify timestamps are correct
- [ ] Test filtering by action type
- [ ] Test filtering by date range

#### Test 13: Error Scenarios
- [ ] Test with expired auth token (should redirect)
- [ ] Test non-admin user access (should deny)
- [ ] Test approving already approved driver (should fail)
- [ ] Test rejecting without reason (should fail)
- [ ] Test suspending without reason (should fail)
- [ ] Test deleting driver with active deliveries (should fail)
- [ ] Test invalid driver ID (should show error)
- [ ] Test network failure handling

#### Test 14: Edge Cases
- [ ] Driver with no email
- [ ] Driver with no profile image
- [ ] Driver with expired license
- [ ] Driver with expired vehicle documents
- [ ] Very long names/text fields
- [ ] Special characters in reasons
- [ ] Multiple rapid status changes
- [ ] Concurrent admin actions on same driver

---

## Implementation Checklist

### Backend (Already Complete ✅)
- [x] Driver listing with filters and search
- [x] Driver profile details endpoint
- [x] Driver profile update endpoint
- [x] Driver approval/rejection endpoints
- [x] Status management (activate, deactivate, suspend, delete)
- [x] Driver statistics endpoint
- [x] Audit logging for all actions
- [x] Safety checks (e.g., prevent delete with active deliveries)
- [x] Vehicle details update endpoint
- [x] Proper error handling

### Frontend (Needs Implementation ❌)
- [ ] Drivers list page with tabs and filters
- [ ] Driver detail page/modal
- [ ] Edit driver profile modal
- [ ] Edit vehicle details modal
- [ ] Pending drivers approval page
- [ ] Approve/reject confirmation dialogs
- [ ] Status management dialogs (suspend, delete)
- [ ] Driver statistics cards
- [ ] Activity log component
- [ ] Image viewer component
- [ ] API service integration
- [ ] Error handling and toasts
- [ ] Loading states
- [ ] Pagination controls
- [ ] Search functionality
- [ ] Filter dropdowns
- [ ] Bulk actions (optional)
- [ ] Real-time updates (optional)

---

## Quick Reference

### Status Badge Colors
- 🟢 **ACTIVE** - Green
- ⏸️ **INACTIVE** - Gray
- 🔴 **SUSPENDED** - Red
- ⚫ **DELETED** - Black

### Approval Badge Colors
- ⏳ **PENDING** - Yellow/Warning
- ✅ **APPROVED** - Green/Success
- ❌ **REJECTED** - Red/Danger

### Document Expiry Warnings
- ✓ **Valid** - Green (> 30 days to expiry)
- ⚠️ **Warning** - Yellow (< 30 days to expiry)
- ❌ **Expired** - Red (already expired)

---

## Support & Questions

**Backend Files Reference:**
- User Schema: [schema/user.schema.js](schema/user.schema.js:121-197)
- Admin Controller: [src/admin/admin.controller.js](src/admin/admin.controller.js)
- Admin Routes: [src/admin/admin.routes.js](src/admin/admin.routes.js)
- Driver Controller: [src/driver/driver.controller.js](src/driver/driver.controller.js)
- Driver Routes: [src/driver/driver.routes.js](src/driver/driver.routes.js)
- Audit Log Schema: [schema/auditLog.schema.js](schema/auditLog.schema.js)

---

## Document Version
- **Version:** 1.0
- **Last Updated:** January 17, 2026
- **Backend Status:** Fully Implemented ✅
- **Admin UI Status:** Needs Integration ❌

---

*This documentation covers complete driver profile management for admin panel. All backend endpoints are fully functional and ready for frontend integration.*
