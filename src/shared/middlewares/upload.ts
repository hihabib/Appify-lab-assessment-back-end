import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import type { RequestHandler } from "express";

/**
 * Image upload middleware — multer (memory) + sharp compression.
 *
 * Pipeline:
 *   1. Multer reads the file into memory (no disk write yet).
 *   2. compressAndSave() resizes to max 500px wide (aspect ratio preserved),
 *      converts to JPEG at quality 80, then writes to uploads/.
 *   3. req.file.filename and req.file.path are patched so downstream
 *      controllers can read them exactly as before.
 *
 * Result: every uploaded image is a JPEG ≤ 500px wide regardless of the
 * original format (PNG, WEBP, BMP, etc.) or dimensions.
 */

// ── Step 1: multer reads file into req.file.buffer ───────────────────────────

const memStorage = multer.memoryStorage();

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed."));
  }
};

const multerUpload = multer({
  storage: memStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB raw upload limit
});

// ── Step 2: compress and write to disk ───────────────────────────────────────

async function compressAndSave(req: Express.Request): Promise<void> {
  if (!req.file) return;

  const uploadsDir = path.join(process.cwd(), "uploads");

  // Always output as JPEG for consistent compression
  const filename = `${randomUUID()}.jpg`;
  const outputPath = path.join(uploadsDir, filename);

  await fs.mkdir(uploadsDir, { recursive: true });

  await sharp(req.file.buffer)
    .resize({
      width: 500,          // max width 500px
      withoutEnlargement: true, // never upscale smaller images
      fit: "inside",       // preserves aspect ratio
    })
    .jpeg({ quality: 80 }) // compress to JPEG @ 80% quality
    .toFile(outputPath);

  // Patch req.file so controllers see the same shape as before
  req.file.filename = filename;
  req.file.path = outputPath;
  req.file.mimetype = "image/jpeg";
}

// ── Step 3: combined middleware export ────────────────────────────────────────

/**
 * Drop-in replacement for the old `upload.single("image")`.
 * Usage in routes is unchanged:
 *   router.post("/", authenticate, upload.single("image"), controller.method);
 */
export const upload = {
  single: (fieldName: string): RequestHandler[] => [
    multerUpload.single(fieldName),
    async (req, _res, next) => {
      try {
        await compressAndSave(req);
        next();
      } catch (err) {
        next(err);
      }
    },
  ],
};
