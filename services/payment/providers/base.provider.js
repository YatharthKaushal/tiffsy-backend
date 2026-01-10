/**
 * Base Payment Provider - Abstract Interface
 *
 * All payment gateway implementations must extend this class.
 * This ensures a consistent interface across different providers (Stripe, Razorpay, etc.)
 *
 * To add a new payment provider:
 * 1. Create a new file in this directory (e.g., newprovider.provider.js)
 * 2. Extend BasePaymentProvider
 * 3. Implement all abstract methods
 * 4. Register in payment.service.js
 */

/**
 * @typedef {Object} CreatePaymentParams
 * @property {string} orderId - Internal order/subscription ID
 * @property {number} amount - Amount in smallest currency unit (paisa for INR)
 * @property {string} currency - Currency code (default: INR)
 * @property {'ORDER'|'SUBSCRIPTION'|'OTHER'} purchaseType - Type of purchase
 * @property {Object} customer - Customer details { id, name, email, phone }
 * @property {Object} [metadata] - Additional metadata for tracking
 * @property {string} [description] - Payment description
 * @property {string} [returnUrl] - Return URL after payment completion
 */

/**
 * @typedef {Object} PaymentIntent
 * @property {string} id - Gateway-specific payment ID
 * @property {string} orderId - Internal order ID
 * @property {'created'|'authorized'|'captured'|'failed'|'refunded'} status - Normalized status
 * @property {number} amount - Amount in smallest currency unit
 * @property {string} currency - Currency code
 * @property {Object} gatewayData - Full gateway response (for debugging/audit)
 * @property {Object} [clientSecret] - Client-side data for completing payment
 * @property {string} [method] - Payment method used (UPI, CARD, etc.)
 */

/**
 * @typedef {Object} RefundParams
 * @property {string} paymentId - Original gateway payment ID
 * @property {number} amount - Refund amount in smallest currency unit
 * @property {string} reason - Refund reason
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * @typedef {Object} RefundResult
 * @property {string} id - Gateway refund ID
 * @property {'pending'|'processed'|'failed'} status - Normalized refund status
 * @property {number} amount - Refund amount
 * @property {Object} gatewayData - Full gateway response
 */

/**
 * @typedef {Object} WebhookEvent
 * @property {string} eventType - Normalized event type (payment.success, payment.failed, etc.)
 * @property {string} paymentId - Gateway payment ID
 * @property {string} [orderId] - Internal order ID (from metadata)
 * @property {string} status - Payment/refund status
 * @property {Object} rawEvent - Original gateway event (for audit)
 * @property {Object} metadata - Extracted metadata
 */

export class BasePaymentProvider {
  /**
   * @param {Object} config - Provider-specific configuration
   */
  constructor(config) {
    if (new.target === BasePaymentProvider) {
      throw new Error("BasePaymentProvider cannot be instantiated directly. Use a concrete implementation.");
    }
    this.config = config;
    this.providerName = "base";
  }

  /**
   * Create a payment intent/order
   * @param {CreatePaymentParams} params - Payment parameters
   * @returns {Promise<PaymentIntent>} - Payment intent with client secret
   */
  async createPayment(params) {
    throw new Error("createPayment() must be implemented by provider");
  }

  /**
   * Verify payment status by querying the gateway
   * @param {string} paymentId - Gateway payment ID
   * @returns {Promise<PaymentIntent>} - Current payment status
   */
  async verifyPayment(paymentId) {
    throw new Error("verifyPayment() must be implemented by provider");
  }

  /**
   * Capture an authorized payment (for 2-step payment flows)
   * @param {string} paymentId - Gateway payment ID
   * @param {number} [amount] - Optional partial capture amount
   * @returns {Promise<PaymentIntent>} - Captured payment details
   */
  async capturePayment(paymentId, amount) {
    throw new Error("capturePayment() must be implemented by provider");
  }

  /**
   * Initiate a refund for a completed payment
   * @param {RefundParams} params - Refund parameters
   * @returns {Promise<RefundResult>} - Refund initiation result
   */
  async initiateRefund(params) {
    throw new Error("initiateRefund() must be implemented by provider");
  }

  /**
   * Get refund status by querying the gateway
   * @param {string} refundId - Gateway refund ID
   * @returns {Promise<RefundResult>} - Current refund status
   */
  async getRefundStatus(refundId) {
    throw new Error("getRefundStatus() must be implemented by provider");
  }

  /**
   * Verify webhook signature for authenticity
   * @param {Object} headers - Request headers
   * @param {string|Buffer} rawBody - Raw request body (unparsed)
   * @returns {boolean} - True if signature is valid
   */
  verifyWebhookSignature(headers, rawBody) {
    throw new Error("verifyWebhookSignature() must be implemented by provider");
  }

  /**
   * Parse and normalize webhook event to common format
   * @param {Object} payload - Parsed webhook payload
   * @returns {WebhookEvent} - Normalized event
   */
  parseWebhookEvent(payload) {
    throw new Error("parseWebhookEvent() must be implemented by provider");
  }

  /**
   * Get list of supported payment methods
   * @returns {Array<string>} - Supported methods: UPI, CARD, WALLET, NETBANKING
   */
  getSupportedMethods() {
    return ["UPI", "CARD", "WALLET", "NETBANKING"];
  }

  /**
   * Check if provider is properly configured
   * @returns {boolean} - True if all required config is present
   */
  isConfigured() {
    return false;
  }
}

export default BasePaymentProvider;
