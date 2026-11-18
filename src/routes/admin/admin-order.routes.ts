import { Router } from "express";
import { getAdminOrderSummary, listAdminOrders } from "../../controllers/admin/admin-order.controller.js";
import { updateOrderStatus } from "../../controllers/order.controller.js";
import { requireAdmin } from "../../middleware/auth.js";

const r = Router();
r.use(requireAdmin);
r.get("/summary", getAdminOrderSummary);
r.get("/", listAdminOrders);
r.patch("/:id/status", updateOrderStatus);

export default r;
