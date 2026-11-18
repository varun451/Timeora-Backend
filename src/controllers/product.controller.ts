import type { RequestHandler } from "express";
import mongoose from "mongoose";
import { ProductModel, type ProductDoc } from "../models/Product.js";
import { getFilterOptions, getRelated, parseQuery, queryProducts, toProduct } from "../services/product.service.js";
import { ApiError, ok } from "../utils/http.js";
import { slugify } from "../utils/slugify.js";
import { productInputSchema, productPatchSchema } from "../validations/index.js";

const byIdOrSlug = (id: string) => (mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { slug: id });
const idParam = (v: string | string[] | undefined) => String(v);

async function findPublished(idOrSlug: string) {
  const d = await ProductModel.findOne({
    ...byIdOrSlug(idOrSlug),
    published: true,
    status: "approved",
    sellerActive: { $ne: false },
    availability: { $ne: "hidden" },
  }).lean<ProductDoc>();
  if (!d) throw new ApiError(404, "Product not found");
  return d;
}

export const listProducts: RequestHandler = async (req, res) => {
  ok(res, await queryProducts(parseQuery(req.query)));
};

export const productFilters: RequestHandler = async (_req, res) => {
  ok(res, await getFilterOptions());
};

export const getProduct: RequestHandler = async (req, res) => {
  ok(res, toProduct(await findPublished(idParam(req.params.id))));
};

export const relatedProducts: RequestHandler = async (req, res) => {
  const p = await findPublished(idParam(req.params.id));
  const limit = Math.min(Math.max(Number(req.query.limit) || 4, 1), 12);
  ok(res, await getRelated(p, limit));
};

export const createProduct: RequestHandler = async (req, res) => {
  const body = productInputSchema.parse(req.body);
  const doc = await ProductModel.create({ ...body, slug: slugify(body.name) });
  ok(res, toProduct(doc.toObject() as ProductDoc), 201);
};

export const updateProduct: RequestHandler = async (req, res) => {
  const id = idParam(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid product id");
  const body = productPatchSchema.parse(req.body);
  const d = await ProductModel.findByIdAndUpdate(id, { ...body, ...(body.name && { slug: slugify(body.name) }) }, { new: true, runValidators: true }).lean<ProductDoc>();
  if (!d) throw new ApiError(404, "Product not found");
  ok(res, toProduct(d));
};

export const deleteProduct: RequestHandler = async (req, res) => {
  const id = idParam(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid product id");
  const d = await ProductModel.findByIdAndDelete(id);
  if (!d) throw new ApiError(404, "Product not found");
  ok(res, { deleted: true });
};
