/**
 * Webhook Middleware
 *
 * Middleware for handling payment gateway webhooks.
 * Provides raw body capture and signature verification.
 *
 * IMPORTANT: Webhook routes must use these middlewares BEFORE any body parser.
 * The raw body is required for signature verification.
 */

import { getProvider, getProviderName, isInitialized } from "../services/payment/payment.service.js";

/**
 * Middleware to capture raw request body for webhook signature verification.
 * Must be used BEFORE any JSON body parser on webhook routes.
 *
 * Stores raw body in req.rawBody and parsed JSON in req.body.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {Function} next
 */
export function captureRawBody(req, res, next) {
  let data = "";

  req.setEncoding("utf8");

  req.on("data", (chunk) => {
    data += chunk;
  });

  req.on("end", () => {
    req.rawBody = data;

    // Also parse the body for convenience
    try {
      req.body = data ? JSON.parse(data) : {};
    } catch (e) {
      req.body = {};
    }

    next();
  });
}

/**
 * Alternative raw body middleware using Buffer.
 * Use this if you need binary data preservation.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {Function} next
 */
export function captureRawBodyBuffer(req, res, next) {
  const chunks = [];

  req.on("data", (chunk) => {
    chunks.push(chunk);
  });

  req.on("end", () => {
    req.rawBody = Buffer.concat(chunks);

    try {
      req.body = JSON.parse(req.rawBody.toString("utf8"));
    } catch (e) {
      req.body = {};
    }

    next();
  });
}

/**
 * Middleware to verify webhook signature from payment provider.
 * Must be used AFTER captureRawBody middleware.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {Function} next
 */
export function verifyWebhookSignature(req, res, next) {
  // Check if payment service is initialized
  if (!isInitialized()) {
    console.error("> WebhookMiddleware: Payment service not initialized");
    return res.status(500).json({
      success: false,
      message: "Payment service not initialized",
    });
  }

  // Check if raw body is available
  if (!req.rawBody) {
    console.error("> WebhookMiddleware: Raw body not captured");
    return res.status(400).json({
      success: false,
      message: "Raw body not available for signature verification",
    });
  }

  try {
    const provider = getProvider();
    const isValid = provider.verifyWebhookSignature(req.headers, req.rawBody);

    if (!isValid) {
      console.warn("> WebhookMiddleware: Invalid signature from", getProviderName());
      return res.status(401).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    console.log("> WebhookMiddleware: Signature verified for", getProviderName());
    next();
  } catch (error) {
    console.error("> WebhookMiddleware: Signature verification error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Signature verification failed",
    });
  }
}

/**
 * Provider-specific signature verification middleware.
 * Verifies signature based on the provider specified in the route parameter.
 *
 * Usage: router.post('/webhook/:provider', verifyProviderWebhook)
 *
 * @param {Request} req
 * @param {Response} res
 * @param {Function} next
 */
export function verifyProviderWebhook(req, res, next) {
  const { provider: requestedProvider } = req.params;
  const activeProvider = getProviderName();

  // Check if the webhook is for the active provider
  if (requestedProvider !== activeProvider) {
    console.warn(
      `> WebhookMiddleware: Webhook for ${requestedProvider} but active provider is ${activeProvider}`
    );
    // Still process it - the provider might have changed
  }

  // Use the main verification
  return verifyWebhookSignature(req, res, next);
}

/**
 * Middleware to log webhook events for debugging
 *
 * @param {Request} req
 * @param {Response} res
 * @param {Function} next
 */
export function logWebhookEvent(req, res, next) {
  const eventType = req.body?.type || req.body?.event || "unknown";
  const provider = req.params?.provider || getProviderName();

  console.log(`> WebhookMiddleware: Received ${eventType} from ${provider}`);

  // Capture response for logging
  const originalSend = res.send;
  res.send = function (data) {
    console.log(`> WebhookMiddleware: Responded to ${eventType} with status ${res.statusCode}`);
    return originalSend.call(this, data);
  };

  next();
}

export default {
  captureRawBody,
  captureRawBodyBuffer,
  verifyWebhookSignature,
  verifyProviderWebhook,
  logWebhookEvent,
};
