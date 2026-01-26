# Command Reference Card

Quick reference for all production and testing commands.

---

## 🚀 Production Deployment

### Start Application
```bash
pm2 start ecosystem.config.cjs --env production
```

### Stop Application
```bash
pm2 stop tiffsy-backend
```

### Restart Application
```bash
# With brief downtime
pm2 restart tiffsy-backend

# Zero-downtime reload
pm2 reload tiffsy-backend
```

### View Status
```bash
pm2 status
```

### View Logs
```bash
# All logs
pm2 logs tiffsy-backend

# Last 100 lines
pm2 logs tiffsy-backend --lines 100

# Error logs only
pm2 logs tiffsy-backend --err

# Follow logs in real-time
pm2 logs tiffsy-backend -f
```

### Monitor
```bash
pm2 monit
```

### Save PM2 Process List
```bash
pm2 save
```

### Auto-Restart on Reboot
```bash
pm2 startup
# Follow the instructions output by the command
```

### Delete from PM2
```bash
pm2 delete tiffsy-backend
```

---

## 🧪 Testing Commands

### Verify Production Setup
```bash
node scripts/verify-production-setup.js
```

### Find Test User
```bash
# Show first 5 users
node scripts/find-user-for-testing.js

# Search by phone
node scripts/find-user-for-testing.js 9876543210
```

### Create Test Vouchers
```bash
node scripts/create-test-vouchers.js <userId> <subscriptionId>
```

### Run Voucher Tests
```bash
node scripts/test-voucher-expiry.js <userId>
```

### Run Complete Test Suite
```bash
node scripts/run-complete-voucher-test.js <userId> <subscriptionId>
```

### Manually Run Voucher Expiry Cron
```bash
node scripts/voucher-expiry-cron.js
```

---

## 🔧 Admin API Endpoints

### Get Admin Token
```bash
curl -X POST http://localhost:3000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-password"
  }'
```

### Manually Trigger Voucher Expiry
```bash
curl -X POST http://localhost:3000/api/admin/cron/voucher-expiry \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json"
```

### Check Cron Status
```bash
curl -X GET http://localhost:3000/api/admin/cron/status \
  -H "Authorization: Bearer <admin_token>"
```

### Get Cron History
```bash
curl -X GET http://localhost:3000/api/admin/cron/history \
  -H "Authorization: Bearer <admin_token>"
```

### Health Check
```bash
curl http://localhost:3000/api/health
```

---

## 📊 MongoDB Queries

### Connect to MongoDB
```bash
mongosh "your-connection-string"
```

### Count Vouchers by Status
```javascript
use tiffsy;

db.vouchers.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } }
]);
```

### Find Expired Vouchers Still AVAILABLE
```javascript
db.vouchers.find({
  expiryDate: { $lt: new Date() },
  status: { $in: ["AVAILABLE", "RESTORED"] }
});
```

### Find Vouchers Expiring Soon (Next 7 Days)
```javascript
db.vouchers.find({
  expiryDate: {
    $gte: new Date(),
    $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  },
  status: { $in: ["AVAILABLE", "RESTORED"] }
});
```

### Clean Up Test Vouchers
```javascript
db.vouchers.deleteMany({
  userId: ObjectId("YOUR_USER_ID"),
  createdAt: { $gte: new Date("2026-01-26") }
});
```

### Check Notifications
```javascript
db.notifications.find({
  userId: ObjectId("YOUR_USER_ID"),
  type: "VOUCHER_EXPIRY_REMINDER"
}).sort({ createdAt: -1 }).limit(5);
```

---

## 🔄 Git Commands

### Pull Latest Code
```bash
git pull origin main
```

### Check Status
```bash
git status
```

### View Recent Commits
```bash
git log --oneline -10
```

---

## 📦 NPM Commands

### Install Dependencies
```bash
npm install
```

### Install Specific Package
```bash
npm install node-cron
```

### Check Installed Packages
```bash
npm list node-cron
```

### Update Dependencies
```bash
npm update
```

---

## 🛠️ Troubleshooting Commands

### Check Node Version
```bash
node --version
```

### Check NPM Version
```bash
npm --version
```

### Check MongoDB Connection
```bash
mongosh "$MONGODB_URL" --eval "db.stats()"
```

### View Environment Variables
```bash
cat .env | grep MONGODB_URL
```

### Check PM2 Process Details
```bash
pm2 info tiffsy-backend
```

### Restart MongoDB Connection (if needed)
```bash
pm2 restart tiffsy-backend
```

### Clear PM2 Logs
```bash
pm2 flush
```

### View System Resources
```bash
pm2 monit
```

---

## 📝 Log Commands

### View Application Logs
```bash
# PM2 logs
tail -f logs/pm2-out.log

# Error logs
tail -f logs/pm2-error.log

# Combined logs
tail -f logs/pm2-combined.log
```

### Search Logs for Cron Execution
```bash
tail -f logs/pm2-out.log | grep "voucher"
```

### Search Logs for Errors
```bash
tail -f logs/pm2-error.log | grep "error"
```

---

## 🔐 Security Commands

### Generate Strong Secret
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Check File Permissions
```bash
ls -la .env
ls -la logs/
```

---

## 🧹 Cleanup Commands

### Stop All PM2 Processes
```bash
pm2 stop all
```

### Delete All PM2 Processes
```bash
pm2 delete all
```

### Clear PM2 Logs
```bash
pm2 flush
```

### Remove Node Modules (for fresh install)
```bash
rm -rf node_modules
npm install
```

---

## ⚡ Quick Deploy Workflow

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
npm install

# 3. Restart application
pm2 reload tiffsy-backend

# 4. Check status
pm2 status

# 5. View logs
pm2 logs tiffsy-backend --lines 20
```

---

## 🔍 Quick Verification

```bash
# 1. Verify setup
node scripts/verify-production-setup.js

# 2. Check health
curl http://localhost:3000/api/health

# 3. Check PM2 status
pm2 status

# 4. View recent logs
pm2 logs tiffsy-backend --lines 20
```

---

## 📞 Emergency Commands

### Application Not Responding
```bash
pm2 restart tiffsy-backend
```

### High Memory Usage
```bash
pm2 restart tiffsy-backend
```

### Cron Not Running
```bash
# Check logs
pm2 logs tiffsy-backend | grep "Scheduled tasks"

# Restart
pm2 restart tiffsy-backend
```

### Database Connection Issues
```bash
# Test connection
mongosh "$MONGODB_URL" --eval "db.stats()"

# Restart app
pm2 restart tiffsy-backend
```

---

## 📚 Documentation Links

- **Production Guide:** [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)
- **Testing Guide:** [scripts/QUICK_START.md](./scripts/QUICK_START.md)
- **Detailed Testing:** [scripts/VOUCHER_TESTING_README.md](./scripts/VOUCHER_TESTING_README.md)
- **Deployment Status:** [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)

---

**Quick Help:**
- PM2 Docs: https://pm2.keymetrics.io/docs/usage/quick-start/
- Node-cron: https://github.com/node-cron/node-cron
- MongoDB Shell: https://www.mongodb.com/docs/mongodb-shell/

---

*Keep this file handy for quick reference during deployment and operations.*
