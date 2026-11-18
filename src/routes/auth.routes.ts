import { Router } from "express";
import {
  changePassword,
  forgotPassword,
  login,
  logout,
  me,
  register,
  resetPassword,
  updateMe,
} from "../controllers/auth.controller.js";
import { requireUser } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const r = Router();
r.post("/register", rateLimit(10, 15 * 60_000), register);
r.post("/login", rateLimit(10, 15 * 60_000), login);
r.post("/logout", logout);
r.get("/me", requireUser, me);
r.patch("/me", requireUser, updateMe);
r.post("/change-password", requireUser, rateLimit(5, 15 * 60_000), changePassword);
r.post("/forgot-password", rateLimit(5, 15 * 60_000), forgotPassword);
r.post("/reset-password", rateLimit(5, 15 * 60_000), resetPassword);

export default r;
