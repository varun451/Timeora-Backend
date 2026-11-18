import type { RequestHandler } from "express";
import mongoose from "mongoose";
import { OrderModel } from "../models/Order.js";
import { captureRazorpayPayment, fetchRazorpayPayment, getRazorpayCheckoutConfig, verifyRazorpaySignature } from "../services/razorpay.service.js";
import { ApiError, ok } from "../utils/http.js";
import { razorpayVerifySchema } from "../validations/index.js";
import { orderView } from "./order.controller.js";

export const paymentConfig: RequestHandler = (_req, res) => {
  ok(res, getRazorpayCheckoutConfig());
};

export const verifyRazorpayPayment: RequestHandler = async (req, res) => {
  const input = razorpayVerifySchema.parse(req.body);
  if (!verifyRazorpaySignature(input.razorpay_order_id, input.razorpay_payment_id, input.razorpay_signature)) {
    throw new ApiError(400, "Payment signature verification failed");
  }

  if (!mongoose.Types.ObjectId.isValid(input.orderId)) throw new ApiError(404, "Order not found");
  const order = await OrderModel.findOne({ _id: input.orderId, user: req.user!._id });
  if (!order) throw new ApiError(404, "Order not found");
  if (order.paymentMethod !== "razorpay" || order.razorpayOrderId !== input.razorpay_order_id) {
    throw new ApiError(409, "Payment does not match this order");
  }
  if (order.paymentStatus === "paid" && order.razorpayPaymentId === input.razorpay_payment_id) {
    ok(res, orderView(order.toObject()));
    return;
  }
  if (order.paymentStatus !== "pending" || order.status !== "pending") {
    throw new ApiError(409, "This order is no longer awaiting payment");
  }

  let payment = await fetchRazorpayPayment(input.razorpay_payment_id);
  const expectedAmount = Math.round(order.total * 100);
  if (
    payment.order_id !== order.razorpayOrderId ||
    payment.amount !== expectedAmount ||
    payment.currency !== "INR"
  ) {
    throw new ApiError(409, "Payment details do not match this order");
  }
  if (payment.status === "authorized") {
    await captureRazorpayPayment(payment.id, expectedAmount);
    payment = await fetchRazorpayPayment(payment.id);
  }
  if (payment.status !== "captured") {
    throw new ApiError(409, "Razorpay has not captured this payment yet");
  }

  const updated = await OrderModel.findOneAndUpdate(
    {
      _id: order._id,
      user: req.user!._id,
      paymentMethod: "razorpay",
      razorpayOrderId: input.razorpay_order_id,
      paymentStatus: "pending",
      status: "pending",
    },
    { $set: { paymentStatus: "paid", status: "confirmed", razorpayPaymentId: input.razorpay_payment_id } },
    { returnDocument: "after" },
  );
  if (updated) {
    ok(res, orderView(updated.toObject()));
    return;
  }

  const current = await OrderModel.findOne({ _id: order._id, user: req.user!._id });
  if (current?.paymentStatus === "paid" && current.razorpayPaymentId === input.razorpay_payment_id) {
    ok(res, orderView(current.toObject()));
    return;
  }
  throw new ApiError(409, "Order status changed while verifying payment");
};
