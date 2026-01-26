# 🎯 Consumer App: Voucher Expiry Implementation - Quick Start Prompt

**For:** Frontend Development Team
**Task:** Implement voucher expiry features in consumer mobile app
**Deadline:** [Your Deadline]
**Backend Version:** 1.0.0 (Ready for integration)

---

## 📋 What You Need to Build

### 1. **Vouchers Display Screen** (Priority: HIGH)

Show all user vouchers with expiry information:

**Features:**
- Display voucher list with codes, meal types, and expiry dates
- Color-coded borders: Green (>7 days), Orange (1-7 days), Red (today), Gray (expired)
- Show "Expires in X days" for upcoming expiries
- Separate expired vouchers into collapsible section
- Pull-to-refresh functionality
- Empty state: "No vouchers available"

**API:**
```
GET /api/vouchers/my-vouchers
Headers: Authorization: Bearer <user_token>
```

**Response includes:**
- Voucher code, status, expiry date, meal type
- `isExpiringSoon` boolean
- `daysUntilExpiry` number
- Summary counts (total, available, expired, expiringSoon)

---

### 2. **Expiry Notifications** (Priority: HIGH)

Display in-app notifications for expiring vouchers:

**Features:**
- Show notification badge on notification icon
- Display notification cards with voucher expiry warnings
- Tap to navigate to vouchers screen
- Mark as read after opening
- Push notifications (if supported)

**API:**
```
GET /api/notifications
Headers: Authorization: Bearer <user_token>
```

**Notification types:**
- 7 days before expiry
- 3 days before expiry
- 1 day before expiry
- On expiry day

---

### 3. **Order Flow Integration** (Priority: CRITICAL)

Handle voucher usage during checkout:

**Features:**
- Show available voucher count in checkout
- Allow selecting voucher(s) to use
- Calculate pricing with voucher discount
- Handle expired voucher errors gracefully
- Show pricing breakdown:
  - Voucher covers base meal only (NOT add-ons)
  - Add-ons charged to customer
  - All fees waived when voucher used

**API:**
```
POST /api/orders/calculate-pricing
Headers: Authorization: Bearer <user_token>
Body: {
  "kitchenId": "...",
  "menuType": "MEAL_MENU",
  "mealWindow": "LUNCH",
  "items": [...],
  "voucherCount": 1
}
```

**Handle these errors:**
- "No valid vouchers available" → Don't show voucher option
- "Voucher expired" → Show error, offer alternatives
- Network errors → Allow retry, proceed without voucher

---

## 🎨 UI/UX Requirements

### Voucher Card Design

```
┌─────────────────────────────────────┐
│ 🎟️ VCH-ABC123    [Available ✓]    │
│                                     │
│ Meal: Lunch  |  Plan: Weekly 5     │
│                                     │
│ ⚠️ Expires in 3 days                │
│ Expiry: Feb 15, 2026                │
│                                     │
│        [Use Voucher →]              │
└─────────────────────────────────────┘
```

### Status Colors
- **AVAILABLE** → Green border, white background
- **EXPIRING SOON** → Orange border, light orange background
- **EXPIRING TODAY** → Red border, light red background
- **EXPIRED** → Gray background, muted text

### Pricing Display (with voucher)
```
Base Meal (Thali)              ₹180
Add-ons (Raita)                 ₹30
─────────────────────────────────────
Subtotal                       ₹210

Voucher Discount              -₹180 ✓
(Covers base meal only)

Delivery Fee                    ₹0 ✓
(Waived with voucher)
─────────────────────────────────────
Amount to Pay                   ₹30
```

---

## 🧪 Testing Requirements

### Must Test These Scenarios:

1. **Display Tests:**
   - [ ] View all vouchers (available + expired)
   - [ ] See correct expiry dates and countdown
   - [ ] Color coding works correctly
   - [ ] Pull-to-refresh updates data

2. **Notification Tests:**
   - [ ] Receive expiry notifications
   - [ ] Tap notification → navigate to vouchers
   - [ ] Badge count shows unread notifications

3. **Order Tests:**
   - [ ] Use valid voucher → pricing correct
   - [ ] Try expired voucher → error shown
   - [ ] Order with base meal + add-on → voucher covers base only
   - [ ] All fees waived when voucher used

4. **Edge Cases:**
   - [ ] No vouchers available → empty state
   - [ ] Only expired vouchers → can't use any
   - [ ] Voucher expires during checkout → handle gracefully
   - [ ] Network error → show retry option

---

## 📊 Test Data Setup

**Backend team will provide:**
- Test user credentials
- API endpoints (base URL)
- Test vouchers (various expiry dates)

**You can request:**
```bash
# Backend can create test vouchers for you
node scripts/create-test-vouchers.js <userId> <subscriptionId>

# This creates 10 vouchers:
# - 2 expired
# - 3 expiring within 7 days
# - 5 valid for future use
```

---

## 🔧 Technical Notes

### Date Handling
```javascript
// Use date-fns or moment for date operations
import { format, differenceInDays } from 'date-fns';

// Backend returns dates in UTC ISO format
const expiryDate = new Date(voucher.expiryDate);

// Calculate days until expiry
const daysUntilExpiry = differenceInDays(expiryDate, new Date());

// Format for display
const formattedDate = format(expiryDate, 'dd MMM yyyy');

// Check if expired
const isExpired = expiryDate < new Date();
```

### Error Handling Pattern
```javascript
try {
  const response = await fetch('/api/vouchers/my-vouchers', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();

  if (data.success) {
    // Show vouchers
    setVouchers(data.data.vouchers);
  } else {
    // Show error message
    showError(data.message);
  }
} catch (error) {
  // Network error
  showError('Failed to load vouchers. Please try again.');
}
```

### State Management
```javascript
// Recommended state structure
const [vouchers, setVouchers] = useState([]);
const [summary, setSummary] = useState({
  total: 0,
  available: 0,
  expired: 0,
  expiringSoon: 0
});
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
```

---

## 📱 Implementation Example (React Native)

**See full example in:** [CONSUMER_APP_VOUCHER_EXPIRY_GUIDE.md](./CONSUMER_APP_VOUCHER_EXPIRY_GUIDE.md)

**Quick snippet:**
```jsx
const VouchersScreen = () => {
  const [vouchers, setVouchers] = useState([]);

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    const response = await api.get('/vouchers/my-vouchers');
    setVouchers(response.data.vouchers);
  };

  const getVoucherStyle = (voucher) => {
    if (voucher.status === 'EXPIRED') return 'gray';
    if (voucher.daysUntilExpiry === 0) return 'red';
    if (voucher.daysUntilExpiry <= 7) return 'orange';
    return 'green';
  };

  return (
    <FlatList
      data={vouchers}
      renderItem={({ item }) => (
        <VoucherCard voucher={item} style={getVoucherStyle(item)} />
      )}
      refreshControl={<RefreshControl onRefresh={fetchVouchers} />}
    />
  );
};
```

---

## ✅ Definition of Done

**Your implementation is complete when:**

1. **Functionality:**
   - [ ] All vouchers displayed with correct information
   - [ ] Expiry dates and countdowns accurate
   - [ ] Notifications working
   - [ ] Order flow handles vouchers correctly
   - [ ] Expired vouchers rejected gracefully

2. **UI/UX:**
   - [ ] Matches design specifications
   - [ ] Color coding implemented
   - [ ] Empty and error states handled
   - [ ] Loading indicators shown
   - [ ] Smooth animations and transitions

3. **Testing:**
   - [ ] All test cases passed
   - [ ] Edge cases handled
   - [ ] Works offline (with cached data)
   - [ ] Performance is acceptable
   - [ ] No memory leaks

4. **Code Quality:**
   - [ ] Code reviewed
   - [ ] No console errors
   - [ ] Proper error handling
   - [ ] Accessibility implemented
   - [ ] Documentation added

---

## 🚨 Critical Rules

### ⚠️ DO NOT:
1. Calculate pricing on frontend - **ALWAYS use backend API**
2. Store sensitive voucher data in local storage
3. Allow using expired vouchers (backend validates, but check on frontend too)
4. Show incorrect expiry dates (handle timezones properly)

### ✅ DO:
1. Always fetch fresh voucher data on app launch
2. Show clear error messages to users
3. Handle network errors gracefully
4. Implement pull-to-refresh
5. Cache voucher data for offline viewing

---

## 📞 Need Help?

**Backend API issues?**
- Contact: [Backend Team]
- API Docs: [CONSUMER_APP_VOUCHER_EXPIRY_GUIDE.md](./CONSUMER_APP_VOUCHER_EXPIRY_GUIDE.md)

**Need test data?**
- Ask backend team to run: `node scripts/create-test-vouchers.js`
- They can create vouchers with any expiry date

**Questions about voucher logic?**
- **Rule 1:** Voucher covers base meal only, NOT add-ons
- **Rule 2:** All fees waived when voucher used
- **Rule 3:** Expired vouchers cannot be used
- **Rule 4:** Expiry checked at time of order placement

---

## 🎯 Priority Order

**Week 1:**
1. Implement vouchers display screen ✓
2. Integrate with backend API ✓
3. Add color coding and status indicators ✓

**Week 2:**
1. Implement notifications ✓
2. Add order flow integration ✓
3. Handle expired voucher errors ✓

**Week 3:**
1. Edge case testing ✓
2. UI polish and animations ✓
3. Accessibility improvements ✓

**Week 4:**
1. QA testing ✓
2. Bug fixes ✓
3. Final review and release ✓

---

## 📚 Additional Resources

**Detailed Implementation Guide:**
[CONSUMER_APP_VOUCHER_EXPIRY_GUIDE.md](./CONSUMER_APP_VOUCHER_EXPIRY_GUIDE.md)

**Backend Documentation:**
- [PRODUCTION_DEPLOYMENT.md](../PRODUCTION_DEPLOYMENT.md)
- [QUICK_START.md](../scripts/QUICK_START.md)

**API Health Check:**
```bash
curl http://your-backend.com/api/health
```

---

## 🚀 Ready to Start?

1. Read this prompt completely
2. Review detailed guide: [CONSUMER_APP_VOUCHER_EXPIRY_GUIDE.md](./CONSUMER_APP_VOUCHER_EXPIRY_GUIDE.md)
3. Set up backend API connection
4. Request test user credentials and data
5. Start with vouchers display screen
6. Follow the testing checklist
7. Complete all features
8. Get QA approval
9. Release! 🎉

---

**Questions? Ask the backend team or refer to the detailed guide.**

**Good luck! 🚀**
