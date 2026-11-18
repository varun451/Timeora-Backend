import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

const schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: [{ product: { type: Schema.Types.ObjectId, ref: "Product" }, name: String, images: { type: [String], default: [] }, unitPrice: Number, quantity: Number }],
    shippingAddress: { name: String, line1: String, line2: String, city: String, state: String, pincode: String, phone: String },
    subtotal: Number, discount: { type: Number, default: 0 }, shippingFee: { type: Number, default: 0 }, total: Number,
    paymentMethod: { type: String, enum: ["razorpay", "cod"] },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    status: { type: String, enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"], default: "pending", index: true },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: String,
    paymentExpiresAt: Date,
  },
  { timestamps: true },
);
export const OrderModel = models.Order ?? model("Order", schema);
