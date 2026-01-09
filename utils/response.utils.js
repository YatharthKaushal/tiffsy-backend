/**
 * Standardized API response helper
 * @param {object} res - Express response object
 * @param {number} status - HTTP status code (200, 201, 400, 500, etc)
 * @param {string|null} message - Success/error message for frontend (optional use)
 * @param {any} data - Response payload or null
 * @param {string|null} error - Error details or null
 * @example
 * Success
 * sendResponse(res, 200, "User fetched", { id: 1, name: "John" }, null);
 * Error
 * sendResponse(res, 500, "Something went wrong", null, "Database connection failed");
 */

export const sendResponse = (
  res,
  status,
  message = null,
  data = null,
  error = null
) => {
  return res.status(status).json({ message, data, error });
};
