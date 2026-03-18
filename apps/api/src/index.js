const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

// Charger le .env à la racine du monorepo (ai-form-coach/.env).
// __dirname = apps/api/src → ../.. = apps → ../../.. = racine du repo.
dotenv.config({
  path: path.resolve(__dirname, "..", "..", "..", ".env")
});

const { connectMongo } = require("./db");
const { authOptional } = require("./middleware/auth");
const uploadsRouter = require("./routes/uploads");
const poseRouter = require("./routes/pose");
const authRouter = require("./routes/auth");

const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    // We serve a SPA + API; allow cross-origin loads when needed.
    crossOriginResourcePolicy: false
  })
);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 240),
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

const rawCorsOrigins = process.env.CORS_ORIGINS || process.env.FRONTEND_ORIGINS || "";
const allowedOrigins = rawCorsOrigins
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    credentials: true,
    origin(origin, cb) {
      // Allow non-browser clients (curl, health checks)
      if (!origin) return cb(null, true);

      // If not configured, keep permissive behavior (dev/local).
      if (allowedOrigins.length === 0) return cb(null, true);

      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin not allowed: ${origin}`));
    }
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.get("/ready", (req, res) => {
  const mongoReady = mongoose.connection?.readyState === 1;
  res.status(mongoReady ? 200 : 503).json({
    status: mongoReady ? "ok" : "not_ready",
    mongoReady
  });
});

app.use("/api/auth", authRouter);
app.use("/api/uploads", authOptional, uploadsRouter);
app.use("/api/pose", authOptional, poseRouter);

async function main() {
  const port = Number(process.env.PORT || 3000);
  await connectMongo(process.env.MONGO_URL);
  app.listen(port, () => console.log(`[api] listening on :${port}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
