# Production Deployment Guide

Complete guide for deploying the Tiffsy backend with voucher expiry cron jobs in production.

## 📋 Prerequisites

- Node.js 20.x or higher
- MongoDB instance running
- PM2 installed globally (`npm install -g pm2`)
- Firebase Admin SDK credentials
- Razorpay API keys

---

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Clone repository
git clone <your-repo-url>
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your production values
```

### 2. Environment Variables

Ensure your `.env` file has:

```bash
# MongoDB
MONGODB_URL=mongodb://...

# Server
PORT=3000
NODE_ENV=production

# Firebase
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# Razorpay
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...

# Security
JWT_SECRET=...
CRON_SECRET=...
```

### 3. Start with PM2

```bash
# Production mode
pm2 start ecosystem.config.cjs --env production

# Check status
pm2 status

# View logs
pm2 logs tiffsy-backend

# Monitor
pm2 monit
```

---

## ⏰ Cron Jobs

### Automatic Scheduling

The application automatically initializes cron jobs on startup:

| Job | Schedule | Time (IST) | Description |
|-----|----------|------------|-------------|
| Voucher Expiry | `30 2 * * *` | 8:00 AM daily | Expires vouchers and sends notifications |

### Manual Triggers (Admin Only)

**Trigger voucher expiry manually:**
```bash
curl -X POST http://your-domain.com/api/admin/cron/voucher-expiry \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json"
```

**Check cron status:**
```bash
curl -X GET http://your-domain.com/api/admin/cron/status \
  -H "Authorization: Bearer <admin_token>"
```

**Response:**
```json
{
  "success": true,
  "message": "Cron job status",
  "data": {
    "jobs": {
      "voucherExpiry": {
        "schedule": "Daily at 8:00 AM IST (2:30 AM UTC)",
        "cronExpression": "30 2 * * *",
        "timezone": "UTC",
        "status": "scheduled",
        "nextRun": "2026-01-27T02:30:00.000Z"
      }
    }
  }
}
```

---

## 📊 Monitoring

### PM2 Monitoring

```bash
# Status of all processes
pm2 status

# Detailed info
pm2 info tiffsy-backend

# Real-time monitoring
pm2 monit

# View logs
pm2 logs tiffsy-backend --lines 100

# Error logs only
pm2 logs tiffsy-backend --err

# Clear logs
pm2 flush
```

### Application Logs

Logs are stored in `./logs/` directory:
- `pm2-out.log` - Standard output
- `pm2-error.log` - Error output
- `pm2-combined.log` - Combined logs

**View recent cron executions:**
```bash
tail -f logs/pm2-out.log | grep "Voucher expiry"
```

---

## 🔄 Updates and Maintenance

### Update Code

```bash
# Pull latest code
git pull origin main

# Install new dependencies
npm install

# Restart application (zero-downtime)
pm2 reload tiffsy-backend

# Or restart (with brief downtime)
pm2 restart tiffsy-backend
```

### Restart Cron Jobs

Cron jobs restart automatically when the application restarts:

```bash
pm2 restart tiffsy-backend
# Output: "> Scheduled tasks initialized"
```

---

## 🛡️ Production Checklist

- [ ] Environment variables configured
- [ ] MongoDB connection tested
- [ ] Firebase Admin SDK credentials valid
- [ ] PM2 installed and configured
- [ ] Application starts without errors
- [ ] Cron jobs initialized successfully
- [ ] Admin endpoints secured
- [ ] Logs directory exists with write permissions
- [ ] Health check endpoint responding
- [ ] Manual cron trigger tested
- [ ] Monitoring setup (optional: Sentry, DataDog)
- [ ] Backup strategy in place
- [ ] SSL/TLS configured (if using HTTPS)

---

## 🚨 Troubleshooting

### Cron Not Running

**Check if cron jobs initialized:**
```bash
pm2 logs tiffsy-backend | grep "Scheduled tasks"
```

Expected output:
```
> Initializing scheduled tasks...
> Scheduled tasks initialized
```

**Manual trigger to test:**
```bash
curl -X POST http://localhost:3000/api/admin/cron/voucher-expiry \
  -H "Authorization: Bearer <admin_token>"
```

### Application Crashes

**Check error logs:**
```bash
pm2 logs tiffsy-backend --err --lines 50
```

**Check process status:**
```bash
pm2 status
pm2 info tiffsy-backend
```

**Restart if needed:**
```bash
pm2 restart tiffsy-backend
```

### Memory Issues

**Check memory usage:**
```bash
pm2 monit
```

**Increase memory limit in `ecosystem.config.cjs`:**
```javascript
max_memory_restart: "2G", // Increase from 1G to 2G
```

---

## 📈 Performance Optimization

### Clustering (Multi-core)

Enable clustering for better performance:

```javascript
// In ecosystem.config.cjs
instances: "max", // Use all CPU cores
exec_mode: "cluster"
```

**Note:** With clustering, each instance runs its own cron jobs. To prevent duplicate execution:
- Only run cron in the master instance
- Or use a distributed lock mechanism (Redis)

### Recommended for Production

```javascript
// ecosystem.config.cjs
{
  instances: 1, // Single instance to avoid duplicate cron execution
  exec_mode: "cluster",
  max_memory_restart: "1G",
  autorestart: true
}
```

---

## 🔐 Security

### Admin API Security

All cron management endpoints require admin authentication:

```bash
# Get admin token first
curl -X POST http://localhost:3000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-password"
  }'

# Use token for cron endpoints
curl -X GET http://localhost:3000/api/admin/cron/status \
  -H "Authorization: Bearer <token>"
```

### Environment Security

- Never commit `.env` to version control
- Use strong secrets for `JWT_SECRET` and `CRON_SECRET`
- Rotate secrets periodically
- Use environment-specific configs

---

## 📦 Backup Strategy

### Database Backups

```bash
# Backup MongoDB
mongodump --uri="mongodb://..." --out=/backups/$(date +%Y%m%d)

# Schedule daily backups (crontab)
0 3 * * * mongodump --uri="mongodb://..." --out=/backups/$(date +\%Y\%m\%d)
```

### Application Logs

```bash
# Rotate logs daily
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## 🎯 Health Checks

### Application Health

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "success": true,
  "message": "Server is running",
  "data": { "status": "ok" }
}
```

### Automated Monitoring

Set up automated health checks:

```bash
# Using PM2 ecosystem config
health_check: {
  url: "http://localhost:3000/api/health",
  interval: 60000,
  timeout: 5000
}
```

### External Monitoring (Optional)

- **UptimeRobot**: Free uptime monitoring
- **Sentry**: Error tracking
- **DataDog**: Full observability
- **New Relic**: Performance monitoring

---

## 🚀 Deployment Strategies

### Manual Deployment

```bash
git pull
npm install
pm2 reload tiffsy-backend
```

### CI/CD Deployment (GitHub Actions Example)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - name: Deploy to server
        run: |
          ssh user@server 'cd /var/www/backend && git pull && npm install && pm2 reload tiffsy-backend'
```

---

## 📞 Support

### Common Commands

```bash
# Start application
pm2 start ecosystem.config.cjs --env production

# Stop application
pm2 stop tiffsy-backend

# Restart application
pm2 restart tiffsy-backend

# Delete from PM2
pm2 delete tiffsy-backend

# Save PM2 process list
pm2 save

# Restore PM2 processes on reboot
pm2 startup
```

### Logs Location

- PM2 Logs: `./logs/pm2-*.log`
- Application Logs: Console output captured by PM2
- MongoDB Logs: As per MongoDB configuration

---

## ✅ Verification Steps

After deployment, verify:

1. **Application Started:**
   ```bash
   pm2 status
   # Status should be "online"
   ```

2. **Cron Jobs Initialized:**
   ```bash
   pm2 logs tiffsy-backend --lines 20 | grep "Scheduled tasks"
   # Should show: "Scheduled tasks initialized"
   ```

3. **Health Check Passes:**
   ```bash
   curl http://localhost:3000/api/health
   # Should return: { "success": true, "data": { "status": "ok" } }
   ```

4. **Cron Status Accessible:**
   ```bash
   curl http://localhost:3000/api/admin/cron/status \
     -H "Authorization: Bearer <admin_token>"
   # Should return cron job details
   ```

5. **Manual Cron Trigger Works:**
   ```bash
   curl -X POST http://localhost:3000/api/admin/cron/voucher-expiry \
     -H "Authorization: Bearer <admin_token>"
   # Should return: { "success": true, "stats": { ... } }
   ```

---

**Last Updated:** 2026-01-26
**Version:** 1.0.0
