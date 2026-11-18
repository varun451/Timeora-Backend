import type { RequestHandler } from "express";
import { ContactMessageModel } from "../models/ContactMessage.js";
import { ok } from "../utils/http.js";
import { contactMessageSchema } from "../validations/index.js";

export const createContactMessage: RequestHandler = async (req, res) => {
  const input = contactMessageSchema.parse(req.body);
  const message = await ContactMessageModel.create(input);
  ok(res, { received: true, id: String(message._id) }, 201);
};

export const listContactMessages: RequestHandler = async (_req, res) => {
  const messages = await ContactMessageModel.find().sort({ createdAt: -1 }).limit(100).lean();
  ok(res, messages.map((message) => ({
    id: String(message._id),
    name: message.name,
    email: message.email,
    orderId: message.orderId,
    message: message.message,
    status: message.status,
    createdAt: message.createdAt,
  })));
};
