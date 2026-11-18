import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { checkOrigin, isAllowedOrigin } from "./middleware/origin.js";
import routes from "./routes/index.js";

const app = express();

app.set("trust proxy", env.TRUST_PROXY);

// Helmet CJS/ESM interop handling for cross-platform builds
const helmetMiddleware = ((helmet as any)?.default ?? helmet) as (options?: unknown) => express.RequestHandler;
app.use(helmetMiddleware({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like same-origin, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Let checkOrigin middleware handle the strict check with ApiError
    },
    credentials: true,
  }),
);

// Allow up to 10MB JSON for image uploads
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(checkOrigin);

// Root & health endpoints for deployment uptime / verification
app.get("/", (_req, res) => {
  res.json({ success: true, message: "Timeora Backend API running" });
});
app.get("/health", (_req, res) => {
  res.json({ success: true, status: "ok" });
});

// Serve uploaded images statically
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);

export default app;
