// Preisquelle: Cardmarket-Preise (EUR) über die kostenlose TCGdex-API.
//
// Warum TCGdex und nicht mehr die Preise aus pokemontcg.io?
//  - pokemontcg.io liefert Cardmarket-Preise nur sehr veraltet (Monate alt)
//    und mischt sie mit TCGplayer/USD.
//  - TCGdex liefert dieselben Cardmarket-Kennzahlen in EUR, täglich frisch,
//    inkl. Cardmarket-Produkt-ID (für einen Direktlink).
//
// Grenzen (bewusst):
//  - Es ist EIN Cardmarket-Wert pro Karte - nicht nach Sprache (Deutsch/Englisch)
//    und nicht nach Zustand aufgeteilt; eine getrennte Quelle gibt es nicht frei.
//  - eBay-Verkaufspreise gibt es ohne kostenpflichtigen API-Zugang nicht.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "../db/index.js";
import { getRawPricesById } from "./pokemonTcgApi.js";
import { resolveProduct } from "./cardmarketGuide.js";

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

export async function fetchJson(url, tries = 2) {
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
  SELECT c.external_id, c.number, c.name, c.set_id, s.name AS set_name, c.abilities, c.attacks, c.price_valid_from
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

// Setzt die zwischengespeicherten TCGdex-Listen (alle Sets + Kartenlisten je
// Set) zurück und lädt die Set-Liste frisch. Ohne das blieben neue Sets und
// neue Karten bestehender Sets (z.B. fortlaufende Promos) für immer
// unsichtbar - die Caches wurden sonst nie erneuert. Läuft jede Nacht im
// Neu-Check (newCardsSync.js).
export async function refreshTcgdexSets() {
  cache.sets = null;
  cache.setCards = {};
  cache.sets = await fetchJson(`${API}/sets`);
  persistCache();
  return cache.sets ?? [];
}

export async function tcgdexSetId(setName, ourSetId) {
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

export async function tcgdexCardId(setName, number, cardName, ourSetId) {
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
// force=true umgeht den 6h-Cache - für den Preis-Job und den manuellen
// "Jetzt aktualisieren"-Button, wo eine wirklich frische Abfrage gewünscht ist.
export async function getCardmarketPrices(externalId, { force = false } = {}) {
  const row = cardRow.get(externalId);
  if (!row) return { prices: [], meta: null };

  const cached = cache.cards[externalId];
  if (!force && cached && Date.now() - cached.ts < CARD_TTL_MS) return cached.value;

  let value = { prices: [], meta: null };
  try {
    const tid = await tcgdexCardId(row.set_name, row.number, row.name, row.set_id);
    if (tid) {
      const full = await fetchJson(`${API}/cards/${tid}`);
      const cm = full?.pricing?.cardmarket;
      const tp = full?.pricing?.tcgplayer;

      // TCGdex liefert für die zweite Preisspalte nur EIN "-holo"-Suffix,
      // das aber je Karte entweder echtes Holo ODER Reverse Holo meint -
      // welches davon steht im variants-Feld (Commons/Uncommons haben fast
      // nie echtes Holo, sondern Reverse Holo). Ohne diese Unterscheidung
      // würde z.B. bei einer Common fälschlich "Holo" statt "Reverse Holo"
      // als Variante stehen.
      const v = full?.variants ?? {};
      const specialVariant = v.reverse && !v.holo ? "reverse" : "holo";

      const cmRows = cm ? cardmarketRows(cm, specialVariant) : [];

      if (cmRows.length) {
        value = {
          prices: cmRows,
          meta: { basis: "cardmarket", productId: cm.idProduct ?? null, updated: cm.updated ?? null },
        };
        value = (await correctSharedProduct(row, cm, specialVariant).catch((e) => { console.warn(`[preise] Gegenprüfung ${externalId}: ${e.message}`); return null; })) ?? value; // nicht erreichbar: TCGdex-Werte behalten
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

  // TCGdex hat keinen Preis: zweite Quelle versuchen
  if (!value.prices.length) {
    try {
      value = await pokemonTcgFallback(externalId);
    } catch {
      return value; // auch die zweite Quelle gerade nicht erreichbar -> nicht cachen
    }
  }

  // Leere Ergebnisse nicht (lange) cachen – vielleicht ist die Quelle nur
  // kurz unvollständig.
  if (value.prices.length) {
    cache.cards[externalId] = { ts: Date.now(), value };
    persistCache();
  }
  return value;
}

// Rückfallebene, wenn TCGdex für eine Karte gar keinen Preis hat (z. B. viele
// Promos): die Preisdaten von pokemontcg.io. Zuerst deren Cardmarket-Wert (EUR),
// falls er frisch ist (höchstens 14 Tage alt), sonst der TCGplayer-Marktpreis
// (USD, umgerechnet). Die Abrufe laufen mit Abstand, damit die kostenlose API
// nicht drosselt.
const FALLBACK_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
// Starts mindestens 350 ms auseinander (ca. 3 Abrufe pro Sekunde), die Abrufe selbst
// laufen aber gleichzeitig - die kostenlose API antwortet manchmal sehr langsam.
let nextSlot = 0;
const paced = async (fn) => {
  const start = Math.max(Date.now(), nextSlot);
  nextSlot = start + 350;
  if (start > Date.now()) await new Promise((r) => setTimeout(r, start - Date.now()));
  return fn();
};
// Preiszeilen aus einem Cardmarket-Datensatz (TCGdex oder Cardmarkets Preisliste:
// gleiche Feldnamen, die zweite Spalte endet auf "-holo").
export function cardmarketRows(cm, specialVariant) {
  return [
    eurRow("normal", "trend", cm.trend),
    eurRow("normal", "low", cm.low),
    eurRow("normal", "avg30", cm.avg30),
    eurRow(specialVariant, "trend", cm["trend-holo"]),
    eurRow(specialVariant, "low", cm["low-holo"]),
    eurRow(specialVariant, "avg30", cm["avg30-holo"]),
  ].filter(Boolean);
}

const eurRow = (variant, priceType, price) =>
  price > 0 ? { source: "cardmarket", variant, price_type: priceType, currency: "EUR", price: Math.round(price * 100) / 100 } : null;

// Preise aus den Rohdaten von pokemontcg.io: deren Cardmarket-Wert (wenn nicht älter
// als maxAgeMs), sonst der TCGplayer-Marktpreis (USD, umgerechnet).
async function pricesFromRaw(raw, maxAgeMs) {
  const cm = raw.cardmarket;
  const p = cm?.prices;
  const updated = cm?.updatedAt ? Date.parse(String(cm.updatedAt).replace(/\//g, "-")) : NaN;
  if (p && p.trendPrice > 0 && Date.now() - updated < maxAgeMs) {
    const rows = [
      eurRow("normal", "trend", p.trendPrice),
      eurRow("normal", "low", p.lowPrice),
      eurRow("normal", "avg30", p.avg30),
      eurRow("reverse", "trend", p.reverseHoloTrend),
    ].filter(Boolean);
    return { prices: rows, meta: { basis: "cardmarket", productId: null, updated: cm.updatedAt } };
  }

  const tp = raw.tcgplayer;
  const variant = tp?.prices && Object.values(tp.prices).find((v) => v?.market > 0 || v?.mid > 0);
  const usd = variant?.market ?? variant?.mid;
  if (usd > 0) {
    const rate = await usdToEur();
    return {
      prices: [{ source: "tcgplayer", variant: "normal", price_type: "trend", currency: "EUR", price: Math.round(usd * rate * 100) / 100 }],
      meta: { basis: "tcgplayer", productId: null, updated: tp.updatedAt ?? null, usdRate: rate },
    };
  }
  return { prices: [], meta: null };
}

async function pokemonTcgFallback(externalId) {
  const raw = await paced(() => getRawPricesById(externalId));
  return raw ? pricesFromRaw(raw, FALLBACK_MAX_AGE_MS) : { prices: [], meta: null };
}

// Gegenprüfung: TCGdex ordnet bei mehreren Karten mit gleichem Namen im selben Set
// manchmal allen dasselbe Cardmarket-Produkt zu (z. B. Ponyta Nr. 46 und 72 bekommen
// den Preis der glänzenden SH11). Teilt sich die Karte ihr Produkt mit einer anderen
// Karte DESSELBEN Sets, wird der TCGdex-Trend mit dem TCGplayer-Marktpreis von
// Zuerst wird versucht, das richtige Produkt in Cardmarkets eigener Preisliste zu finden
// (cardmarketGuide.js: gleicher Name, gleiche Fähigkeiten/Angriffe) - das liefert den
// frischen Cardmarket-Wert der Karte. Gelingt das nicht, wird mit pokemontcg.io verglichen:
//  - hat pokemontcg.io für die Karte einen eigenen Cardmarket-Wert und weicht der
//    TCGdex-Trend um mehr als den Faktor 1,8 (und mehr als 1 EUR) davon ab, gilt die
//    Zuordnung als falsch (z. B. neun Arceus-Karten AR1-AR9 mit identischen 30 EUR,
//    obwohl jede ihren eigenen Wert hat)
//  - sonst: ist der TCGdex-Trend mehr als dreimal so hoch wie der TCGplayer-Marktpreis
//    (und mindestens 2 EUR darüber), gilt sie ebenfalls als falsch
// Dann zählen die Werte von pokemontcg.io (Cardmarket, auch wenn älter, sonst TCGplayer).
const sharedProductStmt = db.prepare(
  `SELECT 1 FROM cards WHERE cardmarket_product_id = ? AND set_id = ? AND external_id != ? LIMIT 1`
);
async function correctSharedProduct(row, cm, specialVariant) {
  const shared = cm.idProduct && sharedProductStmt.get(cm.idProduct, row.set_id, row.external_id);
  if (!shared && !row.price_valid_from) return null; // Karte ist unauffällig

  // 1) Cardmarkets eigene Preisliste: das Produkt mit denselben Fähigkeiten/Angriffen
  const hit = await resolveProduct(row, cm.idProduct).catch(() => null);
  if (hit) {
    return {
      prices: cardmarketRows(hit.cm, specialVariant),
      meta: { basis: "cardmarket", productId: hit.idProduct, updated: hit.cm.updated ?? null, corrected: true },
    };
  }
  if (!shared) return null;

  // 2) Vergleich mit pokemontcg.io
  const raw = await paced(() => getRawPricesById(row.external_id));
  const cmOwn = raw?.cardmarket?.prices?.trendPrice;
  if (cmOwn > 0) {
    if (Math.max(cm.trend / cmOwn, cmOwn / cm.trend) <= 1.8 || Math.abs(cm.trend - cmOwn) < 1) return null;
  } else {
    const prices = raw?.tcgplayer?.prices;
    const ref = prices && (prices.normal?.market > 0 ? prices.normal : Object.values(prices).find((v) => v?.market > 0));
    if (!ref) return null;
    const refEur = ref.market * (await usdToEur());
    if (!(cm.trend > 3 * refEur && cm.trend - refEur >= 2)) return null;
  }
  const fixed = await pricesFromRaw(raw, Infinity);
  if (!fixed.prices.length) return null;
  // Produkt-ID bleibt gespeichert (damit die Mehrfachvergabe weiter erkannt wird)
  return { prices: fixed.prices, meta: { ...fixed.meta, productId: cm.idProduct, corrected: true } };
}

export function cardmarketUrl(productId) {
  return productId
    ? `https://www.cardmarket.com/de/Pokemon/Products/Singles?idProduct=${productId}`
    : null;
}
