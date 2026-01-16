# API Documentation Index

Welcome to the Tiffsy Backend API Documentation! 📚

## Available Documentation

### 🚗 Driver Features

#### Driver Order History API
Complete documentation for integrating the driver's active delivery orders feature.

**Files:**
1. **[DRIVER_ORDER_HISTORY_API.md](DRIVER_ORDER_HISTORY_API.md)** ⭐ START HERE
   - Complete API specification
   - Request/Response examples
   - Integration guide with code samples
   - Error handling
   - Testing guide

2. **[CLAUDE_INTEGRATION_PROMPT.md](CLAUDE_INTEGRATION_PROMPT.md)**
   - Ready-to-use prompt for Claude AI
   - Step-by-step implementation instructions
   - Requirements checklist
   - Success criteria

3. **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)**
   - One-page quick reference
   - Essential fields and examples
   - Common code snippets

#### Driver Profile Management API
Complete documentation for driver profile and vehicle management features.

**File:**
1. **[DRIVER_PROFILE_API.md](DRIVER_PROFILE_API.md)** ⭐ NEW
   - 6 complete API endpoints
   - Profile update (name, email, image)
   - Vehicle details management
   - Document update requests
   - Delivery statistics
   - Complete React integration examples

---

## Getting Started

### For Frontend Developers

**To integrate Driver Order History:**

1. **Read the full documentation:**
   ```
   docs/DRIVER_ORDER_HISTORY_API.md
   ```

2. **Use the integration prompt:**
   ```
   docs/CLAUDE_INTEGRATION_PROMPT.md
   ```

3. **Keep the quick reference handy:**
   ```
   docs/QUICK_REFERENCE.md
   ```

### For AI-Assisted Development

**If using Claude Code or similar AI tools:**

Share this prompt:
```
I need to integrate the Driver Order History API into my app.
Please read docs/DRIVER_ORDER_HISTORY_API.md and implement the feature
following the guidelines in docs/CLAUDE_INTEGRATION_PROMPT.md.

I'm using [your framework/language].
```

---

## Quick Links

### Essential Information

**API Base URL:**
```
http://localhost:5005/api
```

**Driver Orders Endpoint:**
```
GET /api/orders/driver
```

**Authentication:**
```http
Authorization: Bearer <JWT_TOKEN>
```

---

## Documentation Structure

```
docs/
├── README.md                          # This file (index)
├── DRIVER_ORDER_HISTORY_API.md       # Complete API docs
├── CLAUDE_INTEGRATION_PROMPT.md      # Integration guide
└── QUICK_REFERENCE.md                # Quick reference card
```

---

## Backend Source Code Reference

For developers who need to understand the backend implementation:

**Driver Orders:**
- Controller: `src/order/order.controller.js` (line 1507)
- Route: `src/order/order.routes.js` (line 69)
- Schema: `schema/order.schema.js`

**Driver Profile:**
- Controller: `src/driver/driver.controller.js`
- Route: `src/driver/driver.routes.js`
- Validation: `src/driver/driver.validation.js`
- Schema: `schema/user.schema.js`

**Voucher Fix (Latest):**
- Controller: `src/order/order.controller.js` (line 676-706)
- Fixed voucher eligibility calculation bug

---

## Recent Updates

### 2026-01-15
- ✅ **Fixed voucher eligibility bug** in `/api/orders/calculate-pricing`
  - Now correctly calculates `canUse` based on main courses in order
  - No longer requires frontend to calculate voucher count
  - See `src/order/order.controller.js:676-706`

- ✅ **Created complete Driver Order History API documentation**
  - Full API specification
  - Integration guide
  - Quick reference card

- ✅ **Implemented Driver Profile Management System**
  - 6 new API endpoints for driver profile management
  - Update profile (name, email, profile image)
  - Update vehicle details (name, number, type)
  - Request document updates (admin approval required)
  - View delivery statistics
  - Complete documentation with examples

---

## Support

### Need Help?

1. **Check the documentation** in this folder first
2. **Review the source code** in the referenced files
3. **Test the API** using the examples provided

### Backend Details

**Server:**
- Port: `5005` (configurable in `.env`)
- Base URL: `http://localhost:5005/api`
- Database: MongoDB

**Environment:**
```bash
# Check if server is running
curl http://localhost:5005/api/health

# Expected response:
# { "success": true, "status": "ok" }
```

---

## Contributing

When adding new documentation:

1. Create descriptive file names (e.g., `FEATURE_NAME_API.md`)
2. Follow the structure of existing docs
3. Include request/response examples
4. Add error handling guide
5. Update this README with links

---

## Version History

| Date | Change | Files |
|------|--------|-------|
| 2026-01-15 | Initial documentation created | All docs |
| 2026-01-15 | Fixed voucher eligibility bug | order.controller.js |

---

## Quick Start for Common Tasks

### I want to fetch driver's active orders
→ Read: `DRIVER_ORDER_HISTORY_API.md`

### I want to manage driver profile
→ Read: `DRIVER_PROFILE_API.md`

### I need a quick reference
→ Read: `QUICK_REFERENCE.md`

### I'm using Claude to build the frontend
→ Share: `CLAUDE_INTEGRATION_PROMPT.md`

### I need to understand the backend code
→ Check: `src/order/order.controller.js` or `src/driver/driver.controller.js`

---

**Happy coding!** 🚀

For questions or issues, refer to the specific documentation files above.
