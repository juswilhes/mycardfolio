// Datei-Uploads von Nutzern (aktuell: Foto des echten Exemplars bei einem
// Marktplatz-Angebot). Liegt im selben Verzeichnis wie die SQLite-Datei,
// landet also automatisch im persistenten Docker-Volume statt im
// vergänglichen Container-Dateisystem - siehe DATABASE_PATH in docker-compose.yml.
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import multer from "multer";

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : null;
export const uploadsRoot = dbPath
  ? path.join(path.dirname(dbPath), "uploads")
  : path.join(process.cwd(), "uploads");

const listingsDir = path.join(uploadsRoot, "listings");
fs.mkdirSync(listingsDir, { recursive: true });

const EXT_BY_MIME = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, listingsDir),
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${EXT_BY_MIME[file.mimetype] || ""}`),
});

export const uploadListingPhoto = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (_req, file, cb) => cb(null, !!EXT_BY_MIME[file.mimetype]),
}).single("photo");

export const listingPhotoUrl = (filename) => `/uploads/listings/${filename}`;
