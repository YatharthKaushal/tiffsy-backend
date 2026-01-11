import bcrypt from "bcryptjs";
import User from "../../schema/user.schema.js";
import Kitchen from "../../schema/kitchen.schema.js";
import Zone from "../../schema/zone.schema.js";
import Order from "../../schema/order.schema.js";
import Refund from "../../schema/refund.schema.js";
import Voucher from "../../schema/voucher.schema.js";
import AuditLog from "../../schema/auditLog.schema.js";
import SystemConfig from "../../schema/systemConfig.schema.js";
import { sendResponse } from "../../utils/response.utils.js";
import { normalizePhone } from "../../utils/phone.utils.js";
import {
  getConfig,
  updateConfig,
  getCutoffTimes,
  getCancellationConfig,
  getFeesConfig,
} from "../../services/config.service.js";

/**
 * ============================================================================
 * CONFIGURATION
 * ============================================================================
 */

// Legacy in-memory config for non-DB settings (will be migrated to DB)
let LEGACY_CONFIG = {
  batching: { maxBatchSize: 15, failedOrderPolicy: "NO_RETURN", autoDispatchDelay: 0 },
  taxes: [{ name: "GST", rate: 5, enabled: true }],
  refund: { maxRetries: 3, autoProcessDelay: 0 },
  branding: { tiffsyLabel: "By Tiffsy", badges: ["POPULAR", "BESTSELLER", "NEW"] },
};

// Guidelines configuration
let GUIDELINES = {
  menuGuidelines: "",
  kitchenGuidelines: "",
  qualityPolicy: "",
};

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Hash password using bcrypt
 * @param {string} password - Plain password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * ============================================================================
 * USER MANAGEMENT FUNCTIONS
 * ============================================================================
 */

/**
 * Create a new user (Kitchen Staff, Driver, or Admin)
 * @route POST /api/admin/users
 * @access Admin
 */
export async function createUser(req, res) {
  try {
    const { phone: rawPhone, role, name, email, kitchenId, username, password } = req.body;
    const adminId = req.user._id;
    const phone = normalizePhone(rawPhone);

    // Check phone uniqueness
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return sendResponse(res, 400, false, "Phone number already registered");
    }

    // Verify kitchen exists for KITCHEN_STAFF
    if (role === "KITCHEN_STAFF" && kitchenId) {
      const kitchen = await Kitchen.findById(kitchenId);
      if (!kitchen) {
        return sendResponse(res, 400, false, "Kitchen not found");
      }
    }

    // Build user data
    const userData = {
      phone,
      role,
      name,
      email,
      status: "ACTIVE",
      createdBy: adminId,
    };

    if (role === "KITCHEN_STAFF") {
      userData.kitchenId = kitchenId;
    }

    if (role === "ADMIN" && username) {
      userData.username = username;
    }

    if (role === "ADMIN" && password) {
      userData.passwordHash = await hashPassword(password);
    }

    const user = new User(userData);
    await user.save();

    // Log audit
    await AuditLog.create({
      action: "CREATE",
      entityType: "USER",
      entityId: user._id,
      performedBy: adminId,
      details: { role, phone, name },
    });

    // Exclude password hash from response
    const userResponse = user.toObject();
    delete userResponse.passwordHash;

    return sendResponse(res, 201, true, "User created successfully", { user: userResponse });
  } catch (error) {
    console.log("Create user error:", error);
    return sendResponse(res, 500, false, "Failed to create user");
  }
}

/**
 * Get all users with filters
 * @route GET /api/admin/users
 * @access Admin
 */
export async function getUsers(req, res) {
  try {
    const { role, status, kitchenId, search, page = 1, limit = 20 } = req.query;

    const query = {};

    if (role) query.role = role;
    if (status) query.status = status;
    if (kitchenId) query.kitchenId = kitchenId;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-passwordHash")
        .populate("kitchenId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    // Get counts
    const [totalActive, totalInactive, roleCountsAgg] = await Promise.all([
      User.countDocuments({ status: "ACTIVE" }),
      User.countDocuments({ status: "INACTIVE" }),
      User.aggregate([
        { $group: { _id: "$role", count: { $sum: 1 } } },
      ]),
    ]);

    const byRole = {};
    roleCountsAgg.forEach((r) => {
      byRole[r._id] = r.count;
    });

    return sendResponse(res, 200, true, "Users retrieved", {
      users,
      counts: {
        total,
        active: totalActive,
        inactive: totalInactive,
        byRole,
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.log("Get users error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve users");
  }
}

/**
 * Get user by ID
 * @route GET /api/admin/users/:id
 * @access Admin
 */
export async function getUserById(req, res) {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select("-passwordHash")
      .populate("kitchenId", "name address status");

    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    // Get activity stats
    const activity = {
      lastLogin: user.lastLoginAt,
      ordersHandled: 0,
      deliveriesCompleted: 0,
    };

    if (user.role === "KITCHEN_STAFF" && user.kitchenId) {
      activity.ordersHandled = await Order.countDocuments({
        kitchenId: user.kitchenId,
        status: "DELIVERED",
      });
    }

    if (user.role === "DRIVER") {
      activity.deliveriesCompleted = await Order.countDocuments({
        driverId: user._id,
        status: "DELIVERED",
      });
    }

    return sendResponse(res, 200, true, "User retrieved", {
      user,
      kitchen: user.kitchenId,
      activity,
    });
  } catch (error) {
    console.log("Get user by ID error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve user");
  }
}

/**
 * Update user details
 * @route PUT /api/admin/users/:id
 * @access Admin
 */
export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { name, email, kitchenId, username } = req.body;
    const adminId = req.user._id;

    const user = await User.findById(id);
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    // Update allowed fields
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (kitchenId !== undefined && user.role === "KITCHEN_STAFF") {
      user.kitchenId = kitchenId;
    }
    if (username !== undefined && user.role === "ADMIN") {
      user.username = username;
    }

    await user.save();

    // Log audit
    await AuditLog.create({
      action: "UPDATE",
      entityType: "USER",
      entityId: user._id,
      performedBy: adminId,
      details: { updatedFields: Object.keys(req.body) },
    });

    const userResponse = user.toObject();
    delete userResponse.passwordHash;

    return sendResponse(res, 200, true, "User updated successfully", { user: userResponse });
  } catch (error) {
    console.log("Update user error:", error);
    return sendResponse(res, 500, false, "Failed to update user");
  }
}

/**
 * Activate a user account
 * @route PATCH /api/admin/users/:id/activate
 * @access Admin
 */
export async function activateUser(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const user = await User.findById(id);
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    if (user.status === "ACTIVE") {
      return sendResponse(res, 400, false, "User is already active");
    }

    user.status = "ACTIVE";
    await user.save();

    // Log audit
    await AuditLog.create({
      action: "ACTIVATE",
      entityType: "USER",
      entityId: user._id,
      performedBy: adminId,
    });

    return sendResponse(res, 200, true, "User activated", { user });
  } catch (error) {
    console.log("Activate user error:", error);
    return sendResponse(res, 500, false, "Failed to activate user");
  }
}

/**
 * Deactivate a user account
 * @route PATCH /api/admin/users/:id/deactivate
 * @access Admin
 */
export async function deactivateUser(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const user = await User.findById(id);
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    if (user.status === "INACTIVE") {
      return sendResponse(res, 400, false, "User is already inactive");
    }

    user.status = "INACTIVE";
    await user.save();

    // Log audit
    await AuditLog.create({
      action: "DEACTIVATE",
      entityType: "USER",
      entityId: user._id,
      performedBy: adminId,
    });

    return sendResponse(res, 200, true, "User deactivated", { user });
  } catch (error) {
    console.log("Deactivate user error:", error);
    return sendResponse(res, 500, false, "Failed to deactivate user");
  }
}

/**
 * Suspend a user account
 * @route PATCH /api/admin/users/:id/suspend
 * @access Admin
 */
export async function suspendUser(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    const user = await User.findById(id);
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    user.status = "SUSPENDED";
    user.suspensionReason = reason;
    user.suspendedAt = new Date();
    await user.save();

    // Log audit
    await AuditLog.create({
      action: "SUSPEND",
      entityType: "USER",
      entityId: user._id,
      performedBy: adminId,
      details: { reason },
    });

    return sendResponse(res, 200, true, "User suspended", { user });
  } catch (error) {
    console.log("Suspend user error:", error);
    return sendResponse(res, 500, false, "Failed to suspend user");
  }
}

/**
 * Delete a user (soft delete)
 * @route DELETE /api/admin/users/:id
 * @access Admin
 */
export async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const user = await User.findById(id);
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    // Check for pending orders/deliveries
    if (user.role === "DRIVER") {
      const pendingDeliveries = await Order.countDocuments({
        driverId: user._id,
        status: { $in: ["PICKED_UP", "OUT_FOR_DELIVERY"] },
      });
      if (pendingDeliveries > 0) {
        return sendResponse(res, 400, false, "Cannot delete driver with pending deliveries");
      }
    }

    user.status = "DELETED";
    await user.save();

    // Log audit
    await AuditLog.create({
      action: "DELETE",
      entityType: "USER",
      entityId: user._id,
      performedBy: adminId,
    });

    return sendResponse(res, 200, true, "User deleted");
  } catch (error) {
    console.log("Delete user error:", error);
    return sendResponse(res, 500, false, "Failed to delete user");
  }
}

/**
 * Reset admin user password
 * @route POST /api/admin/users/:id/reset-password
 * @access Admin
 */
export async function resetUserPassword(req, res) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const adminId = req.user._id;

    const user = await User.findById(id);
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    if (user.role !== "ADMIN") {
      return sendResponse(res, 400, false, "Password reset only for admin users");
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    // Log audit
    await AuditLog.create({
      action: "RESET_PASSWORD",
      entityType: "USER",
      entityId: user._id,
      performedBy: adminId,
    });

    return sendResponse(res, 200, true, "Password reset successfully");
  } catch (error) {
    console.log("Reset password error:", error);
    return sendResponse(res, 500, false, "Failed to reset password");
  }
}

/**
 * ============================================================================
 * AUDIT LOG FUNCTIONS
 * ============================================================================
 */

/**
 * Get audit logs
 * @route GET /api/admin/audit-logs
 * @access Admin
 */
export async function getAuditLogs(req, res) {
  try {
    const { userId, action, entityType, entityId, dateFrom, dateTo, page = 1, limit = 50 } = req.query;

    const query = {};

    if (userId) query.performedBy = userId;
    if (action) query.action = action;
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate("performedBy", "name role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(query),
    ]);

    return sendResponse(res, 200, true, "Audit logs retrieved", {
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.log("Get audit logs error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve audit logs");
  }
}

/**
 * Get audit log by ID
 * @route GET /api/admin/audit-logs/:id
 * @access Admin
 */
export async function getAuditLogById(req, res) {
  try {
    const { id } = req.params;

    const log = await AuditLog.findById(id).populate("performedBy", "name role phone");

    if (!log) {
      return sendResponse(res, 404, false, "Audit log not found");
    }

    return sendResponse(res, 200, true, "Audit log retrieved", { log });
  } catch (error) {
    console.log("Get audit log by ID error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve audit log");
  }
}

/**
 * ============================================================================
 * SYSTEM CONFIGURATION FUNCTIONS
 * ============================================================================
 */

/**
 * Get system configuration
 * Returns both DB-persisted config and legacy in-memory config
 * @route GET /api/admin/config
 * @access Admin
 */
export async function getSystemConfig(req, res) {
  try {
    // Get DB-persisted configs
    const cutoffTimes = getCutoffTimes();
    const cancellation = getCancellationConfig();
    const fees = getFeesConfig();

    // Combine with legacy config
    const config = {
      cutoffTimes,
      cancellation,
      fees,
      ...LEGACY_CONFIG,
    };

    return sendResponse(res, 200, true, "System configuration", { config });
  } catch (error) {
    console.log("Get system config error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve configuration");
  }
}

/**
 * Update system configuration
 * Persists cutoffTimes, cancellation, and fees to database
 * @route PUT /api/admin/config
 * @access Admin
 */
export async function updateSystemConfig(req, res) {
  try {
    const updates = req.body;
    const adminId = req.user._id;

    // Get previous config for audit log
    const previousConfig = {
      cutoffTimes: getCutoffTimes(),
      cancellation: getCancellationConfig(),
      fees: getFeesConfig(),
      ...LEGACY_CONFIG,
    };

    // Update DB-persisted configs
    if (updates.cutoffTimes) {
      const currentCutoff = getCutoffTimes();
      await updateConfig("cutoffTimes", { ...currentCutoff, ...updates.cutoffTimes }, adminId);
    }

    if (updates.cancellation) {
      const currentCancellation = getCancellationConfig();
      await updateConfig("cancellation", { ...currentCancellation, ...updates.cancellation }, adminId);
    }

    if (updates.fees) {
      const currentFees = getFeesConfig();
      await updateConfig("fees", { ...currentFees, ...updates.fees }, adminId);
    }

    // Update legacy in-memory configs
    if (updates.batching) {
      LEGACY_CONFIG.batching = { ...LEGACY_CONFIG.batching, ...updates.batching };
    }
    if (updates.taxes) {
      LEGACY_CONFIG.taxes = updates.taxes;
    }
    if (updates.refund) {
      LEGACY_CONFIG.refund = { ...LEGACY_CONFIG.refund, ...updates.refund };
    }

    // Log audit
    await AuditLog.create({
      action: "UPDATE_CONFIG",
      entityType: "SYSTEM_CONFIG",
      entityId: "system_config",
      performedBy: adminId,
      details: { previousConfig, updatedFields: Object.keys(updates) },
    });

    // Return updated config
    const config = {
      cutoffTimes: getCutoffTimes(),
      cancellation: getCancellationConfig(),
      fees: getFeesConfig(),
      ...LEGACY_CONFIG,
    };

    return sendResponse(res, 200, true, "Configuration updated", { config });
  } catch (error) {
    console.log("Update config error:", error);
    return sendResponse(res, 500, false, "Failed to update configuration");
  }
}

/**
 * ============================================================================
 * DASHBOARD & REPORTING FUNCTIONS
 * ============================================================================
 */

/**
 * Get admin dashboard overview
 * @route GET /api/admin/dashboard
 * @access Admin
 */
export async function getDashboard(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Overview stats
    const [totalOrders, totalRevenue, activeCustomers, activeKitchens] = await Promise.all([
      Order.countDocuments({ status: "DELIVERED" }),
      Order.aggregate([
        { $match: { status: "DELIVERED" } },
        { $group: { _id: null, total: { $sum: "$grandTotal" } } },
      ]),
      User.countDocuments({ role: "CUSTOMER", status: "ACTIVE" }),
      Kitchen.countDocuments({ status: "ACTIVE" }),
    ]);

    // Today stats
    const [todayOrders, todayRevenue, newCustomersToday] = await Promise.all([
      Order.countDocuments({ placedAt: { $gte: today, $lt: tomorrow } }),
      Order.aggregate([
        { $match: { placedAt: { $gte: today, $lt: tomorrow }, status: "DELIVERED" } },
        { $group: { _id: null, total: { $sum: "$grandTotal" } } },
      ]),
      User.countDocuments({ role: "CUSTOMER", createdAt: { $gte: today, $lt: tomorrow } }),
    ]);

    // Pending actions
    const [pendingOrders, pendingRefunds, pendingKitchenApprovals] = await Promise.all([
      Order.countDocuments({ status: "PLACED" }),
      Refund.countDocuments({ status: { $in: ["INITIATED", "PENDING"] } }),
      Kitchen.countDocuments({ status: "INACTIVE" }),
    ]);

    // Recent activity
    const recentActivity = await AuditLog.find()
      .populate("userId", "name role")
      .sort({ createdAt: -1 })
      .limit(10);

    return sendResponse(res, 200, true, "Dashboard retrieved", {
      overview: {
        totalOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        activeCustomers,
        activeKitchens,
      },
      today: {
        orders: todayOrders,
        revenue: todayRevenue[0]?.total || 0,
        newCustomers: newCustomersToday,
      },
      pendingActions: {
        pendingOrders,
        pendingRefunds,
        pendingKitchenApprovals,
      },
      recentActivity,
    });
  } catch (error) {
    console.log("Get dashboard error:", error);
    return sendResponse(res, 500, false, "Failed to retrieve dashboard");
  }
}

/**
 * Get detailed reports
 * @route GET /api/admin/reports
 * @access Admin
 */
export async function getReports(req, res) {
  try {
    const { type, segmentBy, dateFrom, dateTo, kitchenId, zoneId } = req.query;

    const matchQuery = {};
    if (dateFrom || dateTo) {
      matchQuery.placedAt = {};
      if (dateFrom) matchQuery.placedAt.$gte = new Date(dateFrom);
      if (dateTo) matchQuery.placedAt.$lte = new Date(dateTo);
    }
    if (kitchenId) matchQuery.kitchenId = kitchenId;
    if (zoneId) matchQuery.zoneId = zoneId;

    let report = {};

    switch (type) {
      case "ORDERS":
        report = await generateOrdersReport(matchQuery, segmentBy);
        break;
      case "REVENUE":
        report = await generateRevenueReport(matchQuery, segmentBy);
        break;
      case "VOUCHERS":
        report = await generateVouchersReport(matchQuery, segmentBy);
        break;
      case "REFUNDS":
        report = await generateRefundsReport(matchQuery, segmentBy);
        break;
      default:
        return sendResponse(res, 400, false, "Invalid report type");
    }

    return sendResponse(res, 200, true, "Report generated", { report });
  } catch (error) {
    console.log("Get reports error:", error);
    return sendResponse(res, 500, false, "Failed to generate report");
  }
}

/**
 * Generate orders report
 */
async function generateOrdersReport(matchQuery, segmentBy) {
  const groupField = segmentBy === "KITCHEN" ? "$kitchenId" : "$zoneId";

  const result = await Order.aggregate([
    { $match: { ...matchQuery, status: "DELIVERED" } },
    {
      $group: {
        _id: segmentBy ? groupField : null,
        totalOrders: { $sum: 1 },
        totalValue: { $sum: "$grandTotal" },
        avgOrderValue: { $avg: "$grandTotal" },
      },
    },
    {
      $lookup: {
        from: segmentBy === "KITCHEN" ? "kitchens" : "zones",
        localField: "_id",
        foreignField: "_id",
        as: "entity",
      },
    },
    { $unwind: { path: "$entity", preserveNullAndEmptyArrays: true } },
  ]);

  return { type: "ORDERS", segmentBy, data: result };
}

/**
 * Generate revenue report
 */
async function generateRevenueReport(matchQuery, segmentBy) {
  const groupField = segmentBy === "KITCHEN" ? "$kitchenId" : "$zoneId";

  const result = await Order.aggregate([
    { $match: { ...matchQuery, status: "DELIVERED" } },
    {
      $group: {
        _id: segmentBy ? groupField : null,
        totalRevenue: { $sum: "$grandTotal" },
        subtotalSum: { $sum: "$subtotal" },
        chargesSum: {
          $sum: {
            $add: [
              "$charges.deliveryFee",
              "$charges.serviceFee",
              "$charges.packagingFee",
              "$charges.taxAmount",
            ],
          },
        },
        discountsSum: { $sum: "$discount.discountAmount" },
      },
    },
  ]);

  return { type: "REVENUE", segmentBy, data: result };
}

/**
 * Generate vouchers report
 */
async function generateVouchersReport(matchQuery, segmentBy) {
  const result = await Voucher.aggregate([
    { $match: {} },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  return { type: "VOUCHERS", segmentBy, data: result };
}

/**
 * Generate refunds report
 */
async function generateRefundsReport(matchQuery, segmentBy) {
  const result = await Refund.aggregate([
    { $match: {} },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  return { type: "REFUNDS", segmentBy, data: result };
}

/**
 * Export report data
 * @route GET /api/admin/reports/export
 * @access Admin
 */
export async function exportReport(req, res) {
  try {
    const { type, segmentBy, dateFrom, dateTo, format } = req.query;

    // For now, just return JSON data
    // Full CSV/Excel export would need additional libraries like 'json2csv' or 'exceljs'
    const reportResult = await getReports({
      query: { type, segmentBy, dateFrom, dateTo },
    }, {
      json: (data) => data,
    });

    return sendResponse(res, 200, true, "Report exported", {
      format,
      data: reportResult,
      note: "Full CSV/Excel export pending implementation",
    });
  } catch (error) {
    console.log("Export report error:", error);
    return sendResponse(res, 500, false, "Failed to export report");
  }
}

/**
 * ============================================================================
 * GUIDELINES & POLICIES FUNCTIONS
 * ============================================================================
 */

/**
 * Get guidelines
 * @route GET /api/admin/guidelines
 * @access Admin, Kitchen Staff
 */
export async function getGuidelines(req, res) {
  return sendResponse(res, 200, true, "Guidelines retrieved", {
    guidelines: GUIDELINES,
  });
}

/**
 * Update guidelines
 * @route PUT /api/admin/guidelines
 * @access Admin
 */
export async function updateGuidelines(req, res) {
  try {
    const { menuGuidelines, kitchenGuidelines, qualityPolicy } = req.body;
    const adminId = req.user._id;

    if (menuGuidelines !== undefined) GUIDELINES.menuGuidelines = menuGuidelines;
    if (kitchenGuidelines !== undefined) GUIDELINES.kitchenGuidelines = kitchenGuidelines;
    if (qualityPolicy !== undefined) GUIDELINES.qualityPolicy = qualityPolicy;

    // Log audit
    await AuditLog.create({
      action: "CONFIG_CHANGE",
      entityType: "SYSTEM_CONFIG",
      entityId: null,
      userId: adminId,
      userRole: "ADMIN",
      userName: req.user.name || "Admin",
      newValue: { updatedFields: Object.keys(req.body) },
      actionDescription: "Updated guidelines configuration",
      performedAt: new Date(),
    });

    return sendResponse(res, 200, true, "Guidelines updated", {
      guidelines: GUIDELINES,
    });
  } catch (error) {
    console.log("Update guidelines error:", error);
    return sendResponse(res, 500, false, "Failed to update guidelines");
  }
}

export default {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  activateUser,
  deactivateUser,
  suspendUser,
  deleteUser,
  resetUserPassword,
  getAuditLogs,
  getAuditLogById,
  getSystemConfig,
  updateSystemConfig,
  getDashboard,
  getReports,
  exportReport,
  getGuidelines,
  updateGuidelines,
};
