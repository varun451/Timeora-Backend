import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).default(5000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be 32+ characters"),
  FRONTEND_URL: z.string().default("http://localhost:3000,http://localhost:3002"),
  ADMIN_URL: z.string().url().default("http://localhost:3002"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  SMTP_HOST: z.preprocess((value) => value === "" ? undefined : value, z.string().optional()),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  SMTP_USER: z.preprocess((value) => value === "" ? undefined : value, z.string().optional()),
  SMTP_PASSWORD: z.preprocess((value) => value === "" ? undefined : value, z.string().optional()),
  SMTP_FROM: z.preprocess((value) => value === "" ? undefined : value, z.string().optional()),
  SEED_ADMIN_EMAIL: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  RAZORPAY_KEY_ID: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().startsWith("rzp_test_").optional(),
  ),
  RAZORPAY_KEY_SECRET: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(1).optional(),
  ),
}).superRefine((value, ctx) => {
  if (Boolean(value.RAZORPAY_KEY_ID) !== Boolean(value.RAZORPAY_KEY_SECRET)) {
    ctx.addIssue({
      code: "custom",
      path: ["RAZORPAY_KEY_ID"],
      message: "Set both Razorpay test credentials, or leave both unset",
    });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables (check backend/.env):");
  for (const i of parsed.error.issues) console.error(` - ${i.path.join(".")}: ${i.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const razorpayEnabled = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
