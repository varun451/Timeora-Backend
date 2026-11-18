import { createHash, randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { createSession, destroySession, hashPassword, verifyPassword } from "../middleware/auth.js";
import { AuditLogModel } from "../models/AuditLog.js";
import { PasswordResetTokenModel } from "../models/PasswordResetToken.js";
import { UserModel } from "../models/User.js";
import { isSmtpConfigured, sendPasswordResetEmail } from "../services/email.service.js";
import { ApiError, ok } from "../utils/http.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  profilePatchSchema,
  registerSchema,
  resetPasswordSchema,
} from "../validations/index.js";

const publicUser = (u: {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  phone?: string;
  status?: string;
}) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  phone: u.phone ?? "",
  role: u.role === "admin" ? "super_admin" : u.role,
  status: u.status ?? "active",
});

export const register: RequestHandler = async (req, res) => {
  const body = registerSchema.parse(req.body);
  // Role is always enforced to customer on public registration
  const user = await UserModel.create({
    name: body.name,
    email: body.email.toLowerCase(),
    phone: body.phone ?? "",
    passwordHash: await hashPassword(body.password),
    role: "customer",
    status: "active",
    tokenVersion: 0,
  });

  await AuditLogModel.create({
    actor: user._id,
    actorRole: "customer",
    action: "USER_REGISTER",
    target: "User",
    targetId: user._id,
    ip: req.ip ?? "",
  });

  await createSession(res, String(user._id), 0);
  ok(res, publicUser(user), 201);
};

export const login: RequestHandler = async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await UserModel.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  const valid = user && (await verifyPassword(password, user.passwordHash));

  if (!user || !valid || user.status !== "active") {
    throw new ApiError(401, "Invalid email or password");
  }

  user.lastLoginAt = new Date();
  await user.save();

  await createSession(res, String(user._id), user.tokenVersion ?? 0);
  ok(res, publicUser(user));
};

export const logout: RequestHandler = (_req, res) => {
  destroySession(res);
  ok(res, { loggedOut: true });
};

export const me: RequestHandler = (req, res) => {
  ok(res, publicUser(req.user!));
};

export const updateMe: RequestHandler = async (req, res) => {
  const body = profilePatchSchema.parse(req.body);
  const update: Record<string, string> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.phone !== undefined) update.phone = body.phone;

  const user = await UserModel.findByIdAndUpdate(
    req.user!._id,
    { $set: update },
    { returnDocument: "after", runValidators: true },
  );
  if (!user) throw new ApiError(404, "Account not found");
  ok(res, publicUser(user));
};

export const changePassword: RequestHandler = async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const user = await UserModel.findById(req.user!._id).select("+passwordHash");
  if (!user) throw new ApiError(404, "Account not found");

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw new ApiError(400, "Current password is incorrect");

  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  // Create a new session cookie with updated tokenVersion
  await createSession(res, String(user._id), user.tokenVersion);

  await AuditLogModel.create({
    actor: user._id,
    actorRole: user.role,
    action: "PASSWORD_CHANGE",
    target: "User",
    targetId: user._id,
    ip: req.ip ?? "",
  });

  ok(res, { message: "Password updated successfully" });
};

export const forgotPassword: RequestHandler = async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  if (!isSmtpConfigured()) {
    throw new ApiError(503, "Password reset email is not configured. Please contact the administrator.");
  }
  const user = await UserModel.findOne({ email: email.toLowerCase() });

  // Uniform response message preventing email enumeration
  const genericResponse = {
    message: "If an account with that email exists, password reset instructions have been sent.",
  };

  if (!user || user.status !== "active") {
    ok(res, genericResponse);
    return;
  }

  // Generate cryptographically secure random token (32 bytes hex = 64 chars)
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes TTL

  const resetRecord = await PasswordResetTokenModel.create({
    user: user._id,
    tokenHash,
    expiresAt,
  });

  const appUrl = user.role === "admin" || user.role === "super_admin"
    ? env.ADMIN_URL
    : env.FRONTEND_URL.split(",")[0].trim();
  const resetUrl = new URL("/reset-password", appUrl);
  resetUrl.searchParams.set("token", rawToken);

  try {
    await sendPasswordResetEmail(user.email, resetUrl.toString());
  } catch (error) {
    await resetRecord.deleteOne();
    console.error("Could not deliver password reset email", error);
    throw new ApiError(503, "Could not send the reset email. Please try again later.");
  }

  await AuditLogModel.create({
    actor: user._id,
    actorRole: user.role,
    action: "PASSWORD_RESET_REQUEST",
    target: "User",
    targetId: user._id,
    ip: req.ip ?? "",
  });

  ok(res, genericResponse);
};

export const resetPassword: RequestHandler = async (req, res) => {
  const { token, password } = resetPasswordSchema.parse(req.body);
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const resetRecord = await PasswordResetTokenModel.findOne({
    tokenHash,
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });

  if (!resetRecord) {
    throw new ApiError(400, "Reset link is invalid or has expired. Please request a new one.");
  }

  const user = await UserModel.findById(resetRecord.user);
  if (!user || user.status !== "active") {
    throw new ApiError(400, "Account no longer active or exists");
  }

  user.passwordHash = await hashPassword(password);
  // Increment tokenVersion to revoke all active sessions across all devices
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  resetRecord.usedAt = new Date();
  await resetRecord.save();

  await AuditLogModel.create({
    actor: user._id,
    actorRole: user.role,
    action: "PASSWORD_RESET_COMPLETE",
    target: "User",
    targetId: user._id,
    ip: req.ip ?? "",
  });

  ok(res, { message: "Your password has been reset successfully. Please log in with your new password." });
};
