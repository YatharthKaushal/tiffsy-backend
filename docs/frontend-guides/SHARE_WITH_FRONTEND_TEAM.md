# 📦 Frontend Team Package - Kitchen Approval & Dashboard

## 🎯 What to Share with Frontend Claude

Give Claude these **TWO files** in this order:

### 1️⃣ **FRONTEND_IMPLEMENTATION_PROMPT.txt**
This is the main prompt that explains:
- What needs to be implemented
- The routing logic (CRITICAL)
- Step-by-step implementation order
- Questions to ask before starting

### 2️⃣ **FRONTEND_INTEGRATION_GUIDE.md**
This is the complete technical guide with:
- All API endpoints with full request/response examples
- Complete UI/UX specifications
- Code examples for every screen and component
- Service layer implementation
- Navigation setup
- TypeScript interfaces
- Testing scenarios

---

## 📋 Copy This Message to Frontend Claude

```
Hi Claude! I need you to implement the Kitchen Approval and Dashboard system.

Please read these two documents carefully:

1. FRONTEND_IMPLEMENTATION_PROMPT.txt (START HERE - read this first)
2. FRONTEND_INTEGRATION_GUIDE.md (Complete technical reference)

The backend is fully implemented and ready. The integration guide has complete code examples for every screen and component.

Key points:
- Admin users see Kitchen Approvals in their sidebar
- Kitchen users see different screens based on approval status
- The guide has COMPLETE working code examples
- All API endpoints are documented with full request/response

After reading the prompt, ask me the clarification questions listed, then start implementing following the step-by-step order.
```

---

## 🔍 Quick Reference - What's Implemented

### ✅ Backend (100% Complete)

**Admin Endpoints:**
- `GET /api/admin/kitchens/pending` - List pending kitchens
- `PATCH /api/admin/kitchens/:id/approve` - Approve kitchen
- `PATCH /api/admin/kitchens/:id/reject` - Reject with reason

**Kitchen Endpoints:**
- `POST /api/auth/register-kitchen` - Self-registration
- `GET /api/auth/my-kitchen-status` - Check approval status
- `PATCH /api/auth/resubmit-kitchen` - Resubmit after rejection
- `GET /api/kitchens/dashboard` - Dashboard stats
- `GET /api/menu/my-kitchen/stats` - Menu statistics
- `GET /api/kitchens/analytics` - Historical data

**Schema:**
- Kitchen schema with rejection tracking fields
- User schema with KITCHEN_STAFF role

**Validation:**
- All request validation implemented
- Rejection reason: 10-500 characters
- Zone conflict detection
- Access control (role-based)

---

## 🎨 Frontend Implementation Needed

### Admin Side (4 Screens)
1. **KitchenApprovalsScreen** - List pending kitchens
2. **KitchenDetailsModal** - View full kitchen details
3. **RejectKitchenModal** - Reject with reason input
4. **Approve Confirmation** - Dialog to confirm approval

### Kitchen Side (4 Screens)
1. **KitchenPendingScreen** - Awaiting approval message
2. **KitchenRejectionScreen** - Show rejection + resubmit
3. **EditKitchenRegistrationScreen** - Edit and resubmit form
4. **KitchenDashboardScreen** - 5 tabs (Dashboard, Orders, Batches, Menu, Profile)

---

## 🚀 Expected Timeline

- **API Services:** 1 hour
- **Admin Screens:** 3-4 hours
- **Kitchen Screens:** 4-5 hours
- **Dashboard Tabs:** 3-4 hours
- **Testing & Polish:** 2-3 hours

**Total: 13-17 hours**

---

## ⚠️ Critical Points

1. **Role-Based Routing:**
   - ADMIN → AdminDashboard
   - KITCHEN_STAFF + PENDING + no rejection → PendingScreen
   - KITCHEN_STAFF + PENDING + has rejection → RejectionScreen
   - KITCHEN_STAFF + ACTIVE → KitchenDashboard

2. **Rejection Reason Validation:**
   - Minimum 10 characters
   - Maximum 500 characters
   - Required field

3. **Kitchen Status Flow:**
   ```
   REGISTER → PENDING_APPROVAL → APPROVE → ACTIVE
                    ↓
                  REJECT (with reason)
                    ↓
                RESUBMIT → PENDING_APPROVAL
   ```

4. **Dashboard Date Filter:**
   - Default: Today
   - Format: YYYY-MM-DD
   - Used in dashboard and analytics endpoints

---

## 📞 Testing the Backend

**Backend URL:** `https://tiffsy-backend.onrender.com/api`

**Test with cURL:**
```bash
# Get pending kitchens
curl https://tiffsy-backend.onrender.com/api/admin/kitchens/pending \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Approve kitchen
curl -X PATCH https://tiffsy-backend.onrender.com/api/admin/kitchens/KITCHEN_ID/approve \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Reject kitchen
curl -X PATCH https://tiffsy-backend.onrender.com/api/admin/kitchens/KITCHEN_ID/reject \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Test rejection reason for validation purposes"}'
```

---

## 📚 Additional Resources

**Backend Documentation:**
- `KITCHEN_APPROVAL_FLOW_DOCUMENTATION.md` - Complete flow diagram and business rules
- `KITCHEN_APPROVAL_BACKEND_IMPLEMENTATION_GUIDE.md` - Backend implementation details

**Schema Reference:**
- Kitchen schema: `schema/kitchen.schema.js`
- User schema: `schema/user.schema.js`

**Controller Reference:**
- Admin controller: `src/admin/admin.controller.js` (lines 1124-1280)
- Auth controller: `src/auth/auth.controller.js` (lines 616-965)
- Kitchen controller: `src/kitchen/kitchen.controller.js` (lines 931-1327)

---

## ✅ Final Checklist Before Sharing

- [x] Backend fully implemented and tested
- [x] All API endpoints working
- [x] Complete integration guide created
- [x] Frontend implementation prompt created
- [x] Code examples for all screens provided
- [x] TypeScript interfaces defined
- [x] API service layer examples included
- [x] Navigation setup documented
- [x] Testing scenarios defined
- [x] Error handling guidelines provided

---

**Status:** ✅ Ready to Share
**Backend:** ✅ 100% Complete
**Documentation:** ✅ Complete
**Code Examples:** ✅ Provided for all components

Give the frontend team the two files and let them start implementing! 🚀
