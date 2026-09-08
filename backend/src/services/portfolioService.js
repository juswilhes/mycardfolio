import db from "../db/index.js";
import { listCollection, latestPriceForCard, priceHistoryForCard } from "./cardService.js";

const n = (v) => (v == null ? 0 : Number(v) || 0);
const today = () => new Date().toISOString().slice(0, 10);

// --- Portfolio-Wert über Zeit ---------------------------------------------

const upsertPortfolioSnapshot = db.prepare(`
  INSERT INTO portfolio_snapshots (captured_on, total_value, total_cost, card_count)
  VALUES (@day, @value, @cost, @count)
  ON CONFLICT(captured_on) DO UPDATE SET
    total_value = excluded.total_value,
    total_cost  = excluded.total_cost,
    card_count  = excluded.card_count
`);

// Einen Tages-Snapshot des Gesamt-Portfolios schreiben (idempotent pro Tag).
export function recordPortfolioSnapshot() {
  const rows = listCollection.all();
  let value = 0;
  let cost = 0;
  let count = 0;
  for (const r of rows) {
    const lp = latestPriceForCard.get(r.card_id);
    value += n(lp?.price) * r.quantity;
    if (r.purchase_price != null || r.shipping_cost != null) {
      cost += (n(r.purchase_price) + n(r.shipping_cost)) * r.quantity;
    }
    count += r.quantity;
  }
  upsertPortfolioSnapshot.run({ day: today(), value, cost, count });
}

export const portfolioHistory = db.prepare(`
  SELECT captured_on, total_value, total_cost, card_count
  FROM portfolio_snapshots
  ORDER BY captured_on ASC
`);

const round2 = (x) => Math.round(x * 100) / 100;

// Alle Trend-Snapshots (Cardmarket bevorzugt) als Tageswerte je Karte/Variante.
const trendSnapshotsAll = db.prepare(`
  SELECT card_id, COALESCE(variant, 'normal') AS variant, price,
         substr(fetched_at, 1, 10) AS day
  FROM price_snapshots
  WHERE price_type = 'trend'
  ORDER BY (source = 'cardmarket') DESC, fetched_at ASC
`);

// Wert-über-Zeit für eine GEFILTERTE Teilmenge der Sammlung. Wird genutzt,
// wenn die Sammlungsansicht nach Set/Sprache/Zeichner filtert - die
// portfolio_snapshots-Tabelle kennt nur den Gesamtwert.
export function computePortfolioHistory({ set, language, artist } = {}) {
  const items = listCollection.all().filter(
    (i) =>
      (!set || i.set_name === set) &&
      (!language || i.language === language) &&
      (!artist || i.artist === artist)
  );
  if (!items.length) return [];

  const cardIds = new Set(items.map((i) => i.card_id));
  const byKey = new Map(); // "cardId|variant" -> [{day, price}] (aufsteigend, je Tag letzter Wert)
  for (const r of trendSnapshotsAll.all()) {
    if (!cardIds.has(r.card_id)) continue;
    const key = `${r.card_id}|${r.variant}`;
    let arr = byKey.get(key);
    if (!arr) byKey.set(key, (arr = []));
    const last = arr[arr.length - 1];
    if (last && last.day === r.day) last.price = r.price;
    else arr.push({ day: r.day, price: r.price });
  }

  const days = [
    ...new Set([...[...byKey.values()].flat().map((s) => s.day), today()]),
  ].sort();
  if (!days.length) return [];

  const priceOn = (key, day) => {
    const arr = byKey.get(key);
    if (!arr || !arr.length) return null;
    let p = null;
    for (const s of arr) {
      if (s.day <= day) p = s.price;
      else break;
    }
    // Vor dem ersten Snapshot den ältesten bekannten Wert nehmen, sonst
    // entstünde am Anfang der Kurve ein künstlicher Einbruch auf 0.
    return p ?? arr[0].price;
  };

  return days.map((day) => {
    let value = 0;
    let cost = 0;
    let count = 0;
    for (const it of items) {
      const q = it.quantity || 1;
      const p =
        priceOn(`${it.card_id}|${it.variant || "normal"}`, day) ??
        priceOn(`${it.card_id}|normal`, day);
      value += n(p) * q;
      if (it.purchase_price != null || it.shipping_cost != null) {
        cost += (n(it.purchase_price) + n(it.shipping_cost)) * q;
      }
      count += q;
    }
    return {
      captured_on: day,
      total_value: round2(value),
      total_cost: round2(cost),
      card_count: count,
    };
  });
}

// --- Top-Gewinner / -Verlierer (7 Tage) ---------------------------------

export function getMovers() {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const movers = [];

  for (const c of listCollection.all()) {
    const hist = priceHistoryForCard.all(c.card_id); // {price, fetched_at} aufsteigend
    if (hist.length < 2) continue;

    const latest = hist[hist.length - 1];
    let base = hist[0];
    for (const h of hist) {
      if (new Date(h.fetched_at).getTime() <= cutoff) base = h;
      else break;
    }
    if (base === latest) continue;

    const delta = latest.price - base.price;
    if (Math.abs(delta) < 0.01) continue;

    movers.push({
      card_id: c.card_id,
      external_id: c.external_id,
      name: c.name,
      set_name: c.set_name,
      image_small: c.image_small,
      quantity: c.quantity,
      current: latest.price,
      previous: base.price,
      delta,
      delta_pct: base.price ? (delta / base.price) * 100 : 0,
      since: base.fetched_at,
    });
  }

  movers.sort((a, b) => b.delta - a.delta);
  return {
    gainers: movers.filter((m) => m.delta > 0).slice(0, 3),
    losers: movers.filter((m) => m.delta < 0).slice(-3).reverse(),
  };
}

// --- Verkäufe ----------------------------------------------------------

const collectionItemFull = db.prepare(`
  SELECT ci.*, c.external_id, c.name, c.set_name, c.number, c.image_small
  FROM collection_items ci JOIN cards c ON c.id = ci.card_id
  WHERE ci.id = ?
`);

const insertSale = db.prepare(`
  INSERT INTO sales
    (card_id, external_id, name, set_name, number, image_small, quantity, condition, language, variant,
     grading_company, grade,
     purchase_price, shipping_cost, purchase_date, purchase_notes,
     sale_price, sale_shipping, sale_fees, sold_on, notes)
  VALUES
    (@card_id, @external_id, @name, @set_name, @number, @image_small, @quantity, @condition, @language, @variant,
     @grading_company, @grade,
     @purchase_price, @shipping_cost, @purchase_date, @purchase_notes,
     @sale_price, @sale_shipping, @sale_fees, @sold_on, @notes)
`);

const restoreCollectionItem = db.prepare(`
  INSERT INTO collection_items
    (card_id, quantity, condition, purchase_price, shipping_cost, purchase_date, notes, language, variant,
     grading_company, grade)
  VALUES
    (@card_id, @quantity, @condition, @purchase_price, @shipping_cost, @purchase_date, @notes, @language, @variant,
     @grading_company, @grade)
`);
const saleById = db.prepare(`SELECT * FROM sales WHERE id = ?`);

const removeCollectionItem = db.prepare(`DELETE FROM collection_items WHERE id = ?`);

// Sammlungseintrag "verkaufen": nach sales verschieben, aus der Sammlung nehmen.
export function sellCollectionItem(id, sale) {
  const item = collectionItemFull.get(Number(id));
  if (!item) return null;

  const tx = db.transaction(() => {
    insertSale.run({
      card_id: item.card_id,
      external_id: item.external_id,
      name: item.name,
      set_name: item.set_name,
      number: item.number,
      image_small: item.image_small,
      quantity: item.quantity,
      condition: item.condition,
      language: item.language,
      variant: item.variant ?? "normal",
      grading_company: item.grading_company ?? null,
      grade: item.grade ?? null,
      purchase_price: item.purchase_price,
      shipping_cost: item.shipping_cost,
      purchase_date: item.purchase_date,
      purchase_notes: item.notes,
      sale_price: sale.salePrice,
      sale_shipping: sale.saleShipping,
      sale_fees: sale.saleFees,
      sold_on: sale.soldOn,
      notes: sale.notes,
    });
    removeCollectionItem.run(Number(id));
  });
  tx();
  return true;
}

// Verkauf rückgängig: Eintrag wieder in die Sammlung, Verkauf entfernen.
export function undoSale(id) {
  const s = saleById.get(Number(id));
  if (!s) return null;
  const tx = db.transaction(() => {
    restoreCollectionItem.run({
      card_id: s.card_id,
      quantity: s.quantity ?? 1,
      condition: s.condition,
      purchase_price: s.purchase_price,
      shipping_cost: s.shipping_cost,
      purchase_date: s.purchase_date,
      notes: s.purchase_notes,
      language: s.language ?? "en",
      variant: s.variant ?? "normal",
      grading_company: s.grading_company ?? null,
      grade: s.grade ?? null,
    });
    deleteSaleRow.run(Number(id));
  });
  tx();
  return true;
}

const salesRows = db.prepare(`SELECT * FROM sales ORDER BY sold_on DESC, id DESC`);
const deleteSaleRow = db.prepare(`DELETE FROM sales WHERE id = ?`);

// realisierter Gewinn/Verlust eines Verkaufs
function realized(s) {
  const proceeds = n(s.sale_price) + n(s.sale_shipping) - n(s.sale_fees);
  const cost = n(s.purchase_price) + n(s.shipping_cost);
  return (proceeds - cost) * (s.quantity || 1);
}

export function listSales() {
  const rows = salesRows.all().map((s) => ({ ...s, realized: realized(s) }));
  const stats = rows.reduce(
    (acc, s) => {
      acc.total_realized += s.realized;
      acc.total_proceeds += (n(s.sale_price) + n(s.sale_shipping) - n(s.sale_fees)) * (s.quantity || 1);
      acc.count += 1;
      return acc;
    },
    { total_realized: 0, total_proceeds: 0, count: 0 }
  );
  return { sales: rows, stats };
}

export function deleteSale(id) {
  return deleteSaleRow.run(Number(id)).changes > 0;
}
