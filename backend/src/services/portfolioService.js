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
    (card_id, external_id, name, set_name, number, image_small, quantity, condition, language,
     purchase_price, shipping_cost, sale_price, sale_shipping, sale_fees, sold_on, notes)
  VALUES
    (@card_id, @external_id, @name, @set_name, @number, @image_small, @quantity, @condition, @language,
     @purchase_price, @shipping_cost, @sale_price, @sale_shipping, @sale_fees, @sold_on, @notes)
`);

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
      purchase_price: item.purchase_price,
      shipping_cost: item.shipping_cost,
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
