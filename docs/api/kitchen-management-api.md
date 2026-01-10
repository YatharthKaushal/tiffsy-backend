# Kitchen Management API

> **PROMPT**: Implement kitchen onboarding and management for the admin dashboard. Kitchens can be TIFFSY-owned or PARTNER. Admin can create kitchens, assign zones, update details, manage flags (authorized/premium/gourmet), and control status. Implement a data table with filters by type/status/zone, kitchen detail view, zone assignment UI, and status management. Handle operating hours configuration.

---

## Authentication

All admin endpoints require JWT token:

```
Authorization: Bearer <jwt_token>
```

---

## Endpoints

### 1. Get All Kitchens

**GET** `/api/kitchens`

Fetch paginated list of kitchens with filters.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | No | `TIFFSY` or `PARTNER` |
| status | string | No | `ACTIVE`, `INACTIVE`, `PENDING_APPROVAL`, `SUSPENDED` |
| zoneId | string | No | Filter by zone (24-char hex) |
| search | string | No | Search by name |
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 50, max: 100) |

**Request:**
```
GET /api/kitchens?type=TIFFSY&status=ACTIVE&page=1&limit=20
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kitchens": [
      {
        "_id": "6789def123abc456789def01",
        "name": "Tiffsy Central Kitchen",
        "code": "KIT-A2B3C",
        "type": "TIFFSY",
        "authorizedFlag": true,
        "premiumFlag": false,
        "gourmetFlag": false,
        "logo": "https://cdn.tiffsy.com/kitchens/central-logo.png",
        "coverImage": "https://cdn.tiffsy.com/kitchens/central-cover.jpg",
        "description": "Main Tiffsy kitchen serving Mumbai",
        "cuisineTypes": ["North Indian", "South Indian", "Chinese"],
        "address": {
          "addressLine1": "Plot 45, Industrial Area",
          "addressLine2": "Near Metro Station",
          "locality": "Andheri East",
          "city": "Mumbai",
          "state": "Maharashtra",
          "pincode": "400069",
          "coordinates": {
            "latitude": 19.1136,
            "longitude": 72.8697
          }
        },
        "zonesServed": [
          {
            "_id": "6789abc123def456789abc01",
            "pincode": "400001",
            "name": "Fort",
            "city": "Mumbai"
          },
          {
            "_id": "6789abc123def456789abc02",
            "pincode": "400002",
            "name": "Kalbadevi",
            "city": "Mumbai"
          }
        ],
        "operatingHours": {
          "lunch": {
            "startTime": "10:00",
            "endTime": "14:00"
          },
          "dinner": {
            "startTime": "18:00",
            "endTime": "22:00"
          },
          "onDemand": {
            "startTime": "09:00",
            "endTime": "23:00",
            "isAlwaysOpen": false
          }
        },
        "contactPhone": "9876543210",
        "contactEmail": "central@tiffsy.com",
        "status": "ACTIVE",
        "isAcceptingOrders": true,
        "averageRating": 4.5,
        "totalRatings": 1250,
        "createdAt": "2025-01-01T10:00:00.000Z",
        "updatedAt": "2025-01-10T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 12,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

---

### 2. Create Kitchen

**POST** `/api/kitchens`

Onboard a new kitchen.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Spice Garden Kitchen",
  "type": "PARTNER",
  "authorizedFlag": false,
  "premiumFlag": true,
  "gourmetFlag": false,
  "logo": "https://cdn.tiffsy.com/kitchens/spice-garden-logo.png",
  "coverImage": "https://cdn.tiffsy.com/kitchens/spice-garden-cover.jpg",
  "description": "Authentic North Indian cuisine with premium ingredients",
  "cuisineTypes": ["North Indian", "Mughlai"],
  "address": {
    "addressLine1": "Shop 12, Food Court",
    "addressLine2": "Phoenix Mall",
    "locality": "Lower Parel",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400013",
    "coordinates": {
      "latitude": 18.9932,
      "longitude": 72.8265
    }
  },
  "zonesServed": ["6789abc123def456789abc01", "6789abc123def456789abc02"],
  "operatingHours": {
    "lunch": {
      "startTime": "11:00",
      "endTime": "15:00"
    },
    "dinner": {
      "startTime": "19:00",
      "endTime": "23:00"
    },
    "onDemand": {
      "startTime": "11:00",
      "endTime": "23:00",
      "isAlwaysOpen": false
    }
  },
  "contactPhone": "9876543211",
  "contactEmail": "partner@spicegarden.com",
  "ownerName": "Raj Sharma",
  "ownerPhone": "9876543212"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "kitchen": {
      "_id": "6789def123abc456789def02",
      "name": "Spice Garden Kitchen",
      "code": "KIT-X9Y8Z",
      "type": "PARTNER",
      "authorizedFlag": false,
      "premiumFlag": true,
      "gourmetFlag": false,
      "status": "PENDING_APPROVAL",
      "isAcceptingOrders": false,
      "averageRating": 0,
      "totalRatings": 0,
      "createdBy": "6789abc123def456789abc12",
      "createdAt": "2025-01-10T10:00:00.000Z"
    }
  },
  "message": "Kitchen created successfully"
}
```

---

### 3. Get Kitchen by ID

**GET** `/api/kitchens/:id`

Fetch complete kitchen details.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request:**
```
GET /api/kitchens/6789def123abc456789def01
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kitchen": {
      "_id": "6789def123abc456789def01",
      "name": "Tiffsy Central Kitchen",
      "code": "KIT-A2B3C",
      "type": "TIFFSY",
      "authorizedFlag": true,
      "premiumFlag": false,
      "gourmetFlag": false,
      "logo": "https://cdn.tiffsy.com/kitchens/central-logo.png",
      "coverImage": "https://cdn.tiffsy.com/kitchens/central-cover.jpg",
      "description": "Main Tiffsy kitchen serving Mumbai",
      "cuisineTypes": ["North Indian", "South Indian", "Chinese"],
      "address": {
        "addressLine1": "Plot 45, Industrial Area",
        "addressLine2": "Near Metro Station",
        "locality": "Andheri East",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400069",
        "coordinates": {
          "latitude": 19.1136,
          "longitude": 72.8697
        }
      },
      "zonesServed": [
        {
          "_id": "6789abc123def456789abc01",
          "pincode": "400001",
          "name": "Fort",
          "city": "Mumbai",
          "status": "ACTIVE"
        }
      ],
      "operatingHours": {
        "lunch": {
          "startTime": "10:00",
          "endTime": "14:00"
        },
        "dinner": {
          "startTime": "18:00",
          "endTime": "22:00"
        },
        "onDemand": {
          "startTime": "09:00",
          "endTime": "23:00",
          "isAlwaysOpen": false
        }
      },
      "contactPhone": "9876543210",
      "contactEmail": "central@tiffsy.com",
      "ownerName": null,
      "ownerPhone": null,
      "status": "ACTIVE",
      "isAcceptingOrders": true,
      "averageRating": 4.5,
      "totalRatings": 1250,
      "createdBy": {
        "_id": "6789abc123def456789abc12",
        "name": "Admin User"
      },
      "approvedBy": {
        "_id": "6789abc123def456789abc12",
        "name": "Admin User"
      },
      "approvedAt": "2025-01-01T12:00:00.000Z",
      "createdAt": "2025-01-01T10:00:00.000Z",
      "updatedAt": "2025-01-10T10:00:00.000Z"
    }
  }
}
```

---

### 4. Update Kitchen

**PUT** `/api/kitchens/:id`

Update kitchen details.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Tiffsy Central Kitchen - Updated",
  "description": "Main Tiffsy kitchen serving Greater Mumbai",
  "cuisineTypes": ["North Indian", "South Indian", "Chinese", "Continental"],
  "operatingHours": {
    "lunch": {
      "startTime": "10:30",
      "endTime": "14:30"
    },
    "dinner": {
      "startTime": "18:30",
      "endTime": "22:30"
    }
  },
  "contactPhone": "9876543220",
  "contactEmail": "central-new@tiffsy.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kitchen": {
      "_id": "6789def123abc456789def01",
      "name": "Tiffsy Central Kitchen - Updated",
      "description": "Main Tiffsy kitchen serving Greater Mumbai",
      "updatedAt": "2025-01-10T11:00:00.000Z"
    }
  },
  "message": "Kitchen updated successfully"
}
```

---

### 5. Update Kitchen Type

**PATCH** `/api/kitchens/:id/type`

Change kitchen type (TIFFSY/PARTNER).

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "type": "TIFFSY"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kitchen": {
      "_id": "6789def123abc456789def02",
      "name": "Spice Garden Kitchen",
      "type": "TIFFSY"
    }
  },
  "message": "Kitchen type updated"
}
```

---

### 6. Update Kitchen Flags

**PATCH** `/api/kitchens/:id/flags`

Update quality flags (authorized, premium, gourmet).

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "authorizedFlag": true,
  "premiumFlag": true,
  "gourmetFlag": false
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kitchen": {
      "_id": "6789def123abc456789def01",
      "name": "Tiffsy Central Kitchen",
      "authorizedFlag": true,
      "premiumFlag": true,
      "gourmetFlag": false
    }
  },
  "message": "Kitchen flags updated"
}
```

---

### 7. Update Zones Served

**PATCH** `/api/kitchens/:id/zones`

Assign/update zones that kitchen serves.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "zonesServed": [
    "6789abc123def456789abc01",
    "6789abc123def456789abc02",
    "6789abc123def456789abc03"
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kitchen": {
      "_id": "6789def123abc456789def01",
      "name": "Tiffsy Central Kitchen",
      "zonesServed": [
        {
          "_id": "6789abc123def456789abc01",
          "pincode": "400001",
          "name": "Fort"
        },
        {
          "_id": "6789abc123def456789abc02",
          "pincode": "400002",
          "name": "Kalbadevi"
        },
        {
          "_id": "6789abc123def456789abc03",
          "pincode": "400003",
          "name": "Mandvi"
        }
      ]
    }
  },
  "message": "Zones updated successfully"
}
```

---

### 8. Activate Kitchen

**PATCH** `/api/kitchens/:id/activate`

Set kitchen status to ACTIVE.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request:**
```
PATCH /api/kitchens/6789def123abc456789def02/activate
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kitchen": {
      "_id": "6789def123abc456789def02",
      "name": "Spice Garden Kitchen",
      "status": "ACTIVE",
      "approvedBy": "6789abc123def456789abc12",
      "approvedAt": "2025-01-10T12:00:00.000Z"
    }
  },
  "message": "Kitchen activated successfully"
}
```

---

### 9. Deactivate Kitchen

**PATCH** `/api/kitchens/:id/deactivate`

Set kitchen status to INACTIVE.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kitchen": {
      "_id": "6789def123abc456789def02",
      "name": "Spice Garden Kitchen",
      "status": "INACTIVE"
    }
  },
  "message": "Kitchen deactivated successfully"
}
```

---

### 10. Suspend Kitchen

**PATCH** `/api/kitchens/:id/suspend`

Suspend kitchen with reason.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "reason": "Quality issues reported by multiple customers. Under review."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kitchen": {
      "_id": "6789def123abc456789def02",
      "name": "Spice Garden Kitchen",
      "status": "SUSPENDED"
    }
  },
  "message": "Kitchen suspended"
}
```

---

### 11. Toggle Order Acceptance

**PATCH** `/api/kitchens/:id/accepting-orders`

Enable/disable order acceptance (temporary pause).

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request:**
```json
{
  "isAcceptingOrders": false
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kitchen": {
      "_id": "6789def123abc456789def01",
      "name": "Tiffsy Central Kitchen",
      "isAcceptingOrders": false
    }
  },
  "message": "Order acceptance disabled"
}
```

---

### 12. Delete Kitchen (Soft Delete)

**DELETE** `/api/kitchens/:id`

Soft delete a kitchen.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request:**
```
DELETE /api/kitchens/6789def123abc456789def02
```

**Response (200):**
```json
{
  "success": true,
  "message": "Kitchen deleted successfully"
}
```

---

### 13. Get Kitchens for Zone (Public)

**GET** `/api/kitchens/zone/:zoneId`

Get active kitchens serving a zone.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| menuType | string | No | `MEAL_MENU` or `ON_DEMAND_MENU` |

**Request:**
```
GET /api/kitchens/zone/6789abc123def456789abc01?menuType=MEAL_MENU
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kitchens": [
      {
        "_id": "6789def123abc456789def01",
        "name": "Tiffsy Central Kitchen",
        "logo": "https://cdn.tiffsy.com/kitchens/central-logo.png",
        "cuisineTypes": ["North Indian", "South Indian"],
        "averageRating": 4.5,
        "isAcceptingOrders": true
      }
    ]
  }
}
```

---

## Data Model Reference

```typescript
interface Kitchen {
  _id: string;
  name: string;
  code: string;                    // Auto-generated (KIT-XXXXX)
  type: "TIFFSY" | "PARTNER";
  authorizedFlag: boolean;         // Tiffsy verified
  premiumFlag: boolean;            // Premium quality
  gourmetFlag: boolean;            // Gourmet category
  logo?: string;                   // URL
  coverImage?: string;             // URL
  description?: string;
  cuisineTypes: string[];
  address: {
    addressLine1: string;
    addressLine2?: string;
    locality: string;
    city: string;
    state?: string;
    pincode: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  zonesServed: string[] | Zone[];  // Zone IDs or populated
  operatingHours: {
    lunch?: { startTime: string; endTime: string; };
    dinner?: { startTime: string; endTime: string; };
    onDemand?: { startTime: string; endTime: string; isAlwaysOpen: boolean; };
  };
  contactPhone?: string;
  contactEmail?: string;
  ownerName?: string;              // For PARTNER
  ownerPhone?: string;             // For PARTNER
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_APPROVAL" | "DELETED";
  isAcceptingOrders: boolean;
  averageRating: number;
  totalRatings: number;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## UI Implementation Notes

1. **Data Table**: Columns - Name, Type, Status, Zones, Rating, Accepting Orders, Actions
2. **Filters**: Type dropdown, Status dropdown, Zone multi-select, Search
3. **Kitchen Detail View**: Full information with edit capability
4. **Zone Assignment**: Multi-select dropdown with zone search
5. **Operating Hours**: Time picker inputs for each meal window
6. **Flags**: Checkboxes or toggle switches
7. **Status Badges**:
   - ACTIVE: Green
   - INACTIVE: Gray
   - PENDING_APPROVAL: Yellow
   - SUSPENDED: Red
8. **Type Badge**: TIFFSY (Blue), PARTNER (Purple)
