# Driver Order History API - Quick Reference Card

## 🎯 Endpoint

```http
GET http://localhost:5005/api/orders/driver
```

## 🔑 Authentication

```http
Authorization: Bearer <JWT_TOKEN>
```

## 📤 Request

**No query parameters needed** - automatically returns orders for authenticated driver.

```bash
curl -X GET "http://localhost:5005/api/orders/driver" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📥 Response

```json
{
  "success": true,
  "message": "Driver orders retrieved",
  "data": {
    "orders": [
      {
        "_id": "673d4e8f1234567890abcdef",
        "orderNumber": "ORD-20260115-A7B3C",
        "userId": {
          "name": "John Doe",
          "phone": "+919876543210"
        },
        "deliveryAddress": {
          "addressLine1": "456 Park Avenue",
          "locality": "Rohini",
          "city": "New Delhi",
          "coordinates": {
            "latitude": 28.7041,
            "longitude": 77.1025
          }
        },
        "status": "OUT_FOR_DELIVERY",
        "items": [...],
        "deliveryNotes": "Call on arrival"
      }
    ]
  }
}
```

## 🔄 Order Status

API returns **only** these statuses:
- `PICKED_UP` - Order picked up from kitchen
- `OUT_FOR_DELIVERY` - On the way to deliver

## 💡 Quick Implementation

```javascript
// 1. Fetch orders
const response = await fetch('http://localhost:5005/api/orders/driver', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
const orders = data.data.orders;

// 2. Display order
orders.forEach(order => {
  console.log(`Order: ${order.orderNumber}`);
  console.log(`Customer: ${order.userId.name}`);
  console.log(`Address: ${order.deliveryAddress.addressLine1}`);
  console.log(`Status: ${order.status}`);
});

// 3. Call customer
window.location.href = `tel:${order.userId.phone}`;

// 4. Navigate to address
const lat = order.deliveryAddress.coordinates.latitude;
const lng = order.deliveryAddress.coordinates.longitude;
window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
```

## ⚠️ Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Display orders |
| 401 | Unauthorized | Redirect to login |
| 403 | Forbidden | Not a driver |
| 500 | Server Error | Show retry |

## 📋 Key Fields

### Must Display:
- `orderNumber` - Order ID
- `userId.name` - Customer name
- `userId.phone` - Customer phone
- `deliveryAddress.*` - Full address
- `status` - Current status
- `items` - Order items
- `deliveryNotes` - Special instructions

### For Actions:
- `userId.phone` - For calling
- `deliveryAddress.coordinates` - For navigation

## 🎨 UI Elements Needed

- Order list/cards
- Customer info section
- Delivery address section
- Call button (`tel:` link)
- Navigate button (Google Maps link)
- Status badge
- Pull-to-refresh
- Empty state

## 📚 Full Documentation

For complete details, see:
- **API Docs**: `docs/DRIVER_ORDER_HISTORY_API.md`
- **Integration Guide**: `docs/CLAUDE_INTEGRATION_PROMPT.md`
- **Source Code**: `src/order/order.controller.js:1507`

---

**Ready to build?** Start with reading `DRIVER_ORDER_HISTORY_API.md` 🚀
