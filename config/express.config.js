import express from "express";
import cors from "cors";
import indexRoutes from "../index.route.js";
import { requestLogger, errorLogger } from "../middlewares/requestLogger.middleware.js";

const createApp = () => {
  const app = express();

  // Core Middleware
  app.use(cors());

  // IMPORTANT: Skip express.json() for webhook routes to preserve raw body
  // Razorpay webhooks require the raw body for signature verification
  app.use((req, res, next) => {
    if (req.originalUrl === "/api/payment/webhook") {
      // Skip JSON parsing for webhook - let express.raw() handle it in the route
      console.log("[MIDDLEWARE] Skipping JSON parsing for webhook route");
      next();
    } else {
      express.json()(req, res, next);
    }
  });

  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware (logs all HTTP requests)
  app.use(requestLogger);

  console.log("> Middleware configured");

  // Routes
  app.use("/api", indexRoutes);
  console.log("> Routes initialized");

  // Error logging middleware (catches unhandled errors)
  app.use(errorLogger);

  // Default error handler
  app.use((err, _req, res, _next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: err.message || "Internal server error",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  });

  return app;
};

export default createApp;
