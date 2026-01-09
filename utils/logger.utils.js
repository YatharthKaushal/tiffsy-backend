/**
 * Logger Utility
 * Provides structured logging with different levels and consistent formatting
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Default log level (can be overridden by environment variable)
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  magenta: "\x1b[35m",
};

/**
 * Format timestamp in IST
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
  const now = new Date();
  return now.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Format log message with metadata
 * @param {string} level - Log level
 * @param {string} module - Module/controller name
 * @param {string} action - Action being performed
 * @param {string} message - Log message
 * @param {Object} meta - Additional metadata
 * @returns {string} Formatted log string
 */
function formatLog(level, module, action, message, meta = {}) {
  const timestamp = getTimestamp();
  const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${level}] [${module}] ${action}: ${message}${metaStr}`;
}

/**
 * Create a logger instance for a specific module
 * @param {string} moduleName - Name of the module (e.g., 'OrderController')
 * @returns {Object} Logger instance with methods for each log level
 */
export function createLogger(moduleName) {
  return {
    /**
     * Log error messages
     * @param {string} action - Action that failed
     * @param {string} message - Error message
     * @param {Object} meta - Additional metadata (error object, ids, etc.)
     */
    error(action, message, meta = {}) {
      if (currentLogLevel >= LOG_LEVELS.ERROR) {
        const formattedMeta = { ...meta };
        if (meta.error instanceof Error) {
          formattedMeta.error = {
            message: meta.error.message,
            stack: meta.error.stack?.split("\n").slice(0, 3).join(" | "),
          };
        }
        console.error(
          `${colors.red}${formatLog("ERROR", moduleName, action, message, formattedMeta)}${colors.reset}`
        );
      }
    },

    /**
     * Log warning messages
     * @param {string} action - Action with warning
     * @param {string} message - Warning message
     * @param {Object} meta - Additional metadata
     */
    warn(action, message, meta = {}) {
      if (currentLogLevel >= LOG_LEVELS.WARN) {
        console.warn(
          `${colors.yellow}${formatLog("WARN", moduleName, action, message, meta)}${colors.reset}`
        );
      }
    },

    /**
     * Log info messages
     * @param {string} action - Action being performed
     * @param {string} message - Info message
     * @param {Object} meta - Additional metadata
     */
    info(action, message, meta = {}) {
      if (currentLogLevel >= LOG_LEVELS.INFO) {
        console.log(
          `${colors.green}${formatLog("INFO", moduleName, action, message, meta)}${colors.reset}`
        );
      }
    },

    /**
     * Log debug messages (only in development)
     * @param {string} action - Action being debugged
     * @param {string} message - Debug message
     * @param {Object} meta - Additional metadata
     */
    debug(action, message, meta = {}) {
      if (currentLogLevel >= LOG_LEVELS.DEBUG) {
        console.log(
          `${colors.cyan}${formatLog("DEBUG", moduleName, action, message, meta)}${colors.reset}`
        );
      }
    },

    /**
     * Log API request details
     * @param {Object} req - Express request object
     * @param {string} action - API action name
     */
    request(req, action) {
      if (currentLogLevel >= LOG_LEVELS.INFO) {
        const meta = {
          method: req.method,
          path: req.originalUrl,
          userId: req.user?._id?.toString() || "anonymous",
          ip: req.ip || req.connection?.remoteAddress,
        };
        console.log(
          `${colors.blue}${formatLog("REQUEST", moduleName, action, "Incoming request", meta)}${colors.reset}`
        );
      }
    },

    /**
     * Log API response details
     * @param {string} action - API action name
     * @param {number} statusCode - HTTP status code
     * @param {boolean} success - Whether the request was successful
     * @param {number} duration - Request duration in ms
     */
    response(action, statusCode, success, duration) {
      if (currentLogLevel >= LOG_LEVELS.INFO) {
        const color = success ? colors.green : colors.red;
        const meta = { statusCode, duration: `${duration}ms` };
        console.log(
          `${color}${formatLog("RESPONSE", moduleName, action, success ? "Success" : "Failed", meta)}${colors.reset}`
        );
      }
    },

    /**
     * Log business event
     * @param {string} event - Event name
     * @param {string} message - Event description
     * @param {Object} meta - Event metadata
     */
    event(event, message, meta = {}) {
      if (currentLogLevel >= LOG_LEVELS.INFO) {
        console.log(
          `${colors.magenta}${formatLog("EVENT", moduleName, event, message, meta)}${colors.reset}`
        );
      }
    },
  };
}

/**
 * Default logger instance
 */
export const logger = createLogger("App");

export default { createLogger, logger };
