import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import authRouter from "./routes/auth.js";
import cardsRouter from "./routes/cards.js";
import collectionRouter from "./routes/collection.js";
import setsRouter from "./routes/sets.js";
import portfolioRouter from "./routes/portfolio.js";
import salesRouter from "./routes/sales.js";
import achievementsRouter from "./routes/achievements.js";
import watchlistRouter from "./routes/watchlist.js";
import { authRequired } from "./middleware/auth.js";
import { countPageView } from "./middleware/hits.js";
import { schedulePriceFetching, refreshAllPrices } from "./services/priceFetcher.js";
import { recordAllPortfolioSnapshots } from "./services/portfolioService.js";
import db from "./db/index.js";

process.on("uncaughtException", (e) => console.error("[uncaughtException]", e));
process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e));

// SQLite sauber schliessen, bevor der Prozess endet - sonst kann
// better-sqlite3 unter Node 24 beim Abbau nativ abstuerzen.
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  try {
    db.close();
  } catch {
    /* ignore */
  }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGHUP", shutdown);
process.on("beforeExit", shutdown);

const app = express();

// Hinter einem Reverse-Proxy (IONOS/nginx/Cloudflare) muss Express der
// X-Forwarded-For-Header vertrauen, damit Rate-Limiting die echte IP sieht.
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);

// Sicherheits-Header. CSP hier aus (die API liefert nur JSON), aber
// Cross-Origin-Resource-Policy muss "cross-origin" sein, damit das
// Frontend auf einem anderen Port die Antworten lesen darf.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS: in Produktion auf die eigene Domain begrenzen (CORS_ORIGIN,
// kommagetrennt), sonst alles erlauben (lokale Entwicklung). credentials:
// true, weil die Sitzung über ein Cookie läuft.
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : true;
app.use(cors({ origin: corsOrigin, credentials: true }));

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(countPageView); // einfache Seitenaufruf-Zählung (ohne IPs)

// Grundlegendes Rate-Limiting gegen Missbrauch. Die Tipp-Suche feuert pro
// Tastenanschlag - daher grosszuegig.
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.RATE_LIMIT) || 1000,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Zu viele Anfragen - bitte kurz warten." },
  })
);

// Öffentlich: Konten, Karten-Stammdaten, Set-Übersicht.
app.use("/api/auth", authRouter);
app.use("/api/cards", cardsRouter);
app.use("/api/sets", setsRouter);

// Nur mit Login: alles Nutzerbezogene.
app.use("/api/collection", authRequired, collectionRouter);
app.use("/api/portfolio", authRequired, portfolioRouter);
app.use("/api/sales", authRequired, salesRouter);
app.use("/api/achievements", authRequired, achievementsRouter);
app.use("/api/watchlist", authRequired, watchlistRouter);

// Manueller Trigger, praktisch zum Testen (normalerweise übernimmt der Cron-Job das)
app.post("/api/refresh-prices", authRequired, async (_req, res) => {
  await refreshAllPrices();
  recordAllPortfolioSnapshots();
  res.json({ ok: true });
});

// Unbekannte API-Routen sauber beantworten statt HTML-Fehlerseite.
app.use("/api", (_req, res) => res.status(404).json({ error: "Nicht gefunden" }));

// In Produktion das gebaute Frontend aus demselben Server ausliefern
// (eine Domain -> keine CORS-/Cookie-Sonderfälle). FRONTEND_DIST kann den
// Pfad überschreiben, sonst frontend/dist neben dem Projekt.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = process.env.FRONTEND_DIST
  ? path.resolve(process.env.FRONTEND_DIST)
  : path.join(__dirname, "..", "..", "frontend", "dist");

if (fs.existsSync(path.join(frontendDist, "index.html"))) {
  app.use(express.static(frontendDist, { maxAge: "1h", index: false }));
  // SPA-Fallback: alles, was keine Datei ist, liefert index.html.
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
  console.log(`[frontend] wird ausgeliefert aus ${frontendDist}`);
}

// Zentrale Fehlerbehandlung: nie Stacktraces an den Client, immer geloggt.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[error]", err);
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Anfrage zu groß." });
  }
  res.status(err?.status || 500).json({ error: "Interner Serverfehler" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API läuft auf http://localhost:${PORT}`);
  schedulePriceFetching();
  // beim Start je Nutzer einen aktuellen Portfolio-Punkt sichern
  try {
    recordAllPortfolioSnapshots();
  } catch (e) {
    console.error("[portfolio] Snapshot beim Start fehlgeschlagen:", e.message);
  }
});
