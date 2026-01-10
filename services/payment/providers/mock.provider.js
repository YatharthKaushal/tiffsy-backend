/**
 * Mock Payment Provider
 *
 * A simulated payment provider for development and testing.
 * Mimics real payment gateway behavior without making actual API calls.
 *
 * Features:
 * - Configurable success rate for testing failure scenarios
 * - Simulated delays for realistic testing
 * - Generates valid-looking payment IDs
 * - Supports all provider interface methods
 */

import crypto from "crypto";
import { BasePaymentProvider } from "./base.provider.js";

export class MockProvider extends BasePaymentProvider {
  constructor(config = {}) {
    super(config);
    this.providerName = "mock";
    this.successRate = config.successRate ?? 1.0; // 100% success by default
    this.simulateDelay = config.simulateDelay ?? false;
    this.delayMs = config.delayMs ?? 500;

    // In-memory storage for mock payments
    this.payments = new Map();
    this.refunds = new Map();
  }

  /**
   * Generate a mock payment ID
   */
  _generatePaymentId() {
    return `mock_pi_${crypto.randomBytes(12).toString("hex")}`;
  }

  /**
   * Generate a mock refund ID
   */
  _generateRefundId() {
    return `mock_re_${crypto.randomBytes(12).toString("hex")}`;
  }

  /**
   * Simulate network delay
   */
  async _delay() {
    if (this.simulateDelay) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
  }

  /**
   * Determine if operation should succeed based on success rate
   */
  _shouldSucceed() {
    return Math.random() < this.successRate;
  }

  async createPayment(params) {
    await this._delay();

    const { orderId, amount, currency = "INR", purchaseType, customer, metadata, description } = params;

    const paymentId = this._generatePaymentId();
    const clientSecret = `${paymentId}_secret_${crypto.randomBytes(8).toString("hex")}`;

    const payment = {
      id: paymentId,
      orderId,
      amount,
      currency,
      purchaseType,
      customer,
      metadata: metadata || {},
      description,
      status: "created",
      clientSecret,
      createdAt: new Date(),
    };

    this.payments.set(paymentId, payment);

    return {
      id: paymentId,
      orderId,
      status: "created",
      amount,
      currency,
      gatewayData: payment,
      clientSecret: {
        clientSecret,
        providerName: this.providerName,
        testMode: true,
      },
    };
  }

  async verifyPayment(paymentId) {
    await this._delay();

    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    return {
      id: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      gatewayData: payment,
      method: payment.method || "CARD",
    };
  }

  async capturePayment(paymentId, amount) {
    await this._delay();

    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    if (this._shouldSucceed()) {
      payment.status = "captured";
      payment.capturedAt = new Date();
      payment.method = "CARD"; // Default to card for mock
      if (amount) {
        payment.capturedAmount = amount;
      }
    } else {
      payment.status = "failed";
      payment.failedAt = new Date();
      payment.failureReason = "Mock payment failure";
    }

    return {
      id: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      gatewayData: payment,
    };
  }

  /**
   * Simulate completing a payment (for testing webhook flows)
   * This is a mock-specific method not in the base interface
   */
  async simulatePaymentCompletion(paymentId, success = true, method = "CARD") {
    await this._delay();

    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    if (success) {
      payment.status = "captured";
      payment.capturedAt = new Date();
      payment.method = method;
    } else {
      payment.status = "failed";
      payment.failedAt = new Date();
      payment.failureReason = "Simulated payment failure";
    }

    return this._generateWebhookPayload(payment, success ? "payment.success" : "payment.failed");
  }

  async initiateRefund(params) {
    await this._delay();

    const { paymentId, amount, reason, metadata } = params;

    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    if (payment.status !== "captured") {
      throw new Error(`Cannot refund payment with status: ${payment.status}`);
    }

    const refundId = this._generateRefundId();
    const refund = {
      id: refundId,
      paymentId,
      amount,
      reason,
      metadata: metadata || {},
      status: this._shouldSucceed() ? "pending" : "failed",
      createdAt: new Date(),
    };

    this.refunds.set(refundId, refund);

    // Update payment status
    if (refund.status === "pending") {
      payment.status = amount >= payment.amount ? "refunded" : "partially_refunded";
    }

    return {
      id: refundId,
      status: refund.status,
      amount: refund.amount,
      gatewayData: refund,
    };
  }

  async getRefundStatus(refundId) {
    await this._delay();

    const refund = this.refunds.get(refundId);
    if (!refund) {
      throw new Error(`Refund not found: ${refundId}`);
    }

    return {
      id: refund.id,
      status: refund.status,
      amount: refund.amount,
      gatewayData: refund,
    };
  }

  /**
   * Simulate completing a refund (for testing webhook flows)
   */
  async simulateRefundCompletion(refundId, success = true) {
    await this._delay();

    const refund = this.refunds.get(refundId);
    if (!refund) {
      throw new Error(`Refund not found: ${refundId}`);
    }

    refund.status = success ? "processed" : "failed";
    refund.completedAt = new Date();

    return this._generateWebhookPayload(refund, success ? "refund.success" : "refund.failed");
  }

  verifyWebhookSignature(headers, rawBody) {
    // Mock always accepts webhooks with correct secret
    const signature = headers["x-mock-signature"];
    if (!signature) {
      return true; // Allow unsigned for easy testing
    }

    const expectedSignature = crypto
      .createHmac("sha256", this.config.webhookSecret || "mock_webhook_secret")
      .update(typeof rawBody === "string" ? rawBody : rawBody.toString())
      .digest("hex");

    return signature === expectedSignature;
  }

  parseWebhookEvent(payload) {
    return {
      eventType: payload.eventType || payload.type,
      paymentId: payload.paymentId || payload.data?.id,
      orderId: payload.orderId || payload.data?.metadata?.internalOrderId,
      status: this._normalizeStatus(payload.status || payload.data?.status),
      rawEvent: payload,
      metadata: payload.metadata || payload.data?.metadata || {},
    };
  }

  /**
   * Generate a mock webhook payload
   */
  _generateWebhookPayload(entity, eventType) {
    return {
      id: `mock_evt_${crypto.randomBytes(8).toString("hex")}`,
      type: eventType,
      eventType,
      paymentId: entity.id || entity.paymentId,
      orderId: entity.orderId || entity.metadata?.internalOrderId,
      status: entity.status,
      data: entity,
      metadata: entity.metadata || {},
      createdAt: new Date().toISOString(),
    };
  }

  _normalizeStatus(status) {
    const statusMap = {
      created: "created",
      authorized: "authorized",
      captured: "captured",
      refunded: "refunded",
      partially_refunded: "partially_refunded",
      failed: "failed",
      pending: "pending",
      processed: "processed",
    };
    return statusMap[status] || status;
  }

  getSupportedMethods() {
    return ["UPI", "CARD", "WALLET", "NETBANKING"];
  }

  isConfigured() {
    return true; // Mock is always configured
  }

  /**
   * Clear all mock data (for testing)
   */
  clearAll() {
    this.payments.clear();
    this.refunds.clear();
  }
}

export default MockProvider;
