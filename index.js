import "dotenv/config";
import createApp from "./config/express.config.js";
import connectDB from "./config/database.config.js";
import { initializeConfigCache } from "./services/config.service.js";
import { initializeCronJobs, stopCronJobs } from "./cron/scheduler.js";

const PORT = process.env.PORT || 3000;

let cronJobs = null;

const startServer = async () => {
  console.log("> Starting server...");

  await connectDB();

  // Initialize config cache from database
  await initializeConfigCache();

  const app = createApp();

  app.listen(PORT, () => {
    console.log(`> Server running on port ${PORT}`);

    // Initialize cron jobs after server starts
    console.log("> Initializing scheduled tasks...");
    cronJobs = initializeCronJobs();
    console.log("> Scheduled tasks initialized");
  });
};

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("> SIGTERM signal received: closing HTTP server and stopping cron jobs");
  if (cronJobs) {
    stopCronJobs(cronJobs);
  }
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("> SIGINT signal received: closing HTTP server and stopping cron jobs");
  if (cronJobs) {
    stopCronJobs(cronJobs);
  }
  process.exit(0);
});

startServer();
