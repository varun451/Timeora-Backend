import mongoose, { type Types } from "mongoose";
const { Schema, model, models } = mongoose;

export type ApplicationStatus = "pending" | "approved" | "rejected";

const schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    storeName: { type: String, required: true, trim: true, maxlength: 100 },
    ownerName: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
    businessAddress: {
      line1: { type: String, required: true, trim: true },
      line2: { type: String, default: "", trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
    },
    kyc: {
      pan: { type: String, required: true, uppercase: true, trim: true },
      gstin: { type: String, default: "", uppercase: true, trim: true },
    },
    bankDetails: {
      accountHolderName: { type: String, required: true, trim: true },
      accountNumberEncrypted: { type: String, required: true },
      accountNumberLast4: { type: String, required: true },
      ifscCode: { type: String, required: true, uppercase: true, trim: true },
      bankName: { type: String, required: true, trim: true },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    rejectionReason: { type: String, default: "" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

schema.index({ user: 1, status: 1 });

export interface SellerApplicationDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  storeName: string;
  ownerName: string;
  email: string;
  phone: string;
  description?: string;
  businessAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  kyc: {
    pan: string;
    gstin?: string;
  };
  bankDetails: {
    accountHolderName: string;
    accountNumberEncrypted: string;
    accountNumberLast4: string;
    ifscCode: string;
    bankName: string;
  };
  status: ApplicationStatus;
  rejectionReason?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const SellerApplicationModel =
  models.SellerApplication ?? model("SellerApplication", schema);

