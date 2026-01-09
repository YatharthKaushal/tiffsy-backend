import mongoose from "mongoose";

/**
 * AuditLog Schema
 * Tracks admin actions for audit purposes
 * Records who changed what and when
 * Logs are immutable - never update or delete
 */
const auditLogSchema = new mongoose.Schema(
  {
    // Actor
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    userRole: {
      type: String,
      required: [true, "User role is required"],
      enum: ["ADMIN", "KITCHEN_STAFF", "DRIVER", "SYSTEM"],
    },

    userName: {
      type: String,
      required: [true, "User name is required"],
      trim: true,
    },

    // Action
    action: {
      type: String,
      required: [true, "Action is required"],
      enum: {
        values: [
          "CREATE",
          "UPDATE",
          "DELETE",
          "ACTIVATE",
          "DEACTIVATE",
          "SUSPEND",
          "APPROVE",
          "REJECT",
          "ASSIGN",
          "UNASSIGN",
          "CANCEL",
          "REFUND",
          "LOGIN",
          "LOGOUT",
          "PASSWORD_CHANGE",
          "CONFIG_CHANGE",
          "BULK_UPDATE",
          "EXPORT",
          "DISABLE_ITEM",
          "DISABLE_KITCHEN",
          "OTHER",
        ],
        message: "Invalid action type",
      },
    },

    actionDescription: {
      type: String,
      trim: true,
      maxlength: [500, "Action description cannot exceed 500 characters"],
    },

    // Target Entity
    entityType: {
      type: String,
      required: [true, "Entity type is required"],
      enum: {
        values: [
          "USER",
          "KITCHEN",
          "MENU_ITEM",
          "ADDON",
          "ORDER",
          "SUBSCRIPTION_PLAN",
          "SUBSCRIPTION",
          "VOUCHER",
          "COUPON",
          "CITY",
          "ZONE",
          "DELIVERY_BATCH",
          "REFUND",
          "SYSTEM_CONFIG",
        ],
        message: "Invalid entity type",
      },
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    entityName: {
      type: String,
      trim: true,
    },

    // Change Details
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
    },

    newValue: {
      type: mongoose.Schema.Types.Mixed,
    },

    changedFields: [
      {
        type: String,
        trim: true,
      },
    ],

    // Context
    reason: {
      type: String,
      trim: true,
      maxlength: [500, "Reason cannot exceed 500 characters"],
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },

    // Request Context
    ipAddress: {
      type: String,
      trim: true,
    },

    userAgent: {
      type: String,
      trim: true,
      maxlength: [500, "User agent cannot exceed 500 characters"],
    },

    requestId: {
      type: String,
      trim: true,
    },

    source: {
      type: String,
      enum: {
        values: ["ADMIN_PORTAL", "OPS_APP", "API", "SYSTEM", "CRON"],
        message: "Invalid source",
      },
      default: "ADMIN_PORTAL",
    },

    // Status
    status: {
      type: String,
      enum: {
        values: ["SUCCESS", "FAILURE", "PARTIAL"],
        message: "Invalid status",
      },
      default: "SUCCESS",
    },

    errorMessage: {
      type: String,
      trim: true,
      maxlength: [1000, "Error message cannot exceed 1000 characters"],
    },

    // Timestamp
    performedAt: {
      type: Date,
      required: [true, "Performed at is required"],
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform: function (_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ entityType: 1 });
auditLogSchema.index({ entityId: 1 });
auditLogSchema.index({ performedAt: -1 });
auditLogSchema.index({ userId: 1, performedAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ action: 1, entityType: 1 });

/**
 * Create audit log entry
 * @param {Object} params - Log parameters
 * @param {ObjectId} params.userId - Actor user ID
 * @param {string} params.userRole - Actor role
 * @param {string} params.userName - Actor name
 * @param {string} params.action - Action performed
 * @param {string} params.entityType - Target entity type
 * @param {ObjectId} [params.entityId] - Target entity ID
 * @param {string} [params.entityName] - Target entity name
 * @param {Object} [params.previousValue] - Previous value
 * @param {Object} [params.newValue] - New value
 * @param {string[]} [params.changedFields] - Changed field names
 * @param {Object} [params.context] - Request context (ip, userAgent, requestId, source)
 * @param {string} [params.reason] - Reason for action
 * @param {string} [params.notes] - Additional notes
 * @returns {Promise<Document>} Created audit log document
 */
auditLogSchema.statics.log = async function ({
  userId,
  userRole,
  userName,
  action,
  entityType,
  entityId,
  entityName,
  previousValue,
  newValue,
  changedFields,
  context = {},
  reason,
  notes,
  status = "SUCCESS",
  errorMessage,
}) {
  // Sanitize sensitive fields from values
  const sanitize = (obj) => {
    if (!obj || typeof obj !== "object") return obj;
    const sanitized = { ...obj };
    const sensitiveFields = [
      "password",
      "passwordHash",
      "token",
      "accessToken",
      "refreshToken",
      "otp",
    ];
    sensitiveFields.forEach((field) => {
      if (field in sanitized) {
        sanitized[field] = "[REDACTED]";
      }
    });
    return sanitized;
  };

  const logEntry = new this({
    userId,
    userRole,
    userName,
    action,
    entityType,
    entityId,
    entityName,
    previousValue: sanitize(previousValue),
    newValue: sanitize(newValue),
    changedFields,
    reason,
    notes,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    requestId: context.requestId,
    source: context.source || "ADMIN_PORTAL",
    status,
    errorMessage,
    performedAt: new Date(),
  });

  return logEntry.save();
};

/**
 * Log from request context
 * Helper to extract context from Express request
 * @param {Object} req - Express request object
 * @param {Object} logData - Log data
 * @returns {Promise<Document>} Created audit log
 */
auditLogSchema.statics.logFromRequest = async function (req, logData) {
  const context = {
    ipAddress: req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress,
    userAgent: req.headers["user-agent"],
    requestId: req.headers["x-request-id"],
    source: req.headers["x-source"] || "API",
  };

  return this.log({
    userId: req.user?._id,
    userRole: req.user?.role || "SYSTEM",
    userName: req.user?.name || "System",
    ...logData,
    context,
  });
};

/**
 * Find logs by entity
 * @param {string} entityType - Entity type
 * @param {ObjectId} entityId - Entity ID
 * @returns {Query} Mongoose query
 */
auditLogSchema.statics.findByEntity = function (entityType, entityId) {
  return this.find({ entityType, entityId })
    .sort({ performedAt: -1 })
    .limit(100);
};

/**
 * Find logs by user
 * @param {ObjectId} userId - User ID
 * @param {Object} options - Query options
 * @returns {Query} Mongoose query
 */
auditLogSchema.statics.findByUser = function (userId, options = {}) {
  const query = { userId };

  if (options.action) query.action = options.action;
  if (options.entityType) query.entityType = options.entityType;
  if (options.dateFrom || options.dateTo) {
    query.performedAt = {};
    if (options.dateFrom) query.performedAt.$gte = new Date(options.dateFrom);
    if (options.dateTo) query.performedAt.$lte = new Date(options.dateTo);
  }

  return this.find(query)
    .sort({ performedAt: -1 })
    .limit(options.limit || 100);
};

/**
 * Get recent activity
 * @param {number} limit - Number of entries
 * @returns {Query} Mongoose query
 */
auditLogSchema.statics.getRecentActivity = function (limit = 50) {
  return this.find({
    action: { $nin: ["LOGIN", "LOGOUT"] },
  })
    .sort({ performedAt: -1 })
    .limit(limit)
    .select("-previousValue -newValue -gatewayResponse");
};

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
