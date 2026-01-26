import { Router } from "express";
import { sendResponse } from "./utils/response.utils.js";

// Import route modules
import uploadRoutes from "./src/cloudinary/cloudinary.route.js";
import authRoutes from "./src/auth/auth.routes.js";
import customerRoutes from "./src/customer/customer.routes.js";
import driverRoutes from "./src/driver/driver.routes.js";
import zoneRoutes from "./src/zone/zone.routes.js";
import addressRoutes from "./src/address/address.routes.js";
import kitchenRoutes from "./src/kitchen/kitchen.routes.js";
import menuRoutes from "./src/menu/menu.routes.js";
import addonRoutes from "./src/addon/addon.routes.js";
import subscriptionRoutes from "./src/subscription/subscription.routes.js";
import voucherRoutes from "./src/voucher/voucher.routes.js";
import couponRoutes from "./src/coupon/coupon.routes.js";
import orderRoutes from "./src/order/order.routes.js";
import deliveryRoutes from "./src/delivery/delivery.routes.js";
import adminRoutes from "./src/admin/admin.routes.js";
import cronRoutes from "./src/admin/cron.routes.js";
import refundRoutes from "./src/refund/refund.routes.js";
import paymentRoutes from "./src/payment/payment.routes.js";
import notificationRoutes from "./src/notification/notification.routes.js";

const router = Router();

/**
 * @route GET /api/health
 * @desc Health check endpoint
 */
router.get("/health", (req, res) => {
  sendResponse(res, 200, "Server is running", { status: "ok" }, null);
});

/**
 * @route /api/upload
 * @desc File upload routes (Cloudinary)
 */
router.use("/upload", uploadRoutes);

/**
 * @route /api/auth
 * @desc Authentication routes (Firebase OTP, Admin login)
 */
router.use("/auth", authRoutes);

/**
 * @route /api/customer
 * @desc Customer profile routes
 */
router.use("/customer", customerRoutes);

/**
 * @route /api/driver
 * @desc Driver profile and management routes
 */
router.use("/driver", driverRoutes);

/**
 * @route /api/zones
 * @desc Zone management routes
 */
router.use("/zones", zoneRoutes);

/**
 * @route /api/address
 * @desc Customer address routes
 */
router.use("/address", addressRoutes);

/**
 * @route /api/kitchens
 * @desc Kitchen management routes
 */
router.use("/kitchens", kitchenRoutes);

/**
 * @route /api/menu
 * @desc Menu item routes
 */
router.use("/menu", menuRoutes);

/**
 * @route /api/addons
 * @desc Add-on management routes
 */
router.use("/addons", addonRoutes);

/**
 * @route /api/subscriptions
 * @desc Subscription plan and customer subscription routes
 */
router.use("/subscriptions", subscriptionRoutes);

/**
 * @route /api/vouchers
 * @desc Voucher management routes
 */
router.use("/vouchers", voucherRoutes);

/**
 * @route /api/coupons
 * @desc Coupon management routes (ON_DEMAND_MENU)
 */
router.use("/coupons", couponRoutes);

/**
 * @route /api/orders
 * @desc Order management routes
 */
router.use("/orders", orderRoutes);

/**
 * @route /api/delivery
 * @desc Delivery and batch management routes
 */
router.use("/delivery", deliveryRoutes);

/**
 * @route /api/admin
 * @desc Admin dashboard and management routes
 */
router.use("/admin", adminRoutes);

/**
 * @route /api/admin/cron
 * @desc Admin cron job management routes
 */
router.use("/admin/cron", cronRoutes);

/**
 * @route /api/refunds
 * @desc Refund management routes
 */
router.use("/refunds", refundRoutes);

/**
 * @route /api/payment
 * @desc Payment gateway routes (Razorpay)
 */
router.use("/payment", paymentRoutes);

/**
 * @route /api/notifications
 * @desc In-app notification routes
 */
router.use("/notifications", notificationRoutes);

export default router;
