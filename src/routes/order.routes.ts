import { Router } from "express";
import { cancelMyOrder, createOrder, getMyOrder, listAllOrders, listMyOrders, updateOrderStatus } from "../controllers/order.controller.js";
import { requireAdmin, requireUser } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const r = Router();
r.use(requireUser);
r.post("/", rateLimit(10, 10 * 60_000), createOrder);
r.get("/mine", listMyOrders);
r.get("/", requireAdmin, listAllOrders);
r.get("/:id", getMyOrder);
r.post("/:id/cancel", cancelMyOrder);
r.patch("/:id/status", requireAdmin, updateOrderStatus);
export default r;
