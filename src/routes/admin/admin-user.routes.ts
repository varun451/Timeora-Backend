import { Router } from "express";
import { activateUser, blockUser, listUsers } from "../../controllers/admin/admin-user.controller.js";
import { requireAdmin } from "../../middleware/auth.js";

const r = Router();
r.use(requireAdmin);

r.get("/users", listUsers);
r.post("/users/:id/block", blockUser);
r.post("/users/:id/activate", activateUser);

export default r;
