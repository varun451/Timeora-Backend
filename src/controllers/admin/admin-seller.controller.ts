import type { RequestHandler } from "express";
import mongoose from "mongoose";
import { AuditLogModel } from "../../models/AuditLog.js";
import { ProductModel } from "../../models/Product.js";
import { SellerModel, type SellerDoc } from "../../models/Seller.js";
import { SellerApplicationModel, type SellerApplicationDoc } from "../../models/SellerApplication.js";
import { UserModel } from "../../models/User.js";
import { ApiError, ok } from "../../utils/http.js";
import { slugify } from "../../utils/slugify.js";
import {
  applicationRejectionSchema,
  sellerCommissionSchema,
  sellerSuspensionSchema,
} from "../../validations/seller.validations.js";

const applicationView = (app: SellerApplicationDoc) => ({
  id: String(app._id),
  userId: String(app.user),
  storeName: app.storeName,
  ownerName: app.ownerName,
  email: app.email,
  phone: app.phone,
  description: app.description ?? "",
  businessAddress: app.businessAddress,
  kyc: {
    pan: app.kyc.pan,
    gstin: app.kyc.gstin ?? "",
  },
  bankDetails: {
    accountHolderName: app.bankDetails.accountHolderName,
    accountNumberLast4: app.bankDetails.accountNumberLast4,
    ifscCode: app.bankDetails.ifscCode,
    bankName: app.bankDetails.bankName,
  },
  status: app.status,
  rejectionReason: app.rejectionReason ?? "",
  createdAt: app.createdAt,
  reviewedAt: app.reviewedAt,
});

const sellerView = (s: SellerDoc, productCount = 0) => ({
  id: String(s._id),
  userId: String(s.user),
  storeName: s.storeName,
  slug: s.slug,
  ownerName: s.ownerName,
  email: s.email,
  phone: s.phone,
  description: s.description ?? "",
  businessAddress: s.businessAddress,
  kyc: {
    pan: s.kyc?.pan ?? "",
    gstin: s.kyc?.gstin ?? "",
    verified: s.kyc?.verified ?? false,
  },
  bankDetails: {
    accountHolderName: s.bankDetails?.accountHolderName ?? "",
    accountNumberLast4: s.bankDetails?.accountNumberLast4 ?? "",
    ifscCode: s.bankDetails?.ifscCode ?? "",
    bankName: s.bankDetails?.bankName ?? "",
  },
  status: s.status,
  commissionBps: s.commissionBps,
  suspensionReason: s.suspensionReason ?? "",
  approvedAt: s.approvedAt,
  productCount,
  createdAt: s.createdAt,
});

export const listApplications: RequestHandler = async (req, res) => {
  const status = req.query.status as string | undefined;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const filter: Record<string, unknown> = {};
  if (status && ["pending", "approved", "rejected"].includes(status)) {
    filter.status = status;
  }

  const [apps, total] = await Promise.all([
    SellerApplicationModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<SellerApplicationDoc[]>(),
    SellerApplicationModel.countDocuments(filter),
  ]);

  ok(res, {
    items: apps.map(applicationView),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
};

export const getApplication: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Application not found");

  const app = await SellerApplicationModel.findById(id).lean<SellerApplicationDoc>();
  if (!app) throw new ApiError(404, "Application not found");

  ok(res, applicationView(app));
};

export const approveApplication: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Application not found");

  const application = await SellerApplicationModel.findById(id);
  if (!application) throw new ApiError(404, "Application not found");

  if (application.status !== "pending") {
    throw new ApiError(409, `This application has already been ${application.status}`);
  }

  // Create unique store slug
  let storeSlug = slugify(application.storeName);
  const slugExists = await SellerModel.findOne({ slug: storeSlug });
  if (slugExists) {
    storeSlug = `${storeSlug}-${Math.random().toString(16).substring(2, 6)}`;
  }

  // Upsert or create Seller profile
  const seller = await SellerModel.findOneAndUpdate(
    { user: application.user },
    {
      $set: {
        storeName: application.storeName,
        slug: storeSlug,
        ownerName: application.ownerName,
        email: application.email,
        phone: application.phone,
        description: application.description,
        businessAddress: application.businessAddress,
        kyc: {
          pan: application.kyc.pan,
          gstin: application.kyc.gstin ?? "",
          verified: true,
        },
        bankDetails: application.bankDetails,
        status: "active",
        approvedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after", runValidators: true },
  );

  // Upgrade User role to seller
  await UserModel.findByIdAndUpdate(application.user, { $set: { role: "seller" } });

  // Mark application approved
  application.status = "approved";
  application.reviewedBy = req.user!._id;
  application.reviewedAt = new Date();
  await application.save();

  await AuditLogModel.create({
    actor: req.user!._id,
    actorRole: "super_admin",
    action: "SELLER_APPLICATION_APPROVE",
    target: "Seller",
    targetId: seller._id,
    details: { storeName: seller.storeName, userId: application.user },
    ip: req.ip ?? "",
  });

  ok(res, { approved: true, seller: sellerView(seller.toObject() as SellerDoc) });
};

export const rejectApplication: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Application not found");

  const { reason } = applicationRejectionSchema.parse(req.body);
  const application = await SellerApplicationModel.findById(id);
  if (!application) throw new ApiError(404, "Application not found");

  if (application.status !== "pending") {
    throw new ApiError(409, `This application has already been ${application.status}`);
  }

  application.status = "rejected";
  application.rejectionReason = reason;
  application.reviewedBy = req.user!._id;
  application.reviewedAt = new Date();
  await application.save();

  await AuditLogModel.create({
    actor: req.user!._id,
    actorRole: "super_admin",
    action: "SELLER_APPLICATION_REJECT",
    target: "SellerApplication",
    targetId: application._id,
    details: { reason, userId: application.user },
    ip: req.ip ?? "",
  });

  ok(res, { rejected: true });
};

export const listSellers: RequestHandler = async (req, res) => {
  const status = req.query.status as string | undefined;
  const search = (req.query.q as string | undefined)?.trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const filter: Record<string, unknown> = {};
  if (status && ["active", "suspended"].includes(status)) {
    filter.status = status;
  }
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { storeName: { $regex: escapedSearch, $options: "i" } },
      { ownerName: { $regex: escapedSearch, $options: "i" } },
      { email: { $regex: escapedSearch, $options: "i" } },
      { slug: { $regex: escapedSearch, $options: "i" } },
      { phone: { $regex: escapedSearch, $options: "i" } },
    ];
  }

  const [sellers, total] = await Promise.all([
    SellerModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<SellerDoc[]>(),
    SellerModel.countDocuments(filter),
  ]);

  // Aggregate product counts
  const sellerIds = sellers.map((s) => s._id);
  const counts = await ProductModel.aggregate([
    { $match: { seller: { $in: sellerIds } } },
    { $group: { _id: "$seller", count: { $sum: 1 } } },
  ]);
  const countsMap = new Map(counts.map((c) => [String(c._id), c.count as number]));

  ok(res, {
    items: sellers.map((s) => sellerView(s, countsMap.get(String(s._id)) ?? 0)),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
};

export const getSeller: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Seller not found");

  const seller = await SellerModel.findById(id).lean<SellerDoc>();
  if (!seller) throw new ApiError(404, "Seller not found");

  const productCount = await ProductModel.countDocuments({ seller: seller._id });
  ok(res, sellerView(seller, productCount));
};

export const suspendSeller: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Seller not found");

  const { reason } = sellerSuspensionSchema.parse(req.body);
  const seller = await SellerModel.findByIdAndUpdate(
    id,
    { $set: { status: "suspended", suspensionReason: reason } },
    { returnDocument: "after" },
  ).lean<SellerDoc>();

  if (!seller) throw new ApiError(404, "Seller not found");

  // Cascade: mark products of this seller as sellerActive: false
  await ProductModel.updateMany({ seller: seller._id }, { $set: { sellerActive: false } });

  await AuditLogModel.create({
    actor: req.user!._id,
    actorRole: "super_admin",
    action: "SELLER_SUSPEND",
    target: "Seller",
    targetId: seller._id,
    details: { reason },
    ip: req.ip ?? "",
  });

  ok(res, { suspended: true, seller: sellerView(seller) });
};

export const activateSeller: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Seller not found");

  const seller = await SellerModel.findByIdAndUpdate(
    id,
    { $set: { status: "active", suspensionReason: "" } },
    { returnDocument: "after" },
  ).lean<SellerDoc>();

  if (!seller) throw new ApiError(404, "Seller not found");

  // Restore sellerActive on products
  await ProductModel.updateMany({ seller: seller._id }, { $set: { sellerActive: true } });

  await AuditLogModel.create({
    actor: req.user!._id,
    actorRole: "super_admin",
    action: "SELLER_ACTIVATE",
    target: "Seller",
    targetId: seller._id,
    ip: req.ip ?? "",
  });

  ok(res, { activated: true, seller: sellerView(seller) });
};

export const updateSellerCommission: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Seller not found");

  const { commissionBps } = sellerCommissionSchema.parse(req.body);
  const seller = await SellerModel.findByIdAndUpdate(
    id,
    { $set: { commissionBps } },
    { returnDocument: "after" },
  ).lean<SellerDoc>();

  if (!seller) throw new ApiError(404, "Seller not found");

  await AuditLogModel.create({
    actor: req.user!._id,
    actorRole: "super_admin",
    action: "SELLER_COMMISSION_UPDATE",
    target: "Seller",
    targetId: seller._id,
    details: { commissionBps },
    ip: req.ip ?? "",
  });

  ok(res, { commissionBps: seller.commissionBps });
};
