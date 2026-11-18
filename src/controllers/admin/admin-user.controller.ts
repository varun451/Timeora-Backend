import type { RequestHandler } from "express";
import mongoose from "mongoose";
import { AuditLogModel } from "../../models/AuditLog.js";
import { UserModel, type UserDoc } from "../../models/User.js";
import { ApiError, ok } from "../../utils/http.js";

const userView = (user: UserDoc) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  phone: user.phone ?? "",
  status: user.status,
  createdAt: user.createdAt,
});

export const listUsers: RequestHandler = async (req, res) => {
  const status = req.query.status as string | undefined;
  const search = (req.query.q as string | undefined)?.trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter: Record<string, unknown> = { role: "customer" };

  if (status && ["active", "blocked"].includes(status)) {
    filter.status = status;
  }
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escapedSearch, $options: "i" } },
      { email: { $regex: escapedSearch, $options: "i" } },
      { phone: { $regex: escapedSearch, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    UserModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<UserDoc[]>(),
    UserModel.countDocuments(filter),
  ]);

  ok(res, {
    items: users.map(userView),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
};

const updateUserStatus = async (
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
  status: "active" | "blocked",
) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "User not found");

  const user = await UserModel.findOneAndUpdate(
    { _id: id, role: "customer" },
    { $set: { status }, $inc: { tokenVersion: 1 } },
    { returnDocument: "after" },
  ).lean<UserDoc>();
  if (!user) throw new ApiError(404, "Customer not found");

  await AuditLogModel.create({
    actor: req.user!._id,
    actorRole: req.user!.role,
    action: status === "blocked" ? "CUSTOMER_BLOCK" : "CUSTOMER_ACTIVATE",
    target: "User",
    targetId: user._id,
    details: { email: user.email },
    ip: req.ip ?? "",
  });

  ok(res, { user: userView(user) });
};

export const blockUser: RequestHandler = async (req, res) => {
  await updateUserStatus(req, res, "blocked");
};

export const activateUser: RequestHandler = async (req, res) => {
  await updateUserStatus(req, res, "active");
};
