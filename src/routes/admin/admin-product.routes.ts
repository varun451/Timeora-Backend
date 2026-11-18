import { Router } from "express";
import {
  approveProduct,
  createAdminProduct,
  deleteAdminProduct,
  getAdminProductSummary,
  listAllAdminProducts,
  rejectProduct,
  toggleFeatureProduct,
  updateAdminProduct,
  uploadAdminProductImage,
} from "../../controllers/admin/admin-product.controller.js";
import { requireAdmin } from "../../middleware/auth.js";

const r = Router();
r.use(requireAdmin);

r.get("/products/summary", getAdminProductSummary);
r.get("/products", listAllAdminProducts);
r.post("/products/upload", uploadAdminProductImage);
r.post("/products", createAdminProduct);
r.patch("/products/:id", updateAdminProduct);
r.delete("/products/:id", deleteAdminProduct);
r.post("/products/:id/approve", approveProduct);
r.post("/products/:id/reject", rejectProduct);
r.post("/products/:id/feature", toggleFeatureProduct);

export default r;
