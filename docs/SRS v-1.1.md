## 1. Introduction

### 1.1 Purpose

This SRS defines the functional and non-functional requirements for the **Tiffsy Cloud Kitchen Platform**.

All requirements in Section 3 are written as **testable “shall” statements** to support development, verification, and contractual acceptance.

### 1.2 Scope

Tiffsy is a cloud kitchen ordering and subscription platform focused on **thali and tiffin meals** for office professionals and students seeking **affordable, hygienic, healthy, home-like food**, and also supports **Tiffsy-owned premium/gourmet kitchens** that can operate in any zone. Users may:

- Order from **Meal Menu** (1 thali for Lunch, 1 thali for Dinner per kitchen) with voucher support and time cutoffs
- Order from **On-Demand Menu** (multiple items, anytime) without voucher support but with coupon support
- Purchase **subscription plans** that issue **meal vouchers** (redeemable only on Meal Menu)
- Order from kitchens available in their **City → Zone** service area

Each kitchen manages two menu types:
- **Meal Menu:** Fixed items for Lunch and Dinner with voucher redemption and time-window constraints
- **On-Demand Menu:** Multiple items available anytime; kitchen can accept/reject orders

Operations users manage menus, orders, subscriptions, drivers, batching, kitchens, cities/zones, and refunds.

### 1.3 Definitions, Acronyms, Abbreviations

- **OTP:** One-Time Password (via Firebase phone authentication)
- **Voucher:** A redeemable unit issued by a subscription plan, used for **main course (thali)** only on the **Meal Menu** (initially)
- **Coupon:** A promotional discount code that can be applied to orders (applicable to On-Demand Menu orders)
- **Main Course:** The thali/tiffin meal eligible for voucher redemption
- **Add-ons:** Additional items not covered by vouchers (paid separately); stored as standalone reusable records per kitchen
- **Meal Menu:** A menu type with exactly 1 item for Lunch and 1 item for Dinner; vouchers can be used; subject to time window cutoffs
- **On-Demand Menu:** A menu type with multiple items available anytime; vouchers cannot be used; coupons can be applied; kitchen can accept/reject orders
- **Cutoff Time:** Latest time to place a voucher-based order for a meal window (Lunch: 11:00, Dinner: 21:00)
- **COD:** Cash on Delivery (not supported initially)
- **Ops App:** The shared mobile app for Admins, Kitchen Staff, and Drivers
- **City:** An operational geography enabled for business operations
- **Zone:** A subdivision within a City used to control kitchen listing/serviceability
- **Partner Kitchen:** A kitchen not operated by Tiffsy (may be authorized or non-authorized; semantics TBD)
- **Tiffsy Kitchen:** A kitchen operated by Tiffsy; positioned as premium/gourmet; highlighted in UI
- **Delivery Batch:** A group of multiple orders delivered by a driver in one trip/route
- **Auto-Batching:** Automatic grouping of orders by zone and kitchen, performed continuously during meal time windows

### 1.4 References

- Client notes provided in conversation (source of truth for this SRS)
- Firebase Phone Auth documentation (implementation reference)
- Node.js / Express.js / MongoDB / React Native / Next.js documentation (implementation reference)

---

## 2. Overall Description

### 2.1 Product Perspective

Tiffsy is a multi-client platform supporting:

- Consumer ordering and subscriptions
- Kitchen operations (order acceptance, preparation, dispatch)
- Delivery execution (assignment, pickup, drop), including **batched deliveries**
- Admin governance and configuration (users, cities, zones, kitchens, plans, pricing, refunds, audit)

The business expands **city by city**. Each enabled city is divided into **zones** that control kitchen eligibility and listings.

### 2.2 Product Functions (High-Level)

- Authentication (OTP; admin web also supports username/password)
- Customer onboarding and profile management
- Address management with city/zone mapping and serviceability checks
- **Dual menu system:** Meal Menu (voucher-eligible, time-constrained) and On-Demand Menu (anytime, coupon-eligible)
- Browsing kitchens/menus and placing orders (voucher-based, coupon-based, or paid)
- Subscription purchase and voucher issuance/expiry
- Cutoff-time enforcement for Meal Menu voucher orders
- Add-on management as standalone reusable records per kitchen
- Add-on purchase alongside orders (paid)
- Kitchen order acceptance/rejection/cancellation
- Refund processing for rejected/failed/cancelled paid orders
- **Auto-batching:** Automatic order batching by zone and kitchen; dispatched after meal window ends
- Delivery assignment and delivery tracking status updates
- City and zone management and zone-based kitchen listing rules
- UI differentiation for Tiffsy kitchens ("By Tiffsy" label / premium positioning)
- Admin management of users, kitchens, plans, menus, orders, refunds, and audit logs

### 2.4 Operating Environment

- **Mobile Apps:** React Native (without Expo), Android first (iOS optional unless specified)
- **Admin Web Portal:** React.js / Next.js
- **Backend:** Node.js + Express.js
- **Database:** MongoDB
- **Auth:** Firebase Phone OTP; admin web also supports username/password (in addition to OTP)

### 2.5 Design and Implementation Constraints

- The backend **shall** be implemented using Node.js + Express.js.
- The primary database **shall** be MongoDB.
- Mobile applications **shall** be implemented using React Native without Expo.
- Admin web portal **shall** be implemented using React.js or Next.js.
- Phone-based login **shall** use Firebase authentication.
- The system **shall** support geographic configuration using **City** and **Zone** entities stored in the database.

### 2.6 Assumptions and Dependencies

- Payment gateway integration will be required (provider TBD).
- Notification services (push/SMS/email) will be required (providers TBD).
- Delivery service area definition and delivery fee model are TBD.
- Charges (service/packaging/handling/delivery) are TBD.
- COD is excluded from MVP but may be added later.
- “Authorized vs non-authorized kitchen” is a data attribute but operational meaning is TBD.
- Delivery batching will initially be **automatic** (system auto-batches orders by zone within the same kitchen). Manual batch creation/modification by Kitchen Staff is planned for a future release.

> ⚠ **Open Items (Must be finalized for accurate pricing and acceptance):** payment provider, fee structure, serviceable pincodes/geo-fence, kitchen capacity rules, refund timelines, tax handling, iOS support, notification channels, batching constraints, and SLA targets.

- payment provider: RazorPay (initially we will bypass payment gateway, we will setup payment gateway later; till then for testing purposes, consumer must be able to place orders directly without payment)
- fee structure is not decideed yet, must be optional and later configurable by the admin
- no geo fencing
- no fixed kitched capacity rules
- refund timeline configurable by admin
- tax handling not decided yet
- notification channel will be develped later, so no need to do anything for it
- batching constraint: 1 zone, 1 kitchen, 1 batch (auto-batched by system); manual batching is a future feature

---

## 3. Functional Requirements (Testable “Shall” Statements)

### 3.1 Authentication & Access Control

**FR-AUTH-1** TSA authenticate **Customers, Kitchen Staff, Delivery Drivers, and Admins** using **phone number OTP** via Firebase.  
**FR-AUTH-2** TSA authenticate **Admins** on the **Admin Web Portal** using **either** (a) phone OTP **or** (b) username/password.  
**FR-AUTH-3** TSA restrict **username/password login** to **Admins on the Admin Web Portal only**.  
**FR-AUTH-4** TSA not provide a self-registration flow for Kitchen Staff, Delivery Drivers, or Admins.  
**FR-AUTH-5** TSA allow only Admins to create, activate, deactivate, or delete Kitchen Staff, Delivery Driver, and Admin accounts.  
**FR-AUTH-6** TSA enforce role-based access control such that each role can access only its permitted features.  
**FR-AUTH-7** TSA terminate authenticated sessions after a configurable inactivity timeout.  
**FR-AUTH-8** TSA prevent Partner Kitchen staff from accessing data belonging to other kitchens.

> ⚠ **Potentially missing client decision:** password policy, MFA for admin password login, device binding, session duration.

- password can be changed but only by admin
- no device binding
- no session duration
- no mfa

---

### 3.2 Customer Onboarding & Profile

**FR-CUST-1** The Customer App shall implement a two-step onboarding flow: phone entry → OTP verification → profile completeness check.  
**FR-CUST-2** If a customer profile does not exist or is incomplete, the system shall require the customer to provide **name** and may optionally provide **email**.  
**FR-CUST-3** TSA store customer **dietary preferences** using a configurable list (e.g., Jain/Veg/Non-Veg/Vegan).  
**FR-CUST-4** Upon profile completion, the system shall route the customer to the home screen.  
**FR-CUST-5** TSA allow customers to view and edit their profile data after onboarding.  
**FR-CUST-6** TSA associate the customer profile to one or more saved addresses and shall require at least one address before checkout.

> ⚠ **Potentially missing client decision:** whether email verification is required.

- email verification is not required

---

### 3.3 Address Management

**FR-ADDR-1** TSA allow customers to create, edit, delete, and select delivery addresses.  
**FR-ADDR-2** Each address shall include at minimum: label, full address text, locality/city, and a phone contact name/number.  
**FR-ADDR-3** TSA allow a customer to select an address per order.  
**FR-ADDR-4** TSA validate whether an address is serviceable based on configured service areas.  
**FR-ADDR-5** TSA determine a customer address’s **City** and **Zone** based on configured serviceability rules.  
**FR-ADDR-6** TSA prevent checkout for addresses that do not map to an enabled City/Zone.  
**FR-ADDR-7** TSA allow a customer to change the selected delivery address during checkout prior to payment confirmation.

> ⚠ **Likely slipped:** geo-pin/map support, pin code validation rules, address limits, and address verification.

- no pincode validation or address verification

---

### 3.4 Geography, City Rollout, and Zone Rules

**FR-GEO-1** TSA allow Admins to create, edit, activate, and deactivate Cities.  
**FR-GEO-2** TSA allow Admins to create, edit, activate, and deactivate Zones within a City.  
**FR-GEO-3** Each Zone shall have a unique identifier and a defined service boundary (e.g., pin code list and/or geo boundary), configurable by Admins.  
**FR-GEO-4** TSA allow Admins to map delivery addresses to Zones using the configured boundary definition.  
**FR-GEO-5** TSA allow configuration such that each Zone has **at most one listed Partner Kitchen** at a time.  
**FR-GEO-6** TSA allow Tiffsy-owned kitchens to be listed in a Zone **even if** a Partner Kitchen already exists in that Zone.  
**FR-GEO-7** TSA enforce that a customer order can only be placed with kitchens that serve the customer’s address Zone.  
**FR-GEO-8** If a Zone has no eligible kitchens, the system shall prevent checkout and shall display an “Unavailable in your area” message.  
**FR-GEO-9** TSA allow Admins to enable/disable ordering per Zone without requiring an app update.

> ⚠ **Likely slipped decision:** whether “one partner kitchen per zone” remains fixed or becomes configurable.

- initially fixed, later maybe configurable

---

### 3.5 Kitchens: Types, Authorization Flags, and Listing

**FR-KITCH-1** TSA store kitchens as either **Tiffsy Kitchen** or **Partner Kitchen**.  
**FR-KITCH-2** TSA allow Admins to set and update a kitchen’s type (Tiffsy/Partner).  
**FR-KITCH-3** TSA allow Admins to set and update a kitchen’s **authorizedFlag** (authorized/non-authorized).  
**FR-KITCH-4** TSA allow Admins to activate/deactivate a kitchen, and deactivated kitchens shall not accept new orders.  
**FR-KITCH-5** TSA allow Admins to assign kitchens to serve one or more zones.  
**FR-KITCH-6** TSA enforce that Partner Kitchen visibility in a zone complies with FR-GEO-5.  
**FR-KITCH-7** TSA allow Admins to mark a kitchen as **Premium/Gourmet** (boolean flags or tags) for UI display.

> ⚠ **Open item:** the operational meaning of authorizedFlag (ranking? visibility? compliance status?) must be defined.

---

### 3.6 Menu, Items, and Availability (Thali + Add-ons)

#### 3.6.1 Menu Types

TSA support two distinct menu types per kitchen:

**FR-MENU-TYPE-1** TSA support a **Meal Menu** with the following characteristics:
  - Serves only two meals: **LUNCH** and **DINNER**
  - Each meal window (Lunch/Dinner) shall have exactly **1 menu item** (e.g., 1 thali for lunch, 1 thali for dinner)
  - Vouchers can be redeemed on the Meal Menu
  - Orders are subject to meal time window cutoffs

**FR-MENU-TYPE-2** TSA support an **On-Demand Menu** with the following characteristics:
  - Can have **multiple menu items** (no limit)
  - **No lunch/dinner time constraints** — available anytime
  - **Vouchers cannot be used** on On-Demand Menu orders
  - **Coupons can be applied** to On-Demand Menu orders
  - Any user can order from On-Demand Menu at any time
  - Kitchen has the option to **accept or reject** On-Demand orders

**FR-MENU-TYPE-3** TSA allow customers to order from the Meal Menu (Lunch/Dinner) within the order time window, with or without vouchers.

**FR-MENU-TYPE-4** Each kitchen can manage both menu types:
  - **Meal Menu:** 1 meal item for Lunch + 1 meal item for Dinner
  - **On-Demand Menu:** Multiple menu items with no meal window restrictions

#### 3.6.2 Menu Item Management

**FR-MENU-1** TSA allow Admins and authorized Kitchen Staff to create and manage menu items.
**FR-MENU-2** TSA categorize items into at minimum: **Main Course (Thali/Tiffin)** and **Add-ons**.
**FR-MENU-3** TSA display prices for each item to customers.
**FR-MENU-4** TSA allow Kitchen Staff to mark items as available/unavailable in real time.
**FR-MENU-5** TSA support configuration of meal windows (Lunch/Dinner) and item availability by window for the Meal Menu.
**FR-MENU-6** TSA allow Partner Kitchens to create and publish menu items without requiring pre-approval from Tiffsy.
**FR-MENU-7** TSA provide Admins the ability to disable a specific menu item for policy violations, and the system shall record an audit entry for the action.
**FR-MENU-8** TSA provide Admins the ability to disable a kitchen's menu listing for policy violations, and the system shall record an audit entry for the action.
**FR-MENU-9** TSA allow Admins to publish menu/kitchen guidelines and policies accessible to Partner Kitchens.

#### 3.6.3 Add-on Management

**FR-ADDON-1** TSA store add-ons as **standalone records** in the backend, independent of menu items/meals.
**FR-ADDON-2** When Kitchen Staff adds a new menu item or meal, the system shall provide an option to **attach add-ons** to that item.
**FR-ADDON-3** TSA allow Kitchen Staff to select add-ons from an **existing add-on list** instead of creating duplicates for different items or meals.
**FR-ADDON-4** TSA allow Kitchen Staff to create new add-ons, which are then stored as reusable standalone records.
**FR-ADDON-5** TSA allow the same add-on to be associated with multiple menu items or meals.
**FR-ADDON-6** TSA allow Kitchen Staff to manage (create, edit, delete, activate/deactivate) their add-on library.

> ⚠ **Likely slipped:** taxes, image requirements, allergens, ingredient disclosures, portion size, and "today's menu" vs fixed menu.

- admins can configure, enable, disable, add, remove, the taxes
- image requirements are vague right now
- we are ignoring allergens
- ingredient disclosures is ignored too
- portion size will be optional (string)
- there wont be "todays menu", it will be fixed menu

---

### 3.7 Kitchen Branding & UI Differentiation

**FR-BRAND-1** The Customer App shall display Tiffsy-owned kitchens with a distinct visual treatment compared to Partner Kitchens.  
**FR-BRAND-2** TSA display a label on Tiffsy-owned kitchen listings, such as “By Tiffsy”, where the label text shall be configurable by Admins.  
**FR-BRAND-3** TSA display Premium/Gourmet designation for Tiffsy kitchens when configured.  
**FR-BRAND-4** TSA allow Admins to configure badges/labels displayed for kitchens (including enabling/disabling badges).  
**FR-BRAND-5** TSA ensure the same kitchen branding rules are applied consistently on the home kitchen list and the kitchen menu screen.

> ⚠ **Open suggestion:** define a standard “badge system” to avoid hardcoding future segments.

---

### 3.8 On-Demand Orders (On-Demand Menu)

**FR-ORD-1** TSA allow any customer to place an order from the **On-Demand Menu** at any time by paying the displayed total.
**FR-ORD-2** TSA compute the payable amount as **listed item total + applicable charges**, where charges may include service, packaging, handling, and delivery (configurable; may be zero).
**FR-ORD-3** TSA not offer COD in the initial release.
**FR-ORD-4** TSA allow the kitchen to **accept** or **reject** an on-demand menu order.
**FR-ORD-5** TSA allow the kitchen to **cancel** an accepted on-demand menu order.
**FR-ORD-6** If an on-demand menu order is rejected, failed, or cancelled by the kitchen after acceptance, the system shall initiate a refund to the original payment method.
**FR-ORD-7** TSA show the customer an order status timeline including at minimum: placed, accepted/rejected, preparing, ready, picked up, delivered, cancelled/refunded.
**FR-ORD-8** TSA prevent an order from being placed for an unavailable or deactivated kitchen.
**FR-ORD-9** TSA **NOT allow vouchers** to be applied to On-Demand Menu orders.
**FR-ORD-10** TSA allow **coupons** to be applied to On-Demand Menu orders (subject to coupon validity rules).

> ⚠ **Likely slipped:** refund SLA, partial refunds, dispute flow, and delivery ETA.

- system must handle these things gracefully

---

### 3.8.1 Meal Menu Orders (Voucher & Non-Voucher)

**FR-MEAL-ORD-1** TSA allow customers to place orders from the **Meal Menu** (Lunch/Dinner) within the configured order time window.
**FR-MEAL-ORD-2** TSA allow customers to use **vouchers** when ordering from the Meal Menu.
**FR-MEAL-ORD-3** TSA allow customers to order from the Meal Menu **without vouchers** by paying the full price.
**FR-MEAL-ORD-4** TSA enforce meal time window cutoffs for Meal Menu orders as defined in Section 3.10.
**FR-MEAL-ORD-5** TSA apply the same order lifecycle (accept/reject/cancel/refund) rules to Meal Menu orders as On-Demand orders.

---

### 3.9 Subscriptions & Plans

#### 3.9.1 Plan Catalog

**FR-SUB-1** TSA offer subscription plans with durations: **7, 14, 30, and 60 days**.  
**FR-SUB-2** Each plan shall issue **2 vouchers per day** by default (1 voucher per meal), totaling **2 × planDays** vouchers.  
**FR-SUB-3** TSA support creation of additional/custom plans in the future, including plans with **1 voucher per day** and/or flexible redemption rules.  
**FR-SUB-4** Only Admins shall be able to create, modify, activate, or deactivate subscription plans.  
**FR-SUB-5** TSA allow Admins to activate/deactivate a plan, and inactive plans shall not be purchasable.

#### 3.9.2 Voucher Issuance & Expiry

**FR-VCH-1** Upon successful plan purchase, the system shall issue the plan’s total vouchers to the customer account.  
**FR-VCH-2** Each voucher shall expire **3 months from the plan purchase date**.  
**FR-VCH-3** TSA not enforce same-day expiry for vouchers that are not used.  
**FR-VCH-4** TSA display voucher balance and voucher expiry dates to the customer.  
**FR-VCH-5** TSA prevent redemption of expired vouchers.

#### 3.9.3 Voucher Redemption Rules

**FR-VCH-6** TSA allow vouchers to be redeemed only for **Main Course (Thali/Tiffin)** items.  
**FR-VCH-7** TSA require separate payment for **Add-ons** and other non-covered items when a voucher is used.  
**FR-VCH-8** TSA prevent voucher application to add-ons in the initial release.  
**FR-VCH-9** TSA support a future rule configuration where a plan may include **add-on entitlement per voucher**.  
**FR-VCH-10** TSA record voucher redemption against the order record for auditing and customer support.

> ⚠ **High-risk slipped area:** whether vouchers are generic vs meal-tagged; whether multiple vouchers can be redeemed in a single order.

- initially generic, later there might be meal-tagged as well as generic
- multiple vouchers can be redeemed in a single order

---

### 3.10 Cutoff Times for Voucher Orders

**FR-CUT-1** TSA enforce a voucher redemption cutoff time of **11:00 local time** for Lunch.  
**FR-CUT-2** TSA enforce a voucher redemption cutoff time of **21:00 local time** for Dinner.  
**FR-CUT-3** After the applicable cutoff, the system shall prevent applying vouchers for that meal window and shall display an explanatory message.  
**FR-CUT-4** TSA allow Admins to configure cutoff times without requiring an app update.  
**FR-CUT-5** TSA apply cutoff enforcement based on the timezone configured for the City/Zone.

> ⚠ **Likely slipped:** define meal window boundaries (delivery slots), grace period, and late-order behavior.

- user cannot place late order, can place order for another window or another day
- no grace period

---

### 3.11 Payments, Billing, Refunds

**FR-PAY-1** TSA integrate with at least one online payment gateway (provider TBD) to support prepaid orders and subscription purchases.  
**FR-PAY-2** TSA generate an order receipt including item totals and charge breakdown.  
**FR-PAY-3** TSA record transaction references for reconciliation and support.  
**FR-PAY-4** TSA prevent order creation from being confirmed without a successful payment confirmation (except voucher-only main-course orders with zero payable, if allowed).  
**FR-REF-1** TSA initiate refunds automatically for eligible events (reject/failure/cancel after accept) for paid orders.  
**FR-REF-2** TSA allow Admins to view and manage refund statuses (initiated, pending, completed, failed).  
**FR-REF-3** TSA store refund gateway references and timestamps.  
**FR-REF-4** TSA prevent refunds for voucher redemptions unless explicitly configured, and shall instead restore vouchers when cancellation rules apply (see FR-CAN-3/FR-CAN-4).

> ⚠ **Must be decided:** refund SLA, partial refunds, gateway settlement delays, tax invoices.

- system must support all these things

---

### 3.12 Order Lifecycle, Cancellation, and Voucher Restoration

**FR-LIFE-1** TSA maintain order states and transitions as a finite set configurable by Admins.  
**FR-LIFE-2** TSA record timestamps for each state transition.  
**FR-CAN-1** TSA allow Kitchen Staff to reject an order before acceptance.  
**FR-CAN-2** TSA allow Kitchen Staff to cancel an order after acceptance.  
**FR-CAN-3** If a voucher-based order is cancelled by the kitchen after acceptance, the system shall restore the redeemed voucher(s) to the customer account.  
**FR-CAN-4** If a voucher-based order is rejected or cancelled before acceptance, the system shall restore the redeemed voucher(s) to the customer account.  
**FR-CAN-5** TSA record cancellation reason codes for reporting and support.  
**FR-CAN-6** TSA notify the customer of cancellations and voucher restoration (if applicable).

> ⚠ **Likely slipped:** customer cancellation policy, penalties, no-show handling, and reattempt delivery rules.

- system shall take care of these things

---

### 3.13 Delivery Management (Drivers) and Batching

#### 3.13.1 Assignment and Tracking

**FR-DLV-1** TSA allow Admins or Kitchen Staff to assign a delivery driver to an order.
**FR-DLV-2** TSA allow a driver to view assigned deliveries with pickup and drop addresses.
**FR-DLV-3** TSA allow drivers to update delivery status at minimum: assigned, picked up, en route, delivered, failed.
**FR-DLV-4** TSA timestamp each delivery status change.
**FR-DLV-5** TSA support proof-of-delivery capture (OTP-at-door).

#### 3.13.2 Auto-Batching System

> **Note:** Kitchen Staff will NOT manually create batches in the initial release. Manual batch creation/modification is planned as a future feature.

**FR-DLV-6** TSA **automatically batch orders** (auto-batching) as the default behavior.
**FR-DLV-7** TSA auto-batch orders based on **zone**, clubbing all orders of the **same zone** from the **same kitchen** into a single batch.
**FR-DLV-8** TSA perform auto-batching **continuously** during the meal time window.
**FR-DLV-9** TSA **dispatch batches only after the meal time window ends** (not during the window).
**FR-DLV-10** The **first driver to accept** an auto-batched delivery shall be **assigned to the entire batch**.
**FR-DLV-11** TSA support assigning a delivery driver to a **batch** containing multiple orders.
**FR-DLV-12** TSA allow delivery drivers to optionally choose the delivery sequence within an assigned batch unless sequence locking is enabled by Admins.
**FR-DLV-13** TSA track status per order even when orders are delivered as part of a batch.
**FR-DLV-14** TSA restrict a delivery batch to orders from the **same kitchen and same zone** (cross-zone batching not allowed).
**FR-DLV-15** TSA record a batch identifier on each order included in a batch.

#### 3.13.3 Manual Batch Management (Future Feature)

> **Note:** The following features are planned for future releases and are NOT part of the initial implementation.

**FR-DLV-FUTURE-1** TSA allow Kitchen Staff to **modify** auto-batched deliveries (add/remove orders from batch).
**FR-DLV-FUTURE-2** TSA allow Kitchen Staff to **create new batches** manually.
**FR-DLV-FUTURE-3** TSA allow Kitchen Staff to **reassign drivers** to batches.
**FR-DLV-FUTURE-4** TSA allow Kitchen Staff to **split** an auto-batch into multiple smaller batches.

> ⚠ **Batch Configuration:**

- max batch size will be configurable by admins. default it to 15.
- cross zone batching not allowed
- system shall be capable to handle partial batch failure (some orders out of a batch are successfully delivered, some got failed - failed orders may or may not be returned to kitchen, default will be no return to kitchen, and it is configurable by admin)

---

### 3.14 Admin & Operations Management

**FR-ADM-1** The Admin Web Portal shall allow Admins to manage: users, cities, zones, kitchens, menu, plans, orders, payments, refunds, and system configuration.  
**FR-ADM-2** The Ops App shall provide role-based views for Admins, Kitchen Staff, and Drivers within a single application.  
**FR-ADM-3** TSA log admin actions for audit (who changed what, and when).  
**FR-ADM-4** TSA allow Admins to disable a kitchen temporarily, preventing new orders.  
**FR-ADM-5** The Admin Web Portal shall provide management screens for Cities and Zones, including kitchen assignment per Zone.  
**FR-ADM-6** The Admin Web Portal shall allow Admins to mark kitchens as Tiffsy-owned vs Partner and configure labels/badges.  
**FR-ADM-7** TSA provide reporting segmented by City and Zone (orders, revenue, refunds, voucher usage).  
**FR-ADM-8** TSA allow Admins to onboard Kitchen Staff, Delivery Drivers, and Admin users.

> ⚠ **Likely slipped (include these too):** analytics dashboards, configurable charge rules.

---

## 4. Non-Functional Requirements

### 4.5 Scalability

**NFR-SCAL-1** The architecture shall support adding multiple kitchens and multiple service areas.  
**NFR-SCAL-2** The database design shall support growth to at least 1 million orders without schema redesign.  
**NFR-SCAL-3** TSA support onboarding additional Cities and Zones without downtime through admin configuration.

---

## 5. External Interface Requirements

### 5.1 User Interfaces

#### 5.1.1 Customer Mobile App

**UI-CUST-1** The Customer App shall provide screens for login/OTP, onboarding, home/kitchens, kitchen menu, cart, checkout, payment result, order tracking, subscriptions/vouchers, profile, and address management.
**UI-CUST-2** The Customer App shall display voucher balance and voucher expiry information.
**UI-CUST-3** The Customer App shall allow a customer to browse kitchens available in their Zone and shall show Tiffsy-owned kitchens with distinct UI styling and labels.
**UI-CUST-4** The Customer App shall display both **Meal Menu** (Lunch/Dinner) and **On-Demand Menu** options for each kitchen.
**UI-CUST-5** The Customer App shall clearly indicate which menu type the customer is ordering from and whether vouchers/coupons can be applied.

#### 5.1.2 Operations (Ops) Mobile App (Admins/Kitchen/Drivers)

**UI-OPS-1** The Ops App shall provide role-based navigation for kitchen operations, driver deliveries, and admin controls as permitted.
**UI-OPS-2** The Ops App shall support order list filtering by status and meal window.
**UI-OPS-3** The Ops App shall display auto-batched orders to Kitchen Staff; manual batch creation is a future feature.
**UI-OPS-4** The Driver UI shall present batched deliveries as a list of stops with per-order status updates.
**UI-OPS-5** The Ops App shall provide Kitchen Staff a UI to manage both **Meal Menu** (Lunch/Dinner items) and **On-Demand Menu** (multiple items).
**UI-OPS-6** The Ops App shall provide Kitchen Staff a UI to manage their **Add-on library** (create, edit, delete, associate with menu items).

#### 5.1.3 Admin Web Portal

**UI-WEB-1** The Admin Portal shall provide administrative dashboards and CRUD screens for users, cities, zones, kitchens, plans, menu, orders, refunds, and configuration.  
**UI-WEB-2** The Admin Portal shall support username/password login in addition to OTP.

### 5.3 Software Interfaces

**INT-SW-1** TSA integrate with Firebase Authentication for OTP.  
**INT-SW-2** TSA integrate with a payment gateway for prepaid payments (provider TBD).  
**INT-SW-3** TSA integrate with push notification services (FCM/APNs as applicable).

---

## 6. Data Requirements

### 6.1 Core Data Entities (Logical Model; suggestion - imporovements may be needed)

TSA persist at minimum the following entities:

- **User:** id, role, phone, name, email(optional), dietary preferences, status, timestamps
- **CustomerAddress:** id, userId, label, address fields, cityId, zoneId, serviceability flag
- **City:** id, name, status, timestamps
- **Zone:** id, cityId, name/code, boundary definition, status
- **Kitchen:** id, name, type (TIFFSY/PARTNER), authorizedFlag, premiumFlag, gourmetFlag, address, zonesServed, operating hours, status
- **MenuItem:** id, kitchenId, name, category (main/add-on), menuType (MEAL_MENU/ON_DEMAND_MENU), mealWindow (LUNCH/DINNER for Meal Menu), price, availability, addonIds[], status
- **Addon:** id, kitchenId, name, description, price, availability, status (standalone reusable record)
- **SubscriptionPlan:** id, durationDays, vouchersPerDay, rules (coverage rules), price, status
- **Subscription:** id, userId, planId, purchaseDate, status
- **Voucher:** id, userId, subscriptionId, expiryDate, status (available/redeemed/expired/restored)
- **Order:** id, userId, kitchenId, zoneId, items, charges breakdown, payment info, voucher usage, status timeline, batchId(optional)
- **DeliveryBatch:** id, kitchenId, driverId, orderIds[], status, sequencePolicy, timestamps
- **Refund:** id, orderId, amount, status, gateway refs, timestamps
- **DeliveryAssignment:** id, orderId, driverId, status, timestamps, POD artifact ref

### 6.2 Storage Requirements

**DATA-1** TSA store all transactional data in MongoDB with appropriate indexes on phone, userId, orderId, kitchenId, zoneId, and status fields.  
**DATA-2** TSA store immutable order and payment records for auditability.  
**DATA-3** TSA index Zone→Kitchen mappings to ensure efficient eligibility checks during checkout.  
**DATA-4** TSA preserve DeliveryBatch history for audit and support.

---

## 8. Appendices

### 8.1 Glossary (Extended)

- **Serviceability:** Whether an address falls in a kitchen's configured delivery area.
- **POD:** Proof of Delivery.
- **SLA:** Service Level Agreement (e.g., delivery time guarantees).
- **Delivery Batch:** A grouped set of orders delivered in one trip.
- **Zone Exclusivity (Partner):** Policy limiting a zone to a single Partner Kitchen listing.
- **TSA:** The System (Application) Shall.
- **Meal Menu:** A structured menu offering exactly 1 item for Lunch and 1 item for Dinner; supports voucher redemption; subject to order time cutoffs.
- **On-Demand Menu:** A flexible menu with multiple items available at any time; does not support vouchers; supports coupons; kitchen can accept/reject orders.
- **Auto-Batching:** System-driven automatic grouping of orders by zone and kitchen for efficient delivery; dispatched after meal time window ends.
- **Add-on Library:** A collection of standalone add-on items per kitchen that can be reused across multiple menu items.
