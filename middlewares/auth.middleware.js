import crypto from "crypto";
import jwt from "jsonwebtoken";
import { firebaseAdmin } from "../config/firebase.config.js";
import { sendResponse } from "../utils/response.utils.js";
import User from "../schema/user.schema.js";
import { normalizePhone } from "../utils/phone.utils.js";

/**
 * Timing-safe string comparison to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} Whether strings are equal
 */
function timingSafeCompare(a, b) {
  if (!a || !b) return false;
  // Ensure both strings are same length to prevent length oracle
  const aBuffer = Buffer.from(String(a));
  const bBuffer = Buffer.from(String(b));
  if (aBuffer.length !== bBuffer.length) {
    // Compare against self to maintain constant time
    crypto.timingSafeEqual(aBuffer, aBuffer);
    return false;
  }
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

/**
 * Middleware to verify Firebase ID token and attach user to request
 * Extracts token from Authorization header (Bearer token)
 */
export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("> Auth error: No token provided");
      return sendResponse(res, 401, "Unauthorized", null, "No token provided");
    }

    const token = authHeader.split(" ")[1];

    // Verify Firebase ID token
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    const { uid, phone_number } = decodedToken;
    const phone = normalizePhone(phone_number);

    // Find user in database
    const user = await User.findOne({
      $or: [{ firebaseUid: uid }, { phone }],
      status: { $ne: "DELETED" },
    });

    if (!user) {
      console.log(`> Auth error: User not found for uid: ${uid}`);
      return sendResponse(res, 401, "Unauthorized", null, "User not found");
    }

    if (user.status === "SUSPENDED") {
      console.log(`> Auth error: User suspended: ${user._id}`);
      return sendResponse(
        res,
        403,
        "Account suspended",
        null,
        "Your account has been suspended"
      );
    }

    if (user.status === "INACTIVE") {
      console.log(`> Auth error: User inactive: ${user._id}`);
      return sendResponse(
        res,
        403,
        "Account inactive",
        null,
        "Your account is inactive"
      );
    }

    // Attach user to request
    req.user = user;
    req.firebaseUid = uid;

    next();
  } catch (error) {
    console.log(`> Auth error: ${error.message}`);

    if (error.code === "auth/id-token-expired") {
      return sendResponse(res, 401, "Unauthorized", null, "Token expired");
    }

    if (error.code === "auth/argument-error") {
      return sendResponse(res, 401, "Unauthorized", null, "Invalid token");
    }

    return sendResponse(res, 401, "Unauthorized", null, "Authentication failed");
  }
};

/**
 * Middleware to check if user has ADMIN role
 * Must be used after authMiddleware
 */
export const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    console.log("> Admin check error: No user in request");
    return sendResponse(res, 401, "Unauthorized", null, "Not authenticated");
  }

  if (req.user.role !== "ADMIN") {
    console.log(`> Admin check error: User ${req.user._id} is not admin`);
    return sendResponse(
      res,
      403,
      "Forbidden",
      null,
      "Admin access required"
    );
  }

  next();
};

/**
 * Middleware factory to check if user has one of the specified roles
 * @param {string|string[]} allowedRoles - Single role or array of allowed roles
 * @returns {Function} Express middleware function
 */
export const roleMiddleware = (allowedRoles) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.user) {
      console.log("> Role check error: No user in request");
      return sendResponse(res, 401, "Unauthorized", null, "Not authenticated");
    }

    if (!roles.includes(req.user.role)) {
      console.log(
        `> Role check error: User ${req.user._id} role ${req.user.role} not in ${roles.join(", ")}`
      );
      return sendResponse(
        res,
        403,
        "Forbidden",
        null,
        `Access denied. Required role: ${roles.join(" or ")}`
      );
    }

    next();
  };
};

/**
 * Middleware for internal service-to-service calls
 * Verifies internal API key from headers
 */
export const internalAuthMiddleware = (req, res, next) => {
  const internalKey = req.headers["x-internal-key"];
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey) {
    console.log("> Internal auth error: INTERNAL_API_KEY not configured");
    return sendResponse(
      res,
      500,
      "Server configuration error",
      null,
      "Internal API key not configured"
    );
  }

  if (!internalKey || !timingSafeCompare(internalKey, expectedKey)) {
    console.log("> Internal auth error: Invalid internal key");
    return sendResponse(
      res,
      401,
      "Unauthorized",
      null,
      "Invalid internal API key"
    );
  }

  next();
};

/**
 * Middleware for cron job endpoints
 * Verifies cron secret from headers
 */
export const cronMiddleware = (req, res, next) => {
  const cronSecret = req.headers["x-cron-secret"];
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.log("> Cron auth error: CRON_SECRET not configured");
    return sendResponse(
      res,
      500,
      "Server configuration error",
      null,
      "Cron secret not configured"
    );
  }

  if (!cronSecret || !timingSafeCompare(cronSecret, expectedSecret)) {
    console.log("> Cron auth error: Invalid cron secret");
    return sendResponse(res, 401, "Unauthorized", null, "Invalid cron secret");
  }

  next();
};

/**
 * Firebase-only auth middleware - verifies Firebase token without requiring user in DB
 * Used for sync/register endpoints where user may not exist yet
 */
export const firebaseAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("> Firebase auth error: No token provided");
      return sendResponse(res, 401, "Unauthorized", null, "No token provided");
    }

    const token = authHeader.split(" ")[1];

    // Verify Firebase ID token
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    const { uid, phone_number } = decodedToken;

    // Ensure phone number exists in token
    if (!phone_number) {
      console.log("> Firebase auth error: No phone number in token");
      return sendResponse(res, 401, "Unauthorized", null, "Phone number not found in token");
    }

    const phone = normalizePhone(phone_number);

    // Ensure phone normalization succeeded
    if (!phone) {
      console.log(`> Firebase auth error: Invalid phone number format - ${phone_number}`);
      return sendResponse(res, 401, "Unauthorized", null, "Invalid phone number format");
    }

    // Attach phone and Firebase UID to request (user may not exist yet)
    req.phone = phone;
    req.firebaseUid = uid;

    console.log(`> Firebase auth success - phone: ${phone}, uid: ${uid}`);

    next();
  } catch (error) {
    console.log(`> Firebase auth error: ${error.message}`);

    if (error.code === "auth/id-token-expired") {
      return sendResponse(res, 401, "Unauthorized", null, "Token expired");
    }

    if (error.code === "auth/argument-error") {
      return sendResponse(res, 401, "Unauthorized", null, "Invalid token");
    }

    return sendResponse(res, 401, "Unauthorized", null, "Authentication failed");
  }
};

/**
 * Optional auth middleware - attaches user if token present, continues otherwise
 * Useful for endpoints that work differently for authenticated vs unauthenticated users
 */
export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    const { uid, phone_number } = decodedToken;
    const phone = normalizePhone(phone_number);

    const user = await User.findOne({
      $or: [{ firebaseUid: uid }, { phone }],
      status: "ACTIVE",
    });

    req.user = user || null;
    req.firebaseUid = uid;

    next();
  } catch (error) {
    console.log(`> Optional auth: Token invalid or expired - ${error.message}`);
    req.user = null;
    next();
  }
};

/**
 * Middleware to verify JWT tokens for admin web portal
 * Used for admin routes that use username/password authentication
 * Extracts token from Authorization header (Bearer token)
 */
export const jwtAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("> JWT auth error: No token provided");
      return sendResponse(res, 401, "Unauthorized", null, "No token provided");
    }

    const token = authHeader.split(" ")[1];
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.log("> JWT auth error: JWT_SECRET not configured");
      return sendResponse(
        res,
        500,
        "Server configuration error",
        null,
        "JWT secret not configured"
      );
    }

    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret);
    const { userId, role } = decoded;

    // Find user in database
    const user = await User.findOne({
      _id: userId,
      status: { $ne: "DELETED" },
    });

    if (!user) {
      console.log(`> JWT auth error: User not found for id: ${userId}`);
      return sendResponse(res, 401, "Unauthorized", null, "User not found");
    }

    if (user.status === "SUSPENDED") {
      console.log(`> JWT auth error: User suspended: ${user._id}`);
      return sendResponse(
        res,
        403,
        "Account suspended",
        null,
        "Your account has been suspended"
      );
    }

    if (user.status === "INACTIVE") {
      console.log(`> JWT auth error: User inactive: ${user._id}`);
      return sendResponse(
        res,
        403,
        "Account inactive",
        null,
        "Your account is inactive"
      );
    }

    // Verify role matches token claim
    if (user.role !== role) {
      console.log(`> JWT auth error: Role mismatch for user ${user._id}`);
      return sendResponse(res, 401, "Unauthorized", null, "Invalid token");
    }

    // Attach user to request
    req.user = user;

    next();
  } catch (error) {
    console.log(`> JWT auth error: ${error.message}`);

    if (error.name === "TokenExpiredError") {
      return sendResponse(res, 401, "Unauthorized", null, "Token expired");
    }

    if (error.name === "JsonWebTokenError") {
      return sendResponse(res, 401, "Unauthorized", null, "Invalid token");
    }

    return sendResponse(res, 401, "Unauthorized", null, "Authentication failed");
  }
};

/**
 * Combined auth middleware for admin routes
 * Tries JWT first (for admin web portal), falls back to Firebase (for mobile apps)
 * This allows admins to authenticate via either method
 */
export const adminAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("> Admin auth error: No token provided");
    return sendResponse(res, 401, "Unauthorized", null, "No token provided");
  }

  const token = authHeader.split(" ")[1];

  // Try JWT verification first (primary method for admin web portal)
  try {
    const jwtSecret = process.env.JWT_SECRET;

    if (jwtSecret) {
      const decoded = jwt.verify(token, jwtSecret);
      const { userId, role } = decoded;

      const user = await User.findOne({
        _id: userId,
        status: { $ne: "DELETED" },
      });

      if (user && user.status === "ACTIVE" && user.role === role) {
        req.user = user;
        console.log(`> Admin auth success (JWT): ${user.username || user._id}`);
        return next();
      }
    }
  } catch (jwtError) {
    // JWT verification failed, will try Firebase next
    console.log(`> JWT verification failed, trying Firebase: ${jwtError.message}`);
  }

  // Fallback to Firebase verification (for mobile admin access)
  try {
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    const { uid, phone_number } = decodedToken;
    const phone = normalizePhone(phone_number);

    const user = await User.findOne({
      $or: [{ firebaseUid: uid }, { phone }],
      status: { $ne: "DELETED" },
    });

    if (!user) {
      console.log(`> Admin auth error: User not found for Firebase uid: ${uid}`);
      return sendResponse(res, 401, "Unauthorized", null, "User not found");
    }

    if (user.status === "SUSPENDED") {
      console.log(`> Admin auth error: User suspended: ${user._id}`);
      return sendResponse(res, 403, "Account suspended", null, "Your account has been suspended");
    }

    if (user.status === "INACTIVE") {
      console.log(`> Admin auth error: User inactive: ${user._id}`);
      return sendResponse(res, 403, "Account inactive", null, "Your account is inactive");
    }

    req.user = user;
    req.firebaseUid = uid;
    console.log(`> Admin auth success (Firebase): ${user._id}`);
    return next();
  } catch (firebaseError) {
    console.log(`> Firebase verification also failed: ${firebaseError.message}`);
  }

  // Both methods failed
  console.log("> Admin auth error: Both JWT and Firebase verification failed");
  return sendResponse(res, 401, "Unauthorized", null, "Authentication failed");
};

/**
 * Middleware to check if kitchen staff has access to specific kitchen
 * Must be used after authMiddleware
 * @param {string} kitchenIdParam - Name of the param containing kitchen ID (default: 'kitchenId')
 */
export const kitchenAccessMiddleware = (kitchenIdParam = "kitchenId") => {
  return (req, res, next) => {
    if (!req.user) {
      console.log("> Kitchen access error: No user in request");
      return sendResponse(res, 401, "Unauthorized", null, "Not authenticated");
    }

    // Admins have access to all kitchens
    if (req.user.role === "ADMIN") {
      return next();
    }

    // Kitchen staff can only access their assigned kitchen
    if (req.user.role === "KITCHEN_STAFF") {
      const kitchenId =
        req.params[kitchenIdParam] ||
        req.body[kitchenIdParam] ||
        req.query[kitchenIdParam];

      if (!kitchenId) {
        console.log("> Kitchen access error: No kitchen ID provided");
        return sendResponse(
          res,
          400,
          "Bad request",
          null,
          "Kitchen ID required"
        );
      }

      if (req.user.kitchenId?.toString() !== kitchenId) {
        console.log(
          `> Kitchen access error: User ${req.user._id} cannot access kitchen ${kitchenId}`
        );
        return sendResponse(
          res,
          403,
          "Forbidden",
          null,
          "Access denied to this kitchen"
        );
      }
    }

    next();
  };
};

export default {
  authMiddleware,
  adminMiddleware,
  roleMiddleware,
  internalAuthMiddleware,
  cronMiddleware,
  firebaseAuthMiddleware,
  optionalAuthMiddleware,
  jwtAuthMiddleware,
  adminAuthMiddleware,
  kitchenAccessMiddleware,
};
