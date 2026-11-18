import type { RequestHandler } from "express";
import { getSessionUser, requireRole, requireAdmin, requireSuperAdmin } from "./auth.js";
import { SellerModel, type SellerDoc } from "../models/Seller.js";
import { ApiError } from "../utils/http.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      seller?: SellerDoc;
    }
  }
}

export { requireRole, requireAdmin, requireSuperAdmin };

/**
 * Middleware ensuring the authenticated user is an approved, active Seller.
 * Attaches both req.user and req.seller.
 */
export const requireSeller: RequestHandler = async (req, _res, next) => {
  const u = await getSessionUser(req);
  if (!u) throw new ApiError(401, "Please log in");

  const effectiveRole = u.role === "admin" ? "super_admin" : u.role;
  if (effectiveRole !== "seller" && effectiveRole !== "super_admin") {
    throw new ApiError(403, "Seller access required");
  }

  const seller = await SellerModel.findOne({ user: u._id }).lean<SellerDoc>();
  if (!seller) {
    throw new ApiError(403, "Seller profile not found. Please apply first.");
  }

  if (seller.status !== "active") {
    throw new ApiError(403, "Your seller account is currently suspended or inactive.");
  }

  req.user = u;
  req.seller = seller;
  next();
};

