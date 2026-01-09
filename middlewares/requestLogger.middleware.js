import { createLogger } from "../utils/logger.utils.js";

const log = createLogger("HTTP");

/**
 * Request logging middleware
 * Logs all incoming HTTP requests and their responses
 */
export function requestLogger(req, res, next) {
  const startTime = Date.now();

  // Generate request ID for tracing
  const requestId = generateRequestId();
  req.requestId = requestId;

  // Log incoming request
  const requestMeta = {
    requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    ip: req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress,
    userAgent: req.headers["user-agent"]?.substring(0, 100),
  };

  // Add user info if authenticated
  if (req.user) {
    requestMeta.userId = req.user._id?.toString();
    requestMeta.role = req.user.role;
  }

  log.info("REQUEST", `${req.method} ${req.originalUrl || req.url}`, requestMeta);

  // Capture response
  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const success = statusCode >= 200 && statusCode < 400;

    // Log response
    const responseMeta = {
      requestId,
      statusCode,
      duration: `${duration}ms`,
    };

    // Add response size if available
    if (body) {
      responseMeta.responseSize = Buffer.byteLength(body, "utf8");
    }

    if (success) {
      log.info("RESPONSE", `${req.method} ${req.originalUrl || req.url}`, responseMeta);
    } else {
      // For errors, try to extract error message from response
      let errorMessage = "Request failed";
      try {
        const parsed = JSON.parse(body);
        errorMessage = parsed.message || parsed.error || errorMessage;
      } catch {
        // Body is not JSON
      }
      responseMeta.error = errorMessage;
      log.warn("RESPONSE", `${req.method} ${req.originalUrl || req.url}`, responseMeta);
    }

    return originalSend.call(this, body);
  };

  next();
}

/**
 * Generate a short unique request ID
 * @returns {string} Request ID
 */
function generateRequestId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${timestamp}-${random}`;
}

/**
 * Error logging middleware
 * Should be used after all routes to catch unhandled errors
 */
export function errorLogger(err, req, res, next) {
  const duration = Date.now() - (req.startTime || Date.now());

  log.error("UNHANDLED_ERROR", err.message, {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    userId: req.user?._id?.toString(),
    error: err,
    duration: `${duration}ms`,
  });

  // Pass to default error handler
  next(err);
}

export default { requestLogger, errorLogger };
