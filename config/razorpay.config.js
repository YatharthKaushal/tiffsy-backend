import dotenv from "dotenv";
dotenv.config();

import Razorpay from "razorpay";

// Environment variables
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

// Track configuration status
let isConfigured = false;
let razorpay = null;

/**
 * Validate required environment variables
 * @returns {{ isValid: boolean, missingVars: string[] }}
 */
const validateConfig = () => {
  const missingVars = [];

  if (!RAZORPAY_KEY_ID) missingVars.push("RAZORPAY_KEY_ID");
  if (!RAZORPAY_KEY_SECRET) missingVars.push("RAZORPAY_KEY_SECRET");

  return {
    isValid: missingVars.length === 0,
    missingVars,
  };
};

/**
 * Initialize Razorpay SDK
 */
const initializeRazorpay = () => {
  const validation = validateConfig();

  if (!validation.isValid) {
    console.log(
      `> Razorpay: Missing environment variables: ${validation.missingVars.join(", ")}`
    );
    console.warn(
      "> Razorpay: Payment features will not work until credentials are configured"
    );
    return null;
  }

  try {
    razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });

    isConfigured = true;
    console.log("> Razorpay configured successfully");
    console.log(`> Key ID: ${RAZORPAY_KEY_ID.substring(0, 12)}...`);

    if (!RAZORPAY_WEBHOOK_SECRET) {
      console.warn(
        "> Razorpay: RAZORPAY_WEBHOOK_SECRET not set - webhook verification will fail"
      );
    }

    return razorpay;
  } catch (error) {
    console.log("> Razorpay configuration failed:", error.message);
    return null;
  }
};

// Initialize on module load
initializeRazorpay();

/**
 * Get Razorpay instance
 * @returns {Razorpay|null}
 */
export const getRazorpayInstance = () => {
  if (!isConfigured || !razorpay) {
    throw new Error("Razorpay is not configured. Check environment variables.");
  }
  return razorpay;
};

/**
 * Check if Razorpay is configured
 * @returns {boolean}
 */
export const isRazorpayConfigured = () => isConfigured;

/**
 * Get Razorpay Key ID (public key for client)
 * @returns {string}
 */
export const getRazorpayKeyId = () => RAZORPAY_KEY_ID;

/**
 * Get Razorpay Webhook Secret
 * @returns {string}
 */
export const getRazorpayWebhookSecret = () => RAZORPAY_WEBHOOK_SECRET;

export default razorpay;
