import mongoose, { type Types } from "mongoose";
const { Schema, model, models } = mongoose;

export type SellerStatus = "active" | "suspended";

const schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    storeName: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "" },
    ownerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    businessAddress: {
      line1: { type: String, default: "" },
      line2: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
    },
    kyc: {
      pan: { type: String, default: "" },
      gstin: { type: String, default: "" },
      verified: { type: Boolean, default: false },
    },
    bankDetails: {
      accountHolderName: { type: String, default: "" },
      accountNumberEncrypted: { type: String, default: "" },
      accountNumberLast4: { type: String, default: "" },
      ifscCode: { type: String, default: "" },
      bankName: { type: String, default: "" },
    },
    commissionBps: { type: Number, min: 0, max: 5000 },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      index: true,
    },
    suspensionReason: { type: String, default: "" },
    approvedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export interface SellerDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  storeName: string;
  slug: string;
  description?: string;
  ownerName: string;
  email: string;
  phone: string;
  businessAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  kyc?: {
    pan?: string;
    gstin?: string;
    verified?: boolean;
  };
  bankDetails?: {
    accountHolderName?: string;
    accountNumberEncrypted?: string;
    accountNumberLast4?: string;
    ifscCode?: string;
    bankName?: string;
  };
  commissionBps?: number;
  status: SellerStatus;
  suspensionReason?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const SellerModel = models.Seller ?? model("Seller", schema);

