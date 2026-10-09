import { Router } from "express";
import { authRequired, SESSION_COOKIE } from "../middleware/auth.js";
import { isOperatorUser } from "../lib/admin.js";
import { userForSession } from "../services/authService.js";
import {
  listPublishedArticles,
  listAllArticles,
  getArticleBySlug,
  createArticle,
  updateArticle,
  deleteArticle,
} from "../services/articles.js";
import { rebuildSitemap } from "../services/seo.js";
import { uploadArticleImage, articleImageUrl } from "../lib/uploads.js";

const router = Router();

// Der Betreiber sieht auch Entwürfe; alle anderen nur Veröffentlichtes.
// (Die Artikel-Routen sind öffentlich, hier also kein authRequired davor.)
const isOperator = (req) => isOperatorUser(userForSession(req.cookies?.[SESSION_COOKIE]));
const operatorOnly = (req, res, next) =>
  isOperatorUser(req.user) ? next() : res.status(403).json({ error: "Nur der Betreiber." });

// GET /api/articles -> veröffentlichte Artikel (Betreiber: alle inkl. Entwürfen)
router.get("/", (req, res) => {
  res.json(isOperator(req) ? listAllArticles() : listPublishedArticles());
});

// GET /api/articles/:slug -> ein Artikel (Entwürfe nur für den Betreiber)
router.get("/:slug", (req, res) => {
  const a = getArticleBySlug(req.params.slug);
  if (!a || (!a.published && !isOperator(req))) return res.status(404).json({ error: "Artikel nicht gefunden" });
  res.json(a);
});

// POST /api/articles/image (multipart, Feld "image") -> { url } des hochgeladenen Titelbilds.
router.post("/image", authRequired, operatorOnly, (req, res) => {
  uploadArticleImage(req, res, (err) => {
    if (err) return res.status(400).json({ error: "Bild konnte nicht hochgeladen werden (max. 5 MB)." });
    if (!req.file) return res.status(400).json({ error: "Bitte ein Bild wählen (JPG, PNG oder WebP)." });
    res.json({ url: articleImageUrl(req.file.filename) });
  });
});

// POST /api/articles | PATCH /api/articles/:id | DELETE /api/articles/:id -> nur Betreiber
router.post("/", authRequired, operatorOnly, (req, res) => {
  const r = createArticle(req.body ?? {});
  if (r.error) return res.status(400).json({ error: r.error });
  rebuildSitemap(); // neuer Artikel soll gleich in der Sitemap stehen
  res.status(201).json(r.article);
});

router.patch("/:id", authRequired, operatorOnly, (req, res) => {
  const r = updateArticle(Number(req.params.id), req.body ?? {});
  if (r.notFound) return res.status(404).json({ error: "Artikel nicht gefunden" });
  if (r.error) return res.status(400).json({ error: r.error });
  rebuildSitemap();
  res.json(r.article);
});

router.delete("/:id", authRequired, operatorOnly, (req, res) => {
  if (!deleteArticle(Number(req.params.id))) return res.status(404).json({ error: "Artikel nicht gefunden" });
  rebuildSitemap();
  res.json({ ok: true });
});

export default router;
