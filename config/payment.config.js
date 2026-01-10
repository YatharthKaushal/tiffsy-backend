/**
 * Payment Gateway Configuration
 *
 * Centralized configuration for all payment providers.
 * Values are loaded from environment variables.
 *
 * Required Environment Variables:
 *
 * General:
 * - PAYMENT_PROVIDER: Active provider ('stripe', 'razorpay', 'mock')
 *
 * Stripe:
 * - STRIPE_PUBLISHABLE_KEY: Public key for client-side SDK
 * - STRIPE_SECRET_KEY: Secret key for server-side API calls
 * - STRIPE_WEBHOOK_SECRET: Webhook endpoint signing secret
 *
 * Razorpay (future):
 * - RAZORPAY_KEY_ID: Key ID
 * - RAZORPAY_KEY_SECRET: Key secret
 * - RAZORPAY_WEBHOOK_SECRET: Webhook secret
 */

export const paymentConfig = {
  // Active payment provider
  activeProvider: process.env.PAYMENT_PROVIDER || "mock",

  // Stripe configuration
  stripe: {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    // API version to use
    apiVersion: "2023-10-16",
    // Currency for payments
    currency: "inr",
  },

  // Razorpay configuration (for future use)
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  // Mock provider configuration (for development/testing)
  mock: {
    simulateDelay: process.env.NODE_ENV !== "production",
    delayMs: 300,
    successRate: 1.0, // 100% success in dev, can be lowered for testing failures
    webhookSecret: "mock_webhook_secret",
  },

  // General payment settings
  settings: {
    // Default currency
    currency: "INR",
    // Minimum payment amount (in rupees)
    minAmount: 1,
    // Maximum payment amount (in rupees)
    maxAmount: 100000,
    // Payment timeout in minutes
    paymentTimeoutMinutes: 30,
    // Auto-capture payments (vs manual capture)
    autoCapture: true,
  },
};

/**
 * Get configuration for the active provider
 * @returns {Object} Provider-specific config
 */
export function getActiveProviderConfig() {
  const provider = paymentConfig.activeProvider;
  return paymentConfig[provider] || {};
}

/**
 * Validate that required config is present for a provider
 * @param {string} provider - Provider name
 * @returns {Object} Validation result { valid: boolean, missing: string[] }
 */
export function validateProviderConfig(provider) {
  const config = paymentConfig[provider];
  const missing = [];

  if (!config) {
    return { valid: false, missing: ["Provider configuration not found"] };
  }

  if (provider === "stripe") {
    if (!config.secretKey) missing.push("STRIPE_SECRET_KEY");
    if (!config.publishableKey) missing.push("STRIPE_PUBLISHABLE_KEY");
    if (!config.webhookSecret) missing.push("STRIPE_WEBHOOK_SECRET");
  } else if (provider === "razorpay") {
    if (!config.keyId) missing.push("RAZORPAY_KEY_ID");
    if (!config.keySecret) missing.push("RAZORPAY_KEY_SECRET");
    if (!config.webhookSecret) missing.push("RAZORPAY_WEBHOOK_SECRET");
  }
  // Mock provider has no required config

  return {
    valid: missing.length === 0,
    missing,
  };
}

export default paymentConfig;
