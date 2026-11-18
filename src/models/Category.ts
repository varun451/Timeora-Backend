import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

const schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: String,
    image: String,
    status: { type: String, enum: ["active", "hidden"], default: "active" },
  },
  { timestamps: true },
);
export const CategoryModel = models.Category ?? model("Category", schema);
