import mongoose, { type InferSchemaType, type Types } from "mongoose";
const { Schema, model, models } = mongoose;

const schema = new Schema(
  {
    seller: { type: Schema.Types.ObjectId, ref: "Seller", index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, default: "" },
    brand: { type: String, required: true, index: true },
    brandId: { type: Schema.Types.ObjectId, ref: "Brand" },
    category: { type: String, required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category" },
    gender: { type: String, enum: ["men", "women"], default: "men", index: true },
    price: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, min: 0, max: 90, default: 0 },
    images: { type: [String], default: [] },
    specs: {
      caseMaterial: String,
      strapMaterial: String,
      dialColor: String,
      movement: String,
      waterResistance: String,
      warranty: String,
    },
    stock: { type: Number, min: 0, default: 0 },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    reviewCount: { type: Number, min: 0, default: 0 },
    sold: { type: Number, min: 0, default: 0 },
    published: { type: Boolean, default: true, index: true },
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "approved",
      index: true,
    },
    rejectionReason: { type: String, default: "" },
    availability: { type: String, enum: ["active", "hidden"], default: "active", index: true },
    sellerActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    featuredOrder: { type: Number, default: 0 },
    sku: { type: String, trim: true },
    look: { dial: String, case: String, strap: String },
  },
  { timestamps: true },
);

schema.index({ published: 1, status: 1, sellerActive: 1, availability: 1, createdAt: -1 });
schema.index({ published: 1, price: 1 });
schema.index({ seller: 1, status: 1 });

export type ProductDoc = InferSchemaType<typeof schema> & { _id: Types.ObjectId; createdAt: Date };
export const ProductModel = models.Product ?? model("Product", schema);
