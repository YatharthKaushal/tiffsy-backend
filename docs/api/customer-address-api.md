# Customer Address Management API

> **PROMPT**: Implement address management for the customer app. User can add multiple delivery addresses with location picker (Google Maps). Check serviceability by pincode before saving. Show serviceable kitchens for each address. Allow setting default address, editing, and soft-deleting addresses. Display serviceability status on each address card.

---

## Authentication

All endpoints require Firebase ID Token:
```
Authorization: Bearer <firebase_id_token>
```

---

## Endpoints

### 1. Check Serviceability (Public)

**GET** `/api/addresses/check-serviceability`

Check if a pincode is serviceable before adding address.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| pincode | string | Yes | 6-digit pincode |

**Request:**
```
GET /api/addresses/check-serviceability?pincode=400001
```

**Response (200) - Serviceable:**
```json
{
  "success": true,
  "message": "Serviceability checked",
  "data": {
    "pincode": "400001",
    "isServiceable": true,
    "zone": {
      "_id": "6789zone123abc456789ab01",
      "name": "Fort",
      "city": "Mumbai"
    },
    "kitchenCount": 3,
    "message": "We deliver to this area!"
  }
}
```

**Response (200) - Not Serviceable:**
```json
{
  "success": true,
  "message": "Serviceability checked",
  "data": {
    "pincode": "999999",
    "isServiceable": false,
    "zone": null,
    "kitchenCount": 0,
    "message": "Sorry, we don't deliver to this area yet"
  }
}
```

---

### 2. Create Address

**POST** `/api/addresses`

Create a new delivery address.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Request Body:**
```json
{
  "label": "Home",
  "addressLine1": "123, Tower A, Sky Heights",
  "addressLine2": "Near Central Park",
  "landmark": "Opposite Metro Station",
  "locality": "Fort",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "contactName": "John Doe",
  "contactPhone": "9876543210",
  "coordinates": {
    "latitude": 18.9322,
    "longitude": 72.8347
  },
  "isDefault": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| label | string | Yes | Label (Home, Work, etc.), max 50 chars |
| addressLine1 | string | Yes | Street address, 5-200 chars |
| addressLine2 | string | No | Additional address line |
| landmark | string | No | Nearby landmark, max 100 chars |
| locality | string | Yes | Area/neighborhood, 2-100 chars |
| city | string | Yes | City name, 2-100 chars |
| state | string | No | State name |
| pincode | string | Yes | 6-digit pincode |
| contactName | string | No | Delivery contact name |
| contactPhone | string | No | 10-15 digit phone |
| coordinates | object | No | { latitude, longitude } |
| isDefault | boolean | No | Set as default address |

**Response (201):**
```json
{
  "success": true,
  "message": "Address created successfully",
  "data": {
    "address": {
      "_id": "6789addr123abc456789ab01",
      "userId": "6789user123abc456789ab01",
      "label": "Home",
      "addressLine1": "123, Tower A, Sky Heights",
      "addressLine2": "Near Central Park",
      "landmark": "Opposite Metro Station",
      "locality": "Fort",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "contactName": "John Doe",
      "contactPhone": "9876543210",
      "coordinates": {
        "latitude": 18.9322,
        "longitude": 72.8347
      },
      "zoneId": "6789zone123abc456789ab01",
      "isServiceable": true,
      "isDefault": true,
      "isDeleted": false,
      "createdAt": "2025-01-10T10:00:00.000Z"
    },
    "isServiceable": true,
    "zone": {
      "_id": "6789zone123abc456789ab01",
      "name": "Fort",
      "city": "Mumbai"
    }
  }
}
```

---

### 3. Get All Addresses

**GET** `/api/addresses`

Get all addresses for authenticated user.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| includeDeleted | boolean | No | Include soft-deleted addresses |

**Request:**
```
GET /api/addresses
```

**Response (200):**
```json
{
  "success": true,
  "message": "Addresses retrieved",
  "data": {
    "addresses": [
      {
        "_id": "6789addr123abc456789ab01",
        "label": "Home",
        "addressLine1": "123, Tower A, Sky Heights",
        "locality": "Fort",
        "city": "Mumbai",
        "pincode": "400001",
        "zoneId": {
          "_id": "6789zone123abc456789ab01",
          "name": "Fort",
          "city": "Mumbai",
          "status": "ACTIVE"
        },
        "isServiceable": true,
        "isDefault": true,
        "createdAt": "2025-01-10T10:00:00.000Z"
      },
      {
        "_id": "6789addr123abc456789ab02",
        "label": "Work",
        "addressLine1": "456, Tech Park, Building B",
        "locality": "Andheri East",
        "city": "Mumbai",
        "pincode": "400069",
        "zoneId": {
          "_id": "6789zone123abc456789ab02",
          "name": "Andheri East",
          "city": "Mumbai",
          "status": "ACTIVE"
        },
        "isServiceable": true,
        "isDefault": false,
        "createdAt": "2025-01-05T10:00:00.000Z"
      }
    ],
    "defaultAddressId": "6789addr123abc456789ab01"
  }
}
```

---

### 4. Get Address by ID

**GET** `/api/addresses/:id`

Get address details with kitchen availability.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Request:**
```
GET /api/addresses/6789addr123abc456789ab01
```

**Response (200):**
```json
{
  "success": true,
  "message": "Address retrieved",
  "data": {
    "address": {
      "_id": "6789addr123abc456789ab01",
      "label": "Home",
      "addressLine1": "123, Tower A, Sky Heights",
      "addressLine2": "Near Central Park",
      "landmark": "Opposite Metro Station",
      "locality": "Fort",
      "city": "Mumbai",
      "pincode": "400001",
      "contactName": "John Doe",
      "contactPhone": "9876543210",
      "coordinates": {
        "latitude": 18.9322,
        "longitude": 72.8347
      },
      "isServiceable": true,
      "isDefault": true
    },
    "zone": {
      "_id": "6789zone123abc456789ab01",
      "name": "Fort",
      "city": "Mumbai",
      "status": "ACTIVE",
      "orderingEnabled": true
    },
    "isServiceable": true,
    "availableKitchens": 3
  }
}
```

---

### 5. Update Address

**PUT** `/api/addresses/:id`

Update an existing address.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Request Body:**
```json
{
  "label": "Home - Updated",
  "addressLine1": "123, Tower A, Sky Heights - New Wing",
  "landmark": "Near New Mall",
  "isDefault": true
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Address updated successfully",
  "data": {
    "address": {
      "_id": "6789addr123abc456789ab01",
      "label": "Home - Updated",
      "addressLine1": "123, Tower A, Sky Heights - New Wing",
      "landmark": "Near New Mall",
      "isServiceable": true,
      "isDefault": true
    },
    "isServiceable": true,
    "zone": {
      "name": "Fort",
      "city": "Mumbai"
    }
  }
}
```

---

### 6. Delete Address

**DELETE** `/api/addresses/:id`

Soft delete an address.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Request:**
```
DELETE /api/addresses/6789addr123abc456789ab01
```

**Response (200):**
```json
{
  "success": true,
  "message": "Address deleted successfully"
}
```

**Response (400) - Has Pending Orders:**
```json
{
  "success": false,
  "message": "Cannot delete address with pending orders"
}
```

---

### 7. Set Default Address

**PATCH** `/api/addresses/:id/default`

Set an address as the default delivery address.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Request:**
```
PATCH /api/addresses/6789addr123abc456789ab02/default
```

**Response (200):**
```json
{
  "success": true,
  "message": "Default address updated",
  "data": {
    "defaultAddressId": "6789addr123abc456789ab02"
  }
}
```

---

### 8. Get Kitchens for Address

**GET** `/api/addresses/:id/kitchens`

Get all kitchens that serve this address.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| menuType | string | No | `MEAL_MENU` or `ON_DEMAND_MENU` |

**Request:**
```
GET /api/addresses/6789addr123abc456789ab01/kitchens
```

**Response (200):**
```json
{
  "success": true,
  "message": "Kitchens retrieved",
  "data": {
    "kitchens": [
      {
        "_id": "6789kit123abc456789ab01",
        "name": "Tiffsy Central Kitchen",
        "code": "KIT-A2B3C",
        "type": "TIFFSY",
        "premiumFlag": false,
        "gourmetFlag": false,
        "logo": "https://cdn.tiffsy.com/kitchens/central.jpg",
        "cuisineTypes": ["North Indian", "South Indian"],
        "averageRating": 4.5
      },
      {
        "_id": "6789kit123abc456789ab02",
        "name": "Mumbai Dabba Express",
        "code": "KIT-D4E5F",
        "type": "PARTNER",
        "premiumFlag": true,
        "gourmetFlag": false,
        "logo": "https://cdn.tiffsy.com/kitchens/dabba.jpg",
        "cuisineTypes": ["Maharashtrian", "Gujarati"],
        "averageRating": 4.2
      }
    ],
    "count": 2
  }
}
```

**Response (200) - Not Serviceable:**
```json
{
  "success": true,
  "message": "Kitchens retrieved",
  "data": {
    "kitchens": [],
    "count": 0,
    "message": "This address is not serviceable"
  }
}
```

---

## Data Model

```typescript
interface CustomerAddress {
  _id: string;
  userId: string;
  label: string;                    // "Home", "Work", etc.
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  locality: string;
  city: string;
  state?: string;
  pincode: string;                  // 6 digits
  contactName?: string;
  contactPhone?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  zoneId?: string;                  // Auto-set based on pincode
  isServiceable: boolean;           // Auto-set based on zone
  isDefault: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## UI Implementation Notes

1. **Address List Screen**: FlatList of addresses, default badge, serviceability indicator
2. **Add Address Screen**:
   - Location picker (Google Maps)
   - Auto-fill from pin drop
   - Pincode serviceability check before save
   - Label selector (Home, Work, Other)
3. **Edit Address Screen**: Pre-filled form, update pincode triggers serviceability re-check
4. **Serviceability Indicators**:
   - Green check: Serviceable
   - Red warning: Not serviceable
5. **Swipe Actions**: Set default, Edit, Delete
6. **Empty State**: "Add your first delivery address"
