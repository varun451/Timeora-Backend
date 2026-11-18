import { Router } from "express";
import { listSubscribers, subscribe } from "../controllers/newsletter.controller.js";
import { requireAdmin } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const r = Router();
r.post("/", rateLimit(5, 60 * 60_000), subscribe);
r.get("/", requireAdmin, listSubscribers);
export default r;
