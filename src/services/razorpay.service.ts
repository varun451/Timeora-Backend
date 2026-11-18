import { createHmac, timingSafeEqual } from "node:crypto";
import { env, razorpayEnabled } from "../config/env.js";
import { ApiError } from "../utils/http.js";

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
}

interface RazorpayPaymentResponse {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
}

interface RazorpayOrderPaymentsResponse {
  items: RazorpayPaymentResponse[];
}

function credentials() {
  if (!razorpayEnabled || !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new ApiError(503, "Online payments are not configured");
  }
  return { keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET };
}

async function razorpayRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { keyId, keySecret } = credentials();
  let response: Response;
  try {
    response = await fetch(`https://api.razorpay.com/v1${path}`, {
      ...init,
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(502, "Could not reach Razorpay. Please try again.");
  }

  if (!response.ok) {
    throw new ApiError(502, "Razorpay could not process the payment request");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(502, "Razorpay returned an invalid response");
  }
  if (!body || typeof body !== "object") throw new ApiError(502, "Razorpay returned an invalid response");
  return body as T;
}

export async function createRazorpayOrder(input: { amount: number; receipt: string }) {
  const response = await razorpayRequest<Partial<RazorpayOrderResponse>>("/orders", {
    method: "POST",
    body: JSON.stringify({ amount: input.amount, currency: "INR", receipt: input.receipt }),
  });
  if (
    typeof response.id !== "string" ||
    response.amount !== input.amount ||
    response.currency !== "INR" ||
    response.receipt !== input.receipt
  ) {
    throw new ApiError(502, "Razorpay returned an invalid order");
  }
  const { keyId } = credentials();
  return { ...response, keyId };
}

export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string) {
  const { keySecret } = credentials();
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function fetchRazorpayPayment(paymentId: string) {
  const payment = await razorpayRequest<Partial<RazorpayPaymentResponse>>(`/payments/${encodeURIComponent(paymentId)}`);
  if (
    payment.id !== paymentId ||
    typeof payment.order_id !== "string" ||
    typeof payment.amount !== "number" ||
    payment.currency !== "INR" ||
    typeof payment.status !== "string"
  ) {
    throw new ApiError(502, "Razorpay returned invalid payment details");
  }
  return payment as RazorpayPaymentResponse;
}

export async function captureRazorpayPayment(paymentId: string, amount: number) {
  const payment = await razorpayRequest<Partial<RazorpayPaymentResponse>>(
    `/payments/${encodeURIComponent(paymentId)}/capture`,
    { method: "POST", body: JSON.stringify({ amount, currency: "INR" }) },
  );
  if (
    payment.id !== paymentId ||
    typeof payment.order_id !== "string" ||
    payment.amount !== amount ||
    payment.currency !== "INR" ||
    typeof payment.status !== "string"
  ) {
    throw new ApiError(502, "Razorpay returned invalid payment capture details");
  }
  return payment as RazorpayPaymentResponse;
}

export async function fetchRazorpayOrderPayments(orderId: string) {
  const response = await razorpayRequest<Partial<RazorpayOrderPaymentsResponse>>(
    `/orders/${encodeURIComponent(orderId)}/payments`,
  );
  if (!Array.isArray(response.items)) throw new ApiError(502, "Razorpay returned invalid order payment details");
  return response.items.map((payment) => {
    if (
      typeof payment?.id !== "string" ||
      payment.order_id !== orderId ||
      typeof payment.amount !== "number" ||
      payment.currency !== "INR" ||
      typeof payment.status !== "string"
    ) {
      throw new ApiError(502, "Razorpay returned invalid order payment details");
    }
    return payment;
  });
}

export function getRazorpayCheckoutConfig() {
  return {
    enabled: razorpayEnabled,
    keyId: razorpayEnabled ? env.RAZORPAY_KEY_ID : null,
    currency: "INR",
  };
}
