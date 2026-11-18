import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../src/app.js";
import { connectDB } from "../src/config/db.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await connectDB();
  } catch (err) {
    console.error("Database connection error in serverless handler:", err);
  }
  return app(req, res);
}
