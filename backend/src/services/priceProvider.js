// Preisquelle: Cardmarket-Preise (EUR) über die kostenlose TCGdex-API.
//
// Warum TCGdex und nicht mehr die Preise aus pokemontcg.io?
//  - pokemontcg.io liefert Cardmarket-Preise nur sehr veraltet (Monate alt)
//    und mischt sie mit TCGplayer/USD.
//  - TCGdex liefert dieselben Cardmarket-Kennzahlen in EUR, täglich frisch,
//    inkl. Cardmarket-Produkt-ID (für einen Direktlink).
//
// Grenzen (bewusst):
//  - Es ist der Preis der ENGLISCHEN Karte auf Cardmarket. Für die deutsche
//    Druckvariante gibt es keine frei verfügbare Preisquelle.
//  - eBay-Verkaufspreise gibt es ohne kostenpflichtigen API-Zugang nicht.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "../db/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, "..", "..", "vendor", "tcgdex-price-cache.json");
const API = "https://api.tcgdex.net/v2/en";
const CARD_TTL_MS = 6 * 60 * 60 * 1000; // Kartenpreise 6 h cachen

const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const normNum = (n) => {
  const s = String(n ?? "").trim();
  return /^\d+$/.test(s) ? String(parseInt(s, 10)) : s.toUpperCase().replace(/^0+/, "");
};

// Setnamen, die sich nicht 1:1 auf einen TCGdex-Set-Namen normalisieren lassen
const SET_ID_OVERRIDES = Object.fromEntries(
  Object.entries({
    "Scarlet & Violet Energies": "sve",
    "Scarlet & Violet Black Star Promos": "svp",
    "SWSH Black Star Promos": "swshp",
    "SM Black Star Promos": "smp",
    "Pokémon GO": "pgo",
  }).map(([k, v]) => [norm(k), v])
);

let cache = { sets: null, setCards: {}, cards: {}, fx: null };
try {
  if (fs.existsSync(CACHE_FILE)) {
    cache = { sets: null, setCards: {}, cards: {}, fx: null, ...JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) };
  }
} catch {
  /* ignore */
}

// USD -> EUR Tageskurs (frei, ohne Key, EZB-Daten). Nur für den Fallback,
// wenn Cardmarket für eine Karte gar keinen Preis hat.
async function usdToEur() {
  const today = new Date().toISOString().slice(0, 10);
  if (cache.fx?.date === today) return cache.fx.rate;
  try {
    const j = await fetchJson("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR");
    const rate = j?.rates?.EUR;
    if (rate) {
      cache.fx = { date: today, rate };
      persistCache();
      return rate;
    }
  } catch {
    /* ignore */
  }
  return cache.fx?.rate ?? 0.9; // grober Notnagel
}

let saveTimer = null;
function persistCache() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
    } catch {
      /* ignore */
    }
  }, 1000);
}

async function fetchJson(url, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "MyCardfolio/1.0" } });
      clearTimeout(t);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
}

const cardRow = db.prepare(`
  SELECT c.external_id, c.number, c.name, c.set_id, s.name AS set_name
  FROM cards c LEFT JOIN card_sets s ON s.id = c.set_id
  WHERE c.external_id = ? AND c.game_id = (SELECT id FROM games WHERE slug = 'pokemon')
`);

// TCGdex-Set-IDs sind unseren sehr ähnlich: "swsh12pt5gg" -> "swsh12.5gg",
// "sv3" -> "sv03", "sv3pt5" -> "sv03.5". Kandidaten bilden und gegen die
// TCGdex-Set-Liste prüfen.
function candidateSetIds(ourId) {
  if (!ourId) return [];
  const ids = new Set([ourId]);
  const dotted = ourId.replace("pt5", ".5").replace(/pt(\d)/, ".$1");
  ids.add(dotted);
  for (const base of [ourId, dotted]) {
    const m = base.match(/^([a-z]+)(\d)([^0-9].*|$)/);
    if (m) ids.add(`${m[1]}0${m[2]}${m[3]}`);
  }
  return [...ids];
}

async function tcgdexSetId(setName, ourSetId) {
  if (!cache.sets) {
    cache.sets = await fetchJson(`${API}/sets`);
    persistCache();
  }
  const sets = cache.sets ?? [];

  for (const cand of candidateSetIds(ourSetId)) {
    if (sets.some((s) => s.id === cand)) return cand;
  }
  const key = norm(setName);
  if (SET_ID_OVERRIDES[key]) return SET_ID_OVERRIDES[key];
  return sets.find((s) => norm(s.name) === key)?.id ?? null;
}

async function tcgdexCardId(setName, number, cardName, ourSetId) {
  const sid = await tcgdexSetId(setName, ourSetId);
  if (!sid) return null;
  if (!cache.setCards[sid]) {
    const set = await fetchJson(`${API}/sets/${sid}`);
    cache.setCards[sid] = (set?.cards ?? []).map((c) => ({ id: c.id, localId: c.localId, name: c.name }));
    persistCache();
  }
  const list = cache.setCards[sid] ?? [];
  const byNum = list.find((c) => normNum(c.localId) === normNum(number));
  if (byNum) return byNum.id;
  const byName = list.find((c) => norm(c.name) === norm(cardName));
  return byName?.id ?? null;
}

// -> { prices: [{source,price_type,currency,price}], meta: {productId, updated} }
export async function getCardmarketPrices(externalId) {
  const row = cardRow.get(externalId);
  if (!row) return { prices: [], meta: null };

  const cached = cache.cards[externalId];
  if (cached && Date.now() - cached.ts < CARD_TTL_MS) return cached.value;

  let value = { prices: [], meta: null };
  try {
    const tid = await tcgdexCardId(row.set_name, row.number, row.name, row.set_id);
    if (tid) {
      const full = await fetchJson(`${API}/cards/${tid}`);
      const cm = full?.pricing?.cardmarket;
      const tp = full?.pricing?.tcgplayer;

      const eur = (variant, priceType, price) =>
        price != null && price > 0
          ? {
              source: "cardmarket",
              variant,
              price_type: priceType,
              currency: "EUR",
              price: Math.round(price * 100) / 100,
            }
          : null;

      const cmRows = cm
        ? [
            eur("normal", "trend", cm.trend),
            eur("normal", "low", cm.low),
            eur("normal", "avg30", cm.avg30),
            eur("holo", "trend", cm["trend-holo"]),
            eur("holo", "low", cm["low-holo"]),
            eur("holo", "avg30", cm["avg30-holo"]),
          ].filter(Boolean)
        : [];

      if (cmRows.length) {
        value = {
          prices: cmRows,
          meta: { basis: "cardmarket", productId: cm.idProduct ?? null, updated: cm.updated ?? null },
        };
      } else if (tp) {
        // Fallback: TCGplayer-Marktpreis (USD) -> EUR umgerechnet
        const variant = tp.holofoil ?? tp.normal ?? tp.reverseHolofoil ?? Object.values(tp).find((v) => v?.marketPrice);
        const usd = variant?.marketPrice ?? variant?.midPrice;
        if (usd) {
          const rate = await usdToEur();
          value = {
            prices: [
              {
                source: "tcgplayer",
                variant: "normal",
                price_type: "trend",
                currency: "EUR",
                price: Math.round(usd * rate * 100) / 100,
              },
            ],
            meta: { basis: "tcgplayer", productId: null, updated: tp.updated ?? null, usdRate: rate },
          };
        }
      }
    }
  } catch {
    return value; // Netzwerkfehler -> leeres Ergebnis, nicht cachen
  }

  // Leere Ergebnisse nicht (lange) cachen – vielleicht ist die Quelle nur
  // kurz unvollständig.
  if (value.prices.length) {
    cache.cards[externalId] = { ts: Date.now(), value };
    persistCache();
  }
  return value;
}

export function cardmarketUrl(productId) {
  return productId
    ? `https://www.cardmarket.com/de/Pokemon/Products/Singles?idProduct=${productId}`
    : null;
}
