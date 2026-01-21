# Frontend Integration Guide - Kitchen Approval & Dashboard System

## 🎯 Overview for Frontend Developer

This guide provides **complete implementation details** for integrating the Kitchen Approval and Dashboard system into the React Native frontend. The backend is **fully implemented and ready**. You need to implement the frontend screens and API integrations.

---

## 🔑 Key Concept: Role-Based Routing

**IMPORTANT:** Admin and Kitchen users use the **same app** but see different dashboards based on their role:

```javascript
// After login, check user role and route accordingly:

if (user.role === 'ADMIN') {
  // Show Admin Dashboard
  // - Sidebar with: Kitchen Approvals, Users, Orders, Drivers, Zones, etc.
  navigate('AdminDashboard');
}

if (user.role === 'KITCHEN_STAFF') {
  // Check kitchen approval status first
  if (user.kitchen.status === 'PENDING_APPROVAL') {
    if (user.kitchen.rejectionReason) {
      // Show rejection screen with reason and resubmit button
      navigate('RejectionScreen');
    } else {
      // Show pending approval screen
      navigate('PendingApprovalScreen');
    }
  } else if (user.kitchen.status === 'ACTIVE') {
    // Show Kitchen Dashboard with 5 tabs
    navigate('KitchenDashboard');
  }
}
```

---

## 📱 Part 1: Admin - Kitchen Approvals

### Screen: Kitchen Approvals (Admin Sidebar Item)

**Location:** Add "Kitchen Approvals" to admin sidebar menu

**Purpose:** Admin can view, approve, and reject pending kitchen registrations

### API Endpoints You'll Use

#### 1. Get Pending Kitchens
```http
GET /api/admin/kitchens/pending?page=1&limit=20
Authorization: Bearer <admin_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Pending kitchens retrieved",
  "data": {
    "kitchens": [
      {
        "_id": "kitchen_id_1",
        "name": "Spice Kitchen",
        "code": "KIT-ABC123",
        "type": "PARTNER",
        "status": "PENDING_APPROVAL",
        "address": {
          "addressLine1": "123 MG Road",
          "locality": "Indiranagar",
          "city": "Bangalore",
          "state": "Karnataka",
          "pincode": "560038"
        },
        "contactPhone": "9876543210",
        "contactEmail": "spice@kitchen.com",
        "ownerName": "John Doe",
        "ownerPhone": "9876543211",
        "cuisineTypes": ["North Indian", "Chinese"],
        "zonesServed": [
          { "_id": "zone_1", "name": "Indiranagar", "code": "IND" }
        ],
        "logo": "https://res.cloudinary.com/.../logo.png",
        "coverImage": "https://res.cloudinary.com/.../cover.jpg",
        "description": "Best kitchen in town",
        "operatingHours": {
          "lunch": { "startTime": "11:00", "endTime": "15:00" },
          "dinner": { "startTime": "19:00", "endTime": "23:00" },
          "onDemand": { "startTime": "10:00", "endTime": "23:00", "isAlwaysOpen": false }
        },
        "isAcceptingOrders": false,
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

#### 2. Approve Kitchen
```http
PATCH /api/admin/kitchens/:kitchenId/approve
Authorization: Bearer <admin_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Kitchen approved successfully",
  "data": {
    "kitchen": {
      "_id": "kitchen_id",
      "name": "Spice Kitchen",
      "status": "ACTIVE",
      "approvedBy": "admin_user_id",
      "approvedAt": "2024-01-16T14:25:00.000Z"
    }
  }
}
```

#### 3. Reject Kitchen
```http
PATCH /api/admin/kitchens/:kitchenId/reject
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "reason": "FSSAI license has expired. Please upload a valid license."
}
```

**Validation:**
- Reason must be **10-500 characters**
- Reason is required

**Response:**
```json
{
  "success": true,
  "message": "Kitchen registration rejected",
  "data": {
    "kitchen": {
      "_id": "kitchen_id",
      "status": "PENDING_APPROVAL",
      "rejectionReason": "FSSAI license has expired...",
      "rejectedBy": "admin_user_id",
      "rejectedAt": "2024-01-16T14:30:00.000Z"
    }
  }
}
```

---

### UI Implementation - Kitchen Approvals Screen

#### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  Kitchen Approvals                         [Refresh]     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  📋 Pending Approvals (5)                                │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 🏪 Spice Kitchen                     PARTNER    │    │
│  │ KIT-ABC123                                      │    │
│  │ 📍 Indiranagar, Bangalore                       │    │
│  │ 📞 9876543210 · spice@kitchen.com               │    │
│  │ 👨‍💼 Owner: John Doe                              │    │
│  │ 🍽️ North Indian, Chinese                        │    │
│  │ 📅 Applied: Jan 15, 2024                        │    │
│  │                                                  │    │
│  │ [View Details]  [✓ Approve]  [✗ Reject]        │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 🏪 Tasty Bites                       PARTNER    │    │
│  │ ...                                              │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  [Load More]                                              │
└─────────────────────────────────────────────────────────┘
```

#### Components to Create

**1. KitchenApprovalsScreen.tsx**
```typescript
interface PendingKitchen {
  _id: string;
  name: string;
  code: string;
  type: 'PARTNER';
  status: 'PENDING_APPROVAL';
  address: {
    addressLine1: string;
    locality: string;
    city: string;
    state: string;
    pincode: string;
  };
  contactPhone: string;
  contactEmail: string;
  ownerName: string;
  ownerPhone?: string;
  cuisineTypes: string[];
  zonesServed: Array<{
    _id: string;
    name: string;
    code: string;
  }>;
  logo?: string;
  coverImage?: string;
  description?: string;
  operatingHours: {
    lunch: { startTime: string; endTime: string };
    dinner: { startTime: string; endTime: string };
    onDemand?: { startTime: string; endTime: string; isAlwaysOpen: boolean };
  };
  createdAt: string;
}

const KitchenApprovalsScreen = () => {
  const [kitchens, setKitchens] = useState<PendingKitchen[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchPendingKitchens();
  }, [page]);

  const fetchPendingKitchens = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/kitchens/pending?page=${page}&limit=20`);
      setKitchens(response.data.kitchens);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      console.error('Failed to fetch pending kitchens:', error);
      Alert.alert('Error', 'Failed to load pending kitchens');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (kitchenId: string) => {
    Alert.alert(
      'Approve Kitchen',
      'Are you sure you want to approve this kitchen?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await api.patch(`/admin/kitchens/${kitchenId}/approve`);
              Alert.alert('Success', 'Kitchen approved successfully');
              fetchPendingKitchens(); // Refresh list
            } catch (error) {
              Alert.alert('Error', 'Failed to approve kitchen');
            }
          }
        }
      ]
    );
  };

  const handleReject = (kitchenId: string) => {
    // Show rejection dialog (see below)
    navigation.navigate('RejectKitchenModal', { kitchenId, onReject: fetchPendingKitchens });
  };

  const handleViewDetails = (kitchen: PendingKitchen) => {
    // Show details modal (see below)
    navigation.navigate('KitchenDetailsModal', { kitchen });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kitchen Approvals</Text>
        <TouchableOpacity onPress={fetchPendingKitchens}>
          <Icon name="refresh" size={24} />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>Pending Approvals ({kitchens.length})</Text>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={kitchens}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <KitchenApprovalCard
              kitchen={item}
              onApprove={() => handleApprove(item._id)}
              onReject={() => handleReject(item._id)}
              onViewDetails={() => handleViewDetails(item)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No pending approvals</Text>
          }
        />
      )}

      {totalPages > 1 && (
        <View style={styles.pagination}>
          <Button
            title="Previous"
            disabled={page === 1}
            onPress={() => setPage(page - 1)}
          />
          <Text>Page {page} of {totalPages}</Text>
          <Button
            title="Next"
            disabled={page === totalPages}
            onPress={() => setPage(page + 1)}
          />
        </View>
      )}
    </View>
  );
};
```

**2. KitchenApprovalCard.tsx**
```typescript
const KitchenApprovalCard = ({ kitchen, onApprove, onReject, onViewDetails }) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {kitchen.logo && (
          <Image source={{ uri: kitchen.logo }} style={styles.logo} />
        )}
        <View style={styles.headerText}>
          <Text style={styles.kitchenName}>{kitchen.name}</Text>
          <Text style={styles.kitchenCode}>{kitchen.code}</Text>
          <Text style={styles.badge}>PARTNER</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.infoRow}>
          📍 {kitchen.address.locality}, {kitchen.address.city}
        </Text>
        <Text style={styles.infoRow}>
          📞 {kitchen.contactPhone} · {kitchen.contactEmail}
        </Text>
        <Text style={styles.infoRow}>
          👨‍💼 Owner: {kitchen.ownerName}
        </Text>
        <Text style={styles.infoRow}>
          🍽️ {kitchen.cuisineTypes.join(', ')}
        </Text>
        <Text style={styles.infoRow}>
          🏘️ Zones: {kitchen.zonesServed.map(z => z.name).join(', ')}
        </Text>
        <Text style={styles.infoRow}>
          📅 Applied: {new Date(kitchen.createdAt).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.detailsButton} onPress={onViewDetails}>
          <Text style={styles.detailsButtonText}>View Details</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.approveButton} onPress={onApprove}>
          <Text style={styles.approveButtonText}>✓ Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectButton} onPress={onReject}>
          <Text style={styles.rejectButtonText}>✗ Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
```

**3. RejectKitchenModal.tsx**
```typescript
const RejectKitchenModal = ({ route, navigation }) => {
  const { kitchenId, onReject } = route.params;
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReject = async () => {
    // Validation
    if (reason.trim().length < 10) {
      Alert.alert('Error', 'Rejection reason must be at least 10 characters');
      return;
    }
    if (reason.trim().length > 500) {
      Alert.alert('Error', 'Rejection reason cannot exceed 500 characters');
      return;
    }

    try {
      setLoading(true);
      await api.patch(`/admin/kitchens/${kitchenId}/reject`, {
        reason: reason.trim()
      });
      Alert.alert('Success', 'Kitchen registration rejected');
      onReject(); // Refresh parent list
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to reject kitchen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.modal}>
      <Text style={styles.title}>Reject Kitchen Registration</Text>

      <Text style={styles.label}>Rejection Reason *</Text>
      <Text style={styles.hint}>Provide a clear reason (10-500 characters)</Text>

      <TextInput
        style={styles.textarea}
        multiline
        numberOfLines={6}
        value={reason}
        onChangeText={setReason}
        placeholder="e.g., FSSAI license has expired. Please upload a valid license..."
        maxLength={500}
      />

      <Text style={styles.charCount}>{reason.length}/500</Text>

      <View style={styles.actions}>
        <Button title="Cancel" onPress={() => navigation.goBack()} />
        <Button
          title={loading ? 'Rejecting...' : 'Reject Kitchen'}
          onPress={handleReject}
          disabled={loading || reason.trim().length < 10}
          color="red"
        />
      </View>
    </View>
  );
};
```

**4. KitchenDetailsModal.tsx**
```typescript
const KitchenDetailsModal = ({ route }) => {
  const { kitchen } = route.params;

  return (
    <ScrollView style={styles.modal}>
      <Text style={styles.title}>Kitchen Details</Text>

      {/* Header with Logo */}
      <View style={styles.header}>
        {kitchen.logo && (
          <Image source={{ uri: kitchen.logo }} style={styles.largeLogo} />
        )}
        <Text style={styles.name}>{kitchen.name}</Text>
        <Text style={styles.code}>{kitchen.code}</Text>
      </View>

      {/* Cover Image */}
      {kitchen.coverImage && (
        <Image source={{ uri: kitchen.coverImage }} style={styles.coverImage} />
      )}

      {/* Basic Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        <DetailRow label="Type" value="PARTNER" />
        <DetailRow label="Status" value="PENDING_APPROVAL" />
        <DetailRow label="Cuisines" value={kitchen.cuisineTypes.join(', ')} />
        {kitchen.description && (
          <DetailRow label="Description" value={kitchen.description} />
        )}
      </View>

      {/* Contact Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Information</Text>
        <DetailRow label="Phone" value={kitchen.contactPhone} />
        <DetailRow label="Email" value={kitchen.contactEmail} />
        <DetailRow label="Owner Name" value={kitchen.ownerName} />
        {kitchen.ownerPhone && (
          <DetailRow label="Owner Phone" value={kitchen.ownerPhone} />
        )}
      </View>

      {/* Address */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Address</Text>
        <DetailRow label="Address" value={kitchen.address.addressLine1} />
        <DetailRow label="Locality" value={kitchen.address.locality} />
        <DetailRow label="City" value={kitchen.address.city} />
        <DetailRow label="State" value={kitchen.address.state} />
        <DetailRow label="Pincode" value={kitchen.address.pincode} />
      </View>

      {/* Zones Served */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Zones Served</Text>
        {kitchen.zonesServed.map(zone => (
          <Text key={zone._id} style={styles.zoneChip}>
            {zone.name} ({zone.code})
          </Text>
        ))}
      </View>

      {/* Operating Hours */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Operating Hours</Text>
        <DetailRow
          label="Lunch"
          value={`${kitchen.operatingHours.lunch.startTime} - ${kitchen.operatingHours.lunch.endTime}`}
        />
        <DetailRow
          label="Dinner"
          value={`${kitchen.operatingHours.dinner.startTime} - ${kitchen.operatingHours.dinner.endTime}`}
        />
        {kitchen.operatingHours.onDemand && (
          <DetailRow
            label="On-Demand"
            value={
              kitchen.operatingHours.onDemand.isAlwaysOpen
                ? 'Always Open'
                : `${kitchen.operatingHours.onDemand.startTime} - ${kitchen.operatingHours.onDemand.endTime}`
            }
          />
        )}
      </View>

      {/* Timestamps */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Application Details</Text>
        <DetailRow
          label="Applied On"
          value={new Date(kitchen.createdAt).toLocaleString()}
        />
      </View>
    </ScrollView>
  );
};

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}:</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);
```

---

## 📱 Part 2: Kitchen Staff - Dashboard & Screens

### Kitchen Login Flow

When kitchen staff logs in via Firebase OTP:

```typescript
// After Firebase authentication
const syncUser = async (firebaseToken: string) => {
  const response = await api.post('/auth/sync', {}, {
    headers: { Authorization: `Bearer ${firebaseToken}` }
  });

  const { user, token, kitchen } = response.data.data;

  // Save JWT token
  await AsyncStorage.setItem('authToken', token);

  // Route based on kitchen status
  if (user.role === 'KITCHEN_STAFF') {
    if (kitchen.status === 'PENDING_APPROVAL') {
      if (kitchen.rejectionReason) {
        // Navigate to rejection screen
        navigation.replace('KitchenRejection', { kitchen });
      } else {
        // Navigate to pending approval screen
        navigation.replace('KitchenPending', { kitchen });
      }
    } else if (kitchen.status === 'ACTIVE') {
      // Navigate to kitchen dashboard
      navigation.replace('KitchenDashboard');
    }
  }
};
```

---

### Screen 1: Pending Approval Screen

**Purpose:** Show when kitchen status is PENDING_APPROVAL (not rejected yet)

```typescript
const KitchenPendingScreen = ({ route }) => {
  const { kitchen } = route.params;

  return (
    <View style={styles.container}>
      <Icon name="hourglass" size={80} color="#FFA500" />

      <Text style={styles.title}>Application Under Review</Text>

      <Text style={styles.message}>
        Your kitchen registration is being reviewed by our team.
        We'll notify you once the review is complete.
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Your Application Details:</Text>
        <Text style={styles.info}>Kitchen Name: {kitchen.name}</Text>
        <Text style={styles.info}>
          Submitted: {new Date(kitchen.createdAt).toLocaleDateString()}
        </Text>
      </View>

      <Text style={styles.note}>
        This usually takes 24-48 hours. Thank you for your patience!
      </Text>

      <Button
        title="Refresh Status"
        onPress={async () => {
          // Fetch latest status
          const response = await api.get('/auth/my-kitchen-status');
          const updatedKitchen = response.data.data.kitchen;

          if (updatedKitchen.status === 'ACTIVE') {
            navigation.replace('KitchenDashboard');
          } else if (updatedKitchen.rejectionReason) {
            navigation.replace('KitchenRejection', { kitchen: updatedKitchen });
          }
        }}
      />
    </View>
  );
};
```

---

### Screen 2: Rejection Screen

**Purpose:** Show when kitchen was rejected with reason and resubmit option

```typescript
const KitchenRejectionScreen = ({ route }) => {
  const { kitchen } = route.params;

  const handleResubmit = () => {
    // Navigate to edit registration form
    navigation.navigate('EditKitchenRegistration', { kitchen });
  };

  return (
    <View style={styles.container}>
      <Icon name="close-circle" size={80} color="#FF0000" />

      <Text style={styles.title}>Application Rejected</Text>

      <Text style={styles.message}>
        Unfortunately, your kitchen registration was not approved.
      </Text>

      <View style={styles.reasonBox}>
        <Text style={styles.reasonTitle}>Rejection Reason:</Text>
        <Text style={styles.reasonText}>{kitchen.rejectionReason}</Text>
        <Text style={styles.reasonDate}>
          Rejected on: {new Date(kitchen.rejectedAt).toLocaleDateString()}
        </Text>
      </View>

      <Text style={styles.instruction}>
        Please review the reason above and update your application accordingly.
      </Text>

      <Button
        title="Edit & Resubmit Application"
        onPress={handleResubmit}
        style={styles.primaryButton}
      />

      <TouchableOpacity onPress={() => Linking.openURL('mailto:support@tiffsy.com')}>
        <Text style={styles.supportLink}>Contact Support</Text>
      </TouchableOpacity>
    </View>
  );
};
```

---

### Screen 3: Edit & Resubmit Registration

**Purpose:** Allow kitchen to edit details and resubmit after rejection

**API Endpoint:**
```http
PATCH /api/auth/resubmit-kitchen
Authorization: Bearer <kitchen_jwt_token>
Content-Type: application/json

{
  "name": "Updated Kitchen Name",
  "cuisineTypes": ["North Indian", "Chinese"],
  "logo": "https://new-logo-url.com",
  // ... any other fields to update (all optional)
}
```

**Note:** All fields are optional. Only send the fields being updated.

```typescript
const EditKitchenRegistrationScreen = ({ route, navigation }) => {
  const { kitchen } = route.params;

  // State for form fields (initialize with existing values)
  const [name, setName] = useState(kitchen.name);
  const [cuisineTypes, setCuisineTypes] = useState(kitchen.cuisineTypes);
  const [logo, setLogo] = useState(kitchen.logo);
  // ... other fields

  const handleResubmit = async () => {
    try {
      // Build update payload (only include changed fields)
      const updates = {};
      if (name !== kitchen.name) updates.name = name;
      if (logo !== kitchen.logo) updates.logo = logo;
      // ... check other fields

      await api.patch('/auth/resubmit-kitchen', updates);

      Alert.alert(
        'Success',
        'Your application has been resubmitted for review',
        [
          {
            text: 'OK',
            onPress: () => navigation.replace('KitchenPending', { kitchen: { ...kitchen, ...updates, rejectionReason: null } })
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to resubmit application');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Edit Kitchen Registration</Text>

      {/* Reuse your existing registration form components */}
      {/* but pre-fill with existing kitchen data */}

      <Button title="Resubmit Application" onPress={handleResubmit} />
    </ScrollView>
  );
};
```

---

### Screen 4: Kitchen Dashboard (After Approval)

**Purpose:** Main dashboard for ACTIVE kitchens with 5 tabs

#### Tab Structure

```
┌─────────────────────────────────────────────────────────┐
│  Spice Kitchen                          [Profile Icon]   │
├─────────────────────────────────────────────────────────┤
│  [Dashboard] [Orders] [Batches] [Menu] [Profile]        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [Tab Content Here]                                      │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

#### Tab 1: Dashboard Overview

**API Endpoint:**
```http
GET /api/kitchens/dashboard?date=2024-01-16
Authorization: Bearer <kitchen_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Kitchen dashboard retrieved",
  "data": {
    "kitchen": {
      "name": "Spice Kitchen",
      "logo": "...",
      "status": "ACTIVE",
      "operatingHours": { ... }
    },
    "todayStats": {
      "ordersCount": 45,
      "ordersRevenue": 12500,
      "pendingOrders": 5,
      "acceptedOrders": 15,
      "preparingOrders": 10,
      "readyOrders": 8,
      "completedOrders": 7,
      "cancelledOrders": 0,
      "lunchOrders": 25,
      "lunchRevenue": 7500,
      "dinnerOrders": 20,
      "dinnerRevenue": 5000
    },
    "batchStats": {
      "collectingBatches": 2,
      "readyBatches": 1,
      "dispatchedBatches": 3,
      "inProgressBatches": 4,
      "completedBatches": 5
    },
    "menuStats": {
      "totalMenuItems": 25,
      "activeMenuItems": 22,
      "unavailableItems": 3
    },
    "recentOrders": [
      {
        "_id": "order_id",
        "orderNumber": "ORD-123",
        "status": "PENDING",
        "totalAmount": 350,
        "placedAt": "2024-01-16T10:30:00Z"
      }
    ]
  }
}
```

**UI Implementation:**
```typescript
const DashboardTab = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    fetchDashboard();
  }, [selectedDate]);

  const fetchDashboard = async () => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const response = await api.get(`/kitchens/dashboard?date=${dateStr}`);
    setDashboardData(response.data.data);
  };

  return (
    <ScrollView>
      {/* Date Picker */}
      <DatePicker value={selectedDate} onChange={setSelectedDate} />

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <StatCard
          title="Total Orders"
          value={dashboardData?.todayStats.ordersCount}
          icon="receipt"
        />
        <StatCard
          title="Revenue"
          value={`₹${dashboardData?.todayStats.ordersRevenue}`}
          icon="currency-rupee"
        />
        <StatCard
          title="Pending"
          value={dashboardData?.todayStats.pendingOrders}
          icon="clock"
          color="orange"
        />
        <StatCard
          title="Completed"
          value={dashboardData?.todayStats.completedOrders}
          icon="check-circle"
          color="green"
        />
      </View>

      {/* Meal Window Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Meal Window Breakdown</Text>
        <MealWindowCard
          title="Lunch"
          orders={dashboardData?.todayStats.lunchOrders}
          revenue={dashboardData?.todayStats.lunchRevenue}
        />
        <MealWindowCard
          title="Dinner"
          orders={dashboardData?.todayStats.dinnerOrders}
          revenue={dashboardData?.todayStats.dinnerRevenue}
        />
      </View>

      {/* Batch Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Batch Status</Text>
        <BatchStatsRow stats={dashboardData?.batchStats} />
      </View>

      {/* Menu Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Menu Status</Text>
        <MenuStatsCard stats={dashboardData?.menuStats} />
      </View>

      {/* Recent Orders */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Orders</Text>
        {dashboardData?.recentOrders.map(order => (
          <OrderListItem key={order._id} order={order} />
        ))}
      </View>
    </ScrollView>
  );
};
```

#### Tab 2: Orders

**API Endpoint:** (Already exists)
```http
GET /api/orders/kitchen?status=PENDING&date=2024-01-16
Authorization: Bearer <kitchen_jwt_token>
```

**Actions:**
- View order details
- Accept order: `PATCH /api/orders/:id/accept`
- Reject order: `PATCH /api/orders/:id/reject`
- Mark as preparing: `PATCH /api/orders/:id/status` (body: `{ status: "PREPARING" }`)
- Mark as ready: `PATCH /api/orders/:id/status` (body: `{ status: "READY_FOR_PICKUP" }`)

#### Tab 3: Batch Management

**API Endpoint:** (Already exists)
```http
GET /api/delivery/kitchen-batches?date=2024-01-16&status=DISPATCHED
Authorization: Bearer <kitchen_jwt_token>
```

**Display:**
- List of batches with status, driver, order count
- Batch details on tap
- Filter by date, meal window, status

#### Tab 4: Menu Management

**API Endpoints:** (Already exist)
- List items: `GET /api/menu?kitchenId=X`
- Create item: `POST /api/menu`
- Update item: `PUT /api/menu/:id`
- Delete item: `DELETE /api/menu/:id`
- Toggle availability: `PATCH /api/menu/:id/availability`

**NEW Endpoint - Menu Stats:**
```http
GET /api/menu/my-kitchen/stats
Authorization: Bearer <kitchen_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Menu statistics retrieved",
  "data": {
    "totalItems": 25,
    "activeItems": 22,
    "availableItems": 20,
    "inactiveItems": 3,
    "byCategory": {
      "Main Course": 10,
      "Starters": 8,
      "Desserts": 5,
      "Beverages": 2
    },
    "byMenuType": {
      "MEAL_MENU": 2,
      "ON_DEMAND_MENU": 23
    },
    "mealMenuStatus": {
      "lunch": {
        "exists": true,
        "item": { "name": "Thali", "price": 150, "isAvailable": true },
        "isAvailable": true
      },
      "dinner": {
        "exists": true,
        "item": { "name": "Dinner Combo", "price": 180, "isAvailable": true },
        "isAvailable": true
      }
    }
  }
}
```

**UI:**
- Show stats at top
- Sub-tabs: Meal Menu, On-Demand Menu
- CRUD operations for menu items
- Toggle availability switch

#### Tab 5: Profile

**API Endpoint:** (Already exists)
```http
GET /api/kitchens/my-kitchen
Authorization: Bearer <kitchen_jwt_token>
```

**Display:**
- Kitchen details (name, type, address, zones, hours)
- Statistics (total orders, rating)
- Update images: `PATCH /api/kitchens/my-kitchen/images`
- Toggle order acceptance: `PATCH /api/kitchens/my-kitchen/accepting-orders`

---

## 🔌 API Service Layer

Create a centralized API service:

```typescript
// services/api.service.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://tiffsy-backend.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired, logout user
      AsyncStorage.removeItem('authToken');
      // Navigate to login
    }
    return Promise.reject(error);
  }
);

export default api;
```

**Admin Kitchen Approval Service:**
```typescript
// services/kitchenApproval.service.ts
import api from './api.service';

export const kitchenApprovalService = {
  getPendingKitchens: async (page = 1, limit = 20) => {
    const response = await api.get(`/admin/kitchens/pending?page=${page}&limit=${limit}`);
    return response.data.data;
  },

  approveKitchen: async (kitchenId: string) => {
    const response = await api.patch(`/admin/kitchens/${kitchenId}/approve`);
    return response.data.data;
  },

  rejectKitchen: async (kitchenId: string, reason: string) => {
    const response = await api.patch(`/admin/kitchens/${kitchenId}/reject`, { reason });
    return response.data.data;
  },
};
```

**Kitchen Dashboard Service:**
```typescript
// services/kitchenDashboard.service.ts
import api from './api.service';

export const kitchenDashboardService = {
  getDashboard: async (date?: string) => {
    const query = date ? `?date=${date}` : '';
    const response = await api.get(`/kitchens/dashboard${query}`);
    return response.data.data;
  },

  getMenuStats: async () => {
    const response = await api.get('/menu/my-kitchen/stats');
    return response.data.data;
  },

  getAnalytics: async (dateFrom: string, dateTo: string, groupBy = 'day') => {
    const response = await api.get(
      `/kitchens/analytics?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=${groupBy}`
    );
    return response.data.data;
  },

  getMyKitchenStatus: async () => {
    const response = await api.get('/auth/my-kitchen-status');
    return response.data.data;
  },

  resubmitKitchen: async (updates: any) => {
    const response = await api.patch('/auth/resubmit-kitchen', updates);
    return response.data.data;
  },
};
```

---

## 🗺️ Navigation Setup

Add routes to your navigation:

```typescript
// navigation/AdminNavigator.tsx
const AdminStack = createStackNavigator();

const AdminNavigator = () => (
  <AdminStack.Navigator>
    <AdminStack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
    <AdminStack.Screen name="KitchenApprovals" component={KitchenApprovalsScreen} />
    <AdminStack.Screen name="KitchenDetailsModal" component={KitchenDetailsModal} />
    <AdminStack.Screen name="RejectKitchenModal" component={RejectKitchenModal} />
    {/* ... other admin screens */}
  </AdminStack.Navigator>
);
```

```typescript
// navigation/KitchenNavigator.tsx
const KitchenStack = createStackNavigator();

const KitchenNavigator = () => (
  <KitchenStack.Navigator>
    {/* Conditional routing based on kitchen status */}
    <KitchenStack.Screen name="KitchenPending" component={KitchenPendingScreen} />
    <KitchenStack.Screen name="KitchenRejection" component={KitchenRejectionScreen} />
    <KitchenStack.Screen name="EditKitchenRegistration" component={EditKitchenRegistrationScreen} />
    <KitchenStack.Screen name="KitchenDashboard" component={KitchenDashboardScreen} />
  </KitchenStack.Navigator>
);
```

---

## ✅ Implementation Checklist

### Admin - Kitchen Approvals
- [ ] Add "Kitchen Approvals" to admin sidebar
- [ ] Create KitchenApprovalsScreen with pending list
- [ ] Implement KitchenApprovalCard component
- [ ] Create KitchenDetailsModal (view full details)
- [ ] Create RejectKitchenModal (with reason input, 10-500 chars validation)
- [ ] Implement approve action with confirmation dialog
- [ ] Implement reject action with reason
- [ ] Add pagination for pending list
- [ ] Add refresh functionality
- [ ] Show empty state when no pending kitchens
- [ ] Handle API errors gracefully

### Kitchen Staff - Login Flow
- [ ] Update syncUser to check kitchen status
- [ ] Route PENDING_APPROVAL without rejection → Pending screen
- [ ] Route PENDING_APPROVAL with rejection → Rejection screen
- [ ] Route ACTIVE → Kitchen Dashboard

### Kitchen Staff - Screens
- [ ] Create KitchenPendingScreen (awaiting approval)
- [ ] Create KitchenRejectionScreen (show reason + resubmit)
- [ ] Create EditKitchenRegistrationScreen (resubmit form)
- [ ] Implement refresh status button on pending screen

### Kitchen Dashboard
- [ ] Create KitchenDashboardScreen with 5 tabs
- [ ] Tab 1: Dashboard Overview
  - [ ] Fetch dashboard stats
  - [ ] Show today's orders/revenue stats
  - [ ] Display meal window breakdown
  - [ ] Show batch status summary
  - [ ] Show menu stats summary
  - [ ] List recent orders
- [ ] Tab 2: Orders (use existing implementation)
- [ ] Tab 3: Batches (use existing implementation)
- [ ] Tab 4: Menu Management
  - [ ] Fetch menu stats
  - [ ] Show stats at top
  - [ ] Sub-tabs for Meal Menu / On-Demand
  - [ ] CRUD operations
- [ ] Tab 5: Profile (use existing implementation)

### API Services
- [ ] Create kitchenApproval.service.ts
- [ ] Create kitchenDashboard.service.ts
- [ ] Add error handling and retry logic

---

## 🎨 UI/UX Guidelines

### Colors
- **Success (Approved):** #4CAF50 (Green)
- **Warning (Pending):** #FFA500 (Orange)
- **Error (Rejected):** #F44336 (Red)
- **Primary:** Your app's primary color
- **Background:** #F5F5F5 (Light gray)

### Typography
- **Title:** 24px, Bold
- **Subtitle:** 18px, Semibold
- **Body:** 16px, Regular
- **Caption:** 14px, Regular

### Spacing
- **Card Padding:** 16px
- **Section Margin:** 16px
- **Button Padding:** 12px 24px

---

## 🧪 Testing Scenarios

1. **Admin approves kitchen:**
   - Kitchen status changes to ACTIVE
   - Kitchen staff can login and see dashboard
   - Pending list updates (kitchen removed)

2. **Admin rejects kitchen:**
   - Rejection reason is stored
   - Kitchen status remains PENDING_APPROVAL
   - Kitchen staff sees rejection screen on next login
   - Kitchen can resubmit

3. **Kitchen resubmits:**
   - Updated details are saved
   - Rejection fields cleared
   - Status back to pending (no rejection reason)
   - Admin sees it again in pending list

4. **Kitchen staff login states:**
   - PENDING (no rejection) → Pending screen
   - PENDING (with rejection) → Rejection screen with resubmit
   - ACTIVE → Full dashboard access

---

## 📞 Support

If you encounter issues:

1. Check backend logs for errors
2. Verify API endpoint URLs
3. Check authentication token is being sent
4. Verify user role and kitchen status
5. Check network requests in React Native Debugger

---

**Document Version:** 1.0
**Last Updated:** 2026-01-17
**Backend Status:** ✅ Fully Implemented
**Ready for Frontend Integration:** YES
