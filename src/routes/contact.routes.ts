import { Router } from "express";
import { createContactMessage, listContactMessages } from "../controllers/contact.controller.js";
import { requireAdmin } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const r = Router();
r.post("/", rateLimit(5, 60 * 60_000), createContactMessage);
r.get("/", requireAdmin, listContactMessages);
export default r;
