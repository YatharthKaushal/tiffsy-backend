import jwt from "jsonwebtoken";
import { auth as firebaseAuth } from "../config/firebase.config.js";
import User from "../../schema/user.schema.js";
import { sendResponse } from "../utils/response.utils.js";
import { normalizePhone } from "../../utils/phone.utils.js";

/**
 * Auth Middleware
 * Handles authentication and authorization for all routes
 */

/**
 * Verify Firebase ID token
 * For mobile app authentication via phone OTP
 *
 * Attaches: req.user, req.phone, req.firebaseUid
 */
export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendResponse(res, 401, "No token provided");
    }

    const token = authHeader.split(" ")[1];

    // Try to verify as Firebase token
    try {
      const decodedToken = await firebaseAuth.verifyIdToken(token);

      // Extract and normalize phone number from token
      const rawPhone = decodedToken.phone_number;
      if (!rawPhone) {
        return sendResponse(res, 401, "Invalid token: no phone number");
      }
      const phone = normalizePhone(rawPhone);

      // Find user by phone
      const user = await User.findOne({
        phone,
        status: { $ne: "DELETED" },
      });

      // Check user status
      if (user) {
        if (user.status === "SUSPENDED") {
          return sendResponse(res, 403, "Account is suspended");
        }
        if (user.status === "INACTIVE") {
          return sendResponse(res, 403, "Account is inactive");
        }
      }

      req.user = user;
      req.firebaseUid = decodedToken.uid;
      req.phone = phone;

      return next();
    } catch (firebaseError) {
      // If Firebase verification fails, try JWT (for admin web portal)
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.userId);
        if (!user) {
          return sendResponse(res, 401, "User not found");
        }

        if (user.status === "DELETED") {
          return sendResponse(res, 401, "Account not found");
        }
        if (user.status === "SUSPENDED") {
          return sendResponse(res, 403, "Account is suspended");
        }
        if (user.status === "INACTIVE") {
          return sendResponse(res, 403, "Account is inactive");
        }

        req.user = user;
        return next();
      } catch (jwtError) {
        // Both verifications failed
        if (firebaseError.code === "auth/id-token-expired") {
          return sendResponse(res, 401, "Token expired, please re-authenticate");
        }
        return sendResponse(res, 401, "Invalid token");
      }
    }
  } catch (error) {
    console.error("> Auth middleware error:", error);
    return sendResponse(res, 500, "Authentication service error");
  }
};

/**
 * Verify JWT token only
 * For admin web portal routes that only accept JWT
 */
export const jwtAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendResponse(res, 401, "No token provided");
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.userId);
      if (!user || user.role !== "ADMIN") {
        return sendResponse(res, 401, "Invalid token");
      }

      if (user.status !== "ACTIVE") {
        return sendResponse(res, 403, "Account is disabled");
      }

      req.user = user;
      next();
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return sendResponse(res, 401, "Token expired");
      }
      return sendResponse(res, 401, "Invalid token");
    }
  } catch (error) {
    console.error("> JWT auth middleware error:", error);
    return sendResponse(res, 500, "Authentication service error");
  }
};

/**
 * Require admin role
 * Must be used after authMiddleware
 */
export const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return sendResponse(res, 401, "Authentication required");
  }

  if (req.user.role !== "ADMIN") {
    return sendResponse(res, 403, "Access denied: Admin only");
  }

  next();
};

/**
 * Require specific roles
 * Factory function to create role-checking middleware
 *
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {Function} Express middleware
 */
export const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendResponse(res, 401, "Authentication required");
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendResponse(res, 403, "Access denied");
    }

    next();
  };
};

/**
 * Optional authentication
 * Attaches user if token provided, but doesn't require it
 */
export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];

    // Try Firebase first
    try {
      const decodedToken = await firebaseAuth.verifyIdToken(token);
      const rawPhone = decodedToken.phone_number;

      if (rawPhone) {
        const phone = normalizePhone(rawPhone);
        const user = await User.findOne({
          phone,
          status: "ACTIVE",
        });
        req.user = user;
        req.phone = phone;
        req.firebaseUid = decodedToken.uid;
      }
    } catch (firebaseError) {
      // Try JWT
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (user && user.status === "ACTIVE") {
          req.user = user;
        }
      } catch (jwtError) {
        // Ignore - optional auth
      }
    }

    next();
  } catch (error) {
    // Silently continue - optional auth
    next();
  }
};

/**
 * Kitchen access middleware
 * For KITCHEN_STAFF, restricts access to their assigned kitchen only
 * Must be used after authMiddleware
 *
 * @param {string} kitchenIdParam - Name of the param containing kitchen ID
 */
export const kitchenAccessMiddleware = (kitchenIdParam = "kitchenId") => {
  return (req, res, next) => {
    if (!req.user) {
      return sendResponse(res, 401, "Authentication required");
    }

    // Admins have full access
    if (req.user.role === "ADMIN") {
      return next();
    }

    // Kitchen staff can only access their own kitchen
    if (req.user.role === "KITCHEN_STAFF") {
      const requestedKitchenId = req.params[kitchenIdParam] || req.body.kitchenId;

      if (!req.user.kitchenId) {
        return sendResponse(res, 403, "No kitchen assigned");
      }

      if (requestedKitchenId && requestedKitchenId !== req.user.kitchenId.toString()) {
        return sendResponse(res, 403, "Access denied: Not your kitchen");
      }

      // Attach kitchen ID for convenience
      req.kitchenId = req.user.kitchenId;
      return next();
    }

    // Other roles don't have kitchen access
    return sendResponse(res, 403, "Access denied");
  };
};

/**
 * Internal/cron authentication
 * For internal API calls and cron jobs
 */
export const internalAuthMiddleware = (req, res, next) => {
  const apiKey = req.headers["x-internal-api-key"];

  if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
    return sendResponse(res, 401, "Invalid internal API key");
  }

  // Set a system user context
  req.user = {
    _id: "system",
    role: "SYSTEM",
    name: "System",
  };

  next();
};

/**
 * Cron job authentication
 * For scheduled tasks
 */
export const cronMiddleware = (req, res, next) => {
  const cronSecret = req.headers["x-cron-secret"];

  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return sendResponse(res, 401, "Invalid cron secret");
  }

  req.user = {
    _id: "cron",
    role: "SYSTEM",
    name: "Cron Job",
  };

  next();
};

export default {
  authMiddleware,
  jwtAuthMiddleware,
  adminMiddleware,
  roleMiddleware,
  optionalAuthMiddleware,
  kitchenAccessMiddleware,
  internalAuthMiddleware,
  cronMiddleware,
};
