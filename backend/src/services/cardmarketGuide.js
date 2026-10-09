// Cardmarkets öffentliche Tagesdateien (Produktliste + Preisliste für Pokémon, ohne Zugang
// frei herunterladbar, täglich neu): https://www.cardmarket.com -> Download-Bereich.
// Genutzt, um Karten das RICHTIGE Cardmarket-Produkt zuzuordnen, wenn TCGdex mehreren
// gleichnamigen Karten desselben Sets dasselbe Produkt gibt (siehe priceProvider.js).
// Die Produktnamen enthalten die Fähigkeiten/Angriffe der Karte, z. B.
// "Arceus Lv.100 [Water | Fastwave]" - damit lässt sich jede Karte eindeutig finden.

const PRICES_URL = "https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json";
const PRODUCTS_URL = "https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json";

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
      const [pl, pg] = await Promise.all([download(PRODUCTS_URL), download(PRICES_URL)]);
      const products = new Map();
      const byExpansion = new Map();
      for (const p of pl.products) {
        const entry = { id: p.idProduct, name: p.name, expansion: p.idExpansion };
        products.set(p.idProduct, entry);
        if (!byExpansion.has(p.idExpansion)) byExpansion.set(p.idExpansion, []);
        byExpansion.get(p.idExpansion).push(entry);
      }
      const prices = new Map(pg.priceGuides.map((r) => [r.idProduct, r]));
      cache = { day, products, byExpansion, prices, updated: pg.createdAt };
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

// Sucht zu einer Karte das passende Cardmarket-Produkt innerhalb der Erweiterung des
// (falsch geteilten) Produkts `sharedProductId`: gleicher Name, und alle Fähigkeiten-/
// Angriffsnamen der Karte kommen im Cardmarket-Namen vor (bei alten Karten fehlen uns
// z. B. die Poké-Power-Namen, deshalb reicht "enthalten"). Gewinnt das Produkt mit den
// wenigsten zusätzlichen Namen; nur ein EINDEUTIGER Treffer zählt (sonst null).
// Rückgabe: { idProduct, cm } mit den Preisfeldern der Preisliste (trend, low, avg30 ...).
export async function resolveProduct(card, sharedProductId) {
  const ours = [...parseList(card.abilities), ...parseList(card.attacks)].map((a) => norm(a.name)).filter(Boolean);
  if (!ours.length || !sharedProductId) return null; // Trainer/Energien ohne Angriffe: nicht eindeutig
  const guide = await loadGuide();
  const shared = guide.products.get(sharedProductId);
  if (!shared) return null;
  const wanted = norm(card.name);
  const hits = [];
  for (const p of guide.byExpansion.get(shared.expansion) ?? []) {
    const { base, bracket } = splitName(p.name);
    const a = norm(base);
    if (!(a.startsWith(wanted) || wanted.startsWith(a))) continue;
    const theirs = bracket.split("|").map(norm).filter(Boolean);
    if (ours.every((t) => theirs.includes(t))) hits.push({ p, extra: theirs.length - ours.length });
  }
  if (!hits.length) return null;
  const best = Math.min(...hits.map((h) => h.extra));
  const top = hits.filter((h) => h.extra === best);
  if (top.length !== 1) return null;
  const row = guide.prices.get(top[0].p.id);
  return row ? { idProduct: top[0].p.id, cm: { ...row, idProduct: top[0].p.id, updated: guide.updated } } : null;
}
