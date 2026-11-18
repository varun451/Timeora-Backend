import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { checkOrigin } from "./middleware/origin.js";
import routes from "./routes/index.js";

const app = express();

app.set("trust proxy", env.TRUST_PROXY);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.FRONTEND_URL.split(",").map((s) => s.trim()), credentials: true }));
// Allow up to 10MB JSON for image uploads
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(checkOrigin);

// Serve uploaded images statically
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);

export default app;
