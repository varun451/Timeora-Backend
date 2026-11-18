import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "../utils/http.js";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

const MIME_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/**
 * Saves a base64 Data URL (e.g. data:image/png;base64,...) to the local uploads directory.
 * Returns the public URL path: `/uploads/<filename>`.
 */
export async function saveBase64Image(dataUrl: string): Promise<string> {
  const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new ApiError(400, "Invalid image data format. Expected base64 Data URL.");
  }

  const mime = matches[1].toLowerCase();
  const base64Data = matches[2];
  const extension = MIME_MAP[mime];

  if (!extension) {
    throw new ApiError(400, "Unsupported image type. Use JPEG, PNG, or WebP.");
  }

  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length > 5 * 1024 * 1024) {
    throw new ApiError(400, "Image size exceeds 5MB limit.");
  }

  const filename = `watch_${Date.now()}_${randomBytes(6).toString("hex")}${extension}`;
  const filepath = path.join(UPLOADS_DIR, filename);

  await writeFile(filepath, buffer);
  return `/uploads/${filename}`;
}

