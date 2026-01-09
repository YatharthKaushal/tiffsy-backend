import { sendResponse } from "../utils/response.utils.js";

/**
 * Global error handling middleware
 * Catches all errors and returns consistent error responses
 */
export const errorHandler = (err, req, res, next) => {
  console.log(`> Error: ${err.message}`);
  console.log(`> Stack: ${err.stack}`);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return sendResponse(
      res,
      400,
      "Validation error",
      null,
      messages.join(", ")
    );
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return sendResponse(
      res,
      409,
      "Duplicate entry",
      null,
      `${field} already exists`
    );
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === "CastError") {
    return sendResponse(
      res,
      400,
      "Invalid ID format",
      null,
      `Invalid ${err.path}: ${err.value}`
    );
  }

  // JWT/Firebase auth errors
  if (err.code?.startsWith("auth/")) {
    return sendResponse(res, 401, "Authentication error", null, err.message);
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  return sendResponse(
    res,
    statusCode,
    statusCode === 500 ? "Internal server error" : message,
    null,
    statusCode === 500 ? "Something went wrong" : message
  );
};

/**
 * 404 Not Found handler
 * Catches requests to undefined routes
 */
export const notFoundHandler = (req, res) => {
  console.log(`> 404: ${req.method} ${req.originalUrl}`);
  return sendResponse(
    res,
    404,
    "Not found",
    null,
    `Route ${req.method} ${req.originalUrl} not found`
  );
};

/**
 * Request logging middleware
 * Logs incoming requests
 */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  console.log(`> ${req.method} ${req.originalUrl}`);

  if (Object.keys(req.body).length > 0) {
    // Mask sensitive fields in logs
    const sanitizedBody = { ...req.body };
    const sensitiveFields = ["password", "newPassword", "token", "otp"];
    sensitiveFields.forEach((field) => {
      if (sanitizedBody[field]) {
        sanitizedBody[field] = "***";
      }
    });
    console.log(`> Request body: ${JSON.stringify(sanitizedBody)}`);
  }

  // Log response when finished
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    console.log(`> Response: ${res.statusCode} (${duration}ms)`);
  });

  next();
};

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors and pass to error middleware
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default {
  errorHandler,
  notFoundHandler,
  requestLogger,
  asyncHandler,
};
