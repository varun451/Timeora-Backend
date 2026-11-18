import type { RequestHandler } from "express";
import { ApiError } from "../utils/http.js";

/** In-memory limiter: fine for one server instance. Use Redis when you run several instances. */
export function rateLimit(max: number, windowMs: number): RequestHandler {
  const hits = new Map<string, { n: number; reset: number }>();
  return (req, _res, next) => {
    const key = req.ip ?? "local", now = Date.now(), h = hits.get(key);
    if (!h || h.reset < now) {
      hits.set(key, { n: 1, reset: now + windowMs });
      return next();
    }
    if (++h.n > max) throw new ApiError(429, "Too many attempts. Try again later.");
    next();
  };
}
