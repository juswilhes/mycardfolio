import db from "../db/index.js";

const insertStmt = db.prepare(`
  INSERT INTO sealed_products (
    user_id, set_id, set_name, name, image_url, quantity,
    purchase_price, shipping_cost, purchase_date, current_value, cardmarket_url, notes, catalog_id
  ) VALUES (
    @user_id, @set_id, @set_name, @name, @image_url, @quantity,
    @purchase_price, @shipping_cost, @purchase_date, @current_value, @cardmarket_url, @notes, @catalog_id
  )
`);

export function createSealedProduct(userId, values) {
  const info = insertStmt.run({
    user_id: userId,
    set_id: values.setId || null,
    set_name: values.setName || null,
    name: values.name,
    image_url: values.imageUrl || null,
    quantity: values.quantity ?? 1,
    purchase_price: values.purchasePrice ?? null,
    shipping_cost: values.shippingCost ?? null,
    purchase_date: values.purchaseDate || null,
    current_value: values.currentValue ?? null,
    cardmarket_url: values.cardmarketUrl || null,
    notes: values.notes || null,
    catalog_id: catalogIdOrNull(values.catalogId),
  });
  return info.lastInsertRowid;
}

// Mit Katalog-Eintrag: automatischer Wert (auto_value, jede Nacht) und Bild; ein eigener Wert (current_value) geht vor
export const listSealedProducts = db.prepare(`
  SELECT sp.*, sc.price_cents / 100.0 AS auto_value, sc.updated_at AS auto_value_at, sc.image AS catalog_image,
         COALESCE(sc.cm_name, sc.name) AS catalog_cm_name
  FROM sealed_products sp LEFT JOIN sealed_catalog sc ON sc.id = sp.catalog_id
  WHERE sp.user_id = ? ORDER BY sp.created_at DESC
`);

const catalogExists = db.prepare(`SELECT 1 FROM sealed_catalog WHERE id = ?`);
const catalogIdOrNull = (v) => (v != null && v !== "" && Number.isInteger(Number(v)) && catalogExists.get(Number(v)) ? Number(v) : null);

const updateStmt = db.prepare(`
  UPDATE sealed_products SET
    name = @name,
    quantity = @quantity,
    purchase_price = @purchase_price,
    shipping_cost = @shipping_cost,
    purchase_date = @purchase_date,
    current_value = @current_value,
    cardmarket_url = @cardmarket_url,
    notes = @notes,
    image_url = @image_url,
    catalog_id = @catalog_id
  WHERE id = @id AND user_id = @user_id
`);

export function updateSealedProduct(userId, id, values) {
  return updateStmt.run({
    id,
    user_id: userId,
    name: values.name,
    quantity: values.quantity ?? 1,
    purchase_price: values.purchasePrice ?? null,
    shipping_cost: values.shippingCost ?? null,
    purchase_date: values.purchaseDate || null,
    current_value: values.currentValue ?? null,
    cardmarket_url: values.cardmarketUrl || null,
    notes: values.notes || null,
    image_url: values.imageUrl || null,
    catalog_id: catalogIdOrNull(values.catalogId),
  });
}

export const deleteSealedProduct = db.prepare(`
  DELETE FROM sealed_products WHERE id = ? AND user_id = ?
`);
