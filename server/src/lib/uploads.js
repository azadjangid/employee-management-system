import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { config } from "../config.js";
import { badRequest } from "./errors.js";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const RECEIPT_DIR = path.resolve(serverRoot, config.uploadDir, "receipts");
fs.mkdirSync(RECEIPT_DIR, { recursive: true });

// Allowed types, checked against both the declared type and the file's first bytes.
const TYPES = {
  "application/pdf": { ext: ".pdf", magic: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  "image/png": { ext: ".png", magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/jpeg": { ext: ".jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/webp": { ext: ".webp", magic: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
};

export const receiptUpload = multer({
  storage: multer.diskStorage({
    destination: RECEIPT_DIR,
    filename: (req, file, cb) =>
      cb(null, `${crypto.randomUUID()}${TYPES[file.mimetype]?.ext ?? ""}`),
  }),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    if (TYPES[file.mimetype]) return cb(null, true);
    cb(badRequest("Receipts must be a PDF, JPG, PNG or WebP file"));
  },
}).single("receipt");

/** Express middleware wrapper that turns multer errors into friendly 400s. */
export function handleReceiptUpload(req, res, next) {
  receiptUpload(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(badRequest(`Receipt must be ${config.maxUploadBytes / 1024 / 1024} MB or smaller`));
    }
    if (err instanceof multer.MulterError) return next(badRequest(err.message));
    next(err);
  });
}

/** Make sure the saved file really is what it claims to be; delete it if not. */
export async function verifyUploadedFile(file) {
  const handle = await fsp.open(file.path, "r");
  try {
    const { buffer } = await handle.read(Buffer.alloc(16), 0, 16, 0);
    if (!TYPES[file.mimetype]?.magic(buffer)) {
      await fsp.rm(file.path, { force: true });
      throw badRequest("That file doesn't look like a valid PDF or image");
    }
  } finally {
    await handle.close();
  }
}

/** Absolute path for a stored receipt name, refusing anything that escapes the folder. */
export function receiptFilePath(name) {
  const full = path.resolve(RECEIPT_DIR, name);
  if (path.dirname(full) !== RECEIPT_DIR) throw badRequest("Invalid file");
  return full;
}

export async function removeReceiptFile(name) {
  if (!name) return;
  try {
    await fsp.rm(receiptFilePath(name), { force: true });
  } catch (err) {
    console.error("Could not delete receipt file:", err.message);
  }
}
