import express from "express";
import cors from "cors";
import indexRoutes from "../index.route.js";

const createApp = () => {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  console.log("> Middleware configured");

  // Routes
  app.use("/api", indexRoutes);
  console.log("> Routes initialized");

  return app;
};

export default createApp;
