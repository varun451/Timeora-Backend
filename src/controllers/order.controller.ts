import type { RequestHandler } from "express";
import mongoose from "mongoose";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { createRazorpayOrder, fetchRazorpayOrderPayments } from "../services/razorpay.service.js";
import { ApiError, ok } from "../utils/http.js";
import { adminOrdersQuerySchema, orderInputSchema, orderStatusSchema } from "../validations/index.js";

export const orderView = (order: {
  _id: unknown;
  items: Array<{ product?: unknown; name?: string; images?: string[]; unitPrice?: number; quantity?: number }>;
  shippingAddress: unknown;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  createdAt: Date;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
}) => ({
  id: String(order._id),
  items: order.items.map((item) => ({
    productId: item.product
      ? String(typeof item.product === "object" && "_id" in item.product ? item.product._id : item.product)
      : "",
    name: item.name ?? "Watch",
    images: item.images?.length
      ? item.images
      : item.product && typeof item.product === "object" && "images" in item.product && Array.isArray(item.product.images)
        ? item.product.images as string[]
        : [],
    unitPrice: item.unitPrice ?? 0,
    quantity: item.quantity ?? 0,
  })),
  shippingAddress: order.shippingAddress,
  subtotal: order.subtotal,
  discount: order.discount,
  shippingFee: order.shippingFee,
  total: order.total,
  paymentMethod: order.paymentMethod,
  paymentStatus: order.paymentStatus,
  status: order.status,
  createdAt: order.createdAt,
  razorpayOrderId: order.razorpayOrderId,
  razorpayPaymentId: order.razorpayPaymentId,
});

export const createOrder: RequestHandler = async (req, res) => {
  const input = orderInputSchema.parse(req.body);
  const reserved: Array<{ productId: mongoose.Types.ObjectId; quantity: number }> = [];
  const items: Array<{ product: mongoose.Types.ObjectId; name: string; images: string[]; unitPrice: number; quantity: number }> = [];
  let subtotal = 0;
  let discount = 0;
  let createdOrderId: string | undefined;

  try {
    for (const item of input.items) {
      const productId = new mongoose.Types.ObjectId(item.productId);
      const product = await ProductModel.findOneAndUpdate(
        { _id: productId, published: true, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity, sold: item.quantity } },
        { returnDocument: "after" },
      );
      if (!product) throw new ApiError(409, "A product is unavailable or no longer has enough stock");

      reserved.push({ productId, quantity: item.quantity });
      const basePrice = Math.round(product.price);
      const unitPrice = Math.round(basePrice * (1 - (product.discountPercent ?? 0) / 100));
      subtotal += basePrice * item.quantity;
      discount += (basePrice - unitPrice) * item.quantity;
      items.push({ product: productId, name: product.name, images: product.images ?? [], unitPrice, quantity: item.quantity });
    }

    const shippingFee = subtotal - discount >= 10_000 ? 0 : 99;
    const order = await OrderModel.create({
      user: req.user!._id,
      items,
      shippingAddress: input.shippingAddress,
      subtotal,
      discount,
      shippingFee,
      total: subtotal - discount + shippingFee,
      paymentMethod: "razorpay",
      paymentStatus: "pending",
      status: "pending",
    });
    createdOrderId = String(order._id);

    const amount = Math.round(order.total * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new ApiError(400, "Order total is not valid for online payment");
    const razorpayOrder = await createRazorpayOrder({ amount, receipt: String(order._id) });
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();
    ok(res, {
      ...orderView(order.toObject()),
      razorpay: {
        id: razorpayOrder.id,
        keyId: razorpayOrder.keyId,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
    }, 201);
  } catch (error) {
    try {
      if (createdOrderId) await OrderModel.deleteOne({ _id: createdOrderId });
      if (reserved.length > 0) {
        await Promise.all(reserved.map(({ productId, quantity }) =>
          ProductModel.updateOne({ _id: productId }, { $inc: { stock: quantity, sold: -quantity } }),
        ));
      }
    } catch (rollbackError) {
      console.error("Could not roll back inventory after failed order placement", rollbackError);
    }
    throw error;
  }
};

export const listMyOrders: RequestHandler = async (req, res) => {
  const orders = await OrderModel.find({ user: req.user!._id }).sort({ createdAt: -1 }).lean();
  ok(res, orders.map((order) => orderView(order)));
};

export const getMyOrder: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Order not found");
  const order = await OrderModel.findOne({ _id: id, user: req.user!._id }).populate("items.product", "images").lean();
  if (!order) throw new ApiError(404, "Order not found");
  ok(res, orderView(order));
};

export const cancelMyOrder: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Order not found");
  const current = await OrderModel.findOne({ _id: id, user: req.user!._id });
  if (!current) throw new ApiError(409, "This order can no longer be cancelled");
  if (current.paymentMethod === "razorpay" && current.paymentStatus === "pending" && current.razorpayOrderId) {
    const payments = await fetchRazorpayOrderPayments(current.razorpayOrderId);
    const captured = payments.find((payment) => payment.status === "captured");
    if (captured) {
      if (captured.amount !== Math.round(current.total * 100)) {
        throw new ApiError(409, "Razorpay captured an unexpected amount. Contact support before cancelling this order.");
      }
      await OrderModel.updateOne(
        { _id: current._id, paymentStatus: "pending", status: "pending" },
        { $set: { paymentStatus: "paid", status: "confirmed", razorpayPaymentId: captured.id } },
      );
      throw new ApiError(409, "Razorpay has already captured this payment; the order is confirmed");
    }
    if (payments.some((payment) => payment.status === "authorized")) {
      throw new ApiError(409, "Razorpay is still processing this payment. Please try cancelling again shortly.");
    }
  }
  const order = await OrderModel.findOneAndUpdate(
    {
      _id: id,
      user: req.user!._id,
      paymentStatus: "pending",
      $or: [
        { paymentMethod: "cod", status: { $in: ["pending", "confirmed"] } },
        { paymentMethod: "razorpay", status: "pending" },
      ],
    },
    { $set: { status: "cancelled" } },
    { returnDocument: "after" },
  );
  if (!order) throw new ApiError(409, "This order can no longer be cancelled");

  await Promise.all(order.items.map((item: { product: mongoose.Types.ObjectId; quantity: number }) => ProductModel.updateOne(
    { _id: item.product },
    { $inc: { stock: item.quantity, sold: -item.quantity } },
  )));
  ok(res, orderView(order.toObject()));
};

export const listAllOrders: RequestHandler = async (req, res) => {
  const { page, limit, status } = adminOrdersQuerySchema.parse(req.query);
  const filter = status ? { status } : {};
  const [orders, total] = await Promise.all([
    OrderModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    OrderModel.countDocuments(filter),
  ]);
  ok(res, { items: orders.map((order) => orderView(order)), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
};

export const updateOrderStatus: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, "Order not found");
  const { status } = orderStatusSchema.parse(req.body);
  const current = await OrderModel.findById(id);
  if (!current) throw new ApiError(404, "Order not found");
  if (current.paymentMethod === "razorpay" && current.paymentStatus !== "paid") {
    throw new ApiError(409, "An online order cannot be processed before its payment is confirmed");
  }
  const nextStatus: Record<string, string> = {
    pending: "confirmed",
    confirmed: "processing",
    processing: "shipped",
    shipped: "delivered",
  };
  if (nextStatus[current.status] !== status) throw new ApiError(409, `Cannot move an order from ${current.status} to ${status}`);
  const order = await OrderModel.findOneAndUpdate(
    { _id: id, status: current.status },
    { $set: { status } },
    { returnDocument: "after" },
  ).lean();
  if (!order) throw new ApiError(409, "Order status changed. Refresh and try again.");
  ok(res, orderView(order));
};
