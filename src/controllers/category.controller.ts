import type { RequestHandler } from "express";
import { CategoryModel } from "../models/Category.js";
import { ok } from "../utils/http.js";
import { slugify } from "../utils/slugify.js";
import { categoryInputSchema } from "../validations/index.js";

export const listCategories: RequestHandler = async (_req, res) => {
  ok(res, await CategoryModel.find({ status: "active" }).sort({ name: 1 }).lean());
};

export const createCategory: RequestHandler = async (req, res) => {
  const b = categoryInputSchema.parse(req.body);
  ok(res, await CategoryModel.create({ ...b, slug: slugify(b.name) }), 201);
};
