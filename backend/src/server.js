import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import cardsRouter from "./routes/cards.js";
import collectionRouter from "./routes/collection.js";
import setsRouter from "./routes/sets.js";
import portfolioRouter from "./routes/portfolio.js";
import salesRouter from "./routes/sales.js";
import { schedulePriceFetching, refreshAllPrices } from "./services/priceFetcher.js";
import { recordPortfolioSnapshot } from "./services/portfolioService.js";
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
// kommagetrennt), sonst alles erlauben (lokale Entwicklung).
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : true;
app.use(cors({ origin: corsOrigin }));

app.use(express.json({ limit: "1mb" }));

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

// Strengeres Limit für spätere Auth-Endpunkte (Login/Registrierung).
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Zu viele Versuche - bitte später erneut probieren." },
});

app.use("/api/cards", cardsRouter);
app.use("/api/collection", collectionRouter);
app.use("/api/sets", setsRouter);
app.use("/api/portfolio", portfolioRouter);
app.use("/api/sales", salesRouter);

// Manueller Trigger, praktisch zum Testen (normalerweise übernimmt der Cron-Job das)
app.post("/api/refresh-prices", async (_req, res) => {
  await refreshAllPrices();
  recordPortfolioSnapshot();
  res.json({ ok: true });
});

// Unbekannte API-Routen sauber beantworten statt HTML-Fehlerseite.
app.use("/api", (_req, res) => res.status(404).json({ error: "Nicht gefunden" }));

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
  // beim Start einen aktuellen Portfolio-Punkt sichern
  try {
    recordPortfolioSnapshot();
  } catch (e) {
    console.error("[portfolio] Snapshot beim Start fehlgeschlagen:", e.message);
  }
});
