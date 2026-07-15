import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import * as dotenv from "dotenv";

import { setupSwagger } from "./config/swagger";
import { errorHandler } from "./shared/middlewares/errorHandler";
import { globalLimiter, strictLimiter } from "./shared/middlewares/rateLimiter";
import authRoutes from "./modules/auth/auth.routes";
import feedRoutes from "./modules/feed/feed.routes";
import likesRoutes from "./modules/likes/likes.routes";

dotenv.config();

const app: Express = express();

// ─── Security & Parsing Middleware ───────────────────────────────────────────
app.use(
  helmet({
    // Relax CSP so Swagger UI assets load correctly in development
    contentSecurityPolicy: process.env.NODE_ENV === "production",
  }),
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? "development",
  });
});

// ─── Static File Serving ──────────────────────────────────────────────────────
// Serve uploaded images at GET /uploads/<filename>.
// Cross-Origin-Resource-Policy must be "cross-origin" so the React dev
// server (different port) can load images without ERR_BLOCKED_BY_RESPONSE.
app.use("/uploads", (_req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.join(__dirname, "../uploads")));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
// Global cap: 100 req / 15 min per IP across all API routes
app.use("/api", globalLimiter);
// Strict cap: 20 req / hour per IP for auth + post-creation (mounted before route handlers)
app.use("/api/auth", strictLimiter);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/posts", feedRoutes);
app.use("/api/likes", likesRoutes);

// ─── API Documentation ────────────────────────────────────────────────────────
setupSwagger(app);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// ─── Centralised Error Handler (must be last) ─────────────────────────────────
app.use(errorHandler);

export default app;
