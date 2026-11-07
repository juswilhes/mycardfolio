// Cardmarkets öffentliche Tagesdateien (Produktliste + Preisliste für Pokémon, ohne Zugang
// frei herunterladbar, täglich neu): https://www.cardmarket.com -> Download-Bereich.
// Genutzt, um Karten das RICHTIGE Cardmarket-Produkt zuzuordnen, wenn TCGdex mehreren
// gleichnamigen Karten desselben Sets dasselbe Produkt gibt (siehe priceProvider.js).
// Die Produktnamen enthalten die Fähigkeiten/Angriffe der Karte, z. B.
// "Arceus Lv.100 [Water | Fastwave]" - damit lässt sich jede Karte eindeutig finden.

const PRICES_URL = "https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json";
const PRODUCTS_URL = "https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json";
// Versiegelte Produkte (Booster, Displays, ETBs ...) - Preise stehen in derselben Preisliste (sealedPrices.js)
const SEALED_URL = "https://downloads.s3.cardmarket.com/productCatalog/productList/products_nonsingles_6.json";

let cache = null;
let loading = null;
let dropTimer = null;

async function download(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000), headers: { "User-Agent": "MyCardfolio/1.0" } });
  if (!res.ok) throw new Error(`Cardmarket-Liste: HTTP ${res.status}`);
  return res.json();
}

// Lädt beide Listen höchstens einmal pro Tag (die Dateien sind je ca. 15 MB) und hält sie
// im Speicher; nach 30 Minuten ohne Nutzung wird der Speicher wieder freigegeben.
export async function loadGuide() {
  const day = new Date().toISOString().slice(0, 10);
  if (!(cache?.day === day)) {
    loading ??= (async () => {
      const [pl, pg, sl] = await Promise.all([download(PRODUCTS_URL), download(PRICES_URL), download(SEALED_URL)]);
      const products = new Map();
      const byExpansion = new Map();
      for (const p of pl.products) {
        const entry = { id: p.idProduct, name: p.name, expansion: p.idExpansion };
        products.set(p.idProduct, entry);
        if (!byExpansion.has(p.idExpansion)) byExpansion.set(p.idExpansion, []);
        byExpansion.get(p.idExpansion).push(entry);
      }
      const sealedByExpansion = new Map();
      for (const p of sl.products) {
        const entry = { id: p.idProduct, name: p.name, category: p.categoryName, expansion: p.idExpansion };
        if (!sealedByExpansion.has(p.idExpansion)) sealedByExpansion.set(p.idExpansion, []);
        sealedByExpansion.get(p.idExpansion).push(entry);
      }
      const prices = new Map(pg.priceGuides.map((r) => [r.idProduct, r]));
      cache = { day, products, byExpansion, sealedByExpansion, prices, updated: pg.createdAt };
    })().finally(() => {
      loading = null;
    });
    await loading;
  }
  clearTimeout(dropTimer);
  dropTimer = setTimeout(() => {
    cache = null;
  }, 30 * 60 * 1000);
  dropTimer.unref?.();
  return cache;
}

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const parseList = (json) => {
  try {
    return JSON.parse(json) ?? [];
  } catch {
    return [];
  }
};
// "Arceus Lv.100 [Water | Fastwave]" -> { base: "Arceus Lv.100", bracket: "Water | Fastwave" }
const splitName = (name) => {
  const m = name.match(/^(.*?)\s*(?:\[(.*)\])?\s*$/);
  return { base: m[1], bracket: m[2] ?? "" };
};

// Gleicher Angriffsname, ein Tippfehler erlaubt (TCGdex: "Sprial Drain" bei Leafeon dp5-24) - nur bei längeren Namen
function sameAttack(a, b) {
  if (a === b) return true;
  if (a.length < 6 || Math.abs(a.length - b.length) > 1) return false;
  // Abstand höchstens 1 (ersetzt, eingefügt, gelöscht oder zwei Nachbarn vertauscht)
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length] <= 1;
}

// Erweiterung (Cardmarket) zu einem Produkt
export const expansionOfProduct = (guide, productId) => guide.products.get(productId)?.expansion ?? null;

// Sucht zu einer Karte das passende Cardmarket-Produkt innerhalb einer Erweiterung:
//  - Karten mit Fähigkeiten/Angriffen: gleicher Name, und alle Fähigkeiten-/Angriffsnamen
//    der Karte kommen im Cardmarket-Namen vor (bei alten Karten fehlen uns z. B. die
//    Poké-Power-Namen, deshalb reicht "enthalten"); gewinnt das Produkt mit den wenigsten
//    zusätzlichen Namen
//  - Karten ohne (Trainer, Energien): genau ein Produkt mit exakt diesem Namen und ohne
//    Klammer-Zusatz
// Nur ein EINDEUTIGER Treffer zählt (sonst null).
// Rückgabe: { idProduct, cm } mit den Preisfeldern der Preisliste (trend, low, avg30 ...).
export function resolveInExpansion(guide, card, expansionId, { preferOldest = false } = {}) {
  if (!expansionId) return null;
  const ours = [...parseList(card.abilities), ...parseList(card.attacks)].map((a) => norm(a.name)).filter(Boolean);
  const wanted = norm(card.name);
  const hits = [];
  for (const p of guide.byExpansion.get(expansionId) ?? []) {
    const { base, bracket } = splitName(p.name);
    const a = norm(base);
    if (ours.length) {
      if (!(a.startsWith(wanted) || wanted.startsWith(a))) continue;
      const theirs = bracket.split("|").map(norm).filter(Boolean);
      if (ours.every((t) => theirs.some((x) => sameAttack(t, x)))) hits.push({ p, extra: theirs.length - ours.length });
    } else if (a === wanted && !bracket) {
      hits.push({ p, extra: 0 });
    }
  }
  if (!hits.length) return null;
  const best = Math.min(...hits.map((h) => h.extra));
  const top = hits.filter((h) => h.extra === best);
  // Mehrere völlig gleiche Produkte (z. B. zwei Auflagen derselben Promo): nur wenn wir
  // sonst gar keine Zuordnung haben, das ÄLTESTE (kleinste ID = erste Auflage) nehmen
  if (top.length !== 1 && !(preferOldest && top.length)) return null;
  const chosen = top.reduce((a, b) => (b.p.id < a.p.id ? b : a));
  const row = guide.prices.get(chosen.p.id);
  return row ? { idProduct: chosen.p.id, cm: { ...row, idProduct: chosen.p.id, updated: guide.updated } } : null;
}

// Cardmarket-Erweiterung eines Sets, dessen Karten noch kein einziges Produkt haben (neues Set aus
// tcgplayerSetImport.js): die Erweiterung, in der die meisten Karten über Name + Angriffe eindeutig zu finden
// sind - mindestens 10 Karten und 40 % der Karten mit Angriffen, sonst keine.
export function guessExpansion(guide, cards) {
  const withAttacks = cards.filter((c) => parseList(c.abilities).length + parseList(c.attacks).length > 0);
  if (withAttacks.length < 10) return null;
  const prefix = (s) => norm(s).slice(0, 5);
  const byPrefix = new Map();
  for (const p of guide.products.values()) {
    const k = prefix(splitName(p.name).base);
    if (!byPrefix.has(k)) byPrefix.set(k, new Set());
    byPrefix.get(k).add(p.expansion);
  }
  const counts = new Map();
  for (const c of withAttacks) {
    for (const exp of byPrefix.get(prefix(c.name)) ?? []) {
      if (resolveInExpansion(guide, c, exp)) counts.set(exp, (counts.get(exp) ?? 0) + 1);
    }
  }
  const [best, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
  return n >= 10 && n >= withAttacks.length * 0.4 ? best : null;
}

// Wie resolveInExpansion, mit der Erweiterung eines (falsch geteilten) Produkts
export async function resolveProduct(card, sharedProductId) {
  if (!sharedProductId) return null;
  const guide = await loadGuide();
  return resolveInExpansion(guide, card, expansionOfProduct(guide, sharedProductId));
}
