import type { RequestHandler } from "express";
import mongoose from "mongoose";
import { ProductModel, type ProductDoc } from "../models/Product.js";
import { UserModel } from "../models/User.js";
import { toProduct } from "../services/product.service.js";
import { ApiError, ok } from "../utils/http.js";

export const listWishlist: RequestHandler = async (req, res) => {
  const user = await UserModel.findById(req.user!._id).select("wishlist").lean<{ wishlist: mongoose.Types.ObjectId[] }>();
  if (!user) throw new ApiError(404, "Account not found");
  const products = await ProductModel.find({ _id: { $in: user.wishlist }, published: true }).lean<ProductDoc[]>();
  const byId = new Map(products.map((product) => [String(product._id), product]));
  ok(res, user.wishlist.flatMap((id) => {
    const product = byId.get(String(id));
    return product ? [toProduct(product)] : [];
  }));
};

export const addWishlistItem: RequestHandler = async (req, res) => {
  const productId = String(req.params.productId);
  if (!mongoose.Types.ObjectId.isValid(productId)) throw new ApiError(404, "Product not found");
  const product = await ProductModel.findOne({ _id: productId, published: true }).lean<ProductDoc>();
  if (!product) throw new ApiError(404, "Product not found");
  await UserModel.updateOne({ _id: req.user!._id }, { $addToSet: { wishlist: product._id } });
  ok(res, toProduct(product), 201);
};

export const removeWishlistItem: RequestHandler = async (req, res) => {
  const productId = String(req.params.productId);
  if (!mongoose.Types.ObjectId.isValid(productId)) throw new ApiError(404, "Product not found");
  await UserModel.updateOne({ _id: req.user!._id }, { $pull: { wishlist: new mongoose.Types.ObjectId(productId) } });
  ok(res, { removed: true });
};
