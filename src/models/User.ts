import mongoose, { type Types } from "mongoose";
const { Schema, model, models } = mongoose;

export type UserRole = "customer" | "seller" | "super_admin" | "admin";
export type UserStatus = "active" | "blocked";

const schema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["customer", "seller", "super_admin", "admin"],
      default: "customer",
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
      index: true,
    },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
    addresses: [
      {
        label: String,
        line1: String,
        line2: String,
        city: String,
        state: String,
        pincode: String,
        phone: String,
      },
    ],
    wishlist: [{ type: Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true },
);

export interface UserDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  tokenVersion?: number;
  lastLoginAt?: Date;
  addresses?: Array<{
    label?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    phone?: string;
  }>;
  wishlist?: Types.ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}

export const UserModel = models.User ?? model("User", schema);
