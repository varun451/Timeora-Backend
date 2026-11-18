import type { RequestHandler } from "express";
import { ProductModel } from "../../models/Product.js";
import { ok } from "../../utils/http.js";

export const getSellerDashboard: RequestHandler = async (req, res) => {
  const seller = req.seller!;
  const sellerId = seller._id;

  const [totalProducts, approvedProducts, outOfStockProducts] =
    await Promise.all([
      ProductModel.countDocuments({ seller: sellerId }),
      ProductModel.countDocuments({ seller: sellerId, status: "approved", availability: "active" }),
      ProductModel.countDocuments({ seller: sellerId, stock: 0 }),
    ]);

  const recentWatches = await ProductModel.find({ seller: sellerId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  ok(res, {
    store: {
      id: String(seller._id),
      storeName: seller.storeName,
      slug: seller.slug,
      ownerName: seller.ownerName,
      status: seller.status,
      commissionBps: seller.commissionBps ?? 1000,
      approvedAt: seller.approvedAt,
    },
    metrics: {
      totalProducts,
      approvedProducts,
      outOfStockProducts,
      totalOrders: 0,
      pendingOrders: 0,
      completedOrders: 0,
      totalSales: 0,
      totalEarnings: 0,
      pendingPayouts: 0,
    },
    recentWatches: recentWatches.map((w) => ({
      id: String(w._id),
      name: w.name,
      brand: w.brand,
      category: w.category,
      price: w.price,
      stock: w.stock ?? 0,
      status: w.status ?? "approved",
      images: w.images ?? [],
      createdAt: w.createdAt,
    })),
    recentOrders: [],
    salesChart: [
      { month: "Jan", sales: 0, earnings: 0 },
      { month: "Feb", sales: 0, earnings: 0 },
      { month: "Mar", sales: 0, earnings: 0 },
    ],
  });
};
