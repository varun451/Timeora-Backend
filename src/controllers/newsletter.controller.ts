import type { RequestHandler } from "express";
import { NewsletterSubscriberModel } from "../models/NewsletterSubscriber.js";
import { ok } from "../utils/http.js";
import { newsletterSchema } from "../validations/index.js";

export const subscribe: RequestHandler = async (req, res) => {
  const { email } = newsletterSchema.parse(req.body);
  const subscriber = await NewsletterSubscriberModel.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $set: { status: "subscribed" } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  ok(res, { subscribed: true, email: subscriber.email }, 201);
};

export const listSubscribers: RequestHandler = async (_req, res) => {
  const subscribers = await NewsletterSubscriberModel.find({ status: "subscribed" })
    .sort({ createdAt: -1 })
    .limit(1000)
    .select("email createdAt")
    .lean();
  ok(res, subscribers.map((subscriber) => ({ email: subscriber.email, createdAt: subscriber.createdAt })));
};
