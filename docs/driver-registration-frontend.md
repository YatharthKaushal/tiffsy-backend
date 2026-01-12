# Driver Self-Registration Frontend Implementation Guide

This document provides instructions for implementing the driver self-registration flow with admin approval in the frontend (mobile app).

---

## Table of Contents

1. [Overview](#overview)
2. [User Flow Diagram](#user-flow-diagram)
3. [API Endpoints](#api-endpoints)
4. [Screen-by-Screen Implementation](#screen-by-screen-implementation)
5. [State Management](#state-management)
6. [Error Handling](#error-handling)
7. [UI Components](#ui-components)

---

## Overview

The driver registration system allows drivers to self-register through the mobile app. Unlike customer registration which is instant, driver registration requires admin approval before the driver can start using the app for deliveries.

### Key Differences from Customer Registration

| Aspect | Customer | Driver |
|--------|----------|--------|
| Registration | Instant access | Requires admin approval |
| Required Info | Name, email (optional) | License, vehicle details, documents |
| Post-registration | Can use app immediately | Must wait for approval |
| Login behavior | Normal access | Blocked until approved |

---

## User Flow Diagram

```
┌─────────────────┐
│   Phone OTP     │
│  Verification   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  POST /sync     │
│  Check user     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐  ┌──────────────┐
│ New   │  │ Existing     │
│ User  │  │ Driver       │
└───┬───┘  └──────┬───────┘
    │             │
    ▼             ▼
┌───────────┐  ┌──────────────────┐
│ Role      │  │ Check            │
│ Selection │  │ approvalStatus   │
│ Screen    │  └────────┬─────────┘
└─────┬─────┘           │
      │        ┌────────┼────────┐
      │        │        │        │
      ▼        ▼        ▼        ▼
┌───────────┐ ┌─────┐ ┌─────┐ ┌────────┐
│ Driver    │ │PEND │ │APPR │ │REJECT  │
│ Regist.   │ │ING  │ │OVED │ │ED      │
│ Form      │ └──┬──┘ └──┬──┘ └────┬───┘
└─────┬─────┘    │       │         │
      │          ▼       ▼         ▼
      │     ┌────────┐ ┌─────┐ ┌────────┐
      │     │Waiting │ │Home │ │Rejected│
      │     │Screen  │ │     │ │Screen  │
      │     └────────┘ └─────┘ └────────┘
      ▼
┌─────────────┐
│ POST        │
│ /register-  │
│ driver      │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Waiting     │
│ for         │
│ Approval    │
└─────────────┘
```

---

## API Endpoints

### 1. Sync User (Check Existing)

```
POST /api/auth/sync
Headers: Authorization: Bearer <firebase_token>
Body: {}
```

**Response for New User:**
```json
{
  "success": true,
  "message": "User not found",
  "data": {
    "user": null,
    "isNewUser": true,
    "isProfileComplete": false
  }
}
```

**Response for Pending Driver:**
```json
{
  "success": true,
  "message": "Driver pending approval",
  "data": {
    "user": { ... },
    "isNewUser": false,
    "isProfileComplete": true,
    "approvalStatus": "PENDING",
    "message": "Your driver registration is pending admin approval."
  }
}
```

**Response for Rejected Driver:**
```json
{
  "success": true,
  "message": "Driver rejected",
  "data": {
    "user": { ... },
    "isNewUser": false,
    "isProfileComplete": true,
    "approvalStatus": "REJECTED",
    "rejectionReason": "Invalid license document",
    "message": "Your driver registration was rejected."
  }
}
```

**Response for Approved Driver:**
```json
{
  "success": true,
  "message": "User authenticated",
  "data": {
    "user": { ... },
    "isNewUser": false,
    "isProfileComplete": true,
    "approvalStatus": "APPROVED"
  }
}
```

### 2. Register Driver

```
POST /api/auth/register-driver
Headers: Authorization: Bearer <firebase_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "profileImage": "https://storage.example.com/profile.jpg",
  "licenseNumber": "MH1234567890",
  "licenseImageUrl": "https://storage.example.com/license.jpg",
  "licenseExpiryDate": "2027-12-31",
  "vehicleName": "Honda Activa",
  "vehicleNumber": "MH12AB1234",
  "vehicleType": "SCOOTER",
  "vehicleDocuments": [
    {
      "type": "RC",
      "imageUrl": "https://storage.example.com/rc.jpg",
      "expiryDate": "2028-06-15"
    },
    {
      "type": "INSURANCE",
      "imageUrl": "https://storage.example.com/insurance.jpg",
      "expiryDate": "2025-03-20"
    }
  ]
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Driver registration submitted for approval",
  "data": {
    "user": { ... },
    "approvalStatus": "PENDING",
    "message": "Your registration is pending admin approval. You will be notified once approved."
  }
}
```

---

## Screen-by-Screen Implementation

### Screen 1: Role Selection Screen

**When to Show:** After OTP verification when `isNewUser: true`

**UI Elements:**
- App logo/branding
- Title: "Join Tiffsy"
- Subtitle: "Select how you want to use Tiffsy"
- Two large cards/buttons:
  - **Customer Card:** Icon + "Order Food" + "Get delicious meals delivered"
  - **Driver Card:** Icon + "Deliver Food" + "Earn by delivering orders"

**Implementation Prompt:**
```
Create a role selection screen with two prominent cards:
1. Customer - navigates to customer registration
2. Driver - navigates to driver registration form

Use visually distinct icons and clear descriptions.
The screen should feel welcoming and the choice clear.
```

---

### Screen 2: Driver Registration Form

**When to Show:** When user selects "Driver" role

**Form Sections:**

#### Section A: Personal Information
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Full Name | Text | Yes | Min 2 chars |
| Email | Email | No | Valid email format |
| Profile Photo | Image Upload | No | Max 5MB, JPG/PNG |

#### Section B: License Details
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| License Number | Text | Yes | Non-empty |
| License Photo | Image Upload | Yes | Clear, readable |
| License Expiry | Date Picker | No | Must be future date |

#### Section C: Vehicle Details
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Vehicle Name | Text | Yes | e.g., "Honda Activa" |
| Vehicle Number | Text | Yes | Format: MH12AB1234 |
| Vehicle Type | Dropdown | Yes | BIKE/SCOOTER/BICYCLE/OTHER |

#### Section D: Vehicle Documents
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Document Type | Dropdown | Yes | RC/INSURANCE/PUC/OTHER |
| Document Photo | Image Upload | Yes | Clear, readable |
| Expiry Date | Date Picker | No | - |

**Add More Documents** button to add additional documents.

**Implementation Prompt:**
```
Create a multi-section driver registration form with:

1. Personal Info section:
   - Name input (required)
   - Email input (optional)
   - Profile image picker with camera/gallery options

2. License section:
   - License number input (required)
   - License image upload (required) - show preview
   - License expiry date picker (optional, must be future)

3. Vehicle section:
   - Vehicle name/model input (required)
   - Vehicle number input with format hint "MH12AB1234" (required)
   - Vehicle type dropdown: Bike, Scooter, Bicycle, Other (required)

4. Documents section:
   - Dynamic list of documents
   - Each document has: type dropdown, image upload, expiry date
   - "Add Document" button
   - At least one document required (show validation)
   - Document types: RC, Insurance, PUC, Other

5. Submit button at bottom

Use a stepper or scrollable form. Show progress indicator.
Validate on submit and highlight errors inline.
Upload images to storage first, then submit URLs with form.
```

---

### Screen 3: Registration Success / Waiting Screen

**When to Show:** After successful registration OR when `approvalStatus: "PENDING"`

**UI Elements:**
- Success animation (checkmark or hourglass)
- Title: "Registration Submitted!"
- Message: "Your registration is pending admin approval. We'll notify you once approved."
- Illustration showing waiting/review process
- Estimated time: "Usually approved within 24-48 hours"
- "Check Status" button (calls /sync again)
- "Contact Support" link

**Implementation Prompt:**
```
Create an approval waiting screen with:

1. Animated illustration (hourglass or document review animation)
2. Clear title: "Registration Under Review"
3. Friendly message explaining the approval process
4. Status indicator showing "PENDING"
5. "Check Status" button that calls /api/auth/sync
6. Pull-to-refresh functionality
7. Support contact option
8. Option to logout and try different number

Use calming colors. The screen should reassure the user
that their application is being processed.
```

---

### Screen 4: Rejection Screen

**When to Show:** When `approvalStatus: "REJECTED"`

**UI Elements:**
- Warning/error icon
- Title: "Registration Not Approved"
- Rejection reason (from API): e.g., "Invalid license document"
- Explanation of what to do next
- "Re-apply" button (allows editing and resubmitting)
- "Contact Support" button

**Implementation Prompt:**
```
Create a rejection screen with:

1. Empathetic design - not scary, but informative
2. Clear display of rejection reason from API
3. Explanation: "Your registration was not approved for the following reason:"
4. Display the specific rejection reason
5. "What you can do" section with actionable steps
6. "Re-apply" button - navigates to registration form with pre-filled data
7. "Contact Support" button for disputes
8. Option to logout

Allow users to fix issues and resubmit.
Store their previous data locally to pre-fill on re-application.
```

---

### Screen 5: Driver Home (After Approval)

**When to Show:** When `approvalStatus: "APPROVED"`

Navigate to the main driver dashboard/home screen.

---

## State Management

### Recommended State Structure

```typescript
interface DriverRegistrationState {
  // Auth state
  isAuthenticated: boolean;
  firebaseToken: string | null;

  // User state
  user: User | null;
  isNewUser: boolean;

  // Driver-specific
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  rejectionReason: string | null;

  // Registration form
  registrationForm: {
    name: string;
    email: string;
    profileImage: string | null;
    licenseNumber: string;
    licenseImageUrl: string | null;
    licenseExpiryDate: Date | null;
    vehicleName: string;
    vehicleNumber: string;
    vehicleType: 'BIKE' | 'SCOOTER' | 'BICYCLE' | 'OTHER';
    vehicleDocuments: VehicleDocument[];
  };

  // UI state
  isLoading: boolean;
  error: string | null;
}

interface VehicleDocument {
  type: 'RC' | 'INSURANCE' | 'PUC' | 'OTHER';
  imageUrl: string;
  expiryDate?: Date;
}
```

### Navigation Logic

```typescript
function determineInitialRoute(syncResponse) {
  const { isNewUser, user, approvalStatus } = syncResponse.data;

  if (isNewUser) {
    return 'RoleSelectionScreen';
  }

  if (user.role === 'DRIVER') {
    switch (approvalStatus) {
      case 'PENDING':
        return 'ApprovalWaitingScreen';
      case 'REJECTED':
        return 'RejectionScreen';
      case 'APPROVED':
        return 'DriverHomeScreen';
      default:
        return 'RoleSelectionScreen';
    }
  }

  if (user.role === 'CUSTOMER') {
    return 'CustomerHomeScreen';
  }

  return 'RoleSelectionScreen';
}
```

---

## Error Handling

### API Error Responses

| Status | Message | Action |
|--------|---------|--------|
| 400 | Validation error | Show inline field errors |
| 403 | "Pending approval" | Show waiting screen |
| 403 | "Registration rejected" | Show rejection screen |
| 409 | "Driver account already exists" | Show message, redirect to sync |
| 409 | "Phone registered with different role" | Show message, offer support |
| 500 | Server error | Show retry option |

### Implementation Prompt for Error Handling:

```
Implement error handling for driver registration:

1. Validation errors (400):
   - Parse error messages from response
   - Highlight specific fields with errors
   - Show error messages below each field
   - Scroll to first error field

2. Already exists (409):
   - Show dialog: "Account already exists"
   - Offer to check status or contact support

3. Network errors:
   - Show retry option
   - Cache form data locally
   - Allow offline form filling, submit when online

4. Image upload failures:
   - Show specific upload error
   - Allow retry for individual images
   - Don't lose other form data

5. General errors:
   - Show user-friendly message
   - Log detailed error for debugging
   - Offer "Contact Support" option
```

---

## UI Components

### 1. Image Upload Component

```
Create a reusable image upload component with:

Props:
- label: string
- required: boolean
- value: string | null (URL after upload)
- onChange: (url: string) => void
- error: string | null

Features:
- Tap to open camera/gallery picker
- Show loading indicator during upload
- Display thumbnail preview after upload
- "X" button to remove/change image
- Error state with red border
- Accessibility labels

Upload images to your storage service (Firebase Storage, S3, etc.)
and return the URL.
```

### 2. Document List Component

```
Create a dynamic document list component:

Props:
- documents: VehicleDocument[]
- onChange: (docs: VehicleDocument[]) => void
- error: string | null

Features:
- Render list of document entries
- Each entry has: type dropdown, image upload, expiry date
- "Add Document" button at bottom
- Swipe or button to delete entry
- Minimum 1 document validation
- Smooth animations for add/remove
```

### 3. Vehicle Number Input

```
Create a vehicle number input with:

Features:
- Auto-uppercase
- Format hint as placeholder: "MH12AB1234"
- Validation pattern: /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/
- Real-time format validation
- Visual feedback (green check when valid)
```

### 4. Status Badge Component

```
Create a status badge for approval status:

Props:
- status: 'PENDING' | 'APPROVED' | 'REJECTED'

Styles:
- PENDING: Yellow/Orange background, hourglass icon
- APPROVED: Green background, checkmark icon
- REJECTED: Red background, X icon

Use in profile and status screens.
```

---

## Push Notifications

### Notification Types to Handle

1. **Approval Notification**
   ```json
   {
     "type": "DRIVER_APPROVED",
     "title": "Registration Approved!",
     "body": "Your driver registration has been approved. Start delivering now!",
     "data": { "action": "navigate_home" }
   }
   ```

2. **Rejection Notification**
   ```json
   {
     "type": "DRIVER_REJECTED",
     "title": "Registration Update",
     "body": "Your registration needs attention. Tap to see details.",
     "data": { "action": "navigate_rejection", "reason": "..." }
   }
   ```

**Implementation Prompt:**
```
Handle driver approval push notifications:

1. Listen for notifications with type "DRIVER_APPROVED" or "DRIVER_REJECTED"
2. On DRIVER_APPROVED:
   - Update local state
   - Navigate to driver home
   - Show success toast
3. On DRIVER_REJECTED:
   - Update local state with rejection reason
   - Navigate to rejection screen
   - Show the reason

Also implement background/killed state handling
to navigate correctly when app opens from notification.
```

---

## Testing Checklist

- [ ] New user can see role selection
- [ ] Driver form validates all required fields
- [ ] Images upload successfully
- [ ] Vehicle number format validation works
- [ ] At least one document required
- [ ] Form submits successfully
- [ ] Waiting screen shows after submission
- [ ] "Check Status" refreshes approval status
- [ ] Rejected users see reason
- [ ] Rejected users can re-apply
- [ ] Approved users navigate to home
- [ ] Push notifications work for approval/rejection
- [ ] Offline form filling works
- [ ] Error states display correctly

---

## Admin Panel Integration

For the admin panel (web), implement these screens:

### Pending Drivers List
- `GET /api/admin/drivers/pending`
- Table with: Name, Phone, Vehicle, Submitted Date
- Click to view details

### Driver Detail View
- Show all submitted information
- Display document images
- Approve/Reject buttons

### Approve Action
- `PATCH /api/admin/drivers/:id/approve`
- Confirm dialog
- Send push notification on success

### Reject Action
- `PATCH /api/admin/drivers/:id/reject`
- Require rejection reason
- Send push notification with reason

---

## Summary

The driver registration flow requires careful handling of multiple states (new, pending, approved, rejected) and a multi-step form with document uploads. Key implementation points:

1. **Always check approval status** after OTP verification
2. **Pre-fill form data** for rejected users re-applying
3. **Handle all error states** gracefully
4. **Upload images first**, then submit form with URLs
5. **Implement push notifications** for real-time approval updates
6. **Cache form data** to prevent data loss
