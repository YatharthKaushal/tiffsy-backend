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

### 🎟️ Consumer App - Voucher Expiry

#### Voucher Expiry Implementation Guide
Complete documentation for implementing voucher expiry features in the consumer mobile app.

**Files:**
1. **[FRONTEND_TEAM_PROMPT.md](FRONTEND_TEAM_PROMPT.md)** ⭐ START HERE
   - Quick start implementation prompt
   - Priority features and timeline
   - Essential requirements
   - Testing checklist
   - Week-by-week implementation plan

2. **[CONSUMER_APP_VOUCHER_EXPIRY_GUIDE.md](CONSUMER_APP_VOUCHER_EXPIRY_GUIDE.md)**
   - Comprehensive implementation guide
   - Complete API specifications
   - Full UI/UX requirements
   - React Native code examples
   - 10 detailed test cases
   - Troubleshooting and FAQ

**Backend Documentation:**
- **[Production Deployment Guide](../PRODUCTION_DEPLOYMENT.md)** - Backend setup
- **[Deployment Status](../DEPLOYMENT_STATUS.md)** - Current status (20/21 checks passed)
- **[Command Reference](../COMMAND_REFERENCE.md)** - Quick command reference

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

**To integrate Consumer App Voucher Expiry:**

1. **Start with the prompt:**
   ```
   docs/FRONTEND_TEAM_PROMPT.md
   ```

2. **Read the comprehensive guide:**
   ```
   docs/CONSUMER_APP_VOUCHER_EXPIRY_GUIDE.md
   ```

3. **Backend team references:**
   ```
   PRODUCTION_DEPLOYMENT.md
   DEPLOYMENT_STATUS.md
   COMMAND_REFERENCE.md
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

**Voucher System:**
- Pricing Logic: `src/order/order.controller.js` (line 244-400)
- Eligibility Check: `src/order/order.controller.js` (line 676-706)
- Expiry Cron: `scripts/voucher-expiry-cron.js`
- Cron Scheduler: `cron/scheduler.js`
- Admin Controller: `src/admin/cron.controller.js`
- Schema: `schema/voucher.schema.js`

---

## Recent Updates

### 2026-01-26 ⭐ NEW
- ✅ **Implemented Production Voucher Expiry System**
  - Automated cron job running daily at 8:00 AM IST
  - Auto-initializes on server startup with node-cron
  - Admin API endpoints for manual triggers and monitoring
  - PM2 process management configuration
  - Graceful shutdown handlers
  - Comprehensive testing suite (9 tests, all passing)
  - See `cron/scheduler.js` and `scripts/voucher-expiry-cron.js`

- ✅ **Created Complete Consumer App Documentation**
  - Frontend team implementation prompt
  - Comprehensive voucher expiry guide
  - React Native code examples
  - 10 detailed test cases
  - UI/UX specifications
  - Error handling patterns

- ✅ **Fixed Critical Voucher Pricing Bug**
  - Voucher now covers ONLY base meal price (not add-ons)
  - Add-ons always paid by customer
  - All charges waived when voucher applied
  - See `src/order/order.controller.js:244-400`

- ✅ **Fixed OTP Verification Bug**
  - OTP now verified BEFORE marking delivery as delivered
  - Wrong OTP properly rejected with error message
  - See `src/delivery/delivery.controller.js:824-875`

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
| 2026-01-26 | Production voucher expiry system implemented | cron/scheduler.js, scripts/voucher-expiry-cron.js |
| 2026-01-26 | Consumer app voucher expiry documentation created | FRONTEND_TEAM_PROMPT.md, CONSUMER_APP_VOUCHER_EXPIRY_GUIDE.md |
| 2026-01-26 | Fixed voucher pricing (base meal only) | order.controller.js (244-400) |
| 2026-01-26 | Fixed OTP verification bug | delivery.controller.js (824-875) |
| 2026-01-15 | Initial documentation created | All docs |
| 2026-01-15 | Fixed voucher eligibility bug | order.controller.js |

---

## Quick Start for Common Tasks

### I want to fetch driver's active orders
→ Read: `DRIVER_ORDER_HISTORY_API.md`

### I want to manage driver profile
→ Read: `DRIVER_PROFILE_API.md`

### I need to implement voucher expiry in consumer app
→ Read: `FRONTEND_TEAM_PROMPT.md` ⭐ START HERE

### I need detailed voucher expiry implementation guide
→ Read: `CONSUMER_APP_VOUCHER_EXPIRY_GUIDE.md`

### I want to deploy voucher expiry to production
→ Read: `../PRODUCTION_DEPLOYMENT.md`

### I need quick command reference
→ Read: `../COMMAND_REFERENCE.md`

### I want to test voucher expiry system
→ Read: `../scripts/QUICK_START.md`

### I need a quick reference
→ Read: `QUICK_REFERENCE.md`

### I'm using Claude to build the frontend
→ Share: `CLAUDE_INTEGRATION_PROMPT.md` or `FRONTEND_TEAM_PROMPT.md`

### I need to understand the backend code
→ Check: `src/order/order.controller.js` or `src/driver/driver.controller.js` or `cron/scheduler.js`

---

**Happy coding!** 🚀

For questions or issues, refer to the specific documentation files above.
