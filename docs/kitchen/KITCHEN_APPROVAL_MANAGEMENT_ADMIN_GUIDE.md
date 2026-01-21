# Kitchen Approval Management - Admin Integration Guide

## Table of Contents
1. [Implementation Prompts for Claude (START HERE)](#implementation-prompts-for-claude-start-here)
2. [Overview](#overview)
3. [Backend Analysis & Inconsistencies Fixed](#backend-analysis--inconsistencies-fixed)
4. [Kitchen Approval Workflow](#kitchen-approval-workflow)
5. [API Endpoints Reference](#api-endpoints-reference)
6. [Data Models](#data-models)
7. [UI Requirements](#ui-requirements)
8. [Error Handling](#error-handling)
9. [Testing Scenarios](#testing-scenarios)
10. [Implementation Checklist](#implementation-checklist)

---

## IMPLEMENTATION PROMPTS FOR CLAUDE (START HERE)

Use these prompts sequentially to build the Kitchen Approval Management UI. Each prompt is self-contained and can be copy-pasted directly to Claude in your frontend project.

### Prompt 1: Setup Kitchen Service Layer

```
I need to create a service layer for kitchen approval management in my React admin app.

Create a new file at `src/services/kitchenService.js` with the following API functions:

1. getPendingKitchens(page, limit) - GET /api/admin/kitchens/pending
2. getKitchenById(id) - GET /api/kitchens/:id
3. approveKitchen(id) - PATCH /api/admin/kitchens/:id/approve
4. rejectKitchen(id, reason) - PATCH /api/admin/kitchens/:id/reject
5. getAllKitchens(filters) - GET /api/kitchens with query params (status, type, zone, search)
6. activateKitchen(id) - PATCH /api/kitchens/:id/activate
7. deactivateKitchen(id) - PATCH /api/kitchens/:id/deactivate
8. suspendKitchen(id, reason) - PATCH /api/kitchens/:id/suspend

Each function should:
- Use axios with the base URL from env variables
- Include JWT token from localStorage in Authorization header
- Handle errors with try-catch
- Return { success, data, message, error } format
- Include proper TypeScript/JSDoc comments

Example structure:
```javascript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const getAuthHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  },
});

export const kitchenService = {
  async getPendingKitchens(page = 1, limit = 20) {
    try {
      const response = await axios.get(
        `${API_URL}/api/admin/kitchens/pending?page=${page}&limit=${limit}`,
        getAuthHeaders()
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch pending kitchens',
        error
      };
    }
  },

  // Implement remaining 7 functions following the same pattern
};
```

Make sure all functions follow REST conventions and handle pagination where applicable.
```

### Prompt 2: Create Pending Kitchens Approval Page

```
I need to create a Pending Kitchens page for admins to review and approve/reject kitchen registration requests.

Create `src/pages/admin/PendingKitchens.jsx` with these features:

**Layout:**
- Page title: "Pending Kitchen Approvals"
- Subtitle showing total pending count
- Grid/list view of pending kitchens (cards)

**Kitchen Card displays:**
- Kitchen logo (with fallback icon)
- Kitchen name (bold, large)
- Type badge (TIFFSY/PARTNER with color coding)
- Address (city, locality)
- Contact phone and email
- Owner name and phone (if PARTNER)
- Zones served (as badges)
- Cuisines offered (as chips)
- Submitted date (relative time: "2 days ago")
- Two action buttons: "Review Details" (primary), "Quick Approve" (success)

**Features needed:**
1. Pagination (20 per page)
2. Loading state (skeleton cards)
3. Empty state ("No pending approvals")
4. Error handling with retry button
5. Search filter by kitchen name
6. Filter by type (TIFFSY/PARTNER)
7. Sort by date (newest/oldest)
8. Refresh button to reload data

**Interactions:**
- Click "Review Details" → Opens detailed modal with approve/reject options
- Click "Quick Approve" → Shows quick confirmation dialog, then approves

Use React hooks (useState, useEffect), React Router, and include:
- Responsive design (mobile-friendly grid)
- Accessibility (ARIA labels, keyboard navigation)
- Toast notifications for success/error

The page should fetch data using `kitchenService.getPendingKitchens()` on mount and when filters change.
```

### Prompt 3: Create Kitchen Detail Review Modal

```
I need a detailed review modal for examining kitchen applications before approval/rejection.

Create `src/components/admin/KitchenDetailModal.jsx` that receives a kitchen object as prop.

**Modal Structure:**

**Header:**
- Kitchen name (large, bold)
- Type badge (TIFFSY/PARTNER)
- Close button (X)

**Content Tabs:**
1. **Basic Info Tab:**
   - Logo and cover image preview
   - Description
   - Cuisine types (as badges)
   - Special flags (authorized, premium, gourmet) with checkmarks

2. **Contact & Location Tab:**
   - Full address (formatted, with map link option)
   - Contact phone and email (clickable)
   - Owner details (name, phone) for PARTNER kitchens
   - Zones served (with zone names if populated)

3. **Documents Tab:** (⚠️ NOT YET IMPLEMENTED IN BACKEND)
   - Placeholder message: "Document verification coming soon"
   - Show expected documents: FSSAI License, Business Registration, Food License
   - Display upload status: "Not submitted"

4. **Operating Hours Tab:**
   - Table showing lunch/dinner/onDemand timings
   - Indicate if "Always Open" for onDemand

5. **System Info Tab:**
   - Kitchen code (if generated)
   - Created date (full timestamp)
   - Status: PENDING_APPROVAL (badge)
   - isAcceptingOrders flag

**Footer Actions:**
- "Reject" button (danger, left) → Opens rejection dialog
- "Approve" button (success, right) → Opens approval confirmation
- "Cancel" button (secondary, center)

**Features:**
- Modal should be responsive (full screen on mobile)
- Tab navigation with keyboard support
- Image viewer for logo/cover (click to enlarge)
- Copy button for kitchen code
- Loading state while fetching kitchen details

Use React Modal library or custom modal with portal, include transitions and backdrop click to close.
```

### Prompt 4: Create Approve Kitchen Confirmation Dialog

```
I need a simple confirmation dialog for approving kitchens.

Create `src/components/admin/ApproveKitchenDialog.jsx` that receives:
- isOpen (boolean)
- kitchen (object with name, type)
- onConfirm (function)
- onCancel (function)

**Dialog content:**
- Title: "Approve Kitchen Registration"
- Icon: Success/check icon (green)
- Message: "Are you sure you want to approve **{kitchen.name}**?"
- Sub-message: "This kitchen will be activated and can start accepting orders immediately."
- Warning note (if PARTNER): "⚠️ Ensure all background checks and document verification are complete."

**Actions:**
- "Cancel" button (secondary, left)
- "Approve Kitchen" button (success, right) with loading spinner when clicked

**Behavior:**
- Call `kitchenService.approveKitchen(kitchen._id)` on confirm
- Show loading state during API call
- On success:
  - Show toast "Kitchen approved successfully"
  - Call onConfirm callback to refresh parent data
  - Close dialog
- On error:
  - Show error toast with message
  - Keep dialog open
  - Show retry option

Include form validation, accessibility (focus trap, ESC to close), and use a dialog/modal component library or native dialog element.
```

### Prompt 5: Create Reject Kitchen Dialog with Reason

```
I need a rejection dialog that captures a reason for rejecting a kitchen application.

Create `src/components/admin/RejectKitchenDialog.jsx` that receives:
- isOpen (boolean)
- kitchen (object)
- onConfirm (function)
- onCancel (function)

**Dialog content:**
- Title: "Reject Kitchen Registration"
- Icon: Warning icon (red)
- Kitchen name display
- Required text area for rejection reason
  - Label: "Rejection Reason *"
  - Placeholder: "Please provide a detailed reason for rejection..."
  - Min length: 10 characters
  - Max length: 500 characters
  - Character counter
- Helper text: "This reason will be visible to the kitchen owner."

**Common Rejection Templates (Quick Select):**
- "Incomplete documentation"
- "Failed background verification"
- "Duplicate kitchen registration"
- "Location not serviceable"
- "Does not meet food safety standards"
- Custom reason (user types)

**Actions:**
- "Cancel" button (secondary)
- "Reject Kitchen" button (danger, disabled until valid reason entered)

**Behavior:**
- Validate reason is not empty and meets length requirements
- Call `kitchenService.rejectKitchen(kitchen._id, reason)` on submit
- Show loading state during API call
- On success:
  - Show toast "Kitchen rejected"
  - Call onConfirm callback
  - Close dialog
  - Clear form
- On error:
  - Show error message
  - Keep dialog open

Include form validation with real-time error messages, accessibility features, and confirmation prompt if user tries to close with unsaved text.
```

### Prompt 6: Create Kitchen Status Management Page

```
I need a comprehensive kitchen management page showing all kitchens with filtering and status management.

Create `src/pages/admin/KitchenManagement.jsx` with these features:

**Page Header:**
- Title: "Kitchen Management"
- Stats cards row:
  - Total Kitchens
  - Active Kitchens
  - Pending Approval
  - Suspended

**Filters Bar:**
- Search by name (debounced)
- Status filter dropdown (All, ACTIVE, INACTIVE, SUSPENDED, PENDING_APPROVAL, DELETED)
- Type filter (All, TIFFSY, PARTNER)
- Zone filter dropdown (multi-select)
- Clear filters button

**Kitchen Table/List:**
Columns:
1. Kitchen (logo + name + code)
2. Type (TIFFSY/PARTNER badge)
3. Status (colored badge)
4. Zones Served (count with expand)
5. Contact (phone/email)
6. Created Date
7. Actions (dropdown menu)

**Actions Menu per kitchen:**
- View Details
- Edit Kitchen (if needed)
- Activate (if PENDING_APPROVAL or INACTIVE)
- Deactivate (if ACTIVE)
- Suspend (if ACTIVE, requires reason)
- View Orders
- View Menu Items

**Features:**
- Pagination with page size selector (10, 20, 50)
- Sorting by name, created date, status
- Bulk selection with batch actions (future)
- Export to CSV button
- Loading states (skeleton table)
- Empty state with "Create Kitchen" CTA
- Refresh button

**Interactions:**
- Click kitchen name → Opens detail modal
- Status change actions → Show confirmation dialogs
- All actions update table without full page reload
- Toast notifications for all actions

Use `kitchenService.getAllKitchens(filters)` with proper filter serialization. Include mobile-responsive table (cards on mobile).
```

### Prompt 7: Create Suspend Kitchen Dialog

```
I need a dialog for suspending kitchens with a reason (similar to reject, but for already active kitchens).

Create `src/components/admin/SuspendKitchenDialog.jsx` that receives:
- isOpen (boolean)
- kitchen (object)
- onConfirm (function)
- onCancel (function)

**Dialog content:**
- Title: "Suspend Kitchen Operations"
- Icon: Warning icon (orange)
- Kitchen name and current status display
- Required text area for suspension reason
  - Label: "Suspension Reason *"
  - Placeholder: "Specify the reason for suspension..."
  - Min: 10 chars, Max: 500 chars
- Warning message: "⚠️ This kitchen will immediately stop receiving orders."

**Common Suspension Reasons (Quick Select):**
- "Food safety violation"
- "Customer complaints"
- "Quality issues"
- "License expired"
- "Operational non-compliance"
- "Under investigation"
- Custom reason

**Actions:**
- "Cancel" button (secondary)
- "Suspend Kitchen" button (warning/danger, disabled until valid)

**Behavior:**
- Validate reason requirements
- Call `kitchenService.suspendKitchen(kitchen._id, reason)` on submit
- Loading state during API call
- Success: Toast + callback + close
- Error: Show error, keep open

Include validation, accessibility, and state management similar to reject dialog.
```

### Prompt 8: Create Kitchen Routes and Navigation

```
I need to integrate all kitchen management pages into the admin app routing and navigation.

**1. Update `src/App.jsx` or router configuration:**

Add these routes under admin-protected routes:
- `/admin/kitchens/pending` → PendingKitchens page
- `/admin/kitchens` → KitchenManagement page
- `/admin/kitchens/:id` → Kitchen detail view (optional)

**2. Update admin sidebar navigation:**

Add Kitchen Management section to `src/components/AdminSidebar.jsx`:

```javascript
{
  title: 'Kitchen Management',
  icon: <RestaurantIcon />, // or chef hat icon
  items: [
    {
      title: 'Pending Approvals',
      path: '/admin/kitchens/pending',
      icon: <PendingIcon />,
      badge: pendingKitchensCount, // dynamic count
    },
    {
      title: 'All Kitchens',
      path: '/admin/kitchens',
      icon: <ListIcon />,
    },
  ],
}
```

**3. Add badge counter for pending kitchens:**

Create a hook `src/hooks/usePendingKitchensCount.js`:
- Fetches pending count from API on mount
- Polls every 30 seconds for updates
- Returns { count, loading, error }
- Use this in sidebar to show pending count badge

**4. Add breadcrumbs:**

Update breadcrumb component to show:
- Admin → Kitchens → Pending Approvals
- Admin → Kitchens → All Kitchens

**5. Protected route wrapper:**

Ensure routes use admin authentication:
```javascript
<Route
  path="/admin/kitchens/*"
  element={
    <RequireAuth roles={['ADMIN']}>
      <Routes>
        <Route path="pending" element={<PendingKitchens />} />
        <Route path="" element={<KitchenManagement />} />
      </Routes>
    </RequireAuth>
  }
/>
```

Test navigation, ensure back button works, and active states are highlighted in sidebar.
```

### Prompt 9: Add Document Upload UI (Placeholder for Future)

```
The backend does NOT currently support kitchen document uploads (FSSAI, business registration, etc.). However, we need to prepare the UI structure for when it's implemented.

Create `src/components/admin/KitchenDocumentsSection.jsx` as a placeholder component:

**Display:**
- Section title: "Kitchen Documents (Verification Pending)"
- Info banner: "📋 Document verification system is under development. Currently, kitchen documents are verified manually offline."

**Expected Documents List (read-only for now):**
1. **FSSAI License**
   - Status: Not Submitted
   - Required: Yes
   - Description: Food Safety and Standards Authority of India license

2. **Business Registration**
   - Status: Not Submitted
   - Required: Yes
   - Description: Shop establishment or GST registration

3. **Food License**
   - Status: Not Submitted
   - Required: Yes
   - Description: State food license certificate

4. **Bank Account Proof**
   - Status: Not Submitted
   - Required: Yes
   - Description: Cancelled cheque or bank statement

5. **Owner ID Proof**
   - Status: Not Submitted
   - Required: For PARTNER kitchens
   - Description: Aadhaar, PAN, or Passport

**Future Integration Note:**
- Add comment in code: "TODO: Integrate with document upload API when available"
- Structure component to easily add document viewer/uploader later
- Include sample data structure for documents:

```javascript
// Future document structure
const documentSchema = {
  type: 'FSSAI_LICENSE',
  imageUrl: 'https://...',
  expiryDate: '2025-12-31',
  verificationStatus: 'PENDING', // PENDING, APPROVED, REJECTED
  uploadedAt: '2024-01-15',
  verifiedBy: null,
  verifiedAt: null,
  rejectionReason: null
}
```

For now, show this section in the Kitchen Detail Modal as a disabled/coming-soon state. This sets expectations for admins and prepares the UI for future backend integration.
```

### Prompt 10: Add Real-time Updates and Polish

```
I need to add real-time features and polish to the kitchen approval management system.

**1. Add real-time notification polling:**

Create `src/hooks/useKitchenUpdates.js`:
- Poll for pending kitchens count every 30 seconds
- Compare with previous count
- Show browser notification when new kitchen registration arrives
- Play subtle sound (optional)
- Update sidebar badge automatically

**2. Add optimistic UI updates:**

In approval/rejection actions:
- Immediately update local state (optimistic)
- Show loading indicator on the specific kitchen card
- If API call fails, revert the change and show error
- If success, keep the optimistic update

**3. Add activity log:**

Create `src/components/admin/KitchenActivityLog.jsx`:
- Shows recent admin actions on kitchens
- Displays: timestamp, admin name, action (approved/rejected/suspended), kitchen name
- Fetch from audit logs if available
- Show last 50 activities with pagination

**4. Add data export:**

Add export functionality to Kitchen Management page:
- "Export to CSV" button
- Exports current filtered/sorted kitchen list
- Includes: name, code, type, status, zones, contact, created date
- Use library like 'papaparse' or 'json2csv'
- Download as `kitchens-export-YYYY-MM-DD.csv`

**5. Add keyboard shortcuts:**

- `Ctrl/Cmd + K` → Focus search input
- `Ctrl/Cmd + R` → Refresh data
- `Escape` → Close modals/dialogs
- Arrow keys → Navigate through kitchen cards/rows

**6. Add loading skeletons:**

Replace generic spinners with skeleton loaders:
- Kitchen card skeleton (shimmer effect)
- Table row skeleton
- Modal content skeleton
- Make skeletons match actual content layout

**7. Performance optimizations:**

- Implement React.memo on kitchen card components
- Add virtualization for large kitchen lists (react-window)
- Debounce search input (300ms)
- Cache kitchen details after first load
- Add stale-while-revalidate pattern for data fetching

**8. Accessibility improvements:**

- Add ARIA live regions for notifications
- Ensure all interactive elements are keyboard accessible
- Add skip links for screen readers
- Test with screen reader (NVDA/JAWS)
- Add focus indicators (visible outline on focus)

**9. Mobile responsiveness:**

- Test all pages on mobile (375px width)
- Ensure tables become scrollable cards on mobile
- Make modals full-screen on mobile
- Add swipe gestures for modal close (optional)
- Test touch interactions for all buttons

**10. Error boundary:**

Wrap kitchen management section in error boundary:
- Catch rendering errors
- Show friendly error page
- Provide "Try again" button
- Log errors to monitoring service (Sentry, LogRocket)

After these improvements, the Kitchen Approval Management system will be production-ready with excellent UX!
```

---

## Overview

### What is Kitchen Approval Management?

Kitchen Approval Management is the administrative system for reviewing, verifying, and approving cloud kitchen registrations before they can operate on the Tiffsy platform. Similar to driver approval, this ensures only verified and compliant kitchens can serve customers.

### Key Components

1. **Kitchen Registration**: Kitchens (PARTNER type) register and enter PENDING_APPROVAL status
2. **Admin Review**: Admins review kitchen details, documentation, and background
3. **Approval/Rejection**: Admins approve (ACTIVE status) or reject with reason
4. **Operation Blocking**: Kitchens in PENDING_APPROVAL cannot accept orders
5. **Status Management**: Ongoing monitoring with activate, deactivate, suspend actions

### User Roles Involved

- **ADMIN**: Reviews and approves/rejects kitchens
- **KITCHEN_STAFF**: Can view their kitchen but operations are blocked until approved

---

## Backend Analysis & Inconsistencies Fixed

### Current Backend Implementation Status

✅ **Implemented Features:**
- Kitchen schema with PENDING_APPROVAL status
- Auto-assignment of status based on type (TIFFSY=ACTIVE, PARTNER=PENDING_APPROVAL)
- Activate kitchen endpoint with approval metadata tracking
- Order blocking for non-ACTIVE kitchens
- Suspension with reason tracking

⚠️ **Missing/Inconsistent Features:**
- ❌ No dedicated rejection endpoint (admin.controller.js)
- ❌ No pending kitchens list endpoint (admin routes)
- ❌ No document fields in kitchen schema (FSSAI, licenses)
- ❌ No rejection reason tracking for kitchens
- ❌ Status field mixing approval and operational concerns
- ❌ No login/access blocking for PENDING_APPROVAL kitchen staff

### Recommended Backend Fixes (Already Documented)

The following backend enhancements are recommended to achieve parity with the driver approval system:

#### 1. Add Kitchen Documents to Schema

**File:** `schema/kitchen.schema.js`

Add before line 187 (status field):

```javascript
// Kitchen Documents (for Partner kitchens)
documents: {
  fssaiLicense: {
    licenseNumber: String,
    imageUrl: String,
    expiryDate: Date,
  },
  businessRegistration: {
    registrationType: {
      type: String,
      enum: ["SHOP_ESTABLISHMENT", "GST", "COMPANY_REGISTRATION", "OTHER"],
    },
    registrationNumber: String,
    imageUrl: String,
  },
  foodLicense: {
    licenseNumber: String,
    imageUrl: String,
    expiryDate: Date,
  },
  bankProof: {
    accountHolderName: String,
    accountNumber: String,
    ifscCode: String,
    imageUrl: String, // Cancelled cheque or bank statement
  },
  ownerIdProof: {
    idType: {
      type: String,
      enum: ["AADHAAR", "PAN", "PASSPORT", "DRIVING_LICENSE"],
    },
    idNumber: String,
    imageUrl: String,
  },
  additionalDocuments: [
    {
      documentType: String,
      imageUrl: String,
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
},

// Approval Details (separate from operational status)
approvalDetails: {
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  approvedAt: Date,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  rejectedAt: Date,
  rejectionReason: String,
},
```

#### 2. Add Admin Approval Endpoints

**File:** `src/admin/admin.routes.js`

Add around line 223 (after driver routes):

```javascript
// Kitchen Approval Management
router.get("/kitchens/pending", adminController.getPendingKitchens);
router.patch("/kitchens/:id/approve", adminController.approveKitchen);
router.patch("/kitchens/:id/reject", adminController.rejectKitchen);
```

#### 3. Add Admin Kitchen Controller Functions

**File:** `src/admin/admin.controller.js`

Add these functions after driver approval functions (after line 602):

```javascript
/**
 * Get pending kitchen registrations
 * @route GET /api/admin/kitchens/pending
 * @access Admin
 */
export async function getPendingKitchens(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = {
      status: "PENDING_APPROVAL",
    };

    const [kitchens, total] = await Promise.all([
      Kitchen.find(query)
        .populate("zonesServed", "name code")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Kitchen.countDocuments(query),
    ]);

    return sendResponse(res, 200, true, "Pending kitchens retrieved", {
      kitchens,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.log("Get pending kitchens error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve pending kitchens");
  }
}

/**
 * Approve a kitchen registration
 * @route PATCH /api/admin/kitchens/:id/approve
 * @access Admin
 */
export async function approveKitchen(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const kitchen = await Kitchen.findById(id);
    if (!kitchen) {
      return sendResponse(res, 404, false, "Kitchen not found");
    }

    if (kitchen.status === "ACTIVE") {
      return sendResponse(res, 400, false, "Kitchen is already approved");
    }

    // Update status and approval details
    kitchen.status = "ACTIVE";
    kitchen.approvalDetails = {
      approvedBy: adminId,
      approvedAt: new Date(),
    };

    // Alternative: if you added approvedBy/approvedAt directly to schema (current implementation)
    // kitchen.approvedBy = adminId;
    // kitchen.approvedAt = new Date();

    await kitchen.save();

    // Log audit
    safeAuditCreate({
      action: "APPROVE_KITCHEN",
      entityType: "KITCHEN",
      entityId: kitchen._id,
      performedBy: adminId,
      details: { kitchenName: kitchen.name, type: kitchen.type },
    });

    return sendResponse(res, 200, true, "Kitchen approved successfully", {
      kitchen,
    });
  } catch (error) {
    console.log("Approve kitchen error:", error);
    return sendResponse(res, 500, false, "Failed to approve kitchen");
  }
}

/**
 * Reject a kitchen registration
 * @route PATCH /api/admin/kitchens/:id/reject
 * @access Admin
 */
export async function rejectKitchen(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    if (!reason) {
      return sendResponse(res, 400, false, "Rejection reason is required");
    }

    const kitchen = await Kitchen.findById(id);
    if (!kitchen) {
      return sendResponse(res, 404, false, "Kitchen not found");
    }

    if (kitchen.status === "DELETED") {
      return sendResponse(res, 400, false, "Kitchen is already deleted");
    }

    // Update status and rejection details
    kitchen.status = "INACTIVE"; // or create a new "REJECTED" status value
    kitchen.approvalDetails = {
      ...(kitchen.approvalDetails || {}),
      rejectedBy: adminId,
      rejectedAt: new Date(),
      rejectionReason: reason,
    };

    await kitchen.save();

    // Log audit
    safeAuditCreate({
      action: "REJECT_KITCHEN",
      entityType: "KITCHEN",
      entityId: kitchen._id,
      performedBy: adminId,
      details: { kitchenName: kitchen.name, type: kitchen.type, reason },
    });

    return sendResponse(res, 200, true, "Kitchen rejected", {
      kitchen,
    });
  } catch (error) {
    console.log("Reject kitchen error:", error);
    return sendResponse(res, 500, false, "Failed to reject kitchen");
  }
}
```

#### 4. Optional: Add REJECTED Status Value

**File:** `schema/kitchen.schema.js` (line 192)

Update enum values:

```javascript
enum: {
  values: ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_APPROVAL", "REJECTED", "DELETED"],
  message: "Invalid status",
},
```

This provides clearer distinction between rejected applications and deactivated kitchens.

#### 5. Add Kitchen Access Middleware

**File:** `src/kitchen/kitchen.controller.js`

Add validation in kitchen operations to block PENDING_APPROVAL kitchens:

```javascript
// Example: Block menu item creation for pending kitchens
export const createMenuItem = async (req, res) => {
  try {
    const kitchen = await Kitchen.findById(req.body.kitchenId);

    if (kitchen.status !== "ACTIVE") {
      return sendResponse(
        res,
        403,
        false,
        "Your kitchen registration is pending approval. You cannot create menu items until approved."
      );
    }

    // Continue with menu item creation...
  } catch (error) {
    // Error handling
  }
};
```

Apply similar checks to:
- Menu item management
- Order acceptance toggle
- Kitchen profile updates (allow viewing, block critical changes)

---

## Kitchen Approval Workflow

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    KITCHEN REGISTRATION FLOW                     │
└─────────────────────────────────────────────────────────────────┘

1. KITCHEN CREATION (Admin creates kitchen)
   ├─ POST /api/kitchens
   ├─ Input: name, type, address, zones, contact, owner details
   └─ Auto Status Assignment:
      ├─ If type === "TIFFSY" → status = "ACTIVE" (immediate)
      └─ If type === "PARTNER" → status = "PENDING_APPROVAL"

2. PENDING STATE (For PARTNER kitchens)
   ├─ Kitchen staff can login and view kitchen
   ├─ Kitchen CANNOT accept orders
   ├─ Kitchen CANNOT create menu items (recommended block)
   ├─ Shows message: "Your registration is pending admin approval"
   └─ Documents uploaded (if implemented)

3. ADMIN REVIEW
   ├─ Admin views pending kitchens list
   │  └─ GET /api/admin/kitchens/pending
   ├─ Admin reviews:
   │  ├─ Kitchen details (address, contact, zones)
   │  ├─ Owner information
   │  ├─ Documents (FSSAI, licenses) - if implemented
   │  └─ Background checks (offline process)
   └─ Admin decides: APPROVE or REJECT

4a. APPROVAL PATH
   ├─ Admin clicks "Approve"
   ├─ PATCH /api/admin/kitchens/:id/approve
   ├─ Status: PENDING_APPROVAL → ACTIVE
   ├─ Sets: approvedBy = Admin ID, approvedAt = Date
   ├─ Audit log created
   └─ Kitchen can now:
      ├─ Accept orders
      ├─ Create/manage menu items
      └─ Fully operational

4b. REJECTION PATH
   ├─ Admin enters rejection reason
   ├─ PATCH /api/admin/kitchens/:id/reject
   ├─ Status: PENDING_APPROVAL → INACTIVE (or REJECTED)
   ├─ Sets: rejectedBy = Admin ID, rejectedAt = Date, rejectionReason
   ├─ Audit log created
   └─ Kitchen staff sees rejection message with reason
      └─ Cannot operate, must contact admin

5. POST-APPROVAL MANAGEMENT
   ├─ PATCH /api/kitchens/:id/activate (reactivate)
   ├─ PATCH /api/kitchens/:id/deactivate (pause operations)
   ├─ PATCH /api/kitchens/:id/suspend (emergency block with reason)
   └─ DELETE /api/kitchens/:id (soft delete)

┌─────────────────────────────────────────────────────────────────┐
│                         STATUS STATES                            │
└─────────────────────────────────────────────────────────────────┘

PENDING_APPROVAL → Cannot accept orders, awaiting admin review
ACTIVE          → Fully operational, can accept orders
INACTIVE        → Paused operations (manual deactivation or rejection)
SUSPENDED       → Emergency block (with reason, e.g., violations)
REJECTED        → (Optional status) Application rejected
DELETED         → Soft delete (not shown in listings)
```

### Kitchen Staff Experience

**When PENDING_APPROVAL:**
- Login: ✅ Allowed
- View Dashboard: ✅ Allowed
- View Kitchen Details: ✅ Allowed
- Edit Kitchen: ⚠️ Limited (basic info only, recommended)
- Create Menu Items: ❌ Blocked (recommended)
- Accept Orders: ❌ Blocked (enforced)
- Banner Message: "⏳ Your kitchen registration is pending admin approval. You cannot accept orders until approved."

**When REJECTED:**
- All operations blocked
- Shows rejection reason
- Message: "❌ Your kitchen registration was rejected. Reason: {rejectionReason}. Please contact support."

**When ACTIVE:**
- Full access to all features
- Can accept orders
- Can manage menu items

### Admin Experience

**Pending Kitchens Dashboard:**
- Shows count of pending approvals
- Lists all PENDING_APPROVAL kitchens
- Quick filters: type, zone, date
- Bulk actions: approve multiple, export list

**Kitchen Detail Review:**
- View all kitchen information
- Check documents (when implemented)
- See creation date and submitter
- View zone assignments and coverage
- Access to contact owner directly

**Approval Actions:**
- One-click approve with confirmation
- Reject with mandatory reason (min 10 chars)
- Common rejection templates available
- Audit trail automatically logged

---

## API Endpoints Reference

### Admin Kitchen Approval Endpoints

#### 1. Get Pending Kitchens

**Endpoint:** `GET /api/admin/kitchens/pending`

**Authentication:** Required (Admin only)

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "message": "Pending kitchens retrieved",
  "data": {
    "kitchens": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Tasty Bites Kitchen",
        "code": "KIT-AB3C5",
        "type": "PARTNER",
        "status": "PENDING_APPROVAL",
        "address": {
          "addressLine1": "123 Main St",
          "locality": "Indiranagar",
          "city": "Bangalore",
          "state": "Karnataka",
          "pincode": "560038"
        },
        "contactPhone": "9876543210",
        "contactEmail": "contact@tastybites.com",
        "ownerName": "Raj Kumar",
        "ownerPhone": "9876543211",
        "zonesServed": [
          {
            "_id": "507f1f77bcf86cd799439012",
            "name": "Indiranagar Zone 1",
            "code": "ZONE-001"
          }
        ],
        "cuisineTypes": ["North Indian", "Chinese"],
        "logo": "https://...",
        "description": "Authentic North Indian cuisine",
        "authorizedFlag": false,
        "premiumFlag": false,
        "gourmetFlag": false,
        "createdBy": {
          "_id": "507f1f77bcf86cd799439013",
          "name": "Admin User",
          "email": "admin@tiffsy.com"
        },
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
- `500 Internal Server Error`: Server error

---

#### 2. Approve Kitchen

**Endpoint:** `PATCH /api/admin/kitchens/:id/approve`

**Authentication:** Required (Admin only)

**Path Parameters:**
- `id` (string, required): Kitchen ID

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "message": "Kitchen approved successfully",
  "data": {
    "kitchen": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Tasty Bites Kitchen",
      "status": "ACTIVE",
      "approvedBy": "507f1f77bcf86cd799439013",
      "approvedAt": "2024-01-16T14:25:00.000Z",
      "type": "PARTNER",
      // ... other fields
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Kitchen already approved
- `404 Not Found`: Kitchen not found
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
- `500 Internal Server Error`: Server error

---

#### 3. Reject Kitchen

**Endpoint:** `PATCH /api/admin/kitchens/:id/reject`

**Authentication:** Required (Admin only)

**Path Parameters:**
- `id` (string, required): Kitchen ID

**Request Body:**
```json
{
  "reason": "Incomplete documentation. FSSAI license expired."
}
```

**Validation:**
- `reason`: Required, string, min 10 characters, max 500 characters

**Response:**
```json
{
  "success": true,
  "message": "Kitchen rejected",
  "data": {
    "kitchen": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Tasty Bites Kitchen",
      "status": "INACTIVE",
      "approvalDetails": {
        "rejectedBy": "507f1f77bcf86cd799439013",
        "rejectedAt": "2024-01-16T14:30:00.000Z",
        "rejectionReason": "Incomplete documentation. FSSAI license expired."
      },
      // ... other fields
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing or invalid reason
- `404 Not Found`: Kitchen not found
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
- `500 Internal Server Error`: Server error

---

### Kitchen Management Endpoints (Existing)

#### 4. Get All Kitchens (with filters)

**Endpoint:** `GET /api/kitchens`

**Authentication:** Required (Admin)

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `status` (string): Filter by status (ACTIVE, INACTIVE, SUSPENDED, PENDING_APPROVAL, DELETED)
- `type` (string): Filter by type (TIFFSY, PARTNER)
- `zone` (string): Filter by zone ID
- `search` (string): Search by kitchen name

**Response:**
```json
{
  "success": true,
  "message": "Kitchens retrieved",
  "data": {
    "kitchens": [ /* array of kitchen objects */ ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

---

#### 5. Get Kitchen by ID

**Endpoint:** `GET /api/kitchens/:id`

**Authentication:** Required (Admin or Kitchen Staff of that kitchen)

**Path Parameters:**
- `id` (string, required): Kitchen ID

**Response:**
```json
{
  "success": true,
  "message": "Kitchen retrieved",
  "data": {
    "kitchen": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Tasty Bites Kitchen",
      // ... full kitchen object with populated fields
    }
  }
}
```

---

#### 6. Activate Kitchen

**Endpoint:** `PATCH /api/kitchens/:id/activate`

**Authentication:** Required (Admin only)

**Path Parameters:**
- `id` (string, required): Kitchen ID

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "message": "Kitchen activated",
  "data": {
    "kitchen": {
      "_id": "507f1f77bcf86cd799439011",
      "status": "ACTIVE",
      "approvedBy": "507f1f77bcf86cd799439013",
      "approvedAt": "2024-01-16T14:25:00.000Z"
    }
  }
}
```

**Note:** This is the existing implementation. Use the new `/api/admin/kitchens/:id/approve` endpoint for cleaner admin-specific approval flow.

---

#### 7. Deactivate Kitchen

**Endpoint:** `PATCH /api/kitchens/:id/deactivate`

**Authentication:** Required (Admin only)

**Path Parameters:**
- `id` (string, required): Kitchen ID

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "message": "Kitchen deactivated",
  "data": {
    "kitchen": {
      "_id": "507f1f77bcf86cd799439011",
      "status": "INACTIVE"
    }
  }
}
```

---

#### 8. Suspend Kitchen

**Endpoint:** `PATCH /api/kitchens/:id/suspend`

**Authentication:** Required (Admin only)

**Path Parameters:**
- `id` (string, required): Kitchen ID

**Request Body:**
```json
{
  "reason": "Food safety violation reported by customers"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Kitchen suspended",
  "data": {
    "kitchen": {
      "_id": "507f1f77bcf86cd799439011",
      "status": "SUSPENDED",
      "suspensionReason": "Food safety violation reported by customers"
    }
  }
}
```

---

#### 9. Delete Kitchen (Soft Delete)

**Endpoint:** `DELETE /api/kitchens/:id`

**Authentication:** Required (Admin only)

**Path Parameters:**
- `id` (string, required): Kitchen ID

**Response:**
```json
{
  "success": true,
  "message": "Kitchen deleted",
  "data": {
    "kitchen": {
      "_id": "507f1f77bcf86cd799439011",
      "status": "DELETED"
    }
  }
}
```

---

## Data Models

### Kitchen Schema

**Location:** `schema/kitchen.schema.js`

```javascript
{
  // Basic Information
  name: String (required, max 100 chars),
  code: String (unique, auto-generated, e.g., "KIT-AB3C5"),

  // Type & Flags
  type: String (enum: ["TIFFSY", "PARTNER"]),
  authorizedFlag: Boolean (default: false),
  premiumFlag: Boolean (default: false),
  gourmetFlag: Boolean (default: false),

  // Branding
  logo: String (URL),
  coverImage: String (URL),
  description: String (max 500 chars),
  cuisineTypes: [String],

  // Address
  address: {
    addressLine1: String (required),
    addressLine2: String,
    locality: String (required),
    city: String (required),
    state: String,
    pincode: String (required, 6 digits),
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },

  // Zone Serving
  zonesServed: [ObjectId] (ref: "Zone", required, min 1),

  // Operating Hours
  operatingHours: {
    lunch: { startTime: String, endTime: String },
    dinner: { startTime: String, endTime: String },
    onDemand: {
      startTime: String,
      endTime: String,
      isAlwaysOpen: Boolean
    }
  },

  // Contact
  contactPhone: String (10 digits, 6-9 start),
  contactEmail: String,

  // Owner/Manager (for Partner kitchens)
  ownerName: String,
  ownerPhone: String (10 digits, 6-9 start),

  // Status & Operations
  status: String (enum: ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_APPROVAL", "DELETED"]),
  isAcceptingOrders: Boolean (default: true),

  // Ratings
  averageRating: Number (0-5, default: 0),
  totalRatings: Number (default: 0),

  // Metadata
  createdBy: ObjectId (ref: "User"),
  approvedBy: ObjectId (ref: "User"),
  approvedAt: Date,

  // Timestamps
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

**Instance Methods:**
- `canAcceptOrders()`: Returns `true` if status is ACTIVE and isAcceptingOrders is true
- `servesZone(zoneId)`: Check if kitchen serves a specific zone

**Static Methods:**
- `generateKitchenCode()`: Generates unique kitchen code (KIT-XXXXX)
- `findActiveByZone(zoneId)`: Find all active kitchens in a zone
- `findPartnerByZone(zoneId)`: Find partner kitchen in a zone

**Indexes:**
- `{ name: "text" }` - Text search
- `{ type: 1 }` - Filter by type
- `{ status: 1 }` - Filter by status
- `{ zonesServed: 1 }` - Zone lookup
- `{ type: 1, status: 1 }` - Compound query
- `{ "address.city": 1 }` - City-based search

---

### Kitchen Documents Schema (Recommended Addition)

**To be added to Kitchen schema:**

```javascript
documents: {
  // FSSAI License (Required for all kitchens)
  fssaiLicense: {
    licenseNumber: String,
    imageUrl: String,
    expiryDate: Date
  },

  // Business Registration (Required)
  businessRegistration: {
    registrationType: String (enum: ["SHOP_ESTABLISHMENT", "GST", "COMPANY_REGISTRATION", "OTHER"]),
    registrationNumber: String,
    imageUrl: String
  },

  // Food License (State-specific, Required)
  foodLicense: {
    licenseNumber: String,
    imageUrl: String,
    expiryDate: Date
  },

  // Bank Account Proof (Required for payments)
  bankProof: {
    accountHolderName: String,
    accountNumber: String,
    ifscCode: String,
    imageUrl: String // Cancelled cheque or bank statement
  },

  // Owner ID Proof (Required for PARTNER kitchens)
  ownerIdProof: {
    idType: String (enum: ["AADHAAR", "PAN", "PASSPORT", "DRIVING_LICENSE"]),
    idNumber: String,
    imageUrl: String
  },

  // Additional Documents (Optional)
  additionalDocuments: [
    {
      documentType: String,
      imageUrl: String,
      uploadedAt: Date
    }
  ]
},

// Approval Details (Enhanced version)
approvalDetails: {
  approvedBy: ObjectId (ref: "User"),
  approvedAt: Date,
  rejectedBy: ObjectId (ref: "User"),
  rejectedAt: Date,
  rejectionReason: String
}
```

---

### User Schema (Kitchen Staff)

**Relevant fields for kitchen staff:**

```javascript
{
  role: "KITCHEN_STAFF",
  kitchenId: ObjectId (ref: "Kitchen"),
  // ... other user fields
}
```

**Access Control:**
- Kitchen staff can only access their assigned kitchen
- Check `user.kitchenId === kitchen._id` in middleware

---

### Audit Log Schema (for tracking approval actions)

**Used by:** `safeAuditCreate()` function

```javascript
{
  action: String (e.g., "APPROVE_KITCHEN", "REJECT_KITCHEN", "SUSPEND_KITCHEN"),
  entityType: String ("KITCHEN"),
  entityId: ObjectId (Kitchen ID),
  performedBy: ObjectId (Admin User ID),
  details: Object ({
    kitchenName: String,
    type: String,
    reason: String (for rejection/suspension)
  }),
  createdAt: Date
}
```

---

## UI Requirements

### Pending Kitchens Page

**Route:** `/admin/kitchens/pending`

**Components Needed:**
1. Page Header
   - Title: "Pending Kitchen Approvals"
   - Subtitle: Total count badge
   - Refresh button

2. Filters Bar
   - Search by name (debounced)
   - Type filter (TIFFSY/PARTNER)
   - Date range filter
   - Clear filters button

3. Kitchen Cards Grid
   - Responsive grid (3 cols desktop, 2 tablet, 1 mobile)
   - Each card shows:
     - Logo/placeholder
     - Kitchen name
     - Type badge
     - Location (city, locality)
     - Contact info
     - Submitted date (relative: "2 days ago")
     - Action buttons: "Review", "Quick Approve"

4. Pagination
   - Page numbers
   - Items per page selector (10, 20, 50)
   - Total count display

5. Empty State
   - Icon: Checkmark or empty list icon
   - Message: "No pending approvals"
   - Sub-message: "All kitchens are reviewed!"

**User Interactions:**
- Click "Review" → Opens detail modal
- Click "Quick Approve" → Shows confirmation, then approves
- Search updates results in real-time (debounced)
- Filters update URL query params
- Pagination persists filters

**Loading States:**
- Skeleton cards while loading
- Disable buttons during approval action
- Show spinner on specific card being approved

---

### Kitchen Detail Modal

**Triggered by:** Click "Review" on kitchen card

**Layout:**
- Full-screen overlay with centered modal
- Close button (X) at top-right
- Header: Kitchen name + type badge
- Tabs for organizing information
- Footer with action buttons

**Tabs:**

**1. Basic Info**
- Logo (large, with zoom on click)
- Cover image
- Description (full text)
- Cuisine types (badge list)
- Special flags (checkmarks for authorized, premium, gourmet)

**2. Contact & Location**
- Full address (formatted, copyable)
- Map embed or link to Google Maps
- Contact phone (clickable to call)
- Contact email (clickable to email)
- Owner name and phone (for PARTNER)
- Zones served (list with zone codes)

**3. Documents** (⚠️ Not Yet Implemented)
- Placeholder message: "Document verification coming soon"
- List expected documents:
  - FSSAI License
  - Business Registration
  - Food License
  - Bank Proof
  - Owner ID Proof
- Show status: "Not submitted"

**4. Operating Hours**
- Table format:
  - Meal Window | Start Time | End Time
  - Lunch | HH:MM | HH:MM
  - Dinner | HH:MM | HH:MM
  - On Demand | HH:MM | HH:MM (or "Always Open")
- Timezone indicator

**5. System Info**
- Kitchen code (with copy button)
- Created by (admin name)
- Created at (full timestamp)
- Status (PENDING_APPROVAL badge)
- isAcceptingOrders flag

**Footer Actions:**
- Left: "Reject" button (danger, red)
- Center: "Cancel" button (secondary, gray)
- Right: "Approve" button (success, green)

**Accessibility:**
- Focus trap within modal
- ESC key to close
- Tab navigation through elements
- ARIA labels on all buttons
- Screen reader announcements for tab changes

---

### Approve Kitchen Dialog

**Triggered by:** Click "Approve" in detail modal

**Content:**
- Success icon (green checkmark)
- Title: "Approve Kitchen Registration"
- Kitchen name display
- Confirmation message: "This kitchen will be activated and can start accepting orders immediately."
- Warning (if PARTNER): "Ensure all background checks and document verification are complete."

**Actions:**
- "Cancel" (secondary)
- "Approve Kitchen" (success, with loading spinner during API call)

**Behavior:**
- Calls `/api/admin/kitchens/:id/approve`
- On success: Close modal, show toast, refresh parent list
- On error: Show error message, keep dialog open

---

### Reject Kitchen Dialog

**Triggered by:** Click "Reject" in detail modal

**Content:**
- Warning icon (red)
- Title: "Reject Kitchen Registration"
- Kitchen name display
- Required text area:
  - Label: "Rejection Reason *"
  - Placeholder: "Please provide a detailed reason for rejection..."
  - Min 10 chars, Max 500 chars
  - Character counter
  - Real-time validation
- Helper text: "This reason will be visible to the kitchen owner."

**Quick Rejection Templates:**
- Buttons for common reasons:
  - "Incomplete documentation"
  - "Failed background verification"
  - "Duplicate registration"
  - "Location not serviceable"
  - "Does not meet food safety standards"
- Clicking a template fills the text area (user can edit)

**Actions:**
- "Cancel" (secondary)
- "Reject Kitchen" (danger, disabled until valid reason)

**Validation:**
- Required field
- Minimum 10 characters
- Show error message if invalid
- Disable submit button until valid

**Behavior:**
- Calls `/api/admin/kitchens/:id/reject` with reason
- On success: Close modal, show toast, refresh parent list
- On error: Show error, keep dialog open

---

### Kitchen Management Page

**Route:** `/admin/kitchens`

**Components:**

1. **Stats Cards Row**
   - Total Kitchens (count)
   - Active Kitchens (green badge)
   - Pending Approval (orange badge)
   - Suspended (red badge)

2. **Filters Bar**
   - Search by name
   - Status dropdown (All, ACTIVE, INACTIVE, SUSPENDED, PENDING_APPROVAL, DELETED)
   - Type dropdown (All, TIFFSY, PARTNER)
   - Zone multi-select
   - Clear filters button
   - Export CSV button

3. **Kitchen Table**
   - Columns:
     1. Kitchen (logo + name + code)
     2. Type (badge)
     3. Status (colored badge)
     4. Zones (count with tooltip)
     5. Contact
     6. Created Date
     7. Actions (dropdown menu)

   - Actions menu:
     - View Details
     - Activate (if not ACTIVE)
     - Deactivate (if ACTIVE)
     - Suspend (if ACTIVE)
     - View Orders
     - View Menu Items

4. **Pagination**
   - Same as pending page

**Features:**
- Sortable columns (name, created date, status)
- Bulk selection (checkbox per row)
- Mobile: Convert table to cards
- Loading: Skeleton rows
- Empty: "No kitchens found" with filters applied indicator

---

### Suspend Kitchen Dialog

**Similar to Reject Dialog but for active kitchens**

**Content:**
- Warning icon (orange)
- Title: "Suspend Kitchen Operations"
- Kitchen name + current status
- Warning: "This kitchen will immediately stop receiving orders."
- Required text area for suspension reason

**Quick Suspension Templates:**
- "Food safety violation"
- "Customer complaints"
- "Quality issues"
- "License expired"
- "Operational non-compliance"
- "Under investigation"

**Actions:**
- "Cancel"
- "Suspend Kitchen" (warning, orange/red)

**Behavior:**
- Calls `/api/kitchens/:id/suspend` with reason
- Updates kitchen status to SUSPENDED
- Logs audit entry

---

### Navigation Integration

**Admin Sidebar Updates:**

Add new section:
```
Kitchen Management
├─ Pending Approvals (badge with count)
└─ All Kitchens
```

**Breadcrumbs:**
- Admin → Kitchens → Pending Approvals
- Admin → Kitchens → All Kitchens
- Admin → Kitchens → [Kitchen Name]

**Badge Counter:**
- Real-time count of pending kitchens
- Poll API every 30 seconds
- Show notification when new kitchen registers

---

## Error Handling

### API Error Scenarios

1. **Authentication Errors**
   - 401 Unauthorized: Token missing or invalid
   - UI Action: Redirect to login

2. **Authorization Errors**
   - 403 Forbidden: User is not an admin
   - UI Action: Show "Access Denied" message

3. **Validation Errors**
   - 400 Bad Request: Missing or invalid fields (e.g., rejection reason too short)
   - UI Action: Show field-level error messages

4. **Not Found Errors**
   - 404 Not Found: Kitchen ID doesn't exist
   - UI Action: Show "Kitchen not found" toast, close modal

5. **Conflict Errors**
   - 400 Bad Request: Kitchen already approved/rejected
   - UI Action: Show warning toast, refresh data

6. **Server Errors**
   - 500 Internal Server Error: Backend failure
   - UI Action: Show "Something went wrong" toast, provide retry button

### Frontend Error Handling Patterns

**1. Service Layer Error Wrapping**
```javascript
export const kitchenService = {
  async approveKitchen(id) {
    try {
      const response = await axios.patch(`${API_URL}/api/admin/kitchens/${id}/approve`, {}, getAuthHeaders());
      return { success: true, data: response.data };
    } catch (error) {
      if (error.response?.status === 401) {
        // Redirect to login
        window.location.href = '/login';
        return { success: false, message: 'Authentication failed' };
      }

      if (error.response?.status === 404) {
        return { success: false, message: 'Kitchen not found' };
      }

      return {
        success: false,
        message: error.response?.data?.message || 'Failed to approve kitchen',
        error
      };
    }
  }
};
```

**2. Component-Level Error Display**
```javascript
const [error, setError] = useState(null);

const handleApprove = async () => {
  setError(null);
  setLoading(true);

  const result = await kitchenService.approveKitchen(kitchen._id);

  setLoading(false);

  if (!result.success) {
    setError(result.message);
    toast.error(result.message);
    return;
  }

  toast.success('Kitchen approved successfully');
  onSuccess();
};
```

**3. Global Error Boundary**
```javascript
// Wrap kitchen management routes in error boundary
<ErrorBoundary
  FallbackComponent={KitchenErrorFallback}
  onError={(error, info) => logErrorToService(error, info)}
>
  <Routes>
    <Route path="/admin/kitchens/*" element={<KitchenRoutes />} />
  </Routes>
</ErrorBoundary>
```

### User-Friendly Error Messages

**Replace technical messages with user-friendly ones:**

| Technical Error | User-Friendly Message |
|----------------|----------------------|
| "Kitchen not found" | "This kitchen no longer exists. It may have been deleted." |
| "Validation failed" | "Please check your input and try again." |
| "Unauthorized" | "Your session has expired. Please log in again." |
| "Kitchen already approved" | "This kitchen has already been approved by another admin." |
| "Server error" | "Something went wrong on our end. Please try again in a moment." |
| "Network error" | "Unable to connect. Please check your internet connection." |

### Retry Logic

**Implement exponential backoff for failed requests:**

```javascript
async function approveKitchenWithRetry(id, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const result = await kitchenService.approveKitchen(id);

    if (result.success) {
      return result;
    }

    // Don't retry on client errors (4xx)
    if (result.error?.response?.status >= 400 && result.error?.response?.status < 500) {
      return result;
    }

    // Exponential backoff for server errors
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }

  return { success: false, message: 'Failed after multiple retries' };
}
```

---

## Testing Scenarios

### Manual Testing Checklist

#### Pending Kitchens Page

- [ ] Page loads and displays pending kitchens correctly
- [ ] Pagination works (navigate between pages)
- [ ] Search filters results by kitchen name
- [ ] Type filter shows only TIFFSY or PARTNER kitchens
- [ ] Clear filters button resets all filters
- [ ] Refresh button reloads data
- [ ] Empty state shows when no pending kitchens
- [ ] Loading state shows while fetching data
- [ ] Kitchen cards display all information correctly
- [ ] "Review Details" button opens modal
- [ ] "Quick Approve" shows confirmation and approves kitchen

#### Kitchen Detail Modal

- [ ] Modal opens with correct kitchen data
- [ ] All tabs display information correctly
- [ ] Tab navigation works (keyboard and mouse)
- [ ] Logo/cover images display or show fallback
- [ ] Close button (X) closes modal
- [ ] ESC key closes modal
- [ ] Backdrop click closes modal
- [ ] "Approve" button opens approval dialog
- [ ] "Reject" button opens rejection dialog
- [ ] "Cancel" button closes modal

#### Approve Kitchen Dialog

- [ ] Dialog displays kitchen name correctly
- [ ] Warning shows for PARTNER kitchens
- [ ] "Cancel" button closes dialog
- [ ] "Approve Kitchen" button is enabled
- [ ] Clicking "Approve" shows loading spinner
- [ ] Success: Toast notification appears, modal closes, list refreshes
- [ ] Error: Error message displayed, dialog stays open
- [ ] Already approved: Shows appropriate error message

#### Reject Kitchen Dialog

- [ ] Dialog displays kitchen name correctly
- [ ] Text area is required and validated
- [ ] Character counter updates in real-time
- [ ] Minimum 10 characters enforced
- [ ] Maximum 500 characters enforced
- [ ] "Reject" button disabled when invalid
- [ ] Quick template buttons fill text area
- [ ] Success: Toast notification, modal closes, list refreshes
- [ ] Error: Error message displayed, dialog stays open

#### Kitchen Management Page

- [ ] Stats cards show correct counts
- [ ] Table displays all kitchens with correct data
- [ ] Search filter works
- [ ] Status filter works
- [ ] Type filter works
- [ ] Zone filter works (multi-select)
- [ ] Sorting by columns works
- [ ] Actions menu opens for each kitchen
- [ ] "Activate" action works for inactive/pending kitchens
- [ ] "Deactivate" action works for active kitchens
- [ ] "Suspend" action opens suspend dialog and works
- [ ] Export CSV button downloads correct data
- [ ] Pagination works
- [ ] Mobile view: Table converts to cards

#### Suspend Kitchen Dialog

- [ ] Dialog displays kitchen name and status
- [ ] Text area is required and validated
- [ ] Quick templates work
- [ ] Success: Kitchen status changes to SUSPENDED, toast shows
- [ ] Error: Handled gracefully

#### Navigation

- [ ] Sidebar shows "Kitchen Management" section
- [ ] Pending count badge displays correct number
- [ ] Badge updates when kitchens are approved/rejected
- [ ] Clicking menu items navigates to correct pages
- [ ] Breadcrumbs show correct path
- [ ] Active menu item is highlighted

#### Authorization

- [ ] Non-admin users cannot access kitchen management pages (redirect or 403)
- [ ] Admin users can access all features
- [ ] Session expiration redirects to login
- [ ] API calls include valid auth token

#### Edge Cases

- [ ] Empty pending list shows appropriate message
- [ ] Long kitchen names truncate properly
- [ ] Missing logo shows fallback icon
- [ ] Missing contact info displays "N/A"
- [ ] Large number of zones handled (scroll or show count)
- [ ] Multiple simultaneous approval attempts handled
- [ ] Network failure shows retry option
- [ ] Slow API responses show loading states

### Automated Testing Scenarios

**Unit Tests:**
```javascript
// kitchenService.test.js
describe('Kitchen Service', () => {
  it('should fetch pending kitchens with pagination', async () => {
    const result = await kitchenService.getPendingKitchens(1, 20);
    expect(result.success).toBe(true);
    expect(result.data.kitchens).toBeInstanceOf(Array);
    expect(result.data.pagination).toBeDefined();
  });

  it('should approve kitchen successfully', async () => {
    const result = await kitchenService.approveKitchen('kitchen-id-123');
    expect(result.success).toBe(true);
    expect(result.data.kitchen.status).toBe('ACTIVE');
  });

  it('should reject kitchen with reason', async () => {
    const reason = 'Incomplete documentation';
    const result = await kitchenService.rejectKitchen('kitchen-id-123', reason);
    expect(result.success).toBe(true);
  });

  it('should handle 404 error gracefully', async () => {
    const result = await kitchenService.approveKitchen('non-existent-id');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });
});
```

**Integration Tests:**
```javascript
// PendingKitchens.integration.test.js
describe('Pending Kitchens Page', () => {
  it('should load and display pending kitchens', async () => {
    render(<PendingKitchens />);

    await waitFor(() => {
      expect(screen.getByText('Pending Kitchen Approvals')).toBeInTheDocument();
    });

    expect(screen.getAllByRole('article')).toHaveLength(5); // 5 kitchens
  });

  it('should open detail modal when clicking Review', async () => {
    render(<PendingKitchens />);

    const reviewButton = await screen.findByText('Review Details');
    fireEvent.click(reviewButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Basic Info')).toBeInTheDocument(); // Tab
  });

  it('should approve kitchen and refresh list', async () => {
    render(<PendingKitchens />);

    const quickApproveButton = await screen.findByText('Quick Approve');
    fireEvent.click(quickApproveButton);

    const confirmButton = await screen.findByText('Approve Kitchen');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('Kitchen approved successfully')).toBeInTheDocument();
    });
  });
});
```

**E2E Tests (Playwright/Cypress):**
```javascript
// kitchen-approval.e2e.js
describe('Kitchen Approval Flow', () => {
  it('should complete full approval workflow', () => {
    cy.login('admin@tiffsy.com', 'admin123');

    cy.visit('/admin/kitchens/pending');
    cy.contains('Pending Kitchen Approvals').should('be.visible');

    // Click review on first kitchen
    cy.get('[data-testid="kitchen-card"]').first().within(() => {
      cy.contains('Review Details').click();
    });

    // Modal opens
    cy.get('[role="dialog"]').should('be.visible');
    cy.contains('Basic Info').click();

    // Approve kitchen
    cy.contains('button', 'Approve').click();
    cy.get('[role="dialog"]').within(() => {
      cy.contains('button', 'Approve Kitchen').click();
    });

    // Success notification
    cy.contains('Kitchen approved successfully').should('be.visible');

    // Kitchen removed from pending list
    cy.get('[data-testid="kitchen-card"]').should('have.length', 4); // One less
  });

  it('should reject kitchen with reason', () => {
    cy.login('admin@tiffsy.com', 'admin123');

    cy.visit('/admin/kitchens/pending');

    cy.get('[data-testid="kitchen-card"]').first().within(() => {
      cy.contains('Review Details').click();
    });

    cy.get('[role="dialog"]').should('be.visible');
    cy.contains('button', 'Reject').click();

    cy.get('textarea[name="reason"]').type('Incomplete documentation. FSSAI license expired.');
    cy.contains('button', 'Reject Kitchen').click();

    cy.contains('Kitchen rejected').should('be.visible');
  });
});
```

---

## Implementation Checklist

Use this checklist to track your progress:

### Backend Fixes

- [ ] Add `documents` field to kitchen schema (FSSAI, licenses, etc.)
- [ ] Add `approvalDetails` field to kitchen schema (rejectedBy, rejectionReason)
- [ ] Create `getPendingKitchens()` function in admin controller
- [ ] Create `approveKitchen()` function in admin controller
- [ ] Create `rejectKitchen()` function in admin controller
- [ ] Add admin kitchen routes (`/api/admin/kitchens/pending`, `/approve`, `/reject`)
- [ ] Add validation middleware for rejection reason (min 10 chars)
- [ ] Add document validation checks (if implementing document upload)
- [ ] Update kitchen access middleware to block menu operations for PENDING_APPROVAL
- [ ] Add REJECTED status value to kitchen schema enum (optional)
- [ ] Test all new endpoints with Postman/Insomnia
- [ ] Update API documentation

### Frontend Implementation

**Service Layer:**
- [ ] Create `src/services/kitchenService.js`
- [ ] Implement `getPendingKitchens(page, limit)`
- [ ] Implement `getKitchenById(id)`
- [ ] Implement `approveKitchen(id)`
- [ ] Implement `rejectKitchen(id, reason)`
- [ ] Implement `getAllKitchens(filters)`
- [ ] Implement `activateKitchen(id)`
- [ ] Implement `deactivateKitchen(id)`
- [ ] Implement `suspendKitchen(id, reason)`

**Pages:**
- [ ] Create `src/pages/admin/PendingKitchens.jsx`
- [ ] Create `src/pages/admin/KitchenManagement.jsx`

**Components:**
- [ ] Create `src/components/admin/KitchenDetailModal.jsx`
- [ ] Create `src/components/admin/ApproveKitchenDialog.jsx`
- [ ] Create `src/components/admin/RejectKitchenDialog.jsx`
- [ ] Create `src/components/admin/SuspendKitchenDialog.jsx`
- [ ] Create `src/components/admin/KitchenDocumentsSection.jsx` (placeholder)
- [ ] Create `src/components/admin/KitchenActivityLog.jsx`

**Routing:**
- [ ] Add `/admin/kitchens/pending` route
- [ ] Add `/admin/kitchens` route
- [ ] Add protected route wrapper (admin only)
- [ ] Update admin sidebar with Kitchen Management section
- [ ] Add pending count badge to sidebar

**Hooks:**
- [ ] Create `src/hooks/usePendingKitchensCount.js`
- [ ] Create `src/hooks/useKitchenUpdates.js` (polling)

**Features:**
- [ ] Implement pagination on all list pages
- [ ] Implement search functionality
- [ ] Implement filters (status, type, zone)
- [ ] Implement sorting
- [ ] Implement loading states (skeletons)
- [ ] Implement empty states
- [ ] Implement error handling with retry
- [ ] Implement toast notifications
- [ ] Implement optimistic UI updates
- [ ] Add keyboard shortcuts
- [ ] Add CSV export functionality

**Polish:**
- [ ] Mobile responsive design (all pages)
- [ ] Accessibility audit (ARIA labels, keyboard nav, screen reader)
- [ ] Add transitions and animations
- [ ] Add focus management in modals
- [ ] Add confirmation dialogs for destructive actions
- [ ] Implement error boundary for kitchen section

### Testing

**Unit Tests:**
- [ ] Test kitchen service functions
- [ ] Test validation logic
- [ ] Test error handling

**Integration Tests:**
- [ ] Test pending kitchens page rendering
- [ ] Test kitchen detail modal
- [ ] Test approval flow
- [ ] Test rejection flow
- [ ] Test filters and search

**E2E Tests:**
- [ ] Test complete approval workflow
- [ ] Test complete rejection workflow
- [ ] Test status management (activate, deactivate, suspend)
- [ ] Test navigation and routing
- [ ] Test error scenarios

**Manual Testing:**
- [ ] Complete manual testing checklist (see Testing Scenarios section)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile testing (iOS Safari, Android Chrome)
- [ ] Performance testing (large dataset with 100+ kitchens)

### Documentation

- [ ] Update API documentation with new endpoints
- [ ] Document frontend component props and usage
- [ ] Create admin user guide for kitchen approval process
- [ ] Document backend schema changes
- [ ] Add inline code comments for complex logic

### Deployment

- [ ] Run database migrations (if schema changes require it)
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Verify production deployment works
- [ ] Monitor error logs for first 24 hours
- [ ] Train admin users on new features

---

## Summary

This documentation provides a complete guide for implementing Kitchen Approval Management in the Tiffsy admin panel. The system closely mirrors the existing driver approval workflow, with enhancements to address inconsistencies identified during backend analysis.

**Key Takeaways:**

1. **Backend Status**: Partially implemented. Kitchen status management exists, but dedicated approval/rejection endpoints and document verification are missing.

2. **Recommended Fixes**: Add admin-specific endpoints, document fields, and rejection reason tracking to achieve parity with driver approval.

3. **UI Requirements**: 10 prompts guide step-by-step implementation of all necessary pages, modals, and features.

4. **Document Verification**: Not currently implemented in backend. UI includes placeholder to prepare for future integration.

5. **Testing**: Comprehensive manual and automated testing scenarios ensure quality.

6. **Accessibility**: All UI components must meet WCAG standards with keyboard navigation, screen reader support, and ARIA labels.

By following this guide and using the provided prompts sequentially, you can build a complete, production-ready Kitchen Approval Management system for the Tiffsy admin panel.

---

**Document Version:** 1.0
**Last Updated:** 2024-01-17
**Backend Version Analyzed:** Current (as of session date)
**Prepared For:** Tiffsy Admin Panel Integration
