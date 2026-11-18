import mongoose, { type InferSchemaType, type Types } from "mongoose";

const { Schema, model, models } = mongoose;

const schema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
    status: { type: String, enum: ["subscribed", "unsubscribed"], default: "subscribed", index: true },
  },
  { timestamps: true },
);

export type NewsletterSubscriberDoc = InferSchemaType<typeof schema> & { _id: Types.ObjectId };
export const NewsletterSubscriberModel = models.NewsletterSubscriber ?? model("NewsletterSubscriber", schema);
