import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Request, RequestHandler, Response } from "express";
import { env } from "../config/env.js";
import { UserModel, type UserDoc, type UserRole } from "../models/User.js";
import { ApiError } from "../utils/http.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDoc;
    }
  }
}

const COOKIE = "timeora_session";
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const secret = new TextEncoder().encode(env.AUTH_SECRET);
const cookieOpts = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, hash: string) => bcrypt.compare(p, hash);

export async function createSession(res: Response, userId: string, tokenVersion = 0) {
  const token = await new SignJWT({ tv: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
  res.cookie(COOKIE, token, { ...cookieOpts, maxAge: MAX_AGE_MS });
}

export const destroySession = (res: Response) => {
  res.clearCookie(COOKIE, cookieOpts);
};

/**
 * Role and status are re-read from the database on every call, never trusted from the token.
 * TokenVersion check enables instant invalidation of existing sessions upon password reset.
 */
export async function getSessionUser(req: Request): Promise<UserDoc | null> {
  const token = req.cookies?.[COOKIE] as string | undefined;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;

    const user = await UserModel.findById(payload.sub)
      .select("name email phone role status tokenVersion")
      .lean<UserDoc>();

    if (!user || user.status !== "active") return null;

    // Check token version if set in payload
    if (typeof payload.tv === "number" && (user.tokenVersion ?? 0) !== payload.tv) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export const requireUser: RequestHandler = async (req, _res, next) => {
  const u = await getSessionUser(req);
  if (!u) throw new ApiError(401, "Please log in");
  req.user = u;
  next();
};

export const requireRole = (...allowedRoles: UserRole[]): RequestHandler => {
  return async (req, _res, next) => {
    const u = await getSessionUser(req);
    if (!u) throw new ApiError(401, "Please log in");

    const effectiveRole = u.role === "admin" ? "super_admin" : u.role;
    const isAllowed =
      allowedRoles.includes(u.role) ||
      (allowedRoles.includes("super_admin") && effectiveRole === "super_admin");

    if (!isAllowed) {
      throw new ApiError(403, "Access denied: insufficient permissions");
    }

    req.user = u;
    next();
  };
};

export const requireAdmin: RequestHandler = requireRole("super_admin", "admin");
export const requireSuperAdmin: RequestHandler = requireRole("super_admin", "admin");
