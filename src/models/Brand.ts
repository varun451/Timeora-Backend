import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

const schema = new Schema(
  { name: { type: String, required: true, trim: true }, slug: { type: String, required: true, unique: true }, description: String, logo: String },
  { timestamps: true },
);
export const BrandModel = models.Brand ?? model("Brand", schema);
