import { Router } from "express";
import { paymentConfig, verifyRazorpayPayment } from "../controllers/payment.controller.js";
import { requireUser } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const r = Router();
r.get("/config", paymentConfig);
r.post("/razorpay/verify", requireUser, rateLimit(10, 10 * 60_000), verifyRazorpayPayment);
export default r;
