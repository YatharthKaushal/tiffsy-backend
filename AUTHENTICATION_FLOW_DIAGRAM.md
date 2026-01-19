# Authentication Flow Diagrams

## Complete Authentication Flow (All User Types)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     TIFFSY AUTHENTICATION FLOW                      │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   Frontend   │
│   (Mobile)   │
└──────┬───────┘
       │
       │ 1. User enters phone number
       │    (+919876543210)
       ▼
┌──────────────┐
│   Firebase   │
│     Auth     │
└──────┬───────┘
       │
       │ 2. Send OTP via SMS
       │
       ▼
┌──────────────┐
│     User     │
│ (Receives OTP)│
└──────┬───────┘
       │
       │ 3. Enters OTP code
       │
       ▼
┌──────────────┐
│   Firebase   │
│   Verifies   │
└──────┬───────┘
       │
       │ 4. Returns Firebase ID Token
       │    (JWT, expires in 1 hour)
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│                    CRITICAL STEP                         │
│              ⚠️  MUST BE CALLED FIRST  ⚠️                │
│                                                          │
│  POST /api/auth/sync                                     │
│  Authorization: Bearer {firebase_token}                  │
└──────┬───────────────────────────────────────────────────┘
       │
       │ 5. Backend processes sync
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│              Backend: auth.controller.js                │
│                                                         │
│  - Extracts phone from Firebase token                  │
│  - Finds user by phone in database                     │
│  - Updates firebaseUid if not set                      │
│  - Updates lastLoginAt timestamp                       │
│  - Returns user profile                                │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
     ┌───────────────┐
     │ User Found?   │
     └───┬───────────┘
         │
    ┌────┴────┐
    │         │
   YES        NO
    │         │
    │         ▼
    │    ┌─────────────────┐
    │    │  isNewUser: true│
    │    │  Redirect to    │
    │    │  Registration   │
    │    └─────────────────┘
    │
    ▼
┌────────────────────────────────────────────┐
│  Existing User - Check Role & Status       │
└────┬───────────────────────────────────────┘
     │
     ▼
  ┌────────────────┐
  │  User Role?    │
  └────┬───────────┘
       │
   ────┼────────────────────────────────────────
   │   │        │           │                  │
   │   │        │           │                  │
CUSTOMER│   KITCHEN_STAFF  DRIVER            ADMIN
   │   │        │           │                  │
   │   │        │           │                  │
   ▼   ▼        ▼           ▼                  ▼

┌──────────┐  ┌────────────────┐  ┌─────────────┐  ┌──────────┐
│ CUSTOMER │  │ KITCHEN_STAFF  │  │   DRIVER    │  │  ADMIN   │
│  FLOW    │  │     FLOW       │  │    FLOW     │  │   FLOW   │
└──────────┘  └────────────────┘  └─────────────┘  └──────────┘
```

---

## Customer Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      CUSTOMER FLOW                          │
└─────────────────────────────────────────────────────────────┘

POST /api/auth/sync
    │
    ▼
┌──────────────────┐
│ isNewUser: true? │
└────┬─────────────┘
     │
  ┌──┴──┐
 YES   NO
  │     │
  │     ▼
  │  ┌──────────────────────┐
  │  │ Profile Complete?    │
  │  └────┬─────────────────┘
  │       │
  │    ┌──┴──┐
  │   YES   NO
  │    │     │
  │    │     ▼
  │    │  ┌────────────────────┐
  │    │  │ Show Complete      │
  │    │  │ Profile Screen     │
  │    │  └────────────────────┘
  │    │
  │    ▼
  │  ┌────────────────────┐
  │  │ Navigate to        │
  │  │ Customer Home      │
  │  └────────────────────┘
  │
  ▼
┌─────────────────────────┐
│ Show Registration Screen│
│                         │
│ POST /api/auth/register │
│ Body:                   │
│ {                       │
│   name: "John Doe",     │
│   email: "...",         │
│   dietaryPreferences: []│
│ }                       │
└────────┬────────────────┘
         │
         ▼
    ┌─────────────┐
    │  Success?   │
    └────┬────────┘
         │
      ┌──┴──┐
     YES   NO
      │     │
      │     ▼
      │  ┌──────────────┐
      │  │ Show Error   │
      │  └──────────────┘
      │
      ▼
┌──────────────────────┐
│ Call sync again      │
│ POST /api/auth/sync  │
└─────┬────────────────┘
      │
      ▼
┌──────────────────────┐
│ Navigate to          │
│ Customer Home        │
└──────────────────────┘
```

---

## Kitchen Staff Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                      KITCHEN STAFF FLOW                          │
└──────────────────────────────────────────────────────────────────┘

POST /api/auth/sync
    │
    ▼
┌──────────────────┐
│ isNewUser: true? │
└────┬─────────────┘
     │
  ┌──┴──┐
 YES   NO
  │     │
  │     ▼
  │  ┌─────────────────────────┐
  │  │ kitchenApprovalStatus?  │
  │  └────┬────────────────────┘
  │       │
  │    ───┼───────────────────
  │    │  │         │         │
  │    │  │         │         │
  │  NULL PENDING REJECTED APPROVED
  │    │  │         │         │
  │    │  │         │         │
  │    │  ▼         ▼         ▼
  │    │ ┌────────┐┌────────┐┌─────────────┐
  │    │ │Pending ││Rejected││Navigate to  │
  │    │ │Screen  ││Screen  ││Kitchen      │
  │    │ │        ││with    ││Dashboard    │
  │    │ │"Waiting││reason  │└─────────────┘
  │    │ │approval"│└────────┘
  │    │ └────────┘
  │    │
  │    ▼
  │  ┌─────────────────────┐
  │  │ Has kitchenId?      │
  │  └────┬────────────────┘
  │       │
  │    ┌──┴──┐
  │   YES   NO
  │    │     │
  │    │     ▼
  │    │  ┌──────────────────┐
  │    │  │ Error: Contact   │
  │    │  │ Support          │
  │    │  └──────────────────┘
  │    │
  │    ▼
  │  ┌─────────────────────┐
  │  │ Kitchen Status?     │
  │  └────┬────────────────┘
  │       │
  │    ───┼──────────────
  │    │  │            │
  │  ACTIVE PENDING INACTIVE
  │    │  │            │
  │    │  ▼            ▼
  │    │ ┌──────────┐┌──────────┐
  │    │ │ Approval ││ Contact  │
  │    │ │ Pending  ││ Support  │
  │    │ └──────────┘└──────────┘
  │    │
  │    ▼
  │  ┌─────────────────────┐
  │  │ GET /api/kitchens/  │
  │  │ dashboard           │
  │  └────┬────────────────┘
  │       │
  │       ▼
  │  ┌─────────────────────┐
  │  │ Show Kitchen        │
  │  │ Dashboard           │
  │  │ - Orders            │
  │  │ - Stats             │
  │  │ - Batches           │
  │  └─────────────────────┘
  │
  ▼
┌──────────────────────────────┐
│ Show Registration Screen     │
│                              │
│ POST /api/auth/              │
│      register-kitchen        │
│ Body:                        │
│ {                            │
│   name: "Manager Name",      │
│   kitchenName: "...",        │
│   ownerName: "...",          │
│   address: {...},            │
│   zonesServed: [...],        │
│   operatingHours: {...}      │
│ }                            │
└────────┬─────────────────────┘
         │
         ▼
    ┌─────────────┐
    │  Success?   │
    └────┬────────┘
         │
      ┌──┴──┐
     YES   NO
      │     │
      │     ▼
      │  ┌──────────────┐
      │  │ Show Error   │
      │  └──────────────┘
      │
      ▼
┌──────────────────────┐
│ Kitchen & User       │
│ Created              │
│ Status: PENDING      │
└─────┬────────────────┘
      │
      ▼
┌──────────────────────┐
│ Show Pending         │
│ Approval Screen      │
│                      │
│ "Your kitchen is     │
│ being reviewed"      │
└──────────────────────┘
```

---

## Driver Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        DRIVER FLOW                               │
└──────────────────────────────────────────────────────────────────┘

POST /api/auth/sync
    │
    ▼
┌──────────────────┐
│ isNewUser: true? │
└────┬─────────────┘
     │
  ┌──┴──┐
 YES   NO
  │     │
  │     ▼
  │  ┌─────────────────────┐
  │  │ approvalStatus?     │
  │  └────┬────────────────┘
  │       │
  │    ───┼─────────────────
  │    │  │        │        │
  │    │  │        │        │
  │  NULL PENDING REJECTED APPROVED
  │    │  │        │        │
  │    │  │        │        │
  │    │  ▼        ▼        ▼
  │    │ ┌───────┐┌───────┐┌────────────┐
  │    │ │Pending││Rejected││Navigate to │
  │    │ │Screen ││Screen  ││Driver Home │
  │    │ │       ││with    │└────────────┘
  │    │ │       ││reason  │
  │    │ └───────┘└───────┘
  │    │
  │    ▼
  │  ┌──────────────────┐
  │  │ Error: Contact   │
  │  │ Support          │
  │  └──────────────────┘
  │
  ▼
┌─────────────────────────────┐
│ Show Registration Screen    │
│                             │
│ POST /api/auth/             │
│      register-driver        │
│ Body:                       │
│ {                           │
│   name: "Driver Name",      │
│   email: "...",             │
│   driverDetails: {          │
│     licenseNumber: "...",   │
│     licenseImageUrl: "...", │
│     vehicleName: "...",     │
│     vehicleNumber: "...",   │
│     vehicleType: "BIKE"     │
│   }                         │
│ }                           │
└────────┬────────────────────┘
         │
         ▼
    ┌─────────────┐
    │  Success?   │
    └────┬────────┘
         │
      ┌──┴──┐
     YES   NO
      │     │
      │     ▼
      │  ┌──────────────┐
      │  │ Show Error   │
      │  └──────────────┘
      │
      ▼
┌──────────────────────┐
│ Driver Created       │
│ Status: PENDING      │
└─────┬────────────────┘
      │
      ▼
┌──────────────────────┐
│ Show Pending         │
│ Approval Screen      │
│                      │
│ "Your registration   │
│ is being reviewed"   │
└──────────────────────┘
```

---

## Token Refresh Flow

```
┌──────────────────────────────────────────────────────────┐
│                    TOKEN REFRESH FLOW                    │
└──────────────────────────────────────────────────────────┘

┌────────────────┐
│ User makes     │
│ API request    │
└───────┬────────┘
        │
        ▼
   ┌─────────────────┐
   │ Check token age │
   └────────┬────────┘
            │
         ┌──┴──┐
       < 5min  > 5min
         │      │
         │      ▼
         │  ┌──────────────────────────┐
         │  │ Get fresh token          │
         │  │ auth().currentUser       │
         │  │   .getIdToken(true)      │
         │  └────────┬─────────────────┘
         │           │
         │           ▼
         │  ┌──────────────────────────┐
         │  │ New token received       │
         │  │ (Valid for 1 hour)       │
         │  └────────┬─────────────────┘
         │           │
         └───────────┘
                 │
                 ▼
        ┌────────────────┐
        │ Make API call  │
        │ with token     │
        └────────┬───────┘
                 │
                 ▼
          ┌──────────────┐
          │  API Success │
          └──────────────┘


Auto-refresh strategy:
┌────────────────────────────────────────┐
│ Set interval: every 50 minutes        │
│                                        │
│ setInterval(() => {                    │
│   if (auth().currentUser) {           │
│     auth().currentUser                │
│       .getIdToken(true);              │
│   }                                    │
│ }, 50 * 60 * 1000);                   │
└────────────────────────────────────────┘
```

---

## Error Handling Flow

```
┌──────────────────────────────────────────────────────────┐
│                   ERROR HANDLING FLOW                    │
└──────────────────────────────────────────────────────────┘

API Request
    │
    ▼
┌─────────────┐
│ Response    │
└──────┬──────┘
       │
   ────┼────────────────────────────────────────
   │   │       │        │        │             │
   │   │       │        │        │             │
  200 400    401      403      404           500
   │   │       │        │        │             │
   │   │       │        │        │             │
   │   │       │        │        │             │
   ▼   ▼       ▼        ▼        ▼             ▼
┌────┐┌────┐┌──────┐┌──────┐┌──────┐    ┌──────┐
│OK  ││Bad ││Token ││Access││Not   │    │Server│
│    ││Req.││Expire││Denied││Found │    │Error │
└────┘└─┬──┘└───┬──┘└───┬──┘└───┬──┘    └───┬──┘
       │       │       │       │            │
       │       │       │       │            │
       ▼       ▼       ▼       ▼            ▼
    ┌────┐ ┌──────┐┌──────┐┌──────┐    ┌──────┐
    │Show││Refresh││Check ││Show  │    │Retry │
    │Err ││Token  ││User  ││Err.  │    │or    │
    │Msg ││&Retry ││Role  ││Screen│    │Show  │
    └────┘└──────┘└──────┘└──────┘    │Error │
                                       └──────┘

Error Message Display:
┌──────────────────────────────────────────┐
│ Status Code → User-Friendly Message     │
├──────────────────────────────────────────┤
│ 400 → "Invalid input. Please check."    │
│ 401 → "Session expired. Please login."  │
│ 403 → "Access denied. Contact support." │
│ 404 → "Resource not found."             │
│ 500 → "Server error. Please try later." │
└──────────────────────────────────────────┘
```

---

## Complete Authentication State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                  AUTHENTICATION STATE MACHINE                   │
└─────────────────────────────────────────────────────────────────┘

       ┌──────────────┐
       │ NOT_AUTHED   │ ◄────────────┐
       └──────┬───────┘              │
              │                      │
              │ Start Auth           │ Logout
              │                      │
              ▼                      │
       ┌──────────────┐              │
       │ SENDING_OTP  │              │
       └──────┬───────┘              │
              │                      │
              │ OTP Sent             │
              │                      │
              ▼                      │
       ┌──────────────┐              │
       │ VERIFY_OTP   │              │
       └──────┬───────┘              │
              │                      │
              │ OTP Verified         │
              │ (Got Firebase Token) │
              │                      │
              ▼                      │
       ┌──────────────┐              │
       │ SYNCING      │              │
       │ (Call Sync)  │              │
       └──────┬───────┘              │
              │                      │
         ─────┼─────                 │
         │         │                 │
      IS_NEW   IS_EXISTING          │
         │         │                 │
         │         ▼                 │
         │   ┌──────────────┐        │
         │   │ CHECK_STATUS │        │
         │   └──────┬───────┘        │
         │          │                │
         │      ────┼────            │
         │      │   │   │            │
         │   ACTIVE PENDING REJECTED │
         │      │   │   │            │
         │      │   │   └────────────┘
         │      │   │
         │      │   ▼
         │      │ ┌──────────────┐
         │      │ │ SHOW_PENDING │
         │      │ └──────────────┘
         │      │
         │      ▼
         │   ┌──────────────┐
         │   │ AUTHENTICATED│───────────────┐
         │   │ (App Home)   │               │
         │   └──────────────┘               │
         │                                  │
         ▼                                  │
    ┌──────────────┐                       │
    │ REGISTERING  │                       │
    └──────┬───────┘                       │
           │                               │
           │ Registration Complete         │
           │                               │
           ▼                               │
    ┌──────────────┐                       │
    │ SYNC_AGAIN   │                       │
    └──────┬───────┘                       │
           │                               │
           └───────────────────────────────┘
```

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                │
└──────────────────────────────────────────────────────────────────┘

Frontend                 Firebase              Backend
   │                        │                     │
   │ 1. Phone Number       │                     │
   ├──────────────────────>│                     │
   │                        │                     │
   │ 2. OTP SMS            │                     │
   │<──────────────────────┤                     │
   │                        │                     │
   │ 3. OTP Code           │                     │
   ├──────────────────────>│                     │
   │                        │                     │
   │ 4. ID Token           │                     │
   │    (JWT)              │                     │
   │<──────────────────────┤                     │
   │                        │                     │
   │ 5. POST /auth/sync    │                     │
   │    Bearer {token}     │                     │
   ├───────────────────────┼────────────────────>│
   │                        │                     │
   │                        │ 6. Verify Token    │
   │                        │<────────────────────┤
   │                        │                     │
   │                        │ 7. Token Valid     │
   │                        │    + Phone Number  │
   │                        ├────────────────────>│
   │                        │                     │
   │                        │                     │ 8. Find User
   │                        │                     │    in Database
   │                        │                     │    by Phone
   │                        │                     │
   │                        │                     │ 9. Update
   │                        │                     │    firebaseUid
   │                        │                     │    lastLoginAt
   │                        │                     │
   │ 10. User Profile      │                     │
   │     + Status          │                     │
   │<───────────────────────┼─────────────────────┤
   │                        │                     │
   │ 11. Store User        │                     │
   │     Navigate to       │                     │
   │     Appropriate       │                     │
   │     Screen            │                     │
   │                        │                     │
```

---

## Critical Points Summary

```
┌──────────────────────────────────────────────────────────────────┐
│                      CRITICAL POINTS                             │
└──────────────────────────────────────────────────────────────────┘

1. ⚠️  ALWAYS call /api/auth/sync IMMEDIATELY after Firebase auth
   └─ This links Firebase UID to database user
   └─ Without this, subsequent API calls will fail with 403

2. ⚠️  NEVER skip the sync endpoint
   └─ Don't assume user exists in database
   └─ Don't cache old user data

3. ⚠️  Handle approval statuses for Kitchen & Driver
   └─ Check kitchenApprovalStatus in sync response
   └─ Check approvalStatus for drivers
   └─ Show appropriate pending/rejected screens

4. ⚠️  Refresh tokens before they expire
   └─ Tokens expire after 1 hour
   └─ Implement auto-refresh every 50 minutes
   └─ Use getIdToken(true) to force refresh

5. ⚠️  Phone number format consistency
   └─ Always use +91 prefix for Firebase
   └─ Backend normalizes to 10 digits
   └─ Auth middleware handles both formats

6. ⚠️  Error handling
   └─ Catch and display all error types
   └─ Provide user-friendly messages
   └─ Log errors for debugging
```

---

**Last Updated:** January 19, 2026
