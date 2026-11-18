import type { Response } from "express";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Every successful response has the same shape: { success: true, data }. */
export const ok = <T>(res: Response, data: T, status = 200) => res.status(status).json({ success: true, data });
