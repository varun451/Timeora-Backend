import { Router } from "express";
import { getSellerDashboard } from "../../controllers/seller/seller-dashboard.controller.js";
import { listSellerSales } from "../../controllers/seller/seller-sales.controller.js";
import { getSellerProfile, updateSellerProfile } from "../../controllers/seller/seller-profile.controller.js";
import {
  createSellerProduct,
  deleteSellerProduct,
  getMyProduct,
  listMyProducts,
  quickStockUpdate,
  updateSellerProduct,
  uploadSellerImage,
} from "../../controllers/seller/seller-product.controller.js";
import { requireSeller } from "../../middleware/roles.js";

const r = Router();
r.use(requireSeller);

// Dashboard
r.get("/dashboard", getSellerDashboard);
r.get("/sales", listSellerSales);
r.get("/profile", getSellerProfile);
r.patch("/profile", updateSellerProfile);

// Product management
r.get("/products", listMyProducts);
r.post("/products", createSellerProduct);
r.get("/products/:id", getMyProduct);
r.patch("/products/:id", updateSellerProduct);
r.patch("/products/:id/stock", quickStockUpdate);
r.delete("/products/:id", deleteSellerProduct);

// Uploads
r.post("/upload", uploadSellerImage);

export default r;
