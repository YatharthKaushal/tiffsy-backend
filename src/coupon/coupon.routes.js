import { Router } from "express";
import couponController from "./coupon.controller.js";
import { authMiddleware, adminMiddleware, roleMiddleware } from "../../middlewares/auth.middleware.js";
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
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  validateQuery(queryAvailableCouponsSchema),
  couponController.getAvailableCoupons
);

// Validate coupon
router.post(
  "/validate",
  authMiddleware,
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
  authMiddleware,
  validateBody(applyCouponSchema),
  couponController.applyCoupon
);

// Expire coupons (cron job)
router.post(
  "/expire",
  authMiddleware,
  adminMiddleware,
  couponController.expireCoupons
);

/**
 * ADMIN ROUTES
 */

// Create coupon
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  validateBody(createCouponSchema),
  couponController.createCoupon
);

// Get all coupons
router.get(
  "/",
  authMiddleware,
  adminMiddleware,
  validateQuery(queryCouponsSchema),
  couponController.getCoupons
);

// Get coupon by ID
router.get(
  "/:id",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  couponController.getCouponById
);

// Update coupon
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  validateBody(updateCouponSchema),
  couponController.updateCoupon
);

// Activate coupon
router.patch(
  "/:id/activate",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  couponController.activateCoupon
);

// Deactivate coupon
router.patch(
  "/:id/deactivate",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  couponController.deactivateCoupon
);

// Delete coupon
router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  validateParams(idParamSchema),
  couponController.deleteCoupon
);

export default router;
