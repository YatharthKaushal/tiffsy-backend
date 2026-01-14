/**
 * Standardized API response helper
 * @param {object} res - Express response object
 * @param {number} status - HTTP status code (200, 201, 400, 500, etc)
 * @param {boolean|string} successOrMessage - Success flag (true/false) OR message string (for backward compatibility)
 * @param {string|object|null} messageOrData - Message string OR data object (for backward compatibility)
 * @param {object|null} dataOrError - Data object OR error (for backward compatibility)
 * @param {string|null} error - Error details (optional)
 *
 * @description
 * This function supports TWO formats for backward compatibility:
 *
 * NEW FORMAT (with success flag):
 * sendResponse(res, 200, true, "User fetched", { id: 1, name: "John" }, null);
 * sendResponse(res, 500, false, "Something went wrong", null, "Database connection failed");
 *
 * OLD FORMAT (without success flag):
 * sendResponse(res, 200, "User fetched", { id: 1, name: "John" }, null);
 * sendResponse(res, 500, "Something went wrong", null, "Database connection failed");
 *
 * The function auto-detects which format is being used based on parameter types.
 */

export const sendResponse = (
  res,
  status,
  successOrMessage = null,
  messageOrData = null,
  dataOrError = null,
  error = null
) => {
  // Detect which format is being used
  const isNewFormat = typeof successOrMessage === 'boolean';

  if (isNewFormat) {
    // NEW FORMAT: (res, status, success, message, data, error)
    const success = successOrMessage;
    const message = messageOrData;
    const data = dataOrError;
    return res.status(status).json({ success, message, data, error });
  } else {
    // OLD FORMAT: (res, status, message, data, error)
    const message = successOrMessage;
    const data = messageOrData;
    const errorMsg = dataOrError;

    // Auto-derive success from status code
    const success = status >= 200 && status < 300;

    return res.status(status).json({
      success,
      message,
      data,
      error: errorMsg
    });
  }
};
