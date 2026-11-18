import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../utils/http.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const allowedOrigins = new Set(
  env.FRONTEND_URL.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

/**
 * Validates Origin/Referer header on state-changing browser requests (POST, PUT, PATCH, DELETE)
 * to provide defense-in-depth on top of SameSite=Lax cookies.
 */
export const checkOrigin: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  // Allow webhooks or machine-to-machine integrations to bypass origin check
  if (req.path.startsWith("/payments/razorpay/webhook")) return next();

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin) {
    const originLower = origin.toLowerCase();
    if (allowedOrigins.has(originLower)) return next();
    // Allow local development ports variations if in dev
    if (env.NODE_ENV !== "production" && (originLower.includes("localhost") || originLower.includes("127.0.0.1"))) {
      return next();
    }
    throw new ApiError(403, "Cross-site request blocked");
  }

  if (referer) {
    try {
      const refUrl = new URL(referer);
      const refOrigin = refUrl.origin.toLowerCase();
      if (allowedOrigins.has(refOrigin)) return next();
      if (env.NODE_ENV !== "production" && (refOrigin.includes("localhost") || refOrigin.includes("127.0.0.1"))) {
        return next();
      }
    } catch {
      throw new ApiError(403, "Invalid request referer");
    }
    throw new ApiError(403, "Cross-site request blocked");
  }

  // Same-origin or non-browser client without origin header
  next();
};

