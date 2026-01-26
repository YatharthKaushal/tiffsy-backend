# Consumer App - Voucher Expiry Implementation Guide

**For:** Consumer Mobile App Frontend Team
**Backend Version:** 1.0.0
**Last Updated:** 2026-01-26

---

## 📋 Overview

This guide covers the complete implementation of voucher expiry features in the consumer mobile app, including:
- Displaying voucher expiry dates
- Showing expiry notifications
- Handling expired vouchers during order placement
- Testing all edge cases

---

## 🎯 Implementation Requirements

### 1. Voucher Display Screen

**Location:** My Vouchers / Wallet Screen

**Requirements:**
- Display all user vouchers with clear expiry information
- Show different states: Available, Expired, Redeemed
- Highlight vouchers expiring soon
- Filter/sort by expiry date

**API Endpoint:**
```
GET /api/vouchers/my-vouchers
Authorization: Bearer <user_token>
```

**Response Structure:**
```json
{
  "success": true,
  "message": "Vouchers retrieved successfully",
  "data": {
    "vouchers": [
      {
        "_id": "65abc123...",
        "voucherCode": "VCH-ABC123",
        "status": "AVAILABLE",
        "expiryDate": "2026-02-15T18:30:00.000Z",
        "mealType": "LUNCH",
        "subscriptionId": {
          "_id": "65xyz789...",
          "planType": "WEEKLY_5",
          "menuType": "MEAL_MENU"
        },
        "isExpiringSoon": true,
        "daysUntilExpiry": 3
      },
      {
        "_id": "65def456...",
        "voucherCode": "VCH-DEF456",
        "status": "EXPIRED",
        "expiryDate": "2026-01-20T18:30:00.000Z",
        "mealType": "DINNER"
      }
    ],
    "summary": {
      "total": 10,
      "available": 6,
      "expired": 2,
      "redeemed": 2,
      "expiringSoon": 3
    }
  }
}
```

**UI/UX Requirements:**

1. **Voucher Card Design:**
```
┌─────────────────────────────────────┐
│ 🎟️ VCH-ABC123         [Available] │
│                                     │
│ Meal Type: Lunch                    │
│ Plan: Weekly 5 Days                 │
│                                     │
│ ⚠️ Expires in 3 days                │
│ Expiry: Feb 15, 2026                │
│                                     │
│ [Use Voucher]                       │
└─────────────────────────────────────┘
```

2. **Color Coding:**
   - **Green border:** Available vouchers (7+ days until expiry)
   - **Orange border:** Expiring soon (1-7 days)
   - **Red border:** Expiring today (0 days)
   - **Gray background:** Expired vouchers

3. **Status Labels:**
   - AVAILABLE → Show as "Available" badge (green)
   - EXPIRED → Show as "Expired" badge (red)
   - REDEEMED → Show as "Used" badge (gray)
   - RESTORED → Show as "Available" badge (green) with "Restored" tag

4. **Expiry Warnings:**
   - Show "⚠️ Expires in X days" for vouchers expiring within 7 days
   - Show "🚨 Expires today!" for vouchers expiring today
   - Show red "Expired on [date]" for expired vouchers

---

### 2. In-App Notifications

**Location:** Notifications Screen / Push Notifications

**API Endpoint:**
```
GET /api/notifications
Authorization: Bearer <user_token>
```

**Notification Types:**
- **7 Days Before:** "Your voucher expires in 7 days"
- **3 Days Before:** "Your voucher expires in 3 days - use it soon!"
- **1 Day Before:** "Last chance! Your voucher expires tomorrow"
- **Expiry Day:** "Your voucher expires today - order now!"

**Notification Payload:**
```json
{
  "_id": "notification_id",
  "type": "VOUCHER_EXPIRY_REMINDER",
  "title": "Voucher Expiring Soon",
  "message": "3 vouchers are expiring in 3 days. Use them before they expire!",
  "data": {
    "voucherCount": 3,
    "daysUntilExpiry": 3,
    "expiryDate": "2026-02-15T18:30:00.000Z"
  },
  "isRead": false,
  "createdAt": "2026-01-26T02:30:00.000Z"
}
```

**Implementation:**
1. Fetch notifications on app launch
2. Show unread count badge on notifications icon
3. Display notification cards with voucher expiry warnings
4. Add "View Vouchers" CTA button in notification
5. Mark as read when user taps notification

---

### 3. Order Placement Flow

**Location:** Order Checkout / Payment Screen

**Scenario:** User tries to use voucher during order placement

**API Endpoint:**
```
POST /api/orders/calculate-pricing
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "kitchenId": "kitchen_id",
  "menuType": "MEAL_MENU",
  "mealWindow": "LUNCH",
  "items": [...],
  "voucherCount": 1
}
```

**Response - Success (Valid Voucher):**
```json
{
  "success": true,
  "data": {
    "voucherEligibility": {
      "canUseVouchers": true,
      "available": 5,
      "requested": 1,
      "allowed": 1,
      "reason": "Vouchers available for this order"
    },
    "pricing": {
      "mainCoursesTotal": 180,
      "addonsTotal": 30,
      "voucherCoverageValue": 180,
      "voucherDiscount": 180,
      "deliveryFee": 0,
      "serviceFee": 0,
      "packagingFee": 0,
      "handlingFee": 0,
      "taxAmount": 0,
      "amountToPay": 30
    }
  }
}
```

**Response - Error (Expired Voucher):**
```json
{
  "success": false,
  "message": "No vouchers available for this meal type and time",
  "data": {
    "voucherEligibility": {
      "canUseVouchers": false,
      "available": 0,
      "requested": 1,
      "allowed": 0,
      "reason": "No valid vouchers available"
    }
  }
}
```

**UI Requirements:**

1. **Before Order Calculation:**
```
┌─────────────────────────────────────┐
│ Voucher Selection                   │
├─────────────────────────────────────┤
│ You have 5 available vouchers       │
│                                     │
│ Use vouchers for this order?        │
│ [ ] Yes (1 voucher)                │
│                                     │
│ Note: Expired vouchers cannot be   │
│ used and won't appear here         │
└─────────────────────────────────────┘
```

2. **If User Has No Valid Vouchers:**
```
┌─────────────────────────────────────┐
│ ⚠️ No Vouchers Available            │
│                                     │
│ You don't have any valid vouchers  │
│ for this order.                     │
│                                     │
│ Reason: All vouchers have expired  │
│ or don't match this meal type      │
└─────────────────────────────────────┘
```

3. **Pricing Breakdown:**
```
┌─────────────────────────────────────┐
│ Order Summary                       │
├─────────────────────────────────────┤
│ Base Meal (1x Thali)      ₹180.00  │
│ Add-ons (1x Raita)         ₹30.00  │
│                                     │
│ Subtotal                  ₹210.00  │
│                                     │
│ Voucher Discount         -₹180.00  │
│ (Covers base meal only)             │
│                                     │
│ Delivery Fee               ₹0.00   │
│ (Waived with voucher)               │
│                                     │
│ ─────────────────────────────────  │
│ Total to Pay               ₹30.00  │
└─────────────────────────────────────┘
```

---

### 4. Error Handling

**Handle these error scenarios gracefully:**

#### Error 1: Expired Voucher During Checkout
```json
{
  "success": false,
  "message": "Selected voucher has expired"
}
```

**User Experience:**
```
┌─────────────────────────────────────┐
│ ❌ Voucher Expired                  │
│                                     │
│ The voucher you selected has        │
│ expired and cannot be used.         │
│                                     │
│ [View Available Vouchers]           │
│ [Continue Without Voucher]          │
└─────────────────────────────────────┘
```

#### Error 2: No Vouchers Available
```json
{
  "success": false,
  "message": "No valid vouchers for this order"
}
```

**User Experience:**
- Don't show voucher option in checkout
- Display info message: "You don't have vouchers for this meal"

#### Error 3: Network/Backend Error
```json
{
  "success": false,
  "message": "Failed to fetch vouchers"
}
```

**User Experience:**
- Show retry button
- Allow proceeding without voucher
- Log error for debugging

---

## 🧪 Testing Scenarios

### Test Case 1: Display Available Vouchers

**Steps:**
1. Login with test user account
2. Navigate to "My Vouchers" screen
3. Verify all vouchers are displayed
4. Check expiry dates are shown correctly
5. Verify vouchers are sorted by expiry date (earliest first)

**Expected Result:**
- All vouchers visible
- Expiry dates in "DD MMM YYYY" format
- "Expires in X days" shown for upcoming expiries
- Color coding applied correctly

**Test API:**
```bash
curl -X GET http://your-backend.com/api/vouchers/my-vouchers \
  -H "Authorization: Bearer <user_token>"
```

---

### Test Case 2: Expired Voucher Display

**Steps:**
1. Navigate to "My Vouchers" screen
2. Scroll to expired vouchers section
3. Verify expired vouchers are clearly marked
4. Try to use an expired voucher

**Expected Result:**
- Expired vouchers shown with gray background
- Red "Expired" badge visible
- "Use Voucher" button disabled or hidden
- Shows "Expired on [date]"

**Backend Setup:**
```bash
# Create expired test voucher
node scripts/create-test-vouchers.js <userId> <subscriptionId>
```

---

### Test Case 3: Expiry Notifications

**Steps:**
1. Check notifications screen
2. Look for voucher expiry notifications
3. Tap notification to navigate to vouchers
4. Verify notification marks as read

**Expected Result:**
- Notification shows voucher count and days until expiry
- Tapping navigates to vouchers screen
- Notification marked as read after opening
- Push notification received (if enabled)

**Test API:**
```bash
curl -X GET http://your-backend.com/api/notifications \
  -H "Authorization: Bearer <user_token>"
```

---

### Test Case 4: Order with Valid Voucher

**Steps:**
1. Add items to cart
2. Proceed to checkout
3. Select "Use Voucher" option
4. Calculate pricing
5. Place order

**Expected Result:**
- Voucher applied successfully
- Base meal price covered by voucher
- Add-ons charged to customer
- All fees waived (delivery, service, packaging)
- Only add-ons shown in "Amount to Pay"

**Test API:**
```bash
curl -X POST http://your-backend.com/api/orders/calculate-pricing \
  -H "Authorization: Bearer <user_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "kitchenId": "kitchen_id",
    "menuType": "MEAL_MENU",
    "mealWindow": "LUNCH",
    "items": [
      {
        "itemId": "thali_id",
        "itemType": "MAIN_COURSE",
        "quantity": 1,
        "price": 180
      },
      {
        "itemId": "raita_id",
        "itemType": "ADDON",
        "quantity": 1,
        "price": 30
      }
    ],
    "voucherCount": 1
  }'
```

---

### Test Case 5: Order with Expired Voucher

**Steps:**
1. Have only expired vouchers in account
2. Try to place an order
3. Attempt to use voucher

**Expected Result:**
- Voucher option not shown or disabled
- Error message: "No valid vouchers available"
- Order proceeds without voucher
- Full amount charged

**Backend Setup:**
```bash
# Manually expire vouchers
node scripts/voucher-expiry-cron.js
```

---

### Test Case 6: Voucher Expires During Order

**Edge Case:** User starts order with valid voucher, but it expires before completing checkout

**Steps:**
1. Find voucher expiring in next 5 minutes
2. Start order placement process
3. Wait for voucher to expire
4. Complete order

**Expected Result:**
- Backend validates voucher freshness
- Order rejected if voucher expired
- Error message shown
- User prompted to refresh vouchers

**Expected API Response:**
```json
{
  "success": false,
  "message": "Voucher has expired",
  "error": "VOUCHER_EXPIRED"
}
```

---

### Test Case 7: Multiple Vouchers Expiring Soon

**Steps:**
1. Login with account having 3-5 vouchers expiring in next 7 days
2. Check notifications
3. View vouchers screen

**Expected Result:**
- Notification shows count: "3 vouchers expiring in X days"
- All expiring vouchers highlighted in orange
- Warning icon shown on each
- Sorted by expiry date (earliest first)

---

### Test Case 8: Voucher Count Accuracy

**Steps:**
1. Note initial voucher count
2. Use a voucher to place order
3. Check voucher count after order
4. Wait for a voucher to expire
5. Check count again

**Expected Result:**
- Count decreases by 1 after use
- Count decreases by 1 after expiry
- Available count excludes expired vouchers
- Summary numbers accurate

---

### Test Case 9: Pull-to-Refresh Vouchers

**Steps:**
1. Open vouchers screen
2. Pull down to refresh
3. Verify data updates

**Expected Result:**
- Loading indicator shown
- Voucher list refreshes
- New expiry dates calculated
- Expired vouchers moved to expired section

---

### Test Case 10: Offline Mode Handling

**Steps:**
1. Open app with network connection
2. Load vouchers
3. Turn off network
4. Try to use voucher

**Expected Result:**
- Cached voucher data shown
- Warning: "Using cached data"
- Cannot place order without network
- Graceful error message

---

## 🎨 UI/UX Best Practices

### Visual Hierarchy

1. **Available Vouchers (Top Priority)**
   - Most prominent section
   - Show count badge
   - Sort by expiry date

2. **Expiring Soon (High Priority)**
   - Highlight with orange/yellow
   - Show countdown
   - Add warning icon

3. **Expired (Low Priority)**
   - Collapsed section
   - Muted colors
   - Separate from active vouchers

### User Guidance

1. **First Time Users:**
   - Show tooltip: "Vouchers are automatically applied"
   - Explain expiry dates
   - Guide through first voucher usage

2. **Empty States:**
   - "No vouchers available"
   - "Subscribe to get vouchers"
   - CTA button to subscription page

3. **Error States:**
   - Clear error messages
   - Suggested actions
   - Support contact option

### Accessibility

1. **Screen Readers:**
   - Label expiry dates clearly
   - Announce voucher status
   - Provide context for warnings

2. **Color Blind Users:**
   - Don't rely only on color
   - Use icons (✓, ✗, ⚠️)
   - Clear text labels

3. **Text Size:**
   - Support dynamic text sizing
   - Maintain readability
   - Proper contrast ratios

---

## 📱 Mobile-Specific Considerations

### React Native Implementation Example

```jsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { format, differenceInDays, isPast } from 'date-fns';

const VouchersScreen = () => {
  const [vouchers, setVouchers] = useState([]);
  const [summary, setSummary] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    try {
      const response = await fetch('/api/vouchers/my-vouchers', {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      const data = await response.json();

      if (data.success) {
        setVouchers(data.data.vouchers);
        setSummary(data.data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch vouchers:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchVouchers();
    setRefreshing(false);
  };

  const getVoucherStyle = (voucher) => {
    if (voucher.status === 'EXPIRED') {
      return { borderColor: '#9CA3AF', backgroundColor: '#F3F4F6' };
    }

    const daysUntilExpiry = differenceInDays(
      new Date(voucher.expiryDate),
      new Date()
    );

    if (daysUntilExpiry === 0) {
      return { borderColor: '#EF4444', backgroundColor: '#FEE2E2' };
    }
    if (daysUntilExpiry <= 7) {
      return { borderColor: '#F59E0B', backgroundColor: '#FEF3C7' };
    }
    return { borderColor: '#10B981', backgroundColor: '#D1FAE5' };
  };

  const getExpiryText = (voucher) => {
    if (voucher.status === 'EXPIRED') {
      return `Expired on ${format(new Date(voucher.expiryDate), 'dd MMM yyyy')}`;
    }

    const daysUntilExpiry = differenceInDays(
      new Date(voucher.expiryDate),
      new Date()
    );

    if (daysUntilExpiry === 0) {
      return '🚨 Expires today!';
    }
    if (daysUntilExpiry <= 7) {
      return `⚠️ Expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}`;
    }
    return `Expires on ${format(new Date(voucher.expiryDate), 'dd MMM yyyy')}`;
  };

  const renderVoucher = ({ item }) => (
    <View style={[styles.voucherCard, getVoucherStyle(item)]}>
      <View style={styles.voucherHeader}>
        <Text style={styles.voucherCode}>🎟️ {item.voucherCode}</Text>
        <Text style={styles.statusBadge}>{item.status}</Text>
      </View>

      <Text style={styles.mealType}>
        Meal Type: {item.mealType}
      </Text>

      <Text style={styles.expiryText}>
        {getExpiryText(item)}
      </Text>

      {item.status === 'AVAILABLE' && (
        <TouchableOpacity
          style={styles.useButton}
          onPress={() => navigateToOrderWithVoucher(item)}
        >
          <Text style={styles.useButtonText}>Use Voucher</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          Available: {summary.available || 0}
        </Text>
        {summary.expiringSoon > 0 && (
          <Text style={styles.warningText}>
            ⚠️ {summary.expiringSoon} expiring soon
          </Text>
        )}
      </View>

      <FlatList
        data={vouchers}
        renderItem={renderVoucher}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text>No vouchers available</Text>
            <Text>Subscribe to get vouchers</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  voucherCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2
  },
  voucherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  voucherCode: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  expiryText: {
    fontSize: 14,
    marginTop: 8,
    fontWeight: '500'
  },
  useButton: {
    marginTop: 12,
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  useButtonText: {
    color: '#fff',
    fontWeight: '600'
  }
});

export default VouchersScreen;
```

---

## 🔍 Testing Checklist

Use this checklist to ensure complete implementation:

### Display & UI
- [ ] Vouchers screen shows all vouchers
- [ ] Expiry dates displayed correctly
- [ ] Color coding works (green/orange/red)
- [ ] Status badges visible
- [ ] Expired vouchers clearly marked
- [ ] Sort by expiry date works
- [ ] Pull-to-refresh works
- [ ] Loading states shown
- [ ] Empty states handled
- [ ] Error states handled

### Notifications
- [ ] Expiry notifications received
- [ ] Notification count badge shows
- [ ] Tapping notification navigates correctly
- [ ] Notifications mark as read
- [ ] Push notifications work (if enabled)

### Order Flow
- [ ] Voucher option shown in checkout
- [ ] Can select voucher count
- [ ] Pricing calculation correct
- [ ] Voucher covers base meal only
- [ ] Add-ons charged separately
- [ ] Fees waived with voucher
- [ ] Order placement succeeds
- [ ] Voucher status updates after use

### Error Handling
- [ ] Expired voucher rejection works
- [ ] No vouchers message shown
- [ ] Network errors handled gracefully
- [ ] Backend errors show user-friendly messages
- [ ] Retry mechanisms work

### Edge Cases
- [ ] Voucher expiring during checkout handled
- [ ] Multiple expiring vouchers displayed
- [ ] Offline mode works with cached data
- [ ] Account with no vouchers handled
- [ ] Account with only expired vouchers handled

### Performance
- [ ] Voucher list loads quickly
- [ ] Smooth scrolling
- [ ] No memory leaks
- [ ] Efficient refresh
- [ ] Cached data used when appropriate

### Accessibility
- [ ] Screen reader support
- [ ] Color blind friendly
- [ ] Dynamic text size support
- [ ] High contrast mode works
- [ ] Keyboard navigation (if applicable)

---

## 🐛 Common Issues & Solutions

### Issue 1: Vouchers Not Showing
**Cause:** API call failing or empty response
**Solution:** Check network, verify auth token, check API endpoint

### Issue 2: Wrong Expiry Dates
**Cause:** Timezone conversion issues
**Solution:** Use `date-fns` or `moment-timezone` with proper UTC handling

### Issue 3: Expired Voucher Still Usable
**Cause:** Backend not validating expiry
**Solution:** Backend validates - report if this happens

### Issue 4: Notification Not Received
**Cause:** Push notification permissions
**Solution:** Request permissions, check notification settings

### Issue 5: Pricing Calculation Wrong
**Cause:** Frontend calculation doesn't match backend
**Solution:** Always use backend calculation, don't calculate on frontend

---

## 📞 Support & Contact

### Backend API Issues
- Check [PRODUCTION_DEPLOYMENT.md](../PRODUCTION_DEPLOYMENT.md)
- Contact backend team

### Testing Help
- Run verification: `node scripts/verify-production-setup.js`
- Create test data: `node scripts/create-test-vouchers.js`

### API Documentation
- Health check: `GET /api/health`
- API base URL: Provided by backend team

---

## ✅ Final Checklist Before Release

- [ ] All test cases passed
- [ ] UI matches design specs
- [ ] Error handling implemented
- [ ] Accessibility tested
- [ ] Performance tested
- [ ] Edge cases handled
- [ ] Documentation reviewed
- [ ] Code reviewed
- [ ] QA approval received
- [ ] Backend integration verified

---

**Good luck with the implementation! 🚀**

If you have any questions or issues, refer to this guide or contact the backend team.
