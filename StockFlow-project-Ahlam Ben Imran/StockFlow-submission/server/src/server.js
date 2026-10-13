import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import api from "./routes/api.js";
import { pool } from "./db.js";
import { errorHandler, notFound } from "./utils.js";

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  console.error(
    "DATABASE_URL et JWT_SECRET sont obligatoires. " +
      "Copiez .env.example en .env puis configurez-les.",
  );
  process.exit(1);
}

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  }),
);
app.use(express.json({ limit: "1mb" }));

app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/api/health", async (req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

app.use("/api", api);
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.log(`StockFlow API disponible sur http://localhost:${port}`);
});