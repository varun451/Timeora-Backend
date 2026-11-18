import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import mongoose from "mongoose";
import { AuditLogModel } from "../../models/AuditLog.js";
import { ProductModel, type ProductDoc } from "../../models/Product.js";
import { toProduct } from "../../services/product.service.js";
import { saveBase64Image } from "../../services/upload.service.js";
import { ApiError, ok } from "../../utils/http.js";
import { slugify } from "../../utils/slugify.js";
import {
  sellerProductInputSchema,
  sellerProductPatchSchema,
  sellerProductStockSchema,
} from "../../validations/seller.validations.js";

const toSellerProductView = (d: ProductDoc) => ({
  ...toProduct(d),
  status: d.status ?? "approved",
  availability: d.availability ?? "active",
  rejectionReason: d.rejectionReason ?? "",
  sku: d.sku ?? "",
  createdAt: d.createdAt,
});

export const listMyProducts: RequestHandler = async (req, res) => {
  const sellerId = req.seller!._id;
  const status = req.query.status as string | undefined;
  const q = req.query.q as string | undefined;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const filter: Record<string, unknown> = { seller: sellerId };
  if (status && ["draft", "pending", "approved", "rejected"].includes(status)) {
    filter.status = status;
  }
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: re }, { brand: re }, { category: re }];
  }

  const [docs, total] = await Promise.all([
    ProductModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<ProductDoc[]>(),
    ProductModel.countDocuments(filter),
  ]);

  ok(res, {
    items: docs.map(toSellerProductView),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
};

export const getMyProduct: RequestHandler = async (req, res) => {
  const sellerId = req.seller!._id;
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Product not found");

  const doc = await ProductModel.findOne({ _id: id, seller: sellerId }).lean<ProductDoc>();
  if (!doc) throw new ApiError(404, "Product not found");

  ok(res, toSellerProductView(doc));
};

export const createSellerProduct: RequestHandler = async (req, res) => {
  const seller = req.seller!;
  const body = sellerProductInputSchema.parse(req.body);

  // Generate unique slug by appending random hex
  const baseSlug = slugify(body.name);
  const uniqueSlug = `${baseSlug}-${randomBytes(3).toString("hex")}`;

  const initialStatus = "approved";

  const doc = await ProductModel.create({
    ...body,
    slug: uniqueSlug,
    seller: seller._id,
    sellerActive: seller.status === "active",
    status: initialStatus,
    published: true,
  });

  await AuditLogModel.create({
    actor: req.user!._id,
    actorRole: "seller",
    action: "SELLER_PRODUCT_CREATE",
    target: "Product",
    targetId: doc._id,
    details: { name: doc.name, status: initialStatus },
    ip: req.ip ?? "",
  });

  ok(res, toSellerProductView(doc.toObject() as ProductDoc), 201);
};

export const updateSellerProduct: RequestHandler = async (req, res) => {
  const sellerId = req.seller!._id;
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Product not found");

  const body = sellerProductPatchSchema.parse(req.body);
  const current = await ProductModel.findOne({ _id: id, seller: sellerId });
  if (!current) throw new ApiError(404, "Product not found");

  const nextStatus = "approved";

  const updated = await ProductModel.findOneAndUpdate(
    { _id: id, seller: sellerId },
    {
      $set: {
        ...body,
        status: nextStatus,
        published: true,
        rejectionReason: "",
      },
    },
    { returnDocument: "after", runValidators: true },
  ).lean<ProductDoc>();

  if (!updated) throw new ApiError(404, "Product not found");

  await AuditLogModel.create({
    actor: req.user!._id,
    actorRole: "seller",
    action: "SELLER_PRODUCT_UPDATE",
    target: "Product",
    targetId: updated._id,
    details: { name: updated.name, status: nextStatus },
    ip: req.ip ?? "",
  });

  ok(res, toSellerProductView(updated));
};

export const quickStockUpdate: RequestHandler = async (req, res) => {
  const sellerId = req.seller!._id;
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Product not found");

  const { stock, availability } = sellerProductStockSchema.parse(req.body);
  const update: Record<string, unknown> = {};
  if (stock !== undefined) update.stock = stock;
  if (availability !== undefined) update.availability = availability;

  const doc = await ProductModel.findOneAndUpdate(
    { _id: id, seller: sellerId },
    { $set: update },
    { returnDocument: "after" },
  ).lean<ProductDoc>();

  if (!doc) throw new ApiError(404, "Product not found");
  ok(res, toSellerProductView(doc));
};

export const deleteSellerProduct: RequestHandler = async (req, res) => {
  const sellerId = req.seller!._id;
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Product not found");

  const doc = await ProductModel.findOneAndDelete({ _id: id, seller: sellerId });
  if (!doc) throw new ApiError(404, "Product not found");

  await AuditLogModel.create({
    actor: req.user!._id,
    actorRole: "seller",
    action: "SELLER_PRODUCT_DELETE",
    target: "Product",
    targetId: doc._id,
    details: { name: doc.name },
    ip: req.ip ?? "",
  });

  ok(res, { deleted: true, id });
};

export const uploadSellerImage: RequestHandler = async (req, res) => {
  const { image } = req.body as { image?: string };
  if (!image || typeof image !== "string") {
    throw new ApiError(400, "Image base64 string is required in request body");
  }

  const url = await saveBase64Image(image);
  ok(res, { url }, 201);
};
