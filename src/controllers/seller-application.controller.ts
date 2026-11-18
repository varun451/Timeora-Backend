import type { RequestHandler } from "express";
import { AuditLogModel } from "../models/AuditLog.js";
import { SellerModel } from "../models/Seller.js";
import { SellerApplicationModel, type SellerApplicationDoc } from "../models/SellerApplication.js";
import { encryptField } from "../services/crypto.service.js";
import { ApiError, ok } from "../utils/http.js";
import { sellerApplicationSchema } from "../validations/seller.validations.js";

const applicationView = (app: SellerApplicationDoc) => ({
  id: String(app._id),
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

export const submitApplication: RequestHandler = async (req, res) => {
  const userId = req.user!._id;

  // 1. Check if user is already an approved seller
  const existingSeller = await SellerModel.findOne({ user: userId });
  if (existingSeller) {
    throw new ApiError(409, "You are already registered as a seller on Timeora");
  }

  // 2. Check if user already has a pending application
  const pendingApp = await SellerApplicationModel.findOne({ user: userId, status: "pending" });
  if (pendingApp) {
    throw new ApiError(409, "You already have an application under review. Please wait for Super Admin approval.");
  }

  const input = sellerApplicationSchema.parse(req.body);
  const accountNumberLast4 = input.bankDetails.accountNumber.slice(-4);
  const accountNumberEncrypted = encryptField(input.bankDetails.accountNumber);

  const application = await SellerApplicationModel.create({
    user: userId,
    storeName: input.storeName,
    ownerName: input.ownerName,
    email: input.email.toLowerCase(),
    phone: input.phone,
    description: input.description,
    businessAddress: input.businessAddress,
    kyc: input.kyc,
    bankDetails: {
      accountHolderName: input.bankDetails.accountHolderName,
      accountNumberEncrypted,
      accountNumberLast4,
      ifscCode: input.bankDetails.ifscCode,
      bankName: input.bankDetails.bankName,
    },
    status: "pending",
  });

  await AuditLogModel.create({
    actor: userId,
    actorRole: "customer",
    action: "SELLER_APPLICATION_SUBMIT",
    target: "SellerApplication",
    targetId: application._id,
    details: { storeName: input.storeName },
    ip: req.ip ?? "",
  });

  ok(res, applicationView(application.toObject() as SellerApplicationDoc), 201);
};

export const getMyApplication: RequestHandler = async (req, res) => {
  const userId = req.user!._id;
  const application = await SellerApplicationModel.findOne({ user: userId })
    .sort({ createdAt: -1 })
    .lean<SellerApplicationDoc>();

  if (!application) {
    ok(res, { hasApplication: false, application: null });
    return;
  }

  ok(res, {
    hasApplication: true,
    application: applicationView(application),
  });
};

