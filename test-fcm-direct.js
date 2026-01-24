/**
 * Direct FCM Test Script
 * Run with: node test-fcm-direct.js
 *
 * This script tests if FCM is properly configured and can send messages.
 */

import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config();

// Initialize Firebase Admin
const serviceAccount = {
  type: process.env.FIREBASE_ADMIN_TYPE || "service_account",
  project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
  private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
  auth_uri: process.env.FIREBASE_ADMIN_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
  token_uri: process.env.FIREBASE_ADMIN_TOKEN_URI || "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: process.env.FIREBASE_ADMIN_AUTH_PROVIDER_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_ADMIN_CLIENT_CERT_URL,
  universe_domain: process.env.FIREBASE_ADMIN_UNIVERSE_DOMAIN || "googleapis.com",
};

console.log("=".repeat(60));
console.log("FCM Direct Test");
console.log("=".repeat(60));
console.log("\n1. Checking Firebase Admin credentials...");
console.log("   Project ID:", serviceAccount.project_id);
console.log("   Client Email:", serviceAccount.client_email);
console.log("   Private Key present:", !!serviceAccount.private_key);
console.log("   Private Key length:", serviceAccount.private_key?.length || 0);

if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
  console.error("\n❌ Missing Firebase Admin credentials!");
  console.error("   Make sure these env vars are set:");
  console.error("   - FIREBASE_ADMIN_PROJECT_ID");
  console.error("   - FIREBASE_ADMIN_CLIENT_EMAIL");
  console.error("   - FIREBASE_ADMIN_PRIVATE_KEY");
  process.exit(1);
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("\n2. ✅ Firebase Admin SDK initialized successfully");
} catch (error) {
  console.error("\n❌ Failed to initialize Firebase Admin SDK:");
  console.error("   ", error.message);
  process.exit(1);
}

// Test FCM token - replace with the user's actual token
const testToken = "eewfdb2oQcaXHr_JPOfMcr:APA91bGia_Y0HGfdG0MKeEnH_WM3hpBUusS7zUELdXZi3IfUfdshNnl3t5fJXY6chzzp5Ud0mN0vjH3851BubLxO9pHJEuHWUQfqX62Ep6AE_tSK9JC0LWk";

const message = {
  token: testToken,
  notification: {
    title: "🧪 FCM Test Notification",
    body: "If you see this, FCM is working correctly!",
  },
  data: {
    type: "TEST",
    timestamp: new Date().toISOString(),
  },
  android: {
    priority: "high",
    notification: {
      channelId: "orders_channel",
      sound: "default",
    },
  },
};

console.log("\n3. Sending test notification...");
console.log("   Token (first 50 chars):", testToken.substring(0, 50) + "...");

async function sendTest() {
  try {
    const response = await admin.messaging().send(message);
    console.log("\n✅ FCM Message sent successfully!");
    console.log("   Message ID:", response);
    console.log("\n   👉 Check your device for the notification!");
    console.log("   👉 If you don't see it, check:");
    console.log("      - App notification permissions");
    console.log("      - Battery optimization settings");
    console.log("      - Notification channel settings");
  } catch (error) {
    console.error("\n❌ FCM send failed!");
    console.error("   Error code:", error.code);
    console.error("   Error message:", error.message);

    if (error.code === "messaging/invalid-registration-token") {
      console.error("\n   ⚠️  The FCM token is invalid or expired.");
      console.error("   The user needs to re-login to get a new token.");
    } else if (error.code === "messaging/registration-token-not-registered") {
      console.error("\n   ⚠️  The app was uninstalled or the token was unregistered.");
      console.error("   The user needs to re-login to get a new token.");
    } else if (error.code === "messaging/invalid-argument") {
      console.error("\n   ⚠️  Invalid message format or token.");
      console.error("   Check the message structure.");
    } else if (error.message.includes("project")) {
      console.error("\n   ⚠️  Firebase project mismatch!");
      console.error("   The FCM token was created with a different Firebase project");
      console.error("   than the one used in the Admin SDK.");
    }
  }
}

sendTest().then(() => {
  console.log("\n" + "=".repeat(60));
  process.exit(0);
});
