import mongoose, { type Types } from "mongoose";
const { Schema, model, models } = mongoose;

const schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: "0s" } },
    usedAt: { type: Date },
  },
  { timestamps: true },
);

export interface PasswordResetTokenDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
}

export const PasswordResetTokenModel =
  models.PasswordResetToken ?? model("PasswordResetToken", schema);

