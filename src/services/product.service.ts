import type { QueryFilter } from "mongoose";
import { ProductModel, type ProductDoc } from "../models/Product.js";
import { productQuerySchema, type ProductQuery } from "../validations/index.js";

const DAY = 864e5;
const FALLBACK = { dial: "#1f2022", case: "#b9b9b4", strap: "#111111" };

/** Shape sent to the frontend (matches frontend/src/types/product.ts). */
export function toProduct(d: ProductDoc) {
  return {
    id: String(d._id), slug: d.slug, name: d.name, brand: d.brand, category: d.category,
    gender: d.gender as "men" | "women", price: d.price, discountPercent: d.discountPercent ?? 0,
    rating: d.rating ?? 0, reviewCount: d.reviewCount ?? 0, stock: d.stock ?? 0,
    isNew: Date.now() - new Date(d.createdAt).getTime() < 30 * DAY, isBestSeller: (d.sold ?? 0) >= 5,
    look: { dial: d.look?.dial ?? FALLBACK.dial, case: d.look?.case ?? FALLBACK.case, strap: d.look?.strap ?? FALLBACK.strap },
    description: d.description ?? "", images: d.images ?? [],
    specs: {
      caseMaterial: d.specs?.caseMaterial ?? undefined, strapMaterial: d.specs?.strapMaterial ?? undefined,
      dialColor: d.specs?.dialColor ?? undefined, movement: d.specs?.movement ?? undefined,
      waterResistance: d.specs?.waterResistance ?? undefined, warranty: d.specs?.warranty ?? undefined,
    },
  };
}
export type ProductDTO = ReturnType<typeof toProduct>;

/** Turns raw URL params into a validated query. Empty values are ignored; invalid input falls back to defaults. */
export function parseQuery(raw: Record<string, unknown>): ProductQuery {
  const clean = Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "string" && v !== ""));
  const r = productQuerySchema.safeParse(clean);
  return r.success ? r.data : productQuerySchema.parse({});
}

const SORTS = { newest: { createdAt: -1 }, price_asc: { price: 1 }, price_desc: { price: -1 }, popular: { sold: -1, createdAt: -1 } } as const;

export async function queryProducts(q: ProductQuery, opts: { includeUnpublished?: boolean } = {}) {
  const f: QueryFilter<ProductDoc> = opts.includeUnpublished
    ? {}
    : { published: true, status: "approved", sellerActive: { $ne: false }, availability: { $ne: "hidden" } };
  if (q.category) f.category = q.category;
  if (q.brand) f.brand = q.brand;
  if (q.gender) f.gender = q.gender;
  if (q.inStock) f.stock = { $gt: 0 };
  if (q.minPrice !== undefined || q.maxPrice !== undefined) f.price = { ...(q.minPrice !== undefined && { $gte: q.minPrice }), ...(q.maxPrice !== undefined && { $lte: q.maxPrice }) };
  if (q.q) {
    const re = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    f.$or = [{ name: re }, { brand: re }, { category: re }];
  }
  const [docs, total] = await Promise.all([
    ProductModel.find(f).sort(SORTS[q.sort]).skip((q.page - 1) * q.limit).limit(q.limit).lean<ProductDoc[]>(),
    ProductModel.countDocuments(f),
  ]);
  return { items: docs.map(toProduct), total, page: q.page, pages: Math.max(1, Math.ceil(total / q.limit)) };
}

export async function getRelated(p: { slug: string; category: string; gender: string }, limit = 4) {
  const docs = await ProductModel.find({ published: true, slug: { $ne: p.slug }, $or: [{ category: p.category }, { gender: p.gender }] }).limit(limit).lean<ProductDoc[]>();
  return docs.map(toProduct);
}

export async function getFilterOptions() {
  const [categories, brands] = await Promise.all([ProductModel.distinct("category", { published: true }), ProductModel.distinct("brand", { published: true })]);
  return { categories: categories as string[], brands: brands as string[] };
}
