import type { RequestHandler } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { OrderModel } from "../../models/Order.js";
import { UserModel } from "../../models/User.js";
import { orderView } from "../order.controller.js";
import { ok } from "../../utils/http.js";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(5),
  status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]).optional(),
  q: z.string().trim().max(100).optional(),
  dateFrom: z.iso.datetime().optional(),
});

export const getAdminOrderSummary: RequestHandler = async (_req, res) => {
  const [total, processing, shipped, delivered, cancelled] = await Promise.all([
    OrderModel.countDocuments({}),
    OrderModel.countDocuments({ status: "processing" }),
    OrderModel.countDocuments({ status: "shipped" }),
    OrderModel.countDocuments({ status: "delivered" }),
    OrderModel.countDocuments({ status: "cancelled" }),
  ]);
  ok(res, { total, processing, shipped, delivered, cancelled });
};

export const listAdminOrders: RequestHandler = async (req, res) => {
  const query = querySchema.parse(req.query);
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.dateFrom) filter.createdAt = { $gte: new Date(query.dateFrom) };

  if (query.q) {
    const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matchingUsers = await UserModel.find({
      $or: [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
      ],
    }).select("_id").lean();
    const userIds = matchingUsers.map((user) => user._id);
    const orderId = mongoose.Types.ObjectId.isValid(query.q) ? query.q : null;
    const searchConditions: Record<string, unknown>[] = [
      ...(orderId ? [{ _id: orderId }] : []),
      ...(userIds.length ? [{ user: { $in: userIds } }] : []),
    ];
    if (!searchConditions.length) {
      ok(res, { items: [], total: 0, page: query.page, pages: 1 });
      return;
    }
    filter.$or = searchConditions;
  }

  const [orders, total] = await Promise.all([
    OrderModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate("user", "name email phone")
      .populate("items.product", "images")
      .lean(),
    OrderModel.countDocuments(filter),
  ]);

  ok(res, {
    items: orders.map((order) => {
      const customer = order.user && typeof order.user === "object" && "name" in order.user
        ? { name: String(order.user.name), email: String(order.user.email ?? ""), phone: String(order.user.phone ?? "") }
        : { name: "Customer", email: "", phone: "" };
      return { ...orderView(order), customer };
    }),
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
  });
};
