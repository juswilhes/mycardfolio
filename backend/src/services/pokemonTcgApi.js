// Anbindung an https://pokemontcg.io (kostenlose API, optionaler API-Key für höhere Rate-Limits)
// Doku: https://docs.pokemontcg.io
const BASE_URL = "https://api.pokemontcg.io/v2";

function headers() {
  const h = { "Content-Type": "application/json" };
  if (process.env.POKEMONTCG_API_KEY) {
    h["X-Api-Key"] = process.env.POKEMONTCG_API_KEY;
  }
  return h;
}

// fetch mit hartem Timeout - die kostenlose API antwortet manchmal gar
// nicht (502). Ohne Timeout würde ein Request die ganze Antwort blockieren.
async function fetchJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: headers(), signal: ctrl.signal });
    if (!res.ok) throw new Error(`Pokemon TCG API Fehler: ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// Einzelne Karte per externer ID nachladen (Fallback für Karten, die nicht im
// lokalen Datensatz stecken)
export async function getCardById(externalId, timeoutMs = 8000) {
  const json = await fetchJson(`${BASE_URL}/cards/${externalId}`, timeoutMs);
  return mapCard(json.data);
}

// Normalisiert die API-Antwort auf unser internes Format. Preise kommen
// NICHT von hier - dafür ist priceProvider.js (Cardmarket/EUR) zuständig.
function mapCard(c) {
  return {
    external_id: c.id,
    name: c.name,
    set_name: c.set?.name,
    number: c.number,
    rarity: c.rarity,
    image_small: c.images?.small,
    image_large: c.images?.large, // Artwork liegt bei dieser API auf Englisch vor
  };
}
