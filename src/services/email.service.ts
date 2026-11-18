import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export function isSmtpConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.SMTP_FROM);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP settings are not configured.");
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST!,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! },
  });

  await transporter.sendMail({
    from: env.SMTP_FROM!,
    to,
    subject: "Reset your TIMEORA password",
    text: `We received a request to reset your TIMEORA password. Open this link within 30 minutes:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>We received a request to reset your TIMEORA password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>`,
  });
}
