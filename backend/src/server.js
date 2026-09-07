import "dotenv/config";
import express from "express";
import cors from "cors";
import cardsRouter from "./routes/cards.js";
import collectionRouter from "./routes/collection.js";
import setsRouter from "./routes/sets.js";
import { schedulePriceFetching, refreshAllPrices } from "./services/priceFetcher.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/cards", cardsRouter);
app.use("/api/collection", collectionRouter);
app.use("/api/sets", setsRouter);

// Manueller Trigger, praktisch zum Testen (normalerweise übernimmt der Cron-Job das)
app.post("/api/refresh-prices", async (_req, res) => {
  await refreshAllPrices();
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API läuft auf http://localhost:${PORT}`);
  schedulePriceFetching();
});
