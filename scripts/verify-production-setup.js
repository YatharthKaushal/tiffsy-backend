/**
 * Production Setup Verification Script
 * Verifies that all production components are correctly configured
 *
 * Usage:
 *   node scripts/verify-production-setup.js
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

console.log("\n" + "=".repeat(70));
console.log("🔍 PRODUCTION SETUP VERIFICATION");
console.log("=".repeat(70));

let allChecksPassed = true;
const checks = [];

/**
 * Helper to add check result
 */
function addCheck(name, passed, message) {
  checks.push({ name, passed, message });
  const icon = passed ? "✅" : "❌";
  console.log(`\n${icon} ${name}`);
  if (message) {
    console.log(`   ${message}`);
  }
  if (!passed) {
    allChecksPassed = false;
  }
}

// CHECK 1: Environment Variables
console.log("\n" + "-".repeat(70));
console.log("1. Environment Variables");
console.log("-".repeat(70));

const requiredEnvVars = [
  "MONGODB_URL",
  "PORT",
  "NODE_ENV",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_CLIENT_EMAIL",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "JWT_SECRET"
];

const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingEnvVars.length === 0) {
  addCheck("Environment Variables", true, "All required variables are set");
} else {
  addCheck("Environment Variables", false, `Missing: ${missingEnvVars.join(", ")}`);
}

// CHECK 2: Critical Files
console.log("\n" + "-".repeat(70));
console.log("2. Critical Files");
console.log("-".repeat(70));

const criticalFiles = [
  { path: "index.js", description: "Main entry point" },
  { path: "cron/scheduler.js", description: "Cron scheduler" },
  { path: "ecosystem.config.cjs", description: "PM2 configuration" },
  { path: "src/admin/cron.controller.js", description: "Admin cron controller" },
  { path: "src/admin/cron.routes.js", description: "Admin cron routes" },
  { path: "scripts/voucher-expiry-cron.js", description: "Voucher expiry cron script" },
  { path: "logs/.gitkeep", description: "Logs directory structure" }
];

const backendRoot = path.join(__dirname, "..");

for (const file of criticalFiles) {
  const filePath = path.join(backendRoot, file.path);
  const exists = fs.existsSync(filePath);

  if (exists) {
    addCheck(file.description, true, `Found: ${file.path}`);
  } else {
    addCheck(file.description, false, `Missing: ${file.path}`);
  }
}

// CHECK 3: Dependencies
console.log("\n" + "-".repeat(70));
console.log("3. Node Dependencies");
console.log("-".repeat(70));

const packageJsonPath = path.join(backendRoot, "package.json");
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const hasCron = packageJson.dependencies && packageJson.dependencies["node-cron"];

  if (hasCron) {
    addCheck("node-cron package", true, `Version: ${hasCron}`);
  } else {
    addCheck("node-cron package", false, "Not found in package.json. Run: npm install node-cron");
  }
} else {
  addCheck("package.json", false, "File not found");
}

// CHECK 4: Cron Configuration
console.log("\n" + "-".repeat(70));
console.log("4. Cron Configuration");
console.log("-".repeat(70));

const schedulerPath = path.join(backendRoot, "cron", "scheduler.js");
if (fs.existsSync(schedulerPath)) {
  const schedulerContent = fs.readFileSync(schedulerPath, "utf-8");

  // Check for cron schedule
  const hasCronSchedule = schedulerContent.includes("30 2 * * *");
  addCheck("Voucher expiry schedule", hasCronSchedule,
    hasCronSchedule ? "Configured: 30 2 * * * (8:00 AM IST)" : "Schedule not found");

  // Check for initializeCronJobs
  const hasInit = schedulerContent.includes("export function initializeCronJobs");
  addCheck("Cron initialization function", hasInit, "Function found in scheduler.js");

  // Check for stopCronJobs
  const hasStop = schedulerContent.includes("export function stopCronJobs");
  addCheck("Cron stop function", hasStop, "Function found in scheduler.js");
}

// CHECK 5: Server Integration
console.log("\n" + "-".repeat(70));
console.log("5. Server Integration");
console.log("-".repeat(70));

const indexPath = path.join(backendRoot, "index.js");
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, "utf-8");

  // Check for cron import
  const hasCronImport = indexContent.includes('import { initializeCronJobs, stopCronJobs } from "./cron/scheduler.js"');
  addCheck("Cron scheduler import", hasCronImport, "Import statement found in index.js");

  // Check for cron initialization
  const hasCronInit = indexContent.includes("cronJobs = initializeCronJobs()");
  addCheck("Cron initialization call", hasCronInit, "Call found in server startup");

  // Check for graceful shutdown
  const hasShutdown = indexContent.includes("stopCronJobs(cronJobs)");
  addCheck("Graceful shutdown", hasShutdown, "Shutdown handler found");
}

// CHECK 6: PM2 Configuration
console.log("\n" + "-".repeat(70));
console.log("6. PM2 Configuration");
console.log("-".repeat(70));

const ecosystemPath = path.join(backendRoot, "ecosystem.config.cjs");
if (fs.existsSync(ecosystemPath)) {
  const ecosystemContent = fs.readFileSync(ecosystemPath, "utf-8");

  const hasAppName = ecosystemContent.includes('"tiffsy-backend"');
  addCheck("PM2 app name", hasAppName, "Configured as: tiffsy-backend");

  const hasClusterMode = ecosystemContent.includes('exec_mode: "cluster"');
  addCheck("Cluster mode", hasClusterMode, "Enabled for better performance");

  const hasLogs = ecosystemContent.includes("logs/pm2");
  addCheck("Log configuration", hasLogs, "Logs directory: ./logs/");
}

// CHECK 7: Documentation
console.log("\n" + "-".repeat(70));
console.log("7. Documentation");
console.log("-".repeat(70));

const docsToCheck = [
  { path: "PRODUCTION_DEPLOYMENT.md", description: "Production deployment guide" },
  { path: "scripts/QUICK_START.md", description: "Quick start testing guide" },
  { path: "scripts/VOUCHER_TESTING_README.md", description: "Detailed testing guide" }
];

for (const doc of docsToCheck) {
  const docPath = path.join(backendRoot, doc.path);
  const exists = fs.existsSync(docPath);
  addCheck(doc.description, exists, exists ? `Found: ${doc.path}` : `Missing: ${doc.path}`);
}

// SUMMARY
console.log("\n" + "=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));

const passedChecks = checks.filter(c => c.passed).length;
const totalChecks = checks.length;

console.log(`\nTotal Checks: ${totalChecks}`);
console.log(`✅ Passed: ${passedChecks}`);
console.log(`❌ Failed: ${totalChecks - passedChecks}`);

if (allChecksPassed) {
  console.log("\n" + "=".repeat(70));
  console.log("✅ ALL CHECKS PASSED - READY FOR PRODUCTION");
  console.log("=".repeat(70));

  console.log("\n📋 Next Steps:");
  console.log("   1. Start with PM2: pm2 start ecosystem.config.cjs --env production");
  console.log("   2. Check status: pm2 status");
  console.log("   3. View logs: pm2 logs tiffsy-backend");
  console.log("   4. Monitor: pm2 monit");
  console.log("\n📖 Read full guide: PRODUCTION_DEPLOYMENT.md");

  process.exit(0);
} else {
  console.log("\n" + "=".repeat(70));
  console.log("❌ SOME CHECKS FAILED - FIX ISSUES BEFORE PRODUCTION");
  console.log("=".repeat(70));

  console.log("\n🔧 Failed Checks:");
  checks.filter(c => !c.passed).forEach(check => {
    console.log(`   ❌ ${check.name}: ${check.message || "Check failed"}`);
  });

  process.exit(1);
}
