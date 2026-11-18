import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/http.js";

const fail = (status: number, error: string, details?: unknown) => ({ status, body: { success: false, error, details } });

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
};

/** Every failure returns the same JSON shape and never leaks stack traces. */
export const errorHandler: ErrorRequestHandler = (e, _req, res, _next) => {
  let r;
  if (e instanceof ApiError) r = fail(e.status, e.message);
  else if (e instanceof ZodError) r = fail(400, "Invalid input", e.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  else if (e?.type === "entity.parse.failed") r = fail(400, "Invalid JSON body");
  else if (e?.code === 11000) r = fail(409, "A record with this value already exists");
  else if (e?.name === "ValidationError") r = fail(400, "Invalid input");
  else {
    console.error(e);
    r = fail(500, "Something went wrong. Please try again.");
  }
  res.status(r.status).json(r.body);
};
