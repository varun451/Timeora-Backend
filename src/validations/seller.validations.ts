import { z } from "zod";

export const sellerApplicationSchema = z.object({
  storeName: z.string().trim().min(2, "Store name must be at least 2 characters").max(100),
  ownerName: z.string().trim().min(2, "Owner name must be at least 2 characters").max(100),
  email: z.email("Enter a valid email address").max(120),
  phone: z.string().regex(/^\+?[\d\s-]{10,15}$/, "Enter a valid 10-15 digit phone number"),
  description: z.string().trim().max(1000).optional().default(""),
  businessAddress: z.object({
    line1: z.string().trim().min(3, "Address line 1 is required").max(120),
    line2: z.string().trim().max(120).optional().default(""),
    city: z.string().trim().min(2, "City is required").max(60),
    state: z.string().trim().min(2, "State is required").max(60),
    pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code"),
  }),
  kyc: z.object({
    pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Enter a valid 10-character PAN number (e.g. ABCDE1234F)"),
    gstin: z.string().trim().toUpperCase().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Enter a valid 15-character GSTIN").optional().or(z.literal("")),
  }),
  bankDetails: z.object({
    accountHolderName: z.string().trim().min(2, "Account holder name is required").max(80),
    accountNumber: z.string().regex(/^\d{9,18}$/, "Enter a valid 9 to 18-digit bank account number"),
    ifscCode: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid 11-character IFSC code (e.g. HDFC0001234)"),
    bankName: z.string().trim().min(2, "Bank name is required").max(80),
  }),
});

export const applicationRejectionSchema = z.object({
  reason: z.string().trim().min(5, "Rejection reason must be at least 5 characters").max(500),
});

export const sellerCommissionSchema = z.object({
  commissionBps: z.number().int().min(0, "Commission cannot be negative").max(5000, "Maximum commission is 50% (5000 bps)"),
});

export const sellerSuspensionSchema = z.object({
  reason: z.string().trim().min(5, "Suspension reason must be at least 5 characters").max(500),
});

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const sellerProductInputSchema = z.object({
  name: z.string().trim().min(2, "Product name must be at least 2 characters").max(120),
  description: z.string().trim().max(4000).default(""),
  brand: z.string().trim().min(1, "Brand is required").max(60),
  category: z.string().trim().min(1, "Category is required").max(60),
  gender: z.enum(["men", "women"]).default("men"),
  price: z.number().min(0, "Price must be at least 0"),
  discountPercent: z.number().min(0).max(90, "Maximum discount is 90%").default(0),
  images: z.array(z.string().min(1)).max(10).default([]),
  specs: z
    .object({
      caseMaterial: z.string().max(60).optional(),
      strapMaterial: z.string().max(60).optional(),
      dialColor: z.string().max(40).optional(),
      movement: z.string().max(60).optional(),
      waterResistance: z.string().max(40).optional(),
      warranty: z.string().max(60).optional(),
    })
    .partial()
    .default({}),
  stock: z.number().int().min(0, "Stock cannot be negative").default(0),
  availability: z.enum(["active", "hidden"]).default("active"),
  sku: z.string().trim().max(40).optional().default(""),
  look: z.object({ dial: hexColor, case: hexColor, strap: hexColor }).optional(),
});

export const sellerProductPatchSchema = sellerProductInputSchema.partial();

export const sellerProductStockSchema = z.object({
  stock: z.number().int().min(0).optional(),
  availability: z.enum(["active", "hidden"]).optional(),
});
