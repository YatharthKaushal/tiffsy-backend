import { Router } from "express";
import couponController from "./coupon.controller.js";
import { adminAuthMiddleware, adminMiddleware, roleMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody, validateQuery, validateParams } from "../../middlewares/validate.middleware.js";
import {
  createCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
  applyCouponSchema,
  queryAvailableCouponsSchema,
  queryCouponsSchema,
} from "./coupon.validation.js";
import Joi from "joi";

const router = Router();

// Param schemas
const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

/**
 * CUSTOMER ROUTES
 */

// Get available coupons
router.get(
  "/available",
  adminAuthMiddleware,
  roleMiddleware("CUSTOMER"),
  validateQuery(queryAvailableCouponsSchema),
  couponController.getAvailableCoupons
);

// Validate coupon
router.post(
  "/validate",
  adminAuthMiddleware,
  roleMiddleware("CUSTOMER"),
  validateBody(validateCouponSchema),
  couponController.validateCoupon
);

/**
 * INTERNAL ROUTES
 */

// Apply coupon (internal service call)
router.post(
  "/apply",
  adminAuthMiddleware,
  validateBody(applyCouponSchema),
  couponController.applyCoupon
);

// Expire coupons (cron job)
router.post(
  "/expire",
  adminAuthMiddleware,
  adminMiddleware,
  couponController.expireCoupons
);

/**
 * ADMIN ROUTES
 */

// Create coupon
router.post(
  "/",
  adminAuthMiddleware,
  adminMiddleware,
  validateBody(createCouponSchema),
  couponController.createCoupon
);

// Get all coupons
router.get(
  "/",
  adminAuthMiddleware,
  adminMiddleware,
  validateQuery(queryCouponsSchema),
  couponController.getCoupons
);

// Get coupon by ID
router.get(
  "/:id",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  couponController.getCouponById
);

// Update coupon
router.put(
  "/:id",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(updateCouponSchema),
  couponController.updateCoupon
);

// Activate coupon
router.patch(
  "/:id/activate",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  couponController.activateCoupon
);

// Deactivate coupon
router.patch(
  "/:id/deactivate",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  couponController.deactivateCoupon
);

// Delete coupon
router.delete(
  "/:id",
  adminAuthMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  couponController.deleteCoupon
);

export default router;
