import type { RequestHandler } from "express";
import { z } from "zod";
import { AuditLogModel } from "../../models/AuditLog.js";
import { SellerModel, type SellerDoc } from "../../models/Seller.js";
import { UserModel } from "../../models/User.js";
import { ApiError, ok } from "../../utils/http.js";

const profileSchema = z.object({
  ownerName: z.string().trim().min(2, "Vendor name must be at least 2 characters").max(100),
  email: z.email("Enter a valid email address").max(120),
  phone: z.string().trim().regex(/^\+?[\d\s-]{10,15}$/, "Enter a valid phone number"),
  storeName: z.string().trim().min(2, "Shop name must be at least 2 characters").max(100),
  businessAddress: z.object({
    line1: z.string().trim().min(3, "Address is required").max(120),
    line2: z.string().trim().max(120).optional().default(""),
    city: z.string().trim().max(60).optional().default(""),
    state: z.string().trim().max(60).optional().default(""),
    pincode: z.string().trim().max(10).optional().default(""),
  }),
});

const profileView = (seller: SellerDoc) => ({
  id: String(seller._id),
  ownerName: seller.ownerName,
  email: seller.email,
  phone: seller.phone,
  storeName: seller.storeName,
  businessAddress: {
    line1: seller.businessAddress?.line1 ?? "",
    line2: seller.businessAddress?.line2 ?? "",
    city: seller.businessAddress?.city ?? "",
    state: seller.businessAddress?.state ?? "",
    pincode: seller.businessAddress?.pincode ?? "",
  },
  status: seller.status,
  memberSince: seller.approvedAt ?? seller.createdAt,
});

export const getSellerProfile: RequestHandler = (req, res) => {
  ok(res, profileView(req.seller!));
};

export const updateSellerProfile: RequestHandler = async (req, res) => {
  const body = profileSchema.parse(req.body);
  const seller = req.seller!;
  const updated = await SellerModel.findByIdAndUpdate(
    seller._id,
    {
      $set: {
        ownerName: body.ownerName,
        email: body.email.toLowerCase(),
        phone: body.phone,
        storeName: body.storeName,
        businessAddress: body.businessAddress,
      },
    },
    { returnDocument: "after", runValidators: true },
  ).lean<SellerDoc>();

  if (!updated) throw new ApiError(404, "Seller profile not found");

  await UserModel.findByIdAndUpdate(
    req.user!._id,
    { $set: { name: body.ownerName, phone: body.phone } },
    { runValidators: true },
  );
  await AuditLogModel.create({
    actor: req.user!._id,
    actorRole: req.user!.role,
    action: "SELLER_PROFILE_UPDATE",
    target: "Seller",
    targetId: seller._id,
    details: { storeName: body.storeName },
    ip: req.ip ?? "",
  });

  ok(res, profileView(updated));
};
