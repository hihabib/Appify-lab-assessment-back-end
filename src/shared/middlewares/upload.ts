import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Multer middleware for image uploads.
 *
 * - Saves files to backend/uploads/ with a UUID-based filename
 * - Accepts images only (image/*)
 * - Limits file size to 5 MB
 *
 * Usage in routes:
 *   router.post("/", authenticate, upload.single("image"), controller.method);
 *
 * Uploaded file path:  req.file.filename  → "uuid.ext"
 * Serve via:  GET /uploads/uuid.ext  (Express static middleware in app.ts)
 */

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, "../../../uploads"));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed."));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
