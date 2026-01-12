import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../../schema/user.schema.js";
import Kitchen from "../../schema/kitchen.schema.js";
import { sendResponse } from "../../utils/response.utils.js";

/**
 * Auth Controller
 * Handles authentication for all user types
 * - Phone OTP via Firebase (all users)
 * - Username/password for Admin web portal
 */

/**
 * Generate JWT token for admin users
 * @param {Object} user - User document
 * @returns {Object} Token and expiry info
 */
const generateJwtToken = (user) => {
  const expiresIn = 24 * 60 * 60; // 24 hours in seconds
  const token = jwt.sign(
    {
      userId: user._id,
      role: user.role,
      username: user.username,
    },
    process.env.JWT_SECRET,
    { expiresIn: `${expiresIn}s` }
  );
  return { token, expiresIn };
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result
 */
const validatePasswordStrength = (password) => {
  const errors = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Hash password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Sync/check user after Firebase OTP authentication
 * Only checks if user exists - does NOT create new users
 *
 * POST /api/auth/sync
 */
export const syncUser = async (req, res) => {
  try {
    const phone = req.phone;
    const firebaseUid = req.firebaseUid;

    // Find existing user
    const user = await User.findOne({ phone, status: { $ne: "DELETED" } });

    if (!user) {
      // User does not exist - client should redirect to registration
      return sendResponse(res, 200, "User not found", {
        user: null,
        isNewUser: true,
        isProfileComplete: false,
      });
    }

    // Check if driver is pending approval
    if (user.role === "DRIVER" && user.approvalStatus === "PENDING") {
      return sendResponse(res, 200, "Driver pending approval", {
        user: user.toJSON(),
        isNewUser: false,
        isProfileComplete: Boolean(user.name),
        approvalStatus: "PENDING",
        message: "Your driver registration is pending admin approval.",
      });
    }

    // Check if driver was rejected
    if (user.role === "DRIVER" && user.approvalStatus === "REJECTED") {
      return sendResponse(res, 200, "Driver rejected", {
        user: user.toJSON(),
        isNewUser: false,
        isProfileComplete: Boolean(user.name),
        approvalStatus: "REJECTED",
        rejectionReason: user.approvalDetails?.rejectionReason,
        message: "Your driver registration was rejected.",
      });
    }

    // Existing user - update Firebase UID if not set
    if (!user.firebaseUid && firebaseUid) {
      user.firebaseUid = firebaseUid;
    }
    user.lastLoginAt = new Date();
    await user.save();

    const isProfileComplete = Boolean(user.name);

    return sendResponse(res, 200, "User authenticated", {
      user: user.toJSON(),
      isNewUser: false,
      isProfileComplete,
      approvalStatus: user.role === "DRIVER" ? user.approvalStatus : undefined,
    });
  } catch (error) {
    console.log("> Auth sync error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Register new user after Firebase OTP authentication
 * Creates new CUSTOMER account with profile details
 *
 * POST /api/auth/register
 */
export const registerUser = async (req, res) => {
  try {
    const { name, email, dietaryPreferences } = req.body;
    const phone = req.phone;
    const firebaseUid = req.firebaseUid;

    console.log(`> Register attempt - phone: ${phone}, name: ${name}`);

    // Validate phone is present
    if (!phone) {
      console.log("> Auth register error: Phone not found in request");
      return sendResponse(res, 400, "Phone number not found");
    }

    // Check if user already exists (including deleted - phone has unique index)
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      // If user was deleted, reactivate them
      if (existingUser.status === "DELETED") {
        existingUser.status = "ACTIVE";
        existingUser.name = name.trim();
        existingUser.email = email?.trim() || existingUser.email;
        existingUser.dietaryPreferences = dietaryPreferences || [];
        existingUser.firebaseUid = firebaseUid;
        existingUser.lastLoginAt = new Date();
        await existingUser.save();

        console.log(`> Reactivated deleted customer: ${phone}`);

        return sendResponse(res, 201, "User registered successfully", {
          user: existingUser.toJSON(),
          isProfileComplete: true,
        });
      }

      return sendResponse(res, 409, "User already exists", {
        user: existingUser.toJSON(),
        isProfileComplete: Boolean(existingUser.name),
      });
    }

    // Create new CUSTOMER user
    const newUser = new User({
      phone,
      role: "CUSTOMER",
      name: name.trim(),
      email: email?.trim() || undefined,
      dietaryPreferences: dietaryPreferences || [],
      firebaseUid,
      status: "ACTIVE",
      lastLoginAt: new Date(),
    });

    await newUser.save();

    console.log(`> New customer registered: ${phone}`);

    return sendResponse(res, 201, "User registered successfully", {
      user: newUser.toJSON(),
      isProfileComplete: true,
    });
  } catch (error) {
    console.error("> Auth register error:", error.message);
    console.error("> Auth register stack:", error.stack);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Register new driver after Firebase OTP authentication
 * Creates new DRIVER account with vehicle details - requires admin approval
 *
 * POST /api/auth/register-driver
 */
export const registerDriver = async (req, res) => {
  try {
    const {
      name,
      email,
      profileImage,
      licenseNumber,
      licenseImageUrl,
      licenseExpiryDate,
      vehicleName,
      vehicleNumber,
      vehicleType,
      vehicleDocuments,
    } = req.body;
    const phone = req.phone;
    const firebaseUid = req.firebaseUid;

    console.log(`> Driver register attempt - phone: ${phone}, name: ${name}`);

    // Validate phone is present
    if (!phone) {
      console.log("> Driver register error: Phone not found in request");
      return sendResponse(res, 400, false, "Phone number not found");
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      // If user was deleted, allow re-registration
      if (existingUser.status === "DELETED") {
        existingUser.status = "ACTIVE";
        existingUser.role = "DRIVER";
        existingUser.name = name.trim();
        existingUser.email = email?.trim() || existingUser.email;
        existingUser.profileImage = profileImage || existingUser.profileImage;
        existingUser.firebaseUid = firebaseUid;
        existingUser.approvalStatus = "PENDING";
        existingUser.driverDetails = {
          licenseNumber: licenseNumber.trim(),
          licenseImageUrl,
          licenseExpiryDate: licenseExpiryDate ? new Date(licenseExpiryDate) : undefined,
          vehicleName: vehicleName.trim(),
          vehicleNumber: vehicleNumber.trim().toUpperCase(),
          vehicleType,
          vehicleDocuments,
        };
        existingUser.approvalDetails = {};
        existingUser.lastLoginAt = new Date();
        await existingUser.save();

        console.log(`> Reactivated deleted user as driver: ${phone}`);

        return sendResponse(res, 201, true, "Driver registration submitted for approval", {
          user: existingUser.toJSON(),
          approvalStatus: "PENDING",
          message: "Your registration is pending admin approval. You will be notified once approved.",
        });
      }

      // User exists and is not deleted
      if (existingUser.role === "DRIVER") {
        return sendResponse(res, 409, false, "Driver account already exists", {
          approvalStatus: existingUser.approvalStatus,
        });
      }

      return sendResponse(res, 409, false, "Phone number already registered with a different role");
    }

    // Create new DRIVER user with PENDING approval
    const newDriver = new User({
      phone,
      role: "DRIVER",
      name: name.trim(),
      email: email?.trim() || undefined,
      profileImage,
      firebaseUid,
      status: "ACTIVE",
      approvalStatus: "PENDING",
      driverDetails: {
        licenseNumber: licenseNumber.trim(),
        licenseImageUrl,
        licenseExpiryDate: licenseExpiryDate ? new Date(licenseExpiryDate) : undefined,
        vehicleName: vehicleName.trim(),
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        vehicleType,
        vehicleDocuments,
      },
      lastLoginAt: new Date(),
    });

    await newDriver.save();

    console.log(`> New driver registered (pending approval): ${phone}`);

    return sendResponse(res, 201, true, "Driver registration submitted for approval", {
      user: newDriver.toJSON(),
      approvalStatus: "PENDING",
      message: "Your registration is pending admin approval. You will be notified once approved.",
    });
  } catch (error) {
    console.error("> Driver register error:", error.message);
    console.error("> Driver register stack:", error.stack);
    return sendResponse(res, 500, false, "Failed to register driver");
  }
};

/**
 * Complete or update user profile
 *
 * PUT /api/auth/profile
 */
export const completeProfile = async (req, res) => {
  try {
    const { name, email, dietaryPreferences, profileImage } = req.body;
    const user = req.user;

    if (!user) {
      return sendResponse(res, 401, "User not found");
    }

    // Update fields
    user.name = name.trim();
    if (email !== undefined) user.email = email?.trim() || undefined;
    if (dietaryPreferences !== undefined) user.dietaryPreferences = dietaryPreferences;
    if (profileImage !== undefined) user.profileImage = profileImage;

    await user.save();

    return sendResponse(res, 200, "Profile updated", {
      user: user.toJSON(),
      isProfileComplete: true,
    });
  } catch (error) {
    console.log("> Profile update error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get current authenticated user's profile
 *
 * GET /api/auth/me
 */
export const getCurrentUser = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return sendResponse(res, 401, "User not found");
    }

    const response = {
      user: user.toJSON(),
    };

    // If KITCHEN_STAFF, include kitchen details
    if (user.role === "KITCHEN_STAFF" && user.kitchenId) {
      const kitchen = await Kitchen.findById(user.kitchenId).select(
        "name code type status"
      );
      response.kitchen = kitchen;
    }

    return sendResponse(res, 200, "User profile", response);
  } catch (error) {
    console.log("> Get current user error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Register/update FCM token for push notifications
 *
 * POST /api/auth/fcm-token
 */
export const updateFcmToken = async (req, res) => {
  try {
    const { fcmToken, deviceId } = req.body;
    const user = req.user;

    if (!user) {
      return sendResponse(res, 401, "User not found");
    }

    // Initialize array if not exists
    if (!user.fcmTokens) {
      user.fcmTokens = [];
    }

    // Remove existing token with same deviceId if provided
    if (deviceId) {
      user.fcmTokens = user.fcmTokens.filter((t) => t.deviceId !== deviceId);
    }

    // Remove duplicate token if exists
    user.fcmTokens = user.fcmTokens.filter((t) => t.token !== fcmToken);

    // Add new token
    user.fcmTokens.push({
      token: fcmToken,
      deviceId: deviceId || undefined,
      registeredAt: new Date(),
    });

    // Limit to max 5 devices
    if (user.fcmTokens.length > 5) {
      user.fcmTokens = user.fcmTokens.slice(-5);
    }

    await user.save();

    return sendResponse(res, 200, "FCM token registered");
  } catch (error) {
    console.log("> FCM token update error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Remove FCM token (logout from device)
 *
 * DELETE /api/auth/fcm-token
 */
export const removeFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const user = req.user;

    if (!user) {
      return sendResponse(res, 401, "User not found");
    }

    if (user.fcmTokens) {
      user.fcmTokens = user.fcmTokens.filter((t) => t.token !== fcmToken);
      await user.save();
    }

    return sendResponse(res, 200, "FCM token removed");
  } catch (error) {
    console.log("> FCM token remove error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Admin login with username and password
 * Web portal only
 *
 * POST /api/auth/admin/login
 */
export const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find admin user by username
    const user = await User.findOne({
      username: username.toLowerCase().trim(),
      role: "ADMIN",
      status: { $ne: "DELETED" },
    }).select("+passwordHash");

    if (!user) {
      console.log(`> Failed admin login attempt: ${username}`);
      return sendResponse(res, 401, "Invalid credentials");
    }

    // Check if user has password set
    if (!user.passwordHash) {
      return sendResponse(res, 401, "Invalid credentials");
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      console.log(`> Failed admin login: wrong password for ${username}`);
      return sendResponse(res, 401, "Invalid credentials");
    }

    // Check user status
    if (user.status === "INACTIVE" || user.status === "SUSPENDED") {
      return sendResponse(res, 403, "Account is disabled");
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT token
    const { token, expiresIn } = generateJwtToken(user);

    console.log(`> Admin logged in: ${username}`);

    return sendResponse(res, 200, "Login successful", {
      user: {
        _id: user._id,
        phone: user.phone,
        role: user.role,
        name: user.name,
        email: user.email,
        username: user.username,
      },
      token,
      expiresIn,
    });
  } catch (error) {
    console.log("> Admin login error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Change admin password
 *
 * POST /api/auth/admin/change-password
 */
export const adminChangePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    if (!user) {
      return sendResponse(res, 401, "User not found");
    }

    // Get user with password hash
    const userWithPassword = await User.findById(user._id).select("+passwordHash");

    if (!userWithPassword.passwordHash) {
      return sendResponse(res, 400, "Password not set for this account");
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, userWithPassword.passwordHash);
    if (!isMatch) {
      return sendResponse(res, 401, "Current password is incorrect");
    }

    // Validate new password strength
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      return sendResponse(res, 400, "Password too weak", null, validation.errors.join(", "));
    }

    // Hash and save new password
    userWithPassword.passwordHash = await hashPassword(newPassword);
    await userWithPassword.save();

    console.log(`> Password changed for admin: ${user.username}`);

    return sendResponse(res, 200, "Password changed successfully");
  } catch (error) {
    console.log("> Password change error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Refresh JWT token for admin web portal
 *
 * POST /api/auth/admin/refresh
 */
export const adminRefreshToken = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return sendResponse(res, 401, "User not found");
    }

    // Verify user is still active
    const currentUser = await User.findById(user._id);
    if (!currentUser || currentUser.status !== "ACTIVE" || currentUser.role !== "ADMIN") {
      return sendResponse(res, 401, "User no longer valid");
    }

    // Generate new token
    const { token, expiresIn } = generateJwtToken(currentUser);

    return sendResponse(res, 200, "Token refreshed", {
      token,
      expiresIn,
    });
  } catch (error) {
    console.log("> Token refresh error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

export default {
  syncUser,
  registerUser,
  registerDriver,
  completeProfile,
  getCurrentUser,
  updateFcmToken,
  removeFcmToken,
  adminLogin,
  adminChangePassword,
  adminRefreshToken,
};
