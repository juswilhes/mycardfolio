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
