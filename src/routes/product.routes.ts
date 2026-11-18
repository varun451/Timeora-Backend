import { Router } from "express";
import { createProduct, deleteProduct, getProduct, listProducts, productFilters, relatedProducts, updateProduct } from "../controllers/product.controller.js";
import { requireAdmin } from "../middleware/auth.js";

const r = Router();
r.get("/", listProducts);
r.post("/", requireAdmin, createProduct);
r.get("/filters", productFilters); // must stay above "/:id"
r.get("/:id", getProduct); // :id can be a Mongo id or a slug
r.get("/:id/related", relatedProducts);
r.patch("/:id", requireAdmin, updateProduct);
r.delete("/:id", requireAdmin, deleteProduct);
export default r;
