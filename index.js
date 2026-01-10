import "dotenv/config";
import createApp from "./config/express.config.js";
import connectDB from "./config/database.config.js";
import { initializeConfigCache } from "./services/config.service.js";
import { initializePaymentService } from "./services/payment/payment.service.js";
import paymentConfig, { getActiveProviderConfig } from "./config/payment.config.js";

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  console.log("> Starting server...");

  await connectDB();

  // Initialize config cache from database
  await initializeConfigCache();

  // Initialize payment service with configured provider
  await initializePaymentService(paymentConfig.activeProvider, getActiveProviderConfig());

  const app = createApp();

  app.listen(PORT, () => {
    console.log(`> Server running on port ${PORT}`);
  });
};

startServer();
