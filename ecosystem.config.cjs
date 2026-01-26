/**
 * PM2 Ecosystem Configuration
 * For production deployment with process management
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 logs tiffsy-backend
 *   pm2 status
 *   pm2 restart tiffsy-backend
 *   pm2 stop tiffsy-backend
 *   pm2 delete tiffsy-backend
 */

module.exports = {
  apps: [
    {
      name: "tiffsy-backend",
      script: "./index.js",
      instances: 1, // Single instance for development, use "max" for production clustering
      exec_mode: "cluster", // Use cluster mode for better performance
      watch: false, // Set to true for development auto-reload
      max_memory_restart: "1G", // Restart if memory exceeds 1GB
      env: {
        NODE_ENV: "development",
        PORT: 3000
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_file: "./logs/pm2-combined.log",
      time: true, // Prefix logs with timestamp
      autorestart: true, // Auto-restart on crash
      max_restarts: 10, // Max restarts within restart_delay
      min_uptime: "10s", // Min uptime to consider a restart successful
      restart_delay: 4000, // Delay between restarts (ms)
      listen_timeout: 10000, // Timeout for listening (ms)
      kill_timeout: 5000, // Timeout before force kill (ms)

      // Cron jobs are handled within the app (node-cron)
      // No need for PM2 cron here

      // Environment-specific settings
      node_args: "--max-old-space-size=1024", // Increase heap size if needed

      // Graceful shutdown
      shutdown_with_message: true,

      // Advanced PM2 features
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Process tracking
      vizion: false, // Disable git metadata
      post_update: ["npm install"], // Run after code update

      // Health check (optional)
      // health_check: {
      //   url: "http://localhost:3000/api/health",
      //   interval: 60000, // Check every 60 seconds
      //   timeout: 5000
      // }
    }
  ],

  // Deployment configuration (optional)
  deploy: {
    production: {
      user: "deploy-user",
      host: "your-server.com",
      ref: "origin/main",
      repo: "git@github.com:your-org/tiffsy-backend.git",
      path: "/var/www/tiffsy-backend",
      "post-deploy": "npm install && pm2 reload ecosystem.config.cjs --env production",
      env: {
        NODE_ENV: "production"
      }
    }
  }
};
