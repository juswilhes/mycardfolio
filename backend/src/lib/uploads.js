// Datei-Uploads (aktuell: Titelbilder der News-Artikel). Liegt im selben Verzeichnis wie die SQLite-Datei,
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

const newsDir = path.join(uploadsRoot, "news");
fs.mkdirSync(newsDir, { recursive: true });

const EXT_BY_MIME = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

// Titelbilder für News-Artikel (nur Betreiber, siehe routes/articles.js)
export const uploadArticleImage = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, newsDir),
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${EXT_BY_MIME[file.mimetype] || ""}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => cb(null, !!EXT_BY_MIME[file.mimetype]),
}).single("image");

export const articleImageUrl = (filename) => `/uploads/news/${filename}`;
