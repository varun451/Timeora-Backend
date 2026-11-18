import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(120),
  password: z.string().min(8, "Use at least 8 characters").max(100),
  phone: z.string().regex(/^\+?[\d\s-]{10,15}$/, "Enter a valid phone number").optional(),
});
export const loginSchema = z.object({ email: z.email(), password: z.string().min(1).max(100) });

export const forgotPasswordSchema = z.object({
  email: z.email().max(120),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "Invalid reset token").max(200),
  password: z.string().min(8, "Use at least 8 characters").max(100),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(100),
  newPassword: z.string().min(8, "Use at least 8 characters").max(100),
});

export const addressSchema = z.object({
  name: z.string().trim().min(2).max(80),
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code"),
  phone: z.string().regex(/^\+?[\d\s-]{10,15}$/, "Enter a valid phone number"),
});

export const orderInputSchema = z.object({
  items: z.array(z.object({
    productId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid product"),
    quantity: z.number().int().min(1).max(10),
  })).min(1).max(20),
  shippingAddress: addressSchema,
  paymentMethod: z.literal("razorpay"),
}).superRefine(({ items }, ctx) => {
  const ids = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (ids.has(item.productId)) {
      ctx.addIssue({ code: "custom", path: ["items", index, "productId"], message: "Each product may only appear once" });
    }
    ids.add(item.productId);
  }
});

export const razorpayVerifySchema = z.object({
  orderId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid order"),
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().regex(/^[a-f\d]{64}$/i, "Invalid payment signature"),
});

export const profilePatchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().regex(/^\+?[\d\s-]{10,15}$/, "Enter a valid phone number").optional().or(z.literal("")),
});

export const orderStatusSchema = z.object({
  status: z.enum(["confirmed", "processing", "shipped", "delivered"]),
});

export const adminOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]).optional(),
});

export const newsletterSchema = z.object({ email: z.email().max(120) });
export const contactMessageSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(120),
  orderId: z.string().trim().max(40).optional().default(""),
  message: z.string().trim().min(20).max(3000),
});

export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
  q: z.string().trim().max(80).optional(),
  category: z.string().max(60).optional(),
  brand: z.string().max(60).optional(),
  gender: z.enum(["men", "women"]).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z.enum(["true", "1"]).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "popular"]).default("newest"),
});
export type ProductQuery = z.infer<typeof productQuerySchema>;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const productInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(4000).default(""),
  brand: z.string().trim().min(1).max(60),
  category: z.string().trim().min(1).max(60),
  gender: z.enum(["men", "women"]).default("men"),
  price: z.number().min(0),
  discountPercent: z.number().min(0).max(90).default(0),
  images: z.array(z.url()).max(10).default([]),
  specs: z.object({
    caseMaterial: z.string().max(60), strapMaterial: z.string().max(60), dialColor: z.string().max(40),
    movement: z.string().max(60), waterResistance: z.string().max(40), warranty: z.string().max(60),
  }).partial().default({}),
  stock: z.number().int().min(0).default(0),
  published: z.boolean().default(true),
  look: z.object({ dial: hex, case: hex, strap: hex }).optional(),
});
export const productPatchSchema = productInputSchema.partial();

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().max(300).optional(),
});
