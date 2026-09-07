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

// Suche nach Karten per Namen, z.B. für die "Karte hinzufügen"-Ansicht
export async function searchCards(query, pageSize = 20) {
  const url = `${BASE_URL}/cards?q=name:"${encodeURIComponent(query)}*"&pageSize=${pageSize}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Pokemon TCG API Fehler: ${res.status}`);
  const json = await res.json();
  return json.data.map(mapCard);
}

// Einzelne Karte per externer ID nachladen (u.a. für den Preis-Refresh-Job)
export async function getCardById(externalId) {
  const res = await fetch(`${BASE_URL}/cards/${externalId}`, { headers: headers() });
  if (!res.ok) throw new Error(`Pokemon TCG API Fehler: ${res.status}`);
  const json = await res.json();
  return mapCard(json.data);
}

// Alle Sets (Erweiterungen), neueste zuerst - Grundlage für die "Alle Karten"-Seite
export async function getSets() {
  const res = await fetch(`${BASE_URL}/sets?orderBy=-releaseDate`, { headers: headers() });
  if (!res.ok) throw new Error(`Pokemon TCG API Fehler: ${res.status}`);
  const json = await res.json();
  return json.data.map(mapSet);
}

export async function getSetById(setId) {
  const res = await fetch(`${BASE_URL}/sets/${setId}`, { headers: headers() });
  if (!res.ok) throw new Error(`Pokemon TCG API Fehler: ${res.status}`);
  const json = await res.json();
  return mapSet(json.data);
}

// Alle Karten eines einzelnen Sets, sortiert nach Kartennummer
export async function getCardsBySet(setId) {
  const res = await fetch(`${BASE_URL}/cards?q=set.id:${setId}&orderBy=number&pageSize=250`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Pokemon TCG API Fehler: ${res.status}`);
  const json = await res.json();
  return json.data.map(mapCard);
}

function mapSet(s) {
  return {
    id: s.id,
    name: s.name,
    series: s.series,
    release_date: s.releaseDate,
    total: s.total,
    logo: s.images?.logo,
    symbol: s.images?.symbol,
  };
}

// Normalisiert die API-Antwort auf unser internes Format, inkl. aller
// verfügbaren Preis-Datenpunkte (TCGplayer = USD, Cardmarket = EUR)
function mapCard(c) {
  const prices = [];
  const tp = c.tcgplayer?.prices;
  if (tp) {
    for (const [variant, values] of Object.entries(tp)) {
      // variant z.B. "holofoil", "normal", "reverseHolofoil"
      if (values?.market != null) {
        prices.push({ source: "tcgplayer", price_type: variant, currency: "USD", price: values.market });
      }
    }
  }
  const cm = c.cardmarket?.prices;
  if (cm?.trendPrice != null) {
    prices.push({ source: "cardmarket", price_type: "trend", currency: "EUR", price: cm.trendPrice });
  }

  return {
    external_id: c.id,
    name: c.name,
    set_name: c.set?.name,
    number: c.number,
    rarity: c.rarity,
    image_small: c.images?.small,
    image_large: c.images?.large, // Artwork liegt bei dieser API auf Englisch vor
    prices,
  };
}
