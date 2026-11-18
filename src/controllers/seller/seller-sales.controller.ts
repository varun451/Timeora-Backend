import type { RequestHandler } from "express";
import mongoose from "mongoose";
import { OrderModel } from "../../models/Order.js";
import { ProductModel } from "../../models/Product.js";
import { ok } from "../../utils/http.js";

const ranges = ["7d", "30d", "90d", "all"] as const;
type SalesRange = (typeof ranges)[number];

export const listSellerSales: RequestHandler = async (req, res) => {
  const sellerId = req.seller!._id;
  const rangeValue = String(req.query.range ?? "30d");
  const range: SalesRange = ranges.includes(rangeValue as SalesRange)
    ? (rangeValue as SalesRange)
    : "30d";
  const search = String(req.query.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const earningsRate = 1 - (req.seller!.commissionBps ?? 1000) / 10_000;
  const productIds = await ProductModel.distinct("_id", { seller: sellerId });

  if (productIds.length === 0) {
    ok(res, {
      items: [],
      total: 0,
      page,
      pages: 1,
      metrics: { productsSold: 0, totalEarnings: 0 },
    });
    return;
  }

  const orderMatch: Record<string, unknown> = {
    "items.product": { $in: productIds },
    status: { $ne: "cancelled" },
    paymentStatus: { $nin: ["failed", "refunded"] },
  };
  if (range !== "all") {
    const days = Number(range.slice(0, -1));
    orderMatch.createdAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
  }

  const pipeline: mongoose.PipelineStage[] = [
    { $match: orderMatch },
    { $unwind: "$items" },
    { $match: { "items.product": { $in: productIds } } },
    {
      $project: {
        orderId: { $toString: "$_id" },
        productId: { $toString: "$items.product" },
        product: "$items.name",
        image: { $arrayElemAt: ["$items.images", 0] },
        quantity: "$items.quantity",
        amount: {
          $round: [{ $multiply: ["$items.unitPrice", "$items.quantity", earningsRate] }, 0],
        },
        date: "$createdAt",
      },
    },
  ];

  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    pipeline.push({
      $match: {
        $or: [
          { product: { $regex: escapedSearch, $options: "i" } },
          { orderId: { $regex: escapedSearch.replace(/^#?ORD/i, ""), $options: "i" } },
        ],
      },
    });
  }

  const [result] = await OrderModel.aggregate([
    ...pipeline,
    {
      $facet: {
        items: [
          { $sort: { date: -1, orderId: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ],
        total: [{ $count: "count" }],
        metrics: [
          {
            $group: {
              _id: null,
              productsSold: { $sum: "$quantity" },
              totalEarnings: { $sum: "$amount" },
            },
          },
        ],
      },
    },
  ]);
  const total = (result?.total?.[0]?.count as number | undefined) ?? 0;
  const metrics = result?.metrics?.[0];

  ok(res, {
    items: (result?.items ?? []).map((item: {
      orderId: string;
      productId: string;
      product: string;
      image?: string;
      quantity: number;
      amount: number;
      date: Date;
    }) => ({
      ...item,
      orderId: `ORD${item.orderId.slice(-6).toUpperCase()}`,
      image: item.image ?? "",
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    metrics: {
      productsSold: metrics?.productsSold ?? 0,
      totalEarnings: metrics?.totalEarnings ?? 0,
    },
  });
};
