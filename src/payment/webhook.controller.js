/**
 * Webhook Controller
 *
 * Handles incoming webhooks from payment gateways.
 * Routes events to appropriate handlers based on event type.
 */

import { handleWebhook, getProviderName } from "../../services/payment/payment.service.js";
import { WEBHOOK_EVENTS, TRANSACTION_STATUS } from "../../services/payment/payment.constants.js";
import PaymentTransaction from "../../schema/paymentTransaction.schema.js";
import Order from "../../schema/order.schema.js";
import Subscription from "../../schema/subscription.schema.js";
import Voucher from "../../schema/voucher.schema.js";
import Refund from "../../schema/refund.schema.js";
import { sendResponse } from "../../utils/response.utils.js";

/**
 * Handle payment webhook from any provider
 * POST /api/payment/webhook/:provider
 *
 * @param {Request} req
 * @param {Response} res
 */
export async function handlePaymentWebhook(req, res) {
  const providerName = req.params.provider;
  const startTime = Date.now();

  try {
    console.log(`> WebhookController: Processing ${providerName} webhook`);

    // Process webhook through payment service
    const { duplicate, event } = await handleWebhook(req.headers, req.rawBody, req.body);

    if (duplicate) {
      console.log(`> WebhookController: Duplicate event ignored: ${event.eventType}`);
      return res.status(200).json({ received: true, duplicate: true });
    }

    // Route to appropriate handler based on event type
    await routeWebhookEvent(event);

    const duration = Date.now() - startTime;
    console.log(
      `> WebhookController: Processed ${event.eventType} in ${duration}ms for ${providerName}`
    );

    // Always return 200 to acknowledge receipt
    return res.status(200).json({ received: true });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`> WebhookController: Error processing webhook (${duration}ms):`, error.message);

    // Return 200 to prevent retries for non-retryable errors
    // The gateway will retry if we return 4xx/5xx
    return res.status(200).json({
      received: true,
      error: error.message,
    });
  }
}

/**
 * Route webhook event to appropriate handler
 *
 * @param {Object} event - Normalized webhook event
 */
async function routeWebhookEvent(event) {
  switch (event.eventType) {
    case WEBHOOK_EVENTS.PAYMENT_SUCCESS:
      await handlePaymentSuccess(event);
      break;

    case WEBHOOK_EVENTS.PAYMENT_FAILED:
      await handlePaymentFailed(event);
      break;

    case WEBHOOK_EVENTS.PAYMENT_AUTHORIZED:
      await handlePaymentAuthorized(event);
      break;

    case WEBHOOK_EVENTS.REFUND_SUCCESS:
      await handleRefundSuccess(event);
      break;

    case WEBHOOK_EVENTS.REFUND_FAILED:
      await handleRefundFailed(event);
      break;

    case WEBHOOK_EVENTS.ORDER_PAID:
      // Razorpay-specific: treat as payment success
      await handlePaymentSuccess(event);
      break;

    default:
      console.log(`> WebhookController: Unhandled event type: ${event.eventType}`);
  }
}

/**
 * Handle successful payment
 *
 * @param {Object} event - Webhook event
 */
async function handlePaymentSuccess(event) {
  const { paymentId, metadata } = event;

  // Find the transaction
  const transaction = await PaymentTransaction.findByGatewayId(paymentId);
  if (!transaction) {
    console.warn(`> WebhookController: Transaction not found for payment: ${paymentId}`);
    return;
  }

  // Skip if already completed
  if (transaction.status === TRANSACTION_STATUS.COMPLETED) {
    console.log(`> WebhookController: Transaction already completed: ${paymentId}`);
    return;
  }

  // Update transaction
  transaction.status = TRANSACTION_STATUS.COMPLETED;
  transaction.completedAt = new Date();
  transaction.paymentMethod = event.method || metadata?.paymentMethod;
  transaction.gatewayResponse = event.rawEvent;
  await transaction.save();

  // Update entity based on type
  if (transaction.entityType === "ORDER") {
    await handleOrderPaymentSuccess(transaction, event);
  } else if (transaction.entityType === "SUBSCRIPTION") {
    await handleSubscriptionPaymentSuccess(transaction, event);
  }

  console.log(
    `> WebhookController: Payment success processed for ${transaction.entityType}: ${transaction.entityId}`
  );
}

/**
 * Handle order payment success
 *
 * @param {Object} transaction - Payment transaction
 * @param {Object} event - Webhook event
 */
async function handleOrderPaymentSuccess(transaction, event) {
  const order = await Order.findById(transaction.entityId);
  if (!order) {
    console.warn(`> WebhookController: Order not found: ${transaction.entityId}`);
    return;
  }

  // Update order payment status
  order.paymentStatus = "PAID";
  order.paymentId = event.paymentId;
  order.paymentMethod = transaction.paymentMethod;
  order.paymentDetails = {
    provider: getProviderName(),
    transactionId: transaction._id,
    completedAt: transaction.completedAt,
  };

  await order.save();

  console.log(`> WebhookController: Order ${order.orderNumber} marked as PAID`);
}

/**
 * Handle subscription payment success
 *
 * @param {Object} transaction - Payment transaction
 * @param {Object} event - Webhook event
 */
async function handleSubscriptionPaymentSuccess(transaction, event) {
  const subscription = await Subscription.findById(transaction.entityId).populate("planId");
  if (!subscription) {
    console.warn(`> WebhookController: Subscription not found: ${transaction.entityId}`);
    return;
  }

  // Only activate if still pending
  if (subscription.status !== "PENDING" && subscription.status !== "ACTIVE") {
    console.log(`> WebhookController: Subscription ${subscription._id} status is ${subscription.status}, skipping`);
    return;
  }

  // Activate subscription
  subscription.status = "ACTIVE";
  subscription.paymentId = event.paymentId;
  subscription.paymentMethod = transaction.paymentMethod;
  await subscription.save();

  // Issue vouchers if not already issued
  const existingVouchers = await Voucher.countDocuments({ subscriptionId: subscription._id });
  if (existingVouchers === 0 && subscription.planId) {
    const plan = subscription.planId;
    const totalVouchers = plan.totalVouchers || plan.durationDays * (plan.vouchersPerDay || 2);

    await Voucher.issueForSubscription(
      subscription.userId,
      subscription._id,
      totalVouchers,
      subscription.voucherExpiryDate
    );

    console.log(
      `> WebhookController: Issued ${totalVouchers} vouchers for subscription ${subscription._id}`
    );
  }

  console.log(`> WebhookController: Subscription ${subscription._id} activated`);
}

/**
 * Handle failed payment
 *
 * @param {Object} event - Webhook event
 */
async function handlePaymentFailed(event) {
  const { paymentId } = event;

  const transaction = await PaymentTransaction.findByGatewayId(paymentId);
  if (!transaction) {
    console.warn(`> WebhookController: Transaction not found for failed payment: ${paymentId}`);
    return;
  }

  // Update transaction
  transaction.status = TRANSACTION_STATUS.FAILED;
  transaction.failedAt = new Date();
  transaction.gatewayResponse = event.rawEvent;
  await transaction.save();

  // Update entity based on type
  if (transaction.entityType === "ORDER") {
    await Order.findByIdAndUpdate(transaction.entityId, {
      paymentStatus: "FAILED",
      status: "CANCELLED",
      cancellationReason: "Payment failed",
      cancelledBy: "SYSTEM",
      cancelledAt: new Date(),
    });

    // Restore vouchers if any were used
    const order = await Order.findById(transaction.entityId);
    if (order?.voucherUsage?.voucherIds?.length > 0) {
      await restoreVouchersForOrder(order.voucherUsage.voucherIds, "PAYMENT_FAILED");
    }

    console.log(`> WebhookController: Order ${transaction.entityId} marked as FAILED`);
  } else if (transaction.entityType === "SUBSCRIPTION") {
    await Subscription.findByIdAndUpdate(transaction.entityId, {
      status: "CANCELLED",
      cancellationReason: "Payment failed",
      cancelledAt: new Date(),
    });

    console.log(`> WebhookController: Subscription ${transaction.entityId} cancelled due to payment failure`);
  }
}

/**
 * Handle payment authorized (requires capture)
 *
 * @param {Object} event - Webhook event
 */
async function handlePaymentAuthorized(event) {
  const { paymentId } = event;

  await PaymentTransaction.findOneAndUpdate(
    { gatewayPaymentId: paymentId },
    {
      status: TRANSACTION_STATUS.AUTHORIZED,
      gatewayResponse: event.rawEvent,
    }
  );

  console.log(`> WebhookController: Payment authorized: ${paymentId}`);

  // Auto-capture is typically enabled, but if manual capture is needed,
  // you would implement capture logic here
}

/**
 * Handle successful refund
 *
 * @param {Object} event - Webhook event
 */
async function handleRefundSuccess(event) {
  const { paymentId, refundId } = event;

  // Update refund in transaction
  await PaymentTransaction.updateRefundStatus(refundId, "COMPLETED", event.rawEvent);

  // Update Refund record if exists
  await Refund.findOneAndUpdate(
    { refundGatewayId: refundId },
    {
      status: "COMPLETED",
      completedAt: new Date(),
      gatewayResponse: event.rawEvent,
    }
  );

  // Check if fully refunded and update transaction status
  const transaction = await PaymentTransaction.findByGatewayId(paymentId);
  if (transaction?.isFullyRefunded) {
    transaction.status = TRANSACTION_STATUS.REFUNDED;
    await transaction.save();
  }

  console.log(`> WebhookController: Refund completed: ${refundId}`);
}

/**
 * Handle failed refund
 *
 * @param {Object} event - Webhook event
 */
async function handleRefundFailed(event) {
  const { refundId } = event;

  await PaymentTransaction.updateRefundStatus(refundId, "FAILED", event.rawEvent);

  await Refund.findOneAndUpdate(
    { refundGatewayId: refundId },
    {
      status: "FAILED",
      failedAt: new Date(),
      gatewayResponse: event.rawEvent,
    }
  );

  console.log(`> WebhookController: Refund failed: ${refundId}`);
}

/**
 * Restore vouchers for a cancelled/failed order
 *
 * @param {Array<string>} voucherIds - Voucher IDs to restore
 * @param {string} reason - Restoration reason
 */
async function restoreVouchersForOrder(voucherIds, reason) {
  for (const voucherId of voucherIds) {
    const voucher = await Voucher.findById(voucherId);
    if (voucher && voucher.status === "REDEEMED") {
      await voucher.restore(reason);

      // Update subscription voucher count
      if (voucher.subscriptionId) {
        await Subscription.findByIdAndUpdate(voucher.subscriptionId, {
          $inc: { vouchersUsed: -1 },
        });
      }
    }
  }

  console.log(`> WebhookController: Restored ${voucherIds.length} vouchers (${reason})`);
}

export default {
  handlePaymentWebhook,
};
