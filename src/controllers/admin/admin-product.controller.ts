import type { RequestHandler } from "express";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import { AuditLogModel } from "../../models/AuditLog.js";
import { ProductModel, type ProductDoc } from "../../models/Product.js";
import { SellerModel } from "../../models/Seller.js";
import { toProduct } from "../../services/product.service.js";
import { saveBase64Image } from "../../services/upload.service.js";
import { ApiError, ok } from "../../utils/http.js";
import { slugify } from "../../utils/slugify.js";
import { sellerProductInputSchema } from "../../validations/seller.validations.js";

const productRejectionSchema = z.object({
  reason: z.string().trim().min(5, "Rejection reason must be at least 5 characters").max(500),
});

const createAdminProductSchema = sellerProductInputSchema.extend({
  sellerId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), "Select a valid vendor").optional(),
});

const updateAdminProductSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  brand: z.string().trim().min(1).max(60).optional(),
  gender: z.enum(["men", "women"]).optional(),
  sku: z.string().trim().max(40).optional(),
  price: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  availability: z.enum(["active", "hidden"]).optional(),
});

export const getAdminProductSummary: RequestHandler = async (_req, res) => {
  const [total, active, outOfStock, inactive] = await Promise.all([
    ProductModel.countDocuments({}),
    ProductModel.countDocuments({
      published: true,
      status: "approved",
      availability: "active",
      sellerActive: { $ne: false },
      stock: { $gt: 0 },
    }),
    ProductModel.countDocuments({
      published: true,
      status: "approved",
      availability: "active",
      sellerActive: { $ne: false },
      stock: { $lte: 0 },
    }),
    ProductModel.countDocuments({
      $or: [
        { published: false },
        { status: { $ne: "approved" } },
        { availability: { $ne: "active" } },
        { sellerActive: false },
      ],
    }),
  ]);
  ok(res, { total, active, outOfStock, inactive });
};

export const listAllAdminProducts: RequestHandler = async (req, res) => {
  const status = req.query.status as string | undefined;
  const sellerId = req.query.seller as string | undefined;
  const q = req.query.q as string | undefined;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const filter: Record<string, unknown> = {};
  if (status === "active") {
    filter.published = true;
    filter.status = "approved";
    filter.availability = "active";
    filter.sellerActive = { $ne: false };
    filter.stock = { $gt: 0 };
  } else if (status === "out_of_stock") {
    filter.published = true;
    filter.status = "approved";
    filter.availability = "active";
    filter.sellerActive = { $ne: false };
    filter.stock = { $lte: 0 };
  } else if (status === "inactive") {
    filter.$or = [
      { published: false },
      { status: { $ne: "approved" } },
      { availability: { $ne: "active" } },
      { sellerActive: false },
    ];
  } else if (status === "men" || status === "women") {
    filter.gender = status;
  } else if (status && ["draft", "pending", "approved", "rejected"].includes(status)) {
    filter.status = status;
  }
  if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
    filter.seller = sellerId;
  }
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$and = [
      ...(Array.isArray(filter.$or) ? [{ $or: filter.$or }] : []),
      { $or: [{ name: re }, { brand: re }, { category: re }, { sku: re }] },
    ];
    delete filter.$or;
  }

  const [docs, total] = await Promise.all([
    ProductModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("seller", "storeName ownerName email slug")
      .lean(),
    ProductModel.countDocuments(filter),
  ]);

  ok(res, {
    items: docs.map((d: any) => ({
      ...toProduct(d),
      sku: d.sku ?? "",
      seller: d.seller
        ? {
            id: String(d.seller._id),
            storeName: d.seller.storeName,
            ownerName: d.seller.ownerName,
            slug: d.seller.slug,
          }
        : null,
      status: d.status ?? "approved",
      availability: d.availability ?? "active",
      sellerActive: d.sellerActive !== false,
      published: d.published !== false,
      isFeatured: Boolean(d.isFeatured),
      rejectionReason: d.rejectionReason ?? "",
      createdAt: d.createdAt,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
};

export const createAdminProduct: RequestHandler = async (req, res) => {
  const { sellerId, ...body } = createAdminProductSchema.parse(req.body);
  const seller = sellerId
    ? await SellerModel.findById(sellerId)
    : await SellerModel.findOne({ slug: "timeora", status: "active" });
  if (!seller) throw new ApiError(400, "The Timeora Official vendor is not configured. Configure the house vendor before adding products.");
  const baseSlug = slugify(body.name);
  const slug = `${baseSlug}-${randomBytes(3).toString("hex")}`;
  const product = await ProductModel.create({
    ...body,
    brand: body.brand || "Timeora",
    slug,
    seller: seller._id,
    sellerActive: seller.status === "active",
    status: "approved",
    published: true,
  });

  await AuditLogModel.create({
    actor: req.user!._id,
    actorRole: req.user!.role,
    action: "ADMIN_PRODUCT_CREATE",
    target: "Product",
    targetId: product._id,
    details: { name: product.name, sellerId: String(seller._id) },
    ip: req.ip ?? "",
  });

  ok(res, { ...toProduct(product.toObject() as ProductDoc), sku: product.sku ?? "" }, 201);
};

export const uploadAdminProductImage: RequestHandler = async (req, res) => {
  const { image } = req.body as { image?: string };
  if (!image || typeof image !== "string") {
    throw new ApiError(400, "Image base64 string is required in request body");
  }
  const url = await saveBase64Image(image);
  ok(res, { url }, 201);
};

export const updateAdminProduct: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Product not found");
  const body = updateAdminProductSchema.parse(req.body);
  const product = await ProductModel.findByIdAndUpdate(
    id,
    { $set: body },
    { returnDocument: "after", runValidators: true },
  ).lean<ProductDoc>();
  if (!product) throw new ApiError(404, "Product not found");

  await AuditLogModel.create({
    actor: req.user!._id,
    actorRole: req.user!.role,
    action: "ADMIN_PRODUCT_UPDATE",
    target: "Product",
    targetId: product._id,
    details: { name: product.name, fields: Object.keys(body) },
    ip: req.ip ?? "",
  });

  ok(res, { ...toProduct(product), sku: product.sku ?? "" });
};

export const deleteAdminProduct: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Product not found");
  const product = await ProductModel.findByIdAndDelete(id);
  if (!product) throw new ApiError(404, "Product not found");

  await AuditLogModel.create({
    actor: req.user!._id,
    actorRole: req.user!.role,
    action: "ADMIN_PRODUCT_DELETE",
    target: "Product",
    targetId: product._id,
    details: { name: product.name },
    ip: req.ip ?? "",
  });

  ok(res, { deleted: true, id });
};

export const approveProduct: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Product not found");

  const product = await ProductModel.findByIdAndUpdate(
    id,
    { $set: { status: "approved", rejectionReason: "" } },
    { returnDocument: "after" },
  ).lean<ProductDoc>();

  if (!product) throw new ApiError(404, "Product not found");

  await AuditLogModel.create({
    actor: req.user!._id,
    actorRole: "super_admin",
    action: "PRODUCT_APPROVE",
    target: "Product",
    targetId: product._id,
    details: { name: product.name },
    ip: req.ip ?? "",
  });

  ok(res, { approved: true, product: toProduct(product) });
};

export const rejectProduct: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Product not found");

  const { reason } = productRejectionSchema.parse(req.body);
  const product = await ProductModel.findByIdAndUpdate(
    id,
    { $set: { status: "rejected", rejectionReason: reason } },
    { returnDocument: "after" },
  ).lean<ProductDoc>();

  if (!product) throw new ApiError(404, "Product not found");

  await AuditLogModel.create({
    actor: req.user!._id,
    actorRole: "super_admin",
    action: "PRODUCT_REJECT",
    target: "Product",
    targetId: product._id,
    details: { name: product.name, reason },
    ip: req.ip ?? "",
  });

  ok(res, { rejected: true, product: toProduct(product) });
};

export const toggleFeatureProduct: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Product not found");

  const current = await ProductModel.findById(id);
  if (!current) throw new ApiError(404, "Product not found");

  current.isFeatured = !current.isFeatured;
  await current.save();

  ok(res, { isFeatured: current.isFeatured });
};
