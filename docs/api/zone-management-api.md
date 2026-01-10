# Zone Management API

> **PROMPT**: Implement zone management for the admin dashboard. Zones are delivery areas based on pincode (1 pincode = 1 zone). Admin can create, update, activate/deactivate zones, and toggle ordering. Use the endpoints below with exact request/response formats. Handle loading states, error messages, and implement a data table with search, filter by city/status, and pagination.

---

## Authentication

All admin endpoints require JWT token in Authorization header:

```
Authorization: Bearer <jwt_token>
```

Get token via admin login (see below).

---

## Admin Login

**POST** `/api/auth/admin/login`

Login to get JWT token for admin operations.

**Request:**
```json
{
  "username": "admin",
  "password": "Admin@123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "6789abc123def456789abc12",
      "phone": "9876543210",
      "role": "ADMIN",
      "name": "Admin User",
      "username": "admin",
      "status": "ACTIVE"
    }
  }
}
```

---

## Endpoints

### 1. Get All Zones (Admin)

**GET** `/api/zones`

Fetch paginated list of all zones with filters.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| city | string | No | Filter by city name |
| status | string | No | `ACTIVE` or `INACTIVE` |
| orderingEnabled | boolean | No | Filter by ordering status |
| search | string | No | Search by pincode or name |
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 50, max: 100) |

**Request:**
```
GET /api/zones?city=Mumbai&status=ACTIVE&page=1&limit=20
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "zones": [
      {
        "_id": "6789abc123def456789abc01",
        "pincode": "400001",
        "name": "Fort",
        "city": "Mumbai",
        "state": "Maharashtra",
        "status": "ACTIVE",
        "orderingEnabled": true,
        "timezone": "Asia/Kolkata",
        "displayOrder": 1,
        "createdAt": "2025-01-10T10:00:00.000Z",
        "updatedAt": "2025-01-10T10:00:00.000Z"
      },
      {
        "_id": "6789abc123def456789abc02",
        "pincode": "400002",
        "name": "Kalbadevi",
        "city": "Mumbai",
        "state": "Maharashtra",
        "status": "ACTIVE",
        "orderingEnabled": true,
        "timezone": "Asia/Kolkata",
        "displayOrder": 2,
        "createdAt": "2025-01-10T10:00:00.000Z",
        "updatedAt": "2025-01-10T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "pages": 3
    }
  }
}
```

---

### 2. Create Zone

**POST** `/api/zones`

Create a new delivery zone.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "pincode": "400003",
  "name": "Mandvi",
  "city": "Mumbai",
  "state": "Maharashtra",
  "timezone": "Asia/Kolkata",
  "status": "INACTIVE",
  "orderingEnabled": true,
  "displayOrder": 3
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "zone": {
      "_id": "6789abc123def456789abc03",
      "pincode": "400003",
      "name": "Mandvi",
      "city": "Mumbai",
      "state": "Maharashtra",
      "status": "INACTIVE",
      "orderingEnabled": true,
      "timezone": "Asia/Kolkata",
      "displayOrder": 3,
      "createdBy": "6789abc123def456789abc12",
      "createdAt": "2025-01-10T10:00:00.000Z",
      "updatedAt": "2025-01-10T10:00:00.000Z"
    }
  },
  "message": "Zone created successfully"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Pincode must be 6 digits"
  }
}
```

**Error Response (409):**
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_ERROR",
    "message": "Zone with this pincode already exists"
  }
}
```

---

### 3. Get Zone by ID

**GET** `/api/zones/:id`

Fetch single zone details.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request:**
```
GET /api/zones/6789abc123def456789abc01
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "zone": {
      "_id": "6789abc123def456789abc01",
      "pincode": "400001",
      "name": "Fort",
      "city": "Mumbai",
      "state": "Maharashtra",
      "status": "ACTIVE",
      "orderingEnabled": true,
      "timezone": "Asia/Kolkata",
      "displayOrder": 1,
      "createdBy": "6789abc123def456789abc12",
      "createdAt": "2025-01-10T10:00:00.000Z",
      "updatedAt": "2025-01-10T10:00:00.000Z"
    }
  }
}
```

---

### 4. Update Zone

**PUT** `/api/zones/:id`

Update zone details (except pincode).

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Fort Area",
  "city": "Mumbai",
  "state": "Maharashtra",
  "timezone": "Asia/Kolkata",
  "displayOrder": 1
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "zone": {
      "_id": "6789abc123def456789abc01",
      "pincode": "400001",
      "name": "Fort Area",
      "city": "Mumbai",
      "state": "Maharashtra",
      "status": "ACTIVE",
      "orderingEnabled": true,
      "timezone": "Asia/Kolkata",
      "displayOrder": 1,
      "createdAt": "2025-01-10T10:00:00.000Z",
      "updatedAt": "2025-01-10T11:00:00.000Z"
    }
  },
  "message": "Zone updated successfully"
}
```

---

### 5. Activate Zone

**PATCH** `/api/zones/:id/activate`

Set zone status to ACTIVE.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request:**
```
PATCH /api/zones/6789abc123def456789abc01/activate
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "zone": {
      "_id": "6789abc123def456789abc01",
      "pincode": "400001",
      "name": "Fort",
      "status": "ACTIVE",
      "orderingEnabled": true
    }
  },
  "message": "Zone activated successfully"
}
```

---

### 6. Deactivate Zone

**PATCH** `/api/zones/:id/deactivate`

Set zone status to INACTIVE.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request:**
```
PATCH /api/zones/6789abc123def456789abc01/deactivate
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "zone": {
      "_id": "6789abc123def456789abc01",
      "pincode": "400001",
      "name": "Fort",
      "status": "INACTIVE",
      "orderingEnabled": true
    }
  },
  "message": "Zone deactivated successfully"
}
```

---

### 7. Toggle Ordering

**PATCH** `/api/zones/:id/ordering`

Enable/disable ordering for a zone (temporary pause).

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "orderingEnabled": false
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "zone": {
      "_id": "6789abc123def456789abc01",
      "pincode": "400001",
      "name": "Fort",
      "status": "ACTIVE",
      "orderingEnabled": false
    }
  },
  "message": "Ordering disabled for zone"
}
```

---

### 8. Delete Zone

**DELETE** `/api/zones/:id`

Delete a zone (only if no kitchens are assigned).

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request:**
```
DELETE /api/zones/6789abc123def456789abc01
```

**Response (200):**
```json
{
  "success": true,
  "message": "Zone deleted successfully"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": {
    "code": "ZONE_IN_USE",
    "message": "Cannot delete zone with assigned kitchens"
  }
}
```

---

### 9. Get Cities (Public)

**GET** `/api/zones/cities`

Get distinct cities (for dropdown filters).

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | No | `ACTIVE`, `INACTIVE`, or `ALL` (default: ACTIVE) |

**Request:**
```
GET /api/zones/cities?status=ACTIVE
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "cities": ["Mumbai", "Pune", "Bangalore"]
  }
}
```

---

### 10. Lookup Zone by Pincode (Public)

**GET** `/api/zones/lookup/:pincode`

Check if a pincode is serviceable.

**Request:**
```
GET /api/zones/lookup/400001
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "zone": {
      "_id": "6789abc123def456789abc01",
      "pincode": "400001",
      "name": "Fort",
      "city": "Mumbai",
      "isServiceable": true
    }
  }
}
```

**Response (404):**
```json
{
  "success": false,
  "error": {
    "code": "ZONE_NOT_FOUND",
    "message": "This pincode is not serviceable"
  }
}
```

---

## Data Model Reference

```typescript
interface Zone {
  _id: string;
  pincode: string;           // 6 digits, unique
  name: string;              // Zone name (e.g., "Fort")
  city: string;              // City name
  state?: string;            // State name
  status: "ACTIVE" | "INACTIVE";
  orderingEnabled: boolean;  // Can accept orders
  timezone: string;          // Default: "Asia/Kolkata"
  displayOrder: number;      // For sorting
  createdBy?: string;        // Admin user ID
  createdAt: string;
  updatedAt: string;
}
```

---

## UI Implementation Notes

1. **Data Table**: Display zones with columns: Pincode, Name, City, Status, Ordering, Actions
2. **Filters**: City dropdown, Status dropdown, Search by pincode/name
3. **Actions**: Edit, Activate/Deactivate toggle, Toggle Ordering, Delete
4. **Form**: Create/Edit modal with validation
5. **Status Badges**: Green for ACTIVE, Gray for INACTIVE
6. **Ordering Toggle**: Separate switch from status (for temporary pause)
