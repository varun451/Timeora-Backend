import { Router } from "express";
import { createCategory, listCategories } from "../controllers/category.controller.js";
import { requireAdmin } from "../middleware/auth.js";

const r = Router();
r.get("/", listCategories);
r.post("/", requireAdmin, createCategory);
export default r;
