import db from "../db/index.js";

const insertStmt = db.prepare(`
  INSERT INTO sealed_products (
    user_id, set_id, set_name, name, image_url, quantity,
    purchase_price, shipping_cost, purchase_date, current_value, cardmarket_url, notes
  ) VALUES (
    @user_id, @set_id, @set_name, @name, @image_url, @quantity,
    @purchase_price, @shipping_cost, @purchase_date, @current_value, @cardmarket_url, @notes
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
  });
  return info.lastInsertRowid;
}

export const listSealedProducts = db.prepare(`
  SELECT * FROM sealed_products WHERE user_id = ? ORDER BY created_at DESC
`);

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
    image_url = @image_url
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
  });
}

export const deleteSealedProduct = db.prepare(`
  DELETE FROM sealed_products WHERE id = ? AND user_id = ?
`);
