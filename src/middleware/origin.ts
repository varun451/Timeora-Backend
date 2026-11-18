import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../utils/http.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const allowedOrigins = new Set(
  [...env.FRONTEND_URL.split(","), env.ADMIN_URL]
    .map((s) => s.trim().toLowerCase().replace(/\/$/, ""))
    .filter(Boolean),
);

export function isAllowedOrigin(origin: string): boolean {
  const originLower = origin.toLowerCase().replace(/\/$/, "");
  if (allowedOrigins.has(originLower)) return true;

  // Allow all Timeora Vercel deployments (production + preview domains like timeora-admin-xxx.vercel.app)
  if (originLower.endsWith(".vercel.app") && originLower.includes("timeora")) {
    return true;
  }

  // Allow local development
  if (env.NODE_ENV !== "production" && (originLower.includes("localhost") || originLower.includes("127.0.0.1"))) {
    return true;
  }

  return false;
}

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
    if (isAllowedOrigin(origin)) return next();
    throw new ApiError(403, "Cross-site request blocked");
  }

  if (referer) {
    try {
      const refUrl = new URL(referer);
      if (isAllowedOrigin(refUrl.origin)) return next();
    } catch {
      throw new ApiError(403, "Invalid request referer");
    }
    throw new ApiError(403, "Cross-site request blocked");
  }

  // Same-origin or non-browser client without origin header
  next();
};
