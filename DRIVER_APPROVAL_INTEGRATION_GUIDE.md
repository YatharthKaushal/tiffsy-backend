# Driver Registration & Approval System - Admin UI Integration Guide

## Table of Contents
1. [Overview](#overview)
2. [IMPLEMENTATION PROMPTS FOR CLAUDE (START HERE)](#implementation-prompts-for-claude-start-here)
3. [Complete Workflow](#complete-workflow)
4. [API Endpoints](#api-endpoints)
5. [Data Models](#data-models)
6. [UI Requirements](#ui-requirements)
7. [Error Handling](#error-handling)
8. [Testing Scenarios](#testing-scenarios)

---

## Overview

The backend implements a complete driver registration and approval workflow where:
1. **Drivers** self-register via mobile app with their credentials and documents
2. **System** sets their status to `PENDING` and prevents access to delivery features
3. **Admin** reviews pending registrations and approves/rejects with reasons
4. **Drivers** gain access only after approval, or are blocked if rejected

**Current Status:** Backend fully implemented ✅ | Admin UI integration needed ❌

---

## IMPLEMENTATION PROMPTS FOR CLAUDE (START HERE)

**IMPORTANT:** These are step-by-step prompts to build the Driver Approval admin UI from scratch. Give these prompts to Claude one by one or in sequence.

---

### 🎯 PROMPT 1: Setup Project Structure & Service Layer

```
I need to build a Driver Registration Approval interface for the admin panel. The backend API is already implemented and running.

TASK: Set up the project structure and create the API service layer for driver approval management.

1. Create the following folder structure:
   src/
   ├── pages/admin/
   │   └── PendingDriverApprovals.jsx
   ├── components/admin/approvals/
   │   ├── DriverApprovalCard.jsx
   │   ├── DriverDetailModal.jsx
   │   ├── ApproveConfirmDialog.jsx
   │   ├── RejectDialog.jsx
   │   └── DocumentViewer.jsx
   └── services/
       └── driverApprovalService.js

2. Create `src/services/driverApprovalService.js` with the following API methods:
   - getPendingDrivers(page, limit) - GET /api/admin/drivers/pending
   - approveDriver(driverId) - PATCH /api/admin/drivers/:id/approve
   - rejectDriver(driverId, reason) - PATCH /api/admin/drivers/:id/reject

3. All API calls should:
   - Include Authorization header: `Bearer ${localStorage.getItem('authToken')}`
   - Use BASE_URL from environment variable or default to 'http://localhost:4000/api'
   - Handle errors properly with try-catch
   - Return parsed JSON responses

4. Add proper TypeScript types or JSDoc comments for all methods.

Here's the complete service code:

```javascript
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

const getAuthHeader = () => ({
  'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
});

export const driverApprovalService = {
  // Get pending drivers awaiting approval
  getPendingDrivers: async (page = 1, limit = 20) => {
    const response = await fetch(
      `${API_BASE}/admin/drivers/pending?page=${page}&limit=${limit}`,
      { headers: getAuthHeader() }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch pending drivers');
    }

    return response.json();
  },

  // Approve a driver registration
  approveDriver: async (driverId) => {
    const response = await fetch(
      `${API_BASE}/admin/drivers/${driverId}/approve`,
      {
        method: 'PATCH',
        headers: getAuthHeader(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to approve driver');
    }

    return response.json();
  },

  // Reject a driver registration with reason
  rejectDriver: async (driverId, reason) => {
    if (!reason || reason.trim().length < 10) {
      throw new Error('Rejection reason must be at least 10 characters');
    }

    const response = await fetch(
      `${API_BASE}/admin/drivers/${driverId}/reject`,
      {
        method: 'PATCH',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to reject driver');
    }

    return response.json();
  },
};
```

Please implement this service layer with proper error handling.
```

---

### 🎯 PROMPT 2: Build Pending Drivers Approval Page

```
TASK: Create the main Pending Driver Approvals page with card grid view.

Build `src/pages/admin/PendingDriverApprovals.jsx` with:

FEATURES:

1. Page Header:
   - Title: "Pending Driver Approvals"
   - Total count badge: "Total: {count} pending"
   - [Refresh] button
   - Description: "Review and approve new driver registrations"

2. Empty State:
   - If no pending drivers:
     * Celebration icon (🎉 or similar)
     * Message: "All caught up! No pending approvals"
     * Subtext: "New driver registrations will appear here"

3. Driver Cards Grid (2-3 columns, responsive):
   Each card displays:
   - Profile image (or default avatar)
   - Driver Name (large, bold)
   - Phone Number
   - Registration Date (relative: "2 days ago")
   - Vehicle Information:
     * Type badge (BIKE/SCOOTER/BICYCLE)
     * Vehicle Number (e.g., MH12AB1234)
   - Quick document status indicators:
     * ✓ License (green if valid)
     * ✓ RC
     * ✓ Insurance
     * ⚠ PUC (yellow if expiring soon, red if expired)
   - [View Details] button (primary)

4. Pagination:
   - Show "Showing X-Y of Z drivers"
   - Previous/Next buttons
   - Page numbers
   - Items per page: 20

5. Loading & Error States:
   - Skeleton loaders for cards while fetching
   - Error message with retry button if fetch fails
   - Loading spinner on refresh

6. Click Handling:
   - Click [View Details] opens DriverDetailModal
   - Pass driver data to modal

Use API: driverApprovalService.getPendingDrivers(page, limit)

Implement with proper state management (useState, useEffect), pagination logic, and responsive grid layout (CSS Grid or Tailwind).
```

---

### 🎯 PROMPT 3: Build Driver Detail Modal (Review & Approve/Reject)

```
TASK: Create comprehensive driver detail modal for reviewing registration.

Build `src/components/admin/approvals/DriverDetailModal.jsx` with:

LAYOUT SECTIONS:

1. Modal Header:
   - Driver Name (large)
   - Phone Number
   - Registration Date: "Registered on Jan 15, 2026"
   - [Close X] button

2. Personal Information Section:
   - Name
   - Phone (with copy button)
   - Email (if provided)
   - Registration timestamp

3. License Information Section:
   Title: "Driver's License"
   Display:
   - License Number (with copy button)
   - Expiry Date with status:
     * ✓ Valid (green) if > 30 days
     * ⚠ Expiring Soon (yellow) if < 30 days
     * ❌ Expired (red) if past expiry
   - License Image:
     * Large thumbnail (min 300px width)
     * [View Full Size] button → opens DocumentViewer
     * Image should be zoomable

4. Vehicle Information Section:
   Title: "Vehicle Details"
   Display:
   - Vehicle Name (e.g., "Honda Activa")
   - Vehicle Number (e.g., "MH12AB1234")
   - Vehicle Type badge (BIKE/SCOOTER/BICYCLE/OTHER)

5. Vehicle Documents Section:
   Title: "Vehicle Documents"

   For each document (RC, Insurance, PUC):
   Display as expandable cards:
   - Document Type badge
   - Expiry Date with status indicator
   - Thumbnail image (200px)
   - [View Full Size] button → opens DocumentViewer

   Visual indicators:
   - Green checkmark + "Valid until {date}" if > 30 days
   - Yellow warning + "Expires in {days} days" if < 30 days
   - Red X + "Expired on {date}" if expired

6. Review Notes Section (optional):
   - Textarea for admin notes (optional)
   - Placeholder: "Add any notes about this registration..."
   - Max 500 characters

7. Action Buttons (bottom, sticky):
   - [Reject] button (outlined, red text, left side)
   - [Approve Driver] button (filled, green, right side)
   - Both full width on mobile, side-by-side on desktop

8. Modal Behavior:
   - Full screen on mobile
   - Large centered modal on desktop (max-width: 800px)
   - Scrollable content
   - Keyboard shortcuts: Esc to close

CLICK HANDLERS:
- [Approve Driver] → Opens ApproveConfirmDialog
- [Reject] → Opens RejectDialog

Use proper layout with sections, good spacing, and responsive design.
```

---

### 🎯 PROMPT 4: Build Approve Confirmation Dialog

```
TASK: Create simple confirmation dialog for approving drivers.

Build `src/components/admin/approvals/ApproveConfirmDialog.jsx` with:

CONTENT:

1. Dialog Title:
   "Approve {driverName}?"

2. Dialog Content:
   - Driver summary:
     * Name
     * Phone
     * Vehicle: {type} - {number}

   - Confirmation message:
     "This driver will be able to login and accept delivery assignments."

3. Action Buttons:
   - [Cancel] button (secondary, gray)
   - [Confirm Approval] button (primary, green)

4. Loading State:
   - Show loading spinner on [Confirm Approval] when API call in progress
   - Disable both buttons while loading
   - Button text changes to "Approving..."

5. Success Handling:
   - On success:
     * Close dialog
     * Close parent DriverDetailModal
     * Show success toast: "✓ {driverName} approved successfully"
     * Remove driver from pending list
     * Refresh pending drivers list

6. Error Handling:
   - On error:
     * Show error toast: "Failed to approve driver: {error message}"
     * Keep dialog open
     * Enable buttons again

API Call:
- driverApprovalService.approveDriver(driverId)

Props:
- open: boolean
- driverName: string
- driverId: string
- onClose: function
- onSuccess: function

Implement with proper loading states, error handling, and smooth animations.
```

---

### 🎯 PROMPT 5: Build Reject Dialog with Reason Input

```
TASK: Create dialog for rejecting driver registration with mandatory reason.

Build `src/components/admin/approvals/RejectDialog.jsx` with:

CONTENT:

1. Dialog Title:
   "Reject Driver Registration"

2. Driver Summary:
   - Name
   - Phone
   - Vehicle info

3. Reason Input (REQUIRED):
   - Label: "Reason for Rejection *"
   - Textarea (min 10 characters, max 500)
   - Placeholder: "Please provide a clear reason for rejection..."
   - Character counter: "{count}/500"
   - Validation error shown inline if < 10 chars

4. Common Reasons (Quick Select Chips):
   Clickable chips that auto-fill the textarea:
   - "License document is unclear or unverifiable"
   - "Vehicle documents are expired"
   - "Information provided doesn't match documents"
   - "Incomplete documentation"
   - "Vehicle registration certificate invalid"

   Clicking a chip fills the textarea (user can edit)

5. Important Notes:
   Display warning box (yellow background):
   "⚠️ Important:"
   - Driver will be notified of rejection
   - Driver will see the rejection reason
   - This action cannot be undone

6. Action Buttons:
   - [Cancel] button (secondary, gray)
   - [Submit Rejection] button (danger, red)
     * Disabled if reason < 10 characters
     * Shows validation error on click if invalid

7. Loading State:
   - Show loading spinner when API call in progress
   - Disable both buttons
   - Button text changes to "Rejecting..."

8. Success Handling:
   - On success:
     * Close dialog
     * Close parent DriverDetailModal
     * Show success toast: "Driver registration rejected"
     * Remove driver from pending list
     * Refresh pending drivers list

9. Error Handling:
   - On error:
     * Show error toast: "Failed to reject driver: {error message}"
     * Keep dialog open
     * Enable buttons again

API Call:
- driverApprovalService.rejectDriver(driverId, reason)

Props:
- open: boolean
- driverName: string
- driverId: string
- onClose: function
- onSuccess: function

Implement with form validation, character counter, and proper UX.
```

---

### 🎯 PROMPT 6: Build Document Viewer Component

```
TASK: Create full-screen document/image viewer for license and vehicle documents.

Build `src/components/admin/approvals/DocumentViewer.jsx` with:

FEATURES:

1. Full-Screen Overlay:
   - Dark semi-transparent background (backdrop)
   - Centered image display
   - Click outside to close

2. Image Display:
   - Large, centered image (max 90vw, 90vh)
   - High quality rendering
   - Maintain aspect ratio

3. Zoom Controls:
   - [Zoom In +] button
   - [Zoom Out -] button
   - [Reset 100%] button
   - Mouse wheel zoom support
   - Zoom range: 50% to 300%

4. Pan/Drag:
   - Click and drag to pan when zoomed
   - Cursor changes to grab/grabbing
   - Smooth dragging

5. Top Control Bar:
   - Document title/type (e.g., "Driver's License", "RC Document")
   - Expiry date (if applicable)
   - [Download] button
   - [Close X] button

6. Navigation (if multiple images):
   - [Previous ←] button (left side)
   - [Next →] button (right side)
   - Show "Image X of Y"
   - Keyboard arrow keys support

7. Keyboard Shortcuts:
   - Esc: Close viewer
   - Arrow Left/Right: Navigate images
   - +/-: Zoom in/out
   - 0: Reset zoom

8. Mobile Optimization:
   - Touch gestures:
     * Pinch to zoom
     * Two-finger drag to pan
     * Swipe to navigate
   - Responsive controls

Props:
- images: array of {url, title, type, expiryDate}
- initialIndex: number (which image to show first)
- onClose: function

Use CSS transforms for zoom/pan, or a library like 'react-image-lightbox' or 'yet-another-react-lightbox'.

Implement with smooth animations and good mobile support.
```

---

### 🎯 PROMPT 7: Add Routes and Navigation Integration

```
TASK: Integrate the Pending Driver Approvals page into admin routing and navigation.

1. ADD ROUTE (in your router config):
   ```jsx
   import PendingDriverApprovals from './pages/admin/PendingDriverApprovals';

   <Route path="/admin/drivers/pending-approvals" element={<PendingDriverApprovals />} />
   ```

2. ADD NAVIGATION LINK (in admin sidebar):
   ```jsx
   <NavLink to="/admin/drivers/pending-approvals">
     <ClockIcon /> {/* or UserCheckIcon */}
     Pending Approvals
     {pendingCount > 0 && (
       <Badge variant="warning" className="ml-auto">
         {pendingCount}
       </Badge>
     )}
   </NavLink>
   ```

3. FETCH PENDING COUNT (in sidebar component):
   ```jsx
   const [pendingCount, setPendingCount] = useState(0);

   useEffect(() => {
     const fetchCount = async () => {
       try {
         const response = await driverApprovalService.getPendingDrivers(1, 1);
         setPendingCount(response.data.pagination.total);
       } catch (error) {
         console.error('Failed to fetch pending count:', error);
       }
     };

     fetchCount();

     // Refresh count every 60 seconds
     const interval = setInterval(fetchCount, 60000);
     return () => clearInterval(interval);
   }, []);
   ```

4. PROTECT ROUTE:
   - Ensure admin authentication required
   - Redirect to login if not authenticated
   - Check user has admin role
   - Example:
     ```jsx
     <Route
       path="/admin/drivers/pending-approvals"
       element={
         <ProtectedRoute requiredRole="ADMIN">
           <PendingDriverApprovals />
         </ProtectedRoute>
       }
     />
     ```

5. ADD DASHBOARD WIDGET (optional):
   On admin dashboard home, add a card showing:
   - "X Pending Driver Approvals"
   - [Review Now] button → links to pending approvals page

Implement with proper route protection and active link highlighting.
```

---

### 🎯 PROMPT 8: Add Real-time Updates & Polish

```
TASK: Add real-time features and final polish to the approval interface.

1. AUTO-REFRESH:
   - Auto-refresh pending drivers list every 30 seconds
   - Show "Updated X seconds ago" indicator
   - [Pause Auto-refresh] toggle (optional)
   - Manual [Refresh] button with loading spinner

2. NOTIFICATIONS:
   - Show browser notification when new driver registers (optional)
   - Toast notification for:
     * Approval success
     * Rejection success
     * API errors
   - Sound notification toggle (optional)

3. BADGE COUNT UPDATES:
   - Update sidebar badge count after approval/rejection
   - Real-time count updates
   - Animate count changes

4. LOADING STATES:
   - Skeleton loaders for driver cards
   - Loading overlay during API calls
   - Smooth transitions between states

5. EMPTY STATES:
   - Friendly message when no pending approvals
   - Illustration or icon
   - Helpful text about what to expect

6. ERROR HANDLING:
   - Network error with retry button
   - Clear error messages
   - Fallback UI for failed image loads
   - Timeout handling for slow connections

7. ACCESSIBILITY:
   - Keyboard navigation for all actions
   - Proper ARIA labels
   - Focus management in modals
   - Screen reader announcements
   - Tab order makes sense

8. RESPONSIVE DESIGN:
   - Mobile: Single column, full-width cards
   - Tablet: 2-column grid
   - Desktop: 3-column grid
   - Stack action buttons vertically on mobile

9. PERFORMANCE:
   - Lazy load images
   - Virtualize list if many items
   - Debounce search (if added)
   - Optimize re-renders with React.memo

10. VISUAL POLISH:
    - Smooth transitions and animations
    - Consistent spacing and shadows
    - Proper color contrast
    - Hover states for interactive elements
    - Success/error color coding

11. TESTING:
    - Test approval flow end-to-end
    - Test rejection with various reasons
    - Test with expired documents
    - Test with no pending drivers
    - Test error scenarios
    - Test on different devices

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

#### Main Page
- [ ] Pending Approvals page with card grid
- [ ] Pagination working
- [ ] Empty state
- [ ] Loading states
- [ ] Error handling

#### Components
- [ ] Driver Detail Modal
- [ ] Approve Confirmation Dialog
- [ ] Reject Dialog with reason input
- [ ] Document Viewer
- [ ] All modals working properly

#### Integration
- [ ] Routes configured
- [ ] Navigation link added
- [ ] Pending count badge working
- [ ] Auto-refresh implemented
- [ ] All API endpoints tested

#### User Experience
- [ ] Smooth animations
- [ ] Loading feedback
- [ ] Success/error toasts
- [ ] Keyboard navigation
- [ ] Mobile responsive

#### Polish
- [ ] Accessibility checked
- [ ] Performance optimized
- [ ] Error states handled
- [ ] Visual consistency
- [ ] Production ready

---

## Complete Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: DRIVER SELF-REGISTRATION                               │
└─────────────────────────────────────────────────────────────────┘

Driver Mobile App:
1. Phone OTP verification (Firebase Auth)
2. Submit registration form with:
   - Personal details (name, email, photo)
   - License details (number, image, expiry)
   - Vehicle details (name, number, type)
   - Vehicle documents (RC, Insurance, PUC)

Backend Action:
✓ Creates User with role="DRIVER"
✓ Sets approvalStatus="PENDING"
✓ Sets status="ACTIVE"
✓ Stores all driverDetails
✓ Returns 201 with message: "Registration submitted for approval"

Driver State: CAN view profile, CANNOT accept deliveries


┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: ADMIN REVIEW (NEEDS UI INTEGRATION)                   │
└─────────────────────────────────────────────────────────────────┘

Admin Portal:
1. View list of pending driver registrations
2. Click on driver to see full details:
   - License image
   - Vehicle documents (RC, Insurance, PUC)
   - Registration date
3. Perform background verification
4. Decision:
   a) APPROVE → Driver gains full access
   b) REJECT → Driver blocked with reason

Backend Action:
✓ Updates approvalStatus
✓ Records admin ID, timestamp, reason (if rejected)
✓ Creates audit log entry
✓ Returns updated user object


┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: POST-DECISION                                          │
└─────────────────────────────────────────────────────────────────┘

If APPROVED:
✓ Driver can login
✓ Driver can accept delivery assignments
✓ Full access to driver features

If REJECTED:
✗ Driver cannot login
✗ Sees rejection reason on sync
✗ Must contact support or re-register
```

---

## API Endpoints

### Base URL
```
Production: https://your-api-domain.com/api
Development: http://localhost:4000/api
```

### Authentication
All admin endpoints require authentication:
- **Header:** `Authorization: Bearer <JWT_TOKEN>`
- **Middleware:** `adminAuthMiddleware` + `adminMiddleware`

---

### 1. Get Pending Driver Registrations

**Endpoint:** `GET /api/admin/drivers/pending`

**Description:** Retrieves paginated list of drivers awaiting approval

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

**Request Example:**
```bash
GET /api/admin/drivers/pending?page=1&limit=20
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Pending drivers retrieved",
  "data": {
    "drivers": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "phone": "+919876543210",
        "name": "Rajesh Kumar",
        "email": "rajesh@example.com",
        "profileImage": "https://storage.googleapis.com/bucket/profiles/abc123.jpg",
        "role": "DRIVER",
        "status": "ACTIVE",
        "approvalStatus": "PENDING",
        "driverDetails": {
          "licenseNumber": "MH1220200012345",
          "licenseImageUrl": "https://storage.googleapis.com/bucket/licenses/xyz789.jpg",
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
        "createdAt": "2026-01-15T10:30:00.000Z",
        "updatedAt": "2026-01-15T10:30:00.000Z",
        "lastLoginAt": "2026-01-15T10:30:00.000Z"
      }
      // ... more drivers
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

**Error Responses:**
| Status | Message | Description |
|--------|---------|-------------|
| 401 | Unauthorized | Invalid or missing JWT token |
| 403 | Forbidden | User is not an admin |
| 500 | Failed to retrieve pending drivers | Server error |

---

### 2. Approve Driver Registration

**Endpoint:** `PATCH /api/admin/drivers/:id/approve`

**Description:** Approves a pending driver registration

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Driver's user ID (MongoDB ObjectId) |

**Request Example:**
```bash
PATCH /api/admin/drivers/507f1f77bcf86cd799439011/approve
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Driver approved successfully",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "phone": "+919876543210",
      "name": "Rajesh Kumar",
      "email": "rajesh@example.com",
      "role": "DRIVER",
      "status": "ACTIVE",
      "approvalStatus": "APPROVED",
      "approvalDetails": {
        "approvedBy": "507f1f77bcf86cd799439022",
        "approvedAt": "2026-01-17T14:30:00.000Z"
      },
      "driverDetails": { /* ... */ },
      "createdAt": "2026-01-15T10:30:00.000Z",
      "updatedAt": "2026-01-17T14:30:00.000Z"
    }
  }
}
```

**Error Responses:**
| Status | Message | Description |
|--------|---------|-------------|
| 400 | User is not a driver | Target user is not a DRIVER role |
| 400 | Driver is already approved | Cannot approve already approved driver |
| 401 | Unauthorized | Invalid or missing JWT token |
| 403 | Forbidden | User is not an admin |
| 404 | User not found | Driver ID doesn't exist |
| 500 | Failed to approve driver | Server error |

**Side Effects:**
- ✓ User's `approvalStatus` changed to `"APPROVED"`
- ✓ `approvalDetails.approvedBy` set to admin's ID
- ✓ `approvalDetails.approvedAt` set to current timestamp
- ✓ Audit log created with action `"APPROVE_DRIVER"`
- ✓ Driver can now login and accept deliveries

---

### 3. Reject Driver Registration

**Endpoint:** `PATCH /api/admin/drivers/:id/reject`

**Description:** Rejects a pending driver registration with reason

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Driver's user ID (MongoDB ObjectId) |

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
PATCH /api/admin/drivers/507f1f77bcf86cd799439011/reject
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
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
      "_id": "507f1f77bcf86cd799439011",
      "phone": "+919876543210",
      "name": "Rajesh Kumar",
      "email": "rajesh@example.com",
      "role": "DRIVER",
      "status": "ACTIVE",
      "approvalStatus": "REJECTED",
      "approvalDetails": {
        "rejectedBy": "507f1f77bcf86cd799439022",
        "rejectedAt": "2026-01-17T14:35:00.000Z",
        "rejectionReason": "Vehicle registration certificate has expired. Please upload a valid RC document."
      },
      "driverDetails": { /* ... */ },
      "createdAt": "2026-01-15T10:30:00.000Z",
      "updatedAt": "2026-01-17T14:35:00.000Z"
    }
  }
}
```

**Error Responses:**
| Status | Message | Description |
|--------|---------|-------------|
| 400 | Rejection reason is required | Missing `reason` in request body |
| 400 | User is not a driver | Target user is not a DRIVER role |
| 400 | Driver is already rejected | Cannot reject already rejected driver |
| 401 | Unauthorized | Invalid or missing JWT token |
| 403 | Forbidden | User is not an admin |
| 404 | User not found | Driver ID doesn't exist |
| 500 | Failed to reject driver | Server error |

**Side Effects:**
- ✓ User's `approvalStatus` changed to `"REJECTED"`
- ✓ `approvalDetails.rejectedBy` set to admin's ID
- ✓ `approvalDetails.rejectedAt` set to current timestamp
- ✓ `approvalDetails.rejectionReason` stores the reason
- ✓ Audit log created with action `"REJECT_DRIVER"`
- ✓ Driver CANNOT login (blocked with rejection message)

---

## Data Models

### User Model (Driver Role)

**Schema Location:** `schema/user.schema.js`

**Core Fields:**
```typescript
interface User {
  _id: ObjectId;
  phone: string;                    // Unique, required
  firebaseUid: string;              // Firebase UID
  role: "DRIVER" | "CUSTOMER" | "ADMIN";
  name?: string;
  email?: string;
  profileImage?: string;            // URL
  status: "ACTIVE" | "INACTIVE" | "DELETED";

  // Driver-specific fields
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";

  approvalDetails?: {
    approvedBy?: ObjectId;          // Reference to admin User
    approvedAt?: Date;
    rejectedBy?: ObjectId;          // Reference to admin User
    rejectedAt?: Date;
    rejectionReason?: string;
  };

  driverDetails?: {
    licenseNumber?: string;
    licenseImageUrl?: string;       // URL to license image
    licenseExpiryDate?: Date;
    vehicleName?: string;           // e.g., "Honda Activa"
    vehicleNumber?: string;         // e.g., "MH12AB1234"
    vehicleType?: "BIKE" | "SCOOTER" | "BICYCLE" | "OTHER";
    vehicleDocuments?: Array<{
      type: "RC" | "INSURANCE" | "PUC" | "OTHER";
      imageUrl: string;             // URL to document image
      expiryDate?: Date;
    }>;
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}
```

**Approval Status Values:**
| Status | Description | Driver Access |
|--------|-------------|---------------|
| `PENDING` | Awaiting admin review | Can view profile only |
| `APPROVED` | Admin approved | Full access to app |
| `REJECTED` | Admin rejected | Cannot login |

**Vehicle Types:**
- `BIKE` - Motorcycle
- `SCOOTER` - Scooter/Scooty
- `BICYCLE` - Bicycle
- `OTHER` - Other vehicle types

**Vehicle Document Types:**
- `RC` - Registration Certificate
- `INSURANCE` - Vehicle Insurance
- `PUC` - Pollution Under Control Certificate
- `OTHER` - Other documents

---

### Validation Rules (Registration)

**Validation Schema:** `src/auth/auth.validation.js`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ✓ | Min 2, max 100 chars |
| `email` | string | ✗ | Valid email format |
| `profileImage` | string | ✗ | Valid URL |
| `licenseNumber` | string | ✓ | Non-empty |
| `licenseImageUrl` | string | ✓ | Valid URL |
| `licenseExpiryDate` | date | ✗ | Must be future date |
| `vehicleName` | string | ✓ | Non-empty |
| `vehicleNumber` | string | ✓ | Format: `MH12AB1234` (2 letters + 1-2 digits + 0-3 letters + 4 digits) |
| `vehicleType` | enum | ✓ | BIKE, SCOOTER, BICYCLE, OTHER |
| `vehicleDocuments` | array | ✓ | Min 1 document required |
| `vehicleDocuments[].type` | enum | ✓ | RC, INSURANCE, PUC, OTHER |
| `vehicleDocuments[].imageUrl` | string | ✓ | Valid URL |
| `vehicleDocuments[].expiryDate` | date | ✗ | Optional |

---

## UI Requirements

### 1. Pending Drivers List Page

**Route:** `/admin/drivers/pending`

**Features Required:**
- ✓ Paginated table/list view
- ✓ Show key info: Name, Phone, Vehicle Type, Registration Date
- ✓ Badge showing "PENDING" status
- ✓ Search/filter by name or phone
- ✓ Sort by registration date (newest first by default)
- ✓ Click row to view full details

**Layout Example:**
```
┌─────────────────────────────────────────────────────────────┐
│  Pending Driver Approvals                          [Refresh] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [Search by name or phone...]                 Total: 45      │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Name         Phone          Vehicle      Registered      ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ Rajesh K.   +91 9876...   Scooter      Jan 15, 10:30    ││
│  │ Priya S.    +91 8765...   Bike         Jan 15, 11:45    ││
│  │ Amit P.     +91 7654...   Bicycle      Jan 14, 16:20    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  ← Previous    Page 1 of 3    Next →                         │
└─────────────────────────────────────────────────────────────┘
```

**API Call:**
```javascript
const fetchPendingDrivers = async (page = 1, limit = 20) => {
  const response = await fetch(
    `/api/admin/drivers/pending?page=${page}&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    }
  );
  const data = await response.json();
  return data;
};
```

---

### 2. Driver Detail Modal/Page

**Triggered:** When clicking on a pending driver

**Features Required:**
- ✓ Display all personal information
- ✓ Display license image (zoomable/expandable)
- ✓ Display all vehicle documents (zoomable/expandable)
- ✓ Show expiry dates with visual indicators (red if expired/expiring soon)
- ✓ Approve button (green)
- ✓ Reject button (red, opens rejection reason dialog)
- ✓ Close/Cancel button

**Information to Display:**

**Personal Info:**
- Name
- Phone number
- Email (if provided)
- Profile image
- Registration date

**License Details:**
- License number
- License image (clickable to enlarge)
- Expiry date (with warning if < 30 days)

**Vehicle Details:**
- Vehicle name
- Vehicle number
- Vehicle type

**Documents:**
For each document (RC, Insurance, PUC):
- Document type
- Document image (clickable to enlarge)
- Expiry date (with warning if < 30 days)

**Layout Example:**
```
┌──────────────────────────────────────────────────────────────┐
│  Driver Registration Details                         [Close] │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  Personal Information                                          │
│  ├─ Name: Rajesh Kumar                                        │
│  ├─ Phone: +91 9876543210                                     │
│  ├─ Email: rajesh@example.com                                 │
│  └─ Registered: Jan 15, 2026 10:30 AM                        │
│                                                                │
│  License Details                                               │
│  ├─ Number: MH1220200012345                                   │
│  ├─ Expiry: Jun 15, 2027 ✓                                    │
│  └─ Image: [Click to view full size]                          │
│      [License Image Thumbnail]                                 │
│                                                                │
│  Vehicle Information                                           │
│  ├─ Name: Honda Activa                                        │
│  ├─ Number: MH12AB1234                                        │
│  └─ Type: Scooter                                             │
│                                                                │
│  Vehicle Documents                                             │
│  ├─ RC (Registration Certificate)                             │
│  │   Expiry: Mar 20, 2028 ✓                                   │
│  │   [Document Image]                                          │
│  │                                                             │
│  ├─ Insurance                                                  │
│  │   Expiry: Dec 31, 2026 ⚠ (Expiring in 11 months)          │
│  │   [Document Image]                                          │
│  │                                                             │
│  └─ PUC (Pollution Certificate)                               │
│      Expiry: Jun 30, 2026 ⚠ (Expiring in 5 months)           │
│      [Document Image]                                          │
│                                                                │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│      [Reject]                              [Approve Driver]   │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

### 3. Approve Action

**Trigger:** Click "Approve" button

**Flow:**
1. Show confirmation dialog: "Approve Rajesh Kumar as a driver?"
2. On confirm → Call API
3. Show loading state
4. On success:
   - Show success toast: "Driver approved successfully"
   - Remove from pending list
   - Close modal
5. On error:
   - Show error toast with message
   - Keep modal open

**API Call:**
```javascript
const approveDriver = async (driverId) => {
  try {
    const response = await fetch(
      `/api/admin/drivers/${driverId}/approve`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Approval failed:', error);
    throw error;
  }
};
```

---

### 4. Reject Action

**Trigger:** Click "Reject" button

**Flow:**
1. Show rejection reason dialog/modal
2. Require text input (min 10 chars)
3. Show examples: "License image is unclear", "Vehicle documents expired", etc.
4. On submit → Call API with reason
5. Show loading state
6. On success:
   - Show success toast: "Driver rejected"
   - Remove from pending list
   - Close modal
7. On error:
   - Show error toast with message
   - Keep dialog open

**Rejection Dialog Example:**
```
┌─────────────────────────────────────────────────────┐
│  Reject Driver Registration                         │
├─────────────────────────────────────────────────────┤
│                                                       │
│  Please provide a reason for rejection:              │
│                                                       │
│  ┌─────────────────────────────────────────────────┐│
│  │                                                   ││
│  │  [Type rejection reason here...]                 ││
│  │                                                   ││
│  │  Min 10 characters                               ││
│  └─────────────────────────────────────────────────┘│
│                                                       │
│  Common reasons:                                      │
│  • License image is unclear or unverifiable          │
│  • Vehicle documents are expired                     │
│  • Information provided doesn't match documents      │
│  • Incomplete documentation                          │
│                                                       │
│  [Cancel]                          [Submit Rejection]│
│                                                       │
└─────────────────────────────────────────────────────┘
```

**API Call:**
```javascript
const rejectDriver = async (driverId, reason) => {
  try {
    const response = await fetch(
      `/api/admin/drivers/${driverId}/reject`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Rejection failed:', error);
    throw error;
  }
};
```

---

### 5. Image Viewer Component

**Required:** For viewing license and document images

**Features:**
- ✓ Thumbnail view in list/details
- ✓ Click to open full-size view
- ✓ Zoom in/out functionality
- ✓ Download option
- ✓ Close button
- ✓ Navigation between multiple images (if viewing documents)

**Example Library:** Use existing image viewer like `react-image-lightbox` or similar

---

### 6. Additional Nice-to-Have Features

**Statistics Dashboard:**
- Total pending approvals count (badge)
- Average approval time
- Today's approvals/rejections count

**Filters:**
- By vehicle type
- By registration date range
- By document expiry status

**Notifications:**
- Real-time notification when new driver registers
- Desktop notification support
- Badge count on sidebar menu

**Bulk Actions:**
- Select multiple drivers
- Bulk approve (with caution)
- Export pending list to CSV

---

## Error Handling

### Common Error Scenarios

**1. Network Errors**
```javascript
try {
  const data = await fetchPendingDrivers();
} catch (error) {
  if (error.message === 'Failed to fetch') {
    showToast('Network error. Please check your connection.', 'error');
  }
}
```

**2. Authentication Errors (401)**
```javascript
if (response.status === 401) {
  // Token expired or invalid
  showToast('Session expired. Please login again.', 'error');
  redirectToLogin();
}
```

**3. Authorization Errors (403)**
```javascript
if (response.status === 403) {
  showToast('You do not have permission to perform this action.', 'error');
}
```

**4. Validation Errors (400)**
```javascript
if (response.status === 400) {
  const error = await response.json();
  showToast(error.message, 'error');
  // e.g., "Rejection reason is required"
}
```

**5. Server Errors (500)**
```javascript
if (response.status === 500) {
  showToast('Server error. Please try again later.', 'error');
  logErrorToMonitoring(error);
}
```

---

## Testing Scenarios

### Manual Testing Checklist

#### Test 1: View Pending Drivers
- [ ] Navigate to pending drivers page
- [ ] Verify all pending drivers are displayed
- [ ] Check pagination works correctly
- [ ] Verify search/filter functionality
- [ ] Confirm data is properly formatted

#### Test 2: View Driver Details
- [ ] Click on a pending driver
- [ ] Verify all information is displayed
- [ ] Check license image loads and is viewable
- [ ] Verify all vehicle documents load
- [ ] Check expiry date warnings show correctly

#### Test 3: Approve Driver
- [ ] Click "Approve" button
- [ ] Verify confirmation dialog appears
- [ ] Confirm approval
- [ ] Check success message appears
- [ ] Verify driver removed from pending list
- [ ] Confirm driver can now login on mobile app

#### Test 4: Reject Driver
- [ ] Click "Reject" button
- [ ] Verify rejection reason dialog appears
- [ ] Try submitting without reason (should fail)
- [ ] Enter valid reason and submit
- [ ] Check success message appears
- [ ] Verify driver removed from pending list
- [ ] Confirm driver sees rejection reason on mobile app

#### Test 5: Error Scenarios
- [ ] Test with expired auth token (should redirect to login)
- [ ] Test approving already approved driver (should show error)
- [ ] Test rejecting already rejected driver (should show error)
- [ ] Test with invalid driver ID (should show error)
- [ ] Test network failure handling

#### Test 6: Edge Cases
- [ ] Driver with no email
- [ ] Driver with no profile image
- [ ] Driver with expired license
- [ ] Driver with expired vehicle documents
- [ ] Driver with minimum required documents (1 doc)
- [ ] Very long names/text fields
- [ ] Special characters in reason text

---

## Implementation Checklist

### Backend (Already Complete ✅)
- [x] Driver registration endpoint with validation
- [x] Approval status workflow in User model
- [x] Get pending drivers endpoint
- [x] Approve driver endpoint
- [x] Reject driver endpoint
- [x] Audit logging for all actions
- [x] Middleware checks for approval status
- [x] Proper error handling

### Frontend (Needs Implementation ❌)
- [ ] Pending drivers list page
- [ ] Driver details modal/page
- [ ] Image viewer component
- [ ] Approve confirmation dialog
- [ ] Reject reason dialog
- [ ] API integration functions
- [ ] Error handling and toasts
- [ ] Loading states
- [ ] Pagination controls
- [ ] Search/filter functionality
- [ ] Statistics dashboard (optional)
- [ ] Notifications (optional)

---

## Quick Start Integration Guide

### Step 1: Create API Service File
Create `src/services/driverApprovalService.js`:

```javascript
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

export const driverApprovalService = {
  // Get pending drivers
  getPending: async (page = 1, limit = 20) => {
    const response = await fetch(
      `${API_BASE}/admin/drivers/pending?page=${page}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch pending drivers');
    }

    return response.json();
  },

  // Approve driver
  approve: async (driverId) => {
    const response = await fetch(
      `${API_BASE}/admin/drivers/${driverId}/approve`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to approve driver');
    }

    return response.json();
  },

  // Reject driver
  reject: async (driverId, reason) => {
    const response = await fetch(
      `${API_BASE}/admin/drivers/${driverId}/reject`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to reject driver');
    }

    return response.json();
  },
};
```

### Step 2: Create Pending Drivers Page
Create `src/pages/admin/PendingDrivers.jsx` with:
- List view using the service
- Pagination controls
- Click handler to open driver details

### Step 3: Create Driver Detail Modal
Create `src/components/admin/DriverDetailModal.jsx` with:
- Display all driver information
- Image viewer for documents
- Approve/Reject buttons with handlers

### Step 4: Add Route
Add to your admin routes:
```javascript
<Route path="/admin/drivers/pending" element={<PendingDrivers />} />
```

### Step 5: Add Navigation Link
Add to admin sidebar:
```javascript
<NavLink to="/admin/drivers/pending">
  Pending Approvals {pendingCount > 0 && <Badge>{pendingCount}</Badge>}
</NavLink>
```

---

## Support & Questions

**Backend Files Reference:**
- User Schema: [schema/user.schema.js](schema/user.schema.js)
- Auth Controller: [src/auth/auth.controller.js](src/auth/auth.controller.js:217-322)
- Admin Controller: [src/admin/admin.controller.js](src/admin/admin.controller.js:458-602)
- Admin Routes: [src/admin/admin.routes.js](src/admin/admin.routes.js:195-223)
- Auth Middleware: [middlewares/auth.middleware.js](middlewares/auth.middleware.js)

**Testing the API:**
You can test all endpoints using tools like:
- Postman
- cURL
- Insomnia
- REST Client (VS Code extension)

**Example cURL Commands:**

Get Pending Drivers:
```bash
curl -X GET "http://localhost:4000/api/admin/drivers/pending?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Approve Driver:
```bash
curl -X PATCH "http://localhost:4000/api/admin/drivers/DRIVER_ID/approve" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Reject Driver:
```bash
curl -X PATCH "http://localhost:4000/api/admin/drivers/DRIVER_ID/reject" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "License document is unclear"}'
```

---

## Document Version
- **Version:** 1.0
- **Last Updated:** January 17, 2026
- **Backend Status:** Fully Implemented ✅
- **Admin UI Status:** Needs Integration ❌

---

*This documentation covers the complete driver registration and approval workflow. All backend endpoints are fully functional and ready for frontend integration.*
