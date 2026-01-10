/**
 * Stripe Payment Provider
 *
 * Implementation of the payment provider interface for Stripe.
 * Uses Stripe's PaymentIntent API for payment processing.
 *
 * Features:
 * - PaymentIntent creation with automatic payment methods
 * - Webhook signature verification
 * - Refund processing
 * - Event normalization for consistent handling
 */

import Stripe from "stripe";
import { BasePaymentProvider } from "./base.provider.js";
import {
  STRIPE_EVENT_MAP,
  STRIPE_STATUS_MAP,
  STRIPE_METHOD_MAP,
  PAYMENT_STATUS,
  REFUND_STATUS,
} from "../payment.constants.js";

export class StripeProvider extends BasePaymentProvider {
  /**
   * @param {Object} config
   * @param {string} config.secretKey - Stripe secret key
   * @param {string} config.publishableKey - Stripe publishable key
   * @param {string} config.webhookSecret - Webhook signing secret
   * @param {string} [config.apiVersion] - Stripe API version
   */
  constructor(config) {
    super(config);
    this.providerName = "stripe";

    if (!config.secretKey) {
      console.warn("> StripeProvider: No secret key provided");
    }

    this.client = new Stripe(config.secretKey, {
      apiVersion: config.apiVersion || "2023-10-16",
    });

    this.publishableKey = config.publishableKey;
    this.webhookSecret = config.webhookSecret;
  }

  async createPayment(params) {
    const { orderId, amount, currency = "inr", purchaseType, customer, metadata, description } =
      params;

    const paymentIntentParams = {
      amount, // Already in smallest currency unit (paisa)
      currency: currency.toLowerCase(),
      description: description || `Payment for ${purchaseType}`,
      metadata: {
        purchaseType,
        internalOrderId: orderId,
        customerId: customer.id,
        ...(metadata || {}),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    };

    // Add customer email if available (useful for receipts)
    if (customer.email) {
      paymentIntentParams.receipt_email = customer.email;
    }

    const paymentIntent = await this.client.paymentIntents.create(paymentIntentParams);

    return {
      id: paymentIntent.id,
      orderId,
      status: this._normalizeStatus(paymentIntent.status),
      amount: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      gatewayData: paymentIntent,
      clientSecret: {
        clientSecret: paymentIntent.client_secret,
        publishableKey: this.publishableKey,
        paymentIntentId: paymentIntent.id,
      },
    };
  }

  async verifyPayment(paymentId) {
    const paymentIntent = await this.client.paymentIntents.retrieve(paymentId);

    return {
      id: paymentIntent.id,
      orderId: paymentIntent.metadata?.internalOrderId,
      status: this._normalizeStatus(paymentIntent.status),
      amount: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      gatewayData: paymentIntent,
      method: this._normalizeMethod(paymentIntent.payment_method_types?.[0]),
    };
  }

  async capturePayment(paymentId, amount) {
    const captureParams = {};
    if (amount) {
      captureParams.amount_to_capture = amount;
    }

    const paymentIntent = await this.client.paymentIntents.capture(paymentId, captureParams);

    return {
      id: paymentIntent.id,
      orderId: paymentIntent.metadata?.internalOrderId,
      status: this._normalizeStatus(paymentIntent.status),
      amount: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      gatewayData: paymentIntent,
    };
  }

  async initiateRefund(params) {
    const { paymentId, amount, reason, metadata } = params;

    const refundParams = {
      payment_intent: paymentId,
      amount,
      metadata: metadata || {},
    };

    // Map reason to Stripe's enum
    if (reason) {
      refundParams.reason = this._mapRefundReason(reason);
    }

    const refund = await this.client.refunds.create(refundParams);

    return {
      id: refund.id,
      status: this._normalizeRefundStatus(refund.status),
      amount: refund.amount,
      gatewayData: refund,
    };
  }

  async getRefundStatus(refundId) {
    const refund = await this.client.refunds.retrieve(refundId);

    return {
      id: refund.id,
      status: this._normalizeRefundStatus(refund.status),
      amount: refund.amount,
      gatewayData: refund,
    };
  }

  verifyWebhookSignature(headers, rawBody) {
    const signature = headers["stripe-signature"];

    if (!signature || !this.webhookSecret) {
      return false;
    }

    try {
      // Stripe's constructEvent verifies the signature
      this.client.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
      return true;
    } catch (err) {
      console.error("> StripeProvider: Webhook signature verification failed:", err.message);
      return false;
    }
  }

  parseWebhookEvent(payload) {
    const eventType = this._normalizeEventType(payload.type);

    // Extract the relevant object based on event type
    let object = payload.data?.object;
    let paymentId = null;
    let orderId = null;

    if (object) {
      // For payment_intent events
      if (object.object === "payment_intent") {
        paymentId = object.id;
        orderId = object.metadata?.internalOrderId;
      }
      // For charge events
      else if (object.object === "charge") {
        paymentId = object.payment_intent;
        orderId = object.metadata?.internalOrderId;
      }
      // For refund events
      else if (object.object === "refund") {
        paymentId = object.payment_intent;
        // Try to get orderId from charge metadata
        orderId = object.metadata?.internalOrderId;
      }
    }

    return {
      eventType,
      paymentId,
      orderId,
      status: this._normalizeStatus(object?.status),
      rawEvent: payload,
      metadata: object?.metadata || {},
      refundId: object?.object === "refund" ? object.id : null,
    };
  }

  /**
   * Normalize Stripe payment status to common format
   */
  _normalizeStatus(status) {
    return STRIPE_STATUS_MAP[status] || status;
  }

  /**
   * Normalize Stripe refund status
   */
  _normalizeRefundStatus(status) {
    const statusMap = {
      pending: REFUND_STATUS.PENDING,
      succeeded: REFUND_STATUS.PROCESSED,
      failed: REFUND_STATUS.FAILED,
      canceled: REFUND_STATUS.FAILED,
      requires_action: REFUND_STATUS.PENDING,
    };
    return statusMap[status] || status;
  }

  /**
   * Normalize Stripe payment method
   */
  _normalizeMethod(method) {
    return STRIPE_METHOD_MAP[method] || "OTHER";
  }

  /**
   * Normalize Stripe event type to common format
   */
  _normalizeEventType(eventType) {
    return STRIPE_EVENT_MAP[eventType] || eventType;
  }

  /**
   * Map refund reason to Stripe's enum
   */
  _mapRefundReason(reason) {
    const reasonMap = {
      ORDER_CANCELLED: "requested_by_customer",
      ORDER_REJECTED: "requested_by_customer",
      CUSTOMER_REQUEST: "requested_by_customer",
      DUPLICATE: "duplicate",
      FRAUDULENT: "fraudulent",
    };
    return reasonMap[reason] || "requested_by_customer";
  }

  getSupportedMethods() {
    // Stripe supports these in India
    return ["CARD", "UPI"];
  }

  isConfigured() {
    return !!(this.config.secretKey && this.config.publishableKey && this.config.webhookSecret);
  }

  /**
   * Create a Stripe Checkout Session (alternative to PaymentIntent)
   * Useful for hosted checkout page
   */
  async createCheckoutSession(params) {
    const { orderId, amount, currency = "inr", customer, metadata, successUrl, cancelUrl } = params;

    const sessionParams = {
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: amount,
            product_data: {
              name: metadata?.productName || "Order Payment",
              description: metadata?.productDescription || `Payment for order ${orderId}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        internalOrderId: orderId,
        customerId: customer.id,
        ...(metadata || {}),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    };

    if (customer.email) {
      sessionParams.customer_email = customer.email;
    }

    const session = await this.client.checkout.sessions.create(sessionParams);

    return {
      id: session.id,
      url: session.url,
      orderId,
      gatewayData: session,
    };
  }

  /**
   * Retrieve Stripe Checkout Session
   */
  async getCheckoutSession(sessionId) {
    return this.client.checkout.sessions.retrieve(sessionId);
  }
}

export default StripeProvider;
