// Welcher Booster-/Displaypreis gilt für ein Set? Automatisch der von Cardmarket (sealedPrices.js, Nachtlauf);
// hat der Betreiber selbst Preise eingetragen (manual_prices_override = 1), gehen seine vor. Fehlt einer der
// beiden Werte, springt der andere ein. Als SQL-Spalten, damit alle Analysen dieselbe Regel nutzen.
export const EFFECTIVE_SET_PRICES = `
  CASE WHEN manual_prices_override = 1 THEN COALESCE(box_price_cents, auto_box_price_cents)
       ELSE COALESCE(auto_box_price_cents, box_price_cents) END AS box_price_cents,
  CASE WHEN manual_prices_override = 1 THEN COALESCE(booster_price_cents, auto_booster_price_cents)
       ELSE COALESCE(auto_booster_price_cents, booster_price_cents) END AS booster_price_cents,
  CASE WHEN manual_prices_override = 1 OR (auto_box_price_cents IS NULL AND auto_booster_price_cents IS NULL)
       THEN prices_updated_at ELSE auto_prices_at END AS prices_updated_at,
  CASE WHEN manual_prices_override = 1 OR (auto_box_price_cents IS NULL AND auto_booster_price_cents IS NULL)
       THEN 'manuell' ELSE 'cardmarket' END AS price_source`;

export const HAS_SET_PRICE = `(box_price_cents IS NOT NULL OR booster_price_cents IS NOT NULL
  OR auto_box_price_cents IS NOT NULL OR auto_booster_price_cents IS NOT NULL)`;
