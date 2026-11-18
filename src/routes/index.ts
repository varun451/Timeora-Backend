import { Router } from "express";
import mongoose from "mongoose";
import adminProductRoutes from "./admin/admin-product.routes.js";
import adminOrderRoutes from "./admin/admin-order.routes.js";
import adminSellerRoutes from "./admin/admin-seller.routes.js";
import adminUserRoutes from "./admin/admin-user.routes.js";
import authRoutes from "./auth.routes.js";
import categoryRoutes from "./category.routes.js";
import contactRoutes from "./contact.routes.js";
import newsletterRoutes from "./newsletter.routes.js";
import orderRoutes from "./order.routes.js";
import paymentRoutes from "./payment.routes.js";
import productRoutes from "./product.routes.js";
import sellerApplicationRoutes from "./seller-application.routes.js";
import sellerRoutes from "./seller/seller.routes.js";
import wishlistRoutes from "./wishlist.routes.js";

const r = Router();

r.get("/health", (_req, res) => {
  const db = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.status(db === "connected" ? 200 : 503).json({ success: true, data: { status: "ok", db } });
});

r.use("/auth", authRoutes);
r.use("/categories", categoryRoutes);
r.use("/contact", contactRoutes);
r.use("/products", productRoutes);
r.use("/orders", orderRoutes);
r.use("/payments", paymentRoutes);
r.use("/wishlist", wishlistRoutes);
r.use("/newsletter", newsletterRoutes);
r.use("/seller-applications", sellerApplicationRoutes);
r.use("/seller", sellerRoutes);
r.use("/admin", adminSellerRoutes);
r.use("/admin", adminProductRoutes);
r.use("/admin/orders", adminOrderRoutes);
r.use("/admin", adminUserRoutes);

export default r;
