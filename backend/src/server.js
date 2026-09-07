import "dotenv/config";
import express from "express";
import cors from "cors";
import cardsRouter from "./routes/cards.js";
import collectionRouter from "./routes/collection.js";
import setsRouter from "./routes/sets.js";
import portfolioRouter from "./routes/portfolio.js";
import salesRouter from "./routes/sales.js";
import { schedulePriceFetching, refreshAllPrices } from "./services/priceFetcher.js";
import { recordPortfolioSnapshot } from "./services/portfolioService.js";

process.on("uncaughtException", (e) => console.error("[uncaughtException]", e));
process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e));

const app = express();
app.use(cors());
app.use(express.json());

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
