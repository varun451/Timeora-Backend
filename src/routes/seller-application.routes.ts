import { Router } from "express";
import { getMyApplication, submitApplication } from "../controllers/seller-application.controller.js";
import { requireUser } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const r = Router();
r.use(requireUser);

r.post("/", rateLimit(5, 15 * 60_000), submitApplication);
r.get("/mine", getMyApplication);

export default r;

