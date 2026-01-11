import AuditLog from "../schema/auditLog.schema.js";

/**
 * Safe Audit Logging Utilities
 * These wrappers ensure audit log failures don't break the main flow
 */

/**
 * Safely log an audit entry from request context
 * Failures are logged but don't throw or break execution
 * @param {Object} req - Express request object
 * @param {Object} logData - Audit log data
 * @returns {Promise<void>}
 */
export const safeAuditLog = async (req, logData) => {
  try {
    await AuditLog.logFromRequest(req, logData);
  } catch (error) {
    console.error("> Audit log failed (non-blocking):", error.message);
  }
};

/**
 * Safely create an audit entry directly
 * Failures are logged but don't throw or break execution
 * @param {Object} data - Audit log data
 * @returns {Promise<void>}
 */
export const safeAuditCreate = async (data) => {
  try {
    await AuditLog.create(data);
  } catch (error) {
    console.error("> Audit log create failed (non-blocking):", error.message);
  }
};

/**
 * Fire-and-forget audit log from request (doesn't await)
 * Use when you don't need to wait for the audit log to complete
 * @param {Object} req - Express request object
 * @param {Object} logData - Audit log data
 */
export const fireAuditLog = (req, logData) => {
  AuditLog.logFromRequest(req, logData).catch((error) => {
    console.error("> Audit log failed (fire-and-forget):", error.message);
  });
};

/**
 * Fire-and-forget audit create (doesn't await)
 * Use when you don't need to wait for the audit log to complete
 * @param {Object} data - Audit log data
 */
export const fireAuditCreate = (data) => {
  AuditLog.create(data).catch((error) => {
    console.error("> Audit log create failed (fire-and-forget):", error.message);
  });
};

export default {
  safeAuditLog,
  safeAuditCreate,
  fireAuditLog,
  fireAuditCreate,
};
