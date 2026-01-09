import "dotenv/config";
import createApp from "./config/express.config.js";
import connectDB from "./config/database.config.js";
import { initializeConfigCache } from "./services/config.service.js";

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  console.log("> Starting server...");

  await connectDB();

  // Initialize config cache from database
  await initializeConfigCache();

  const app = createApp();

  app.listen(PORT, () => {
    console.log(`> Server running on port ${PORT}`);
  });
};

startServer();
