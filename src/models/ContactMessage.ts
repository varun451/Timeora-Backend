import mongoose, { type InferSchemaType, type Types } from "mongoose";

const { Schema, model, models } = mongoose;

const schema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 120 },
    orderId: { type: String, trim: true, maxlength: 40, default: "" },
    message: { type: String, required: true, trim: true, maxlength: 3000 },
    status: { type: String, enum: ["open", "resolved"], default: "open", index: true },
  },
  { timestamps: true },
);

export type ContactMessageDoc = InferSchemaType<typeof schema> & { _id: Types.ObjectId };
export const ContactMessageModel = models.ContactMessage ?? model("ContactMessage", schema);
