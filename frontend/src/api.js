const BASE = "/api";

export async function searchCards(q) {
  const res = await fetch(`${BASE}/cards/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Suche fehlgeschlagen");
  return res.json();
}

export async function getCollection() {
  const res = await fetch(`${BASE}/collection`);
  if (!res.ok) throw new Error("Sammlung konnte nicht geladen werden");
  return res.json();
}

export async function addToCollection(payload) {
  const res = await fetch(`${BASE}/collection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Karte konnte nicht hinzugefügt werden");
  return res.json();
}

export async function matchImportRows(rows) {
  const res = await fetch(`${BASE}/collection/import/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
  if (!res.ok) throw new Error("Abgleich fehlgeschlagen");
  return res.json();
}

export async function commitImport(items) {
  const res = await fetch(`${BASE}/collection/import/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error("Import fehlgeschlagen");
  return res.json();
}

export async function updateCollectionItem(id, payload) {
  const res = await fetch(`${BASE}/collection/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Änderung konnte nicht gespeichert werden");
  return res.json();
}

export async function deleteCollectionItem(id) {
  const res = await fetch(`${BASE}/collection/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Karte konnte nicht entfernt werden");
  return res.json();
}

export async function sellCollectionItem(id, payload) {
  const res = await fetch(`${BASE}/collection/${id}/sell`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Verkauf konnte nicht gespeichert werden");
  return res.json();
}

// --- Portfolio & Verkäufe --------------------------------------------

export async function getPortfolioHistory() {
  const res = await fetch(`${BASE}/portfolio/history`);
  if (!res.ok) throw new Error("Portfolio-Verlauf konnte nicht geladen werden");
  return res.json();
}

export async function getMovers() {
  const res = await fetch(`${BASE}/portfolio/movers`);
  if (!res.ok) throw new Error("Bewegungen konnten nicht geladen werden");
  return res.json();
}

export async function getSales() {
  const res = await fetch(`${BASE}/sales`);
  if (!res.ok) throw new Error("Verkäufe konnten nicht geladen werden");
  return res.json();
}

export async function deleteSale(id) {
  const res = await fetch(`${BASE}/sales/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Verkauf konnte nicht entfernt werden");
  return res.json();
}

export async function undoSale(id) {
  const res = await fetch(`${BASE}/sales/${id}/undo`, { method: "POST" });
  if (!res.ok) throw new Error("Verkauf konnte nicht rückgängig gemacht werden");
  return res.json();
}

export async function getPriceHistory(cardId) {
  const res = await fetch(`${BASE}/cards/${cardId}/prices`);
  if (!res.ok) throw new Error("Preisverlauf konnte nicht geladen werden");
  return res.json();
}

// --- Karten-Datenbank (Sets-Übersicht) ---------------------------------

export async function getSets() {
  const res = await fetch(`${BASE}/sets`);
  if (!res.ok) throw new Error("Sets konnten nicht geladen werden");
  return res.json();
}

export async function getSet(setId) {
  const res = await fetch(`${BASE}/sets/${setId}`);
  if (!res.ok) throw new Error("Set konnte nicht geladen werden");
  return res.json();
}

export async function getCardsForSet(setId) {
  const res = await fetch(`${BASE}/sets/${setId}/cards`);
  if (!res.ok) throw new Error("Karten konnten nicht geladen werden");
  return res.json();
}

export async function getSetProgress() {
  const res = await fetch(`${BASE}/sets/progress`);
  if (!res.ok) throw new Error("Fortschritt konnte nicht geladen werden");
  return res.json();
}

export async function getOwnedInSet(setId) {
  const res = await fetch(`${BASE}/sets/${setId}/owned`);
  if (!res.ok) throw new Error("Besitz konnte nicht geladen werden");
  return res.json();
}

export async function getCardInfo(externalId) {
  const res = await fetch(`${BASE}/cards/external/${externalId}`);
  if (!res.ok) throw new Error("Karteninfo konnte nicht geladen werden");
  return res.json();
}

export async function getCardPriceHistory(externalId) {
  const res = await fetch(`${BASE}/cards/external/${externalId}/prices`);
  if (!res.ok) throw new Error("Preisverlauf konnte nicht geladen werden");
  return res.json();
}

export async function updateCardArtist(externalId, artist) {
  const res = await fetch(`${BASE}/cards/external/${externalId}/artist`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artist }),
  });
  if (!res.ok) throw new Error("Illustrator konnte nicht gespeichert werden");
  return res.json();
}
