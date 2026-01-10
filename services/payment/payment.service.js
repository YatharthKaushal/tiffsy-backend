/**
 * Payment Service - Main Facade
 *
 * Central payment service that provides a unified interface for all payment operations.
 * Uses the Strategy Pattern to allow switching between payment providers (Stripe, Razorpay, etc.)
 *
 * To switch payment providers:
 * 1. Set PAYMENT_PROVIDER environment variable to desired provider
 * 2. Ensure provider config is properly set
 * 3. Restart the application
 *
 * The service will use the same interface regardless of the underlying provider.
 */

import { MockProvider } from "./providers/mock.provider.js";
import { StripeProvider } from "./providers/stripe.provider.js";
import {
  PAYMENT_PROVIDERS,
  PURCHASE_TYPES,
  TRANSACTION_STATUS,
  DEFAULT_CURRENCY,
} from "./payment.constants.js";

// Provider registry - add new providers here
const providerRegistry = {
  [PAYMENT_PROVIDERS.MOCK]: MockProvider,
  [PAYMENT_PROVIDERS.STRIPE]: StripeProvider,
  // [PAYMENT_PROVIDERS.RAZORPAY]: RazorpayProvider, // Future
};

// Active provider instance
let activeProvider = null;
let activeProviderName = null;
let PaymentTransaction = null;

/**
 * Initialize payment service with specified provider
 * Should be called once during application startup
 *
 * @param {string} providerName - Provider name: 'stripe', 'razorpay', 'mock'
 * @param {Object} config - Provider-specific configuration
 */
export async function initializePaymentService(providerName, config) {
  const ProviderClass = providerRegistry[providerName];

  if (!ProviderClass) {
    const available = Object.keys(providerRegistry).join(", ");
    throw new Error(`Unknown payment provider: '${providerName}'. Available: ${available}`);
  }

  activeProvider = new ProviderClass(config);
  activeProviderName = providerName;

  // Lazy load PaymentTransaction model to avoid circular dependencies
  const module = await import("../../schema/paymentTransaction.schema.js");
  PaymentTransaction = module.default;

  console.log(`> PaymentService: Initialized with '${providerName}' provider`);

  if (!activeProvider.isConfigured()) {
    console.warn(`> PaymentService: WARNING - Provider '${providerName}' may not be fully configured`);
  }
}

/**
 * Register a new provider class
 * Allows dynamic registration of providers
 *
 * @param {string} name - Provider name
 * @param {Class} ProviderClass - Provider class extending BasePaymentProvider
 */
export function registerProvider(name, ProviderClass) {
  providerRegistry[name] = ProviderClass;
  console.log(`> PaymentService: Registered provider '${name}'`);
}

/**
 * Get current active provider instance
 * @returns {BasePaymentProvider}
 * @throws {Error} If service not initialized
 */
export function getProvider() {
  if (!activeProvider) {
    throw new Error("Payment service not initialized. Call initializePaymentService() first.");
  }
  return activeProvider;
}

/**
 * Get active provider name
 * @returns {string|null}
 */
export function getProviderName() {
  return activeProviderName;
}

/**
 * Check if payment service is initialized
 * @returns {boolean}
 */
export function isInitialized() {
  return activeProvider !== null;
}

/**
 * Create payment for an order
 *
 * @param {Object} params
 * @param {string} params.orderId - Order ID
 * @param {number} params.amount - Amount in rupees (will be converted to paisa)
 * @param {Object} params.customer - Customer details { id, name, email, phone }
 * @param {Object} [params.metadata] - Additional metadata
 * @returns {Promise<Object>} Payment intent with client secret
 */
export async function createOrderPayment(params) {
  const { orderId, amount, customer, metadata = {} } = params;

  const provider = getProvider();

  // Create payment via provider
  const paymentIntent = await provider.createPayment({
    orderId,
    amount: Math.round(amount * 100), // Convert to paisa
    currency: DEFAULT_CURRENCY,
    purchaseType: PURCHASE_TYPES.ORDER,
    customer,
    metadata: {
      internalOrderId: orderId,
      ...metadata,
    },
    description: `Order payment for ${orderId}`,
  });

  // Store transaction record for tracking
  await PaymentTransaction.create({
    entityType: PURCHASE_TYPES.ORDER,
    entityId: orderId,
    entityModel: "Order",
    gatewayProvider: activeProviderName,
    gatewayPaymentId: paymentIntent.id,
    gatewayOrderId: paymentIntent.gatewayData?.order_id || null,
    amount,
    currency: DEFAULT_CURRENCY,
    status: TRANSACTION_STATUS.INITIATED,
    metadata,
  });

  return paymentIntent;
}

/**
 * Create payment for a subscription plan purchase
 *
 * @param {Object} params
 * @param {string} params.subscriptionId - Subscription ID
 * @param {string} params.planId - Plan ID
 * @param {number} params.amount - Amount in rupees
 * @param {Object} params.customer - Customer details
 * @param {Object} [params.metadata] - Additional metadata
 * @returns {Promise<Object>} Payment intent with client secret
 */
export async function createSubscriptionPayment(params) {
  const { subscriptionId, planId, amount, customer, metadata = {} } = params;

  const provider = getProvider();

  const paymentIntent = await provider.createPayment({
    orderId: subscriptionId, // Use subscription ID as order reference
    amount: Math.round(amount * 100),
    currency: DEFAULT_CURRENCY,
    purchaseType: PURCHASE_TYPES.SUBSCRIPTION,
    customer,
    metadata: {
      internalOrderId: subscriptionId,
      planId,
      ...metadata,
    },
    description: `Subscription plan purchase`,
  });

  await PaymentTransaction.create({
    entityType: PURCHASE_TYPES.SUBSCRIPTION,
    entityId: subscriptionId,
    entityModel: "Subscription",
    gatewayProvider: activeProviderName,
    gatewayPaymentId: paymentIntent.id,
    gatewayOrderId: paymentIntent.gatewayData?.order_id || null,
    amount,
    currency: DEFAULT_CURRENCY,
    status: TRANSACTION_STATUS.INITIATED,
    metadata: { planId, ...metadata },
  });

  return paymentIntent;
}

/**
 * Verify payment status with gateway
 *
 * @param {string} paymentId - Gateway payment ID
 * @returns {Promise<Object>} Payment status
 */
export async function verifyPayment(paymentId) {
  const provider = getProvider();
  const payment = await provider.verifyPayment(paymentId);

  // Update transaction record
  const updateFields = {
    gatewayResponse: payment.gatewayData,
  };

  if (payment.status === "captured") {
    updateFields.status = TRANSACTION_STATUS.COMPLETED;
    updateFields.completedAt = new Date();
    updateFields.paymentMethod = payment.method;
  } else if (payment.status === "failed") {
    updateFields.status = TRANSACTION_STATUS.FAILED;
    updateFields.failedAt = new Date();
  } else if (payment.status === "authorized") {
    updateFields.status = TRANSACTION_STATUS.AUTHORIZED;
  }

  await PaymentTransaction.findOneAndUpdate({ gatewayPaymentId: paymentId }, updateFields);

  return payment;
}

/**
 * Initiate refund for a payment
 *
 * @param {Object} params
 * @param {string} params.paymentId - Gateway payment ID
 * @param {number} params.amount - Refund amount in rupees
 * @param {string} params.reason - Refund reason
 * @param {Object} [params.metadata] - Additional metadata
 * @returns {Promise<Object>} Refund result
 */
export async function initiateRefund(params) {
  const { paymentId, amount, reason, metadata = {} } = params;

  const provider = getProvider();

  const refund = await provider.initiateRefund({
    paymentId,
    amount: Math.round(amount * 100),
    reason,
    metadata,
  });

  // Update transaction with refund info
  await PaymentTransaction.findOneAndUpdate(
    { gatewayPaymentId: paymentId },
    {
      $push: {
        refunds: {
          gatewayRefundId: refund.id,
          amount,
          reason,
          status: refund.status.toUpperCase(),
          initiatedAt: new Date(),
        },
      },
    }
  );

  return refund;
}

/**
 * Get refund status
 *
 * @param {string} refundId - Gateway refund ID
 * @returns {Promise<Object>} Refund status
 */
export async function getRefundStatus(refundId) {
  const provider = getProvider();
  return provider.getRefundStatus(refundId);
}

/**
 * Handle incoming webhook
 * Verifies signature, parses event, and checks idempotency
 *
 * @param {Object} headers - Request headers
 * @param {string|Buffer} rawBody - Raw request body
 * @param {Object} parsedBody - Parsed request body
 * @returns {Promise<Object>} Processed webhook event
 */
export async function handleWebhook(headers, rawBody, parsedBody) {
  const provider = getProvider();

  // Verify signature
  if (!provider.verifyWebhookSignature(headers, rawBody)) {
    throw new Error("Invalid webhook signature");
  }

  // Parse and normalize event
  const event = provider.parseWebhookEvent(parsedBody);

  // Generate idempotency key
  const eventId = event.rawEvent?.id || `${event.paymentId}_${event.eventType}_${Date.now()}`;

  // Check for duplicate
  const existingEvent = await PaymentTransaction.findOne({
    "webhookEvents.eventId": eventId,
  });

  if (existingEvent) {
    console.log(`> PaymentService: Duplicate webhook ignored: ${eventId}`);
    return { duplicate: true, event };
  }

  // Store webhook event
  await PaymentTransaction.findOneAndUpdate(
    { gatewayPaymentId: event.paymentId },
    {
      $push: {
        webhookEvents: {
          eventId,
          eventType: event.eventType,
          receivedAt: new Date(),
          payload: event.rawEvent,
        },
      },
    }
  );

  return { duplicate: false, event };
}

/**
 * Get transaction by entity (order or subscription)
 *
 * @param {string} entityType - 'ORDER' or 'SUBSCRIPTION'
 * @param {string} entityId - Entity ID
 * @returns {Promise<Object|null>} Transaction record
 */
export async function getTransactionByEntity(entityType, entityId) {
  return PaymentTransaction.findByEntity(entityType, entityId);
}

/**
 * Get transaction by gateway payment ID
 *
 * @param {string} paymentId - Gateway payment ID
 * @returns {Promise<Object|null>} Transaction record
 */
export async function getTransactionByPaymentId(paymentId) {
  return PaymentTransaction.findByGatewayId(paymentId);
}

export default {
  initializePaymentService,
  registerProvider,
  getProvider,
  getProviderName,
  isInitialized,
  createOrderPayment,
  createSubscriptionPayment,
  verifyPayment,
  initiateRefund,
  getRefundStatus,
  handleWebhook,
  getTransactionByEntity,
  getTransactionByPaymentId,
};
