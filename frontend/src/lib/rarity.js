// Anzeigename einer Seltenheit aus der Datenquelle.
export function rarityLabel(rarity, setName = "") {
  if (rarity == null || rarity === "None") return /classic collection/i.test(setName) ? "Classic Collection" : "Ohne Seltenheit";
  // Rohwerte aus der Datenquelle ("MEGA_ATTACK_RARE") lesbar machen
  if (/^[A-Z_]+$/.test(rarity)) {
    return rarity.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  }
  // Die Quelle schreibt dieselbe Seltenheit mal "Illustration rare", mal "Illustration Rare"
  return rarity.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// Reihenfolge von gewöhnlich nach selten (für Filter und Sortierung auf der Set-Seite).
// Gleiche Zahl = gleiche Stufe unter anderem Namen (ältere Sets nennen "Ultra Rare" z. B. "Rare Ultra").
// Unbekannte Seltenheiten landen vor Promo/Ohne Seltenheit am Ende.
const RANK = {
  common: 1,
  uncommon: 2,
  rare: 3,
  "rare holo": 4,
  "rare holo star": 5,
  "rare prime": 5,
  legend: 5,
  "rare holo lv.x": 5,
  "rare holo ex": 5,
  "rare holo gx": 5,
  "rare break": 5,
  "rare prism star": 5,
  "rare holo v": 5,
  "rare holo vmax": 6,
  "rare holo vstar": 6,
  "double rare": 6,
  "rare ace": 7,
  "ace spec rare": 7,
  "radiant rare": 7,
  "amazing rare": 7,
  "rare shining": 8,
  "trainer gallery rare holo": 8,
  "classic collection": 8,
  "rare shiny": 9,
  "shiny rare": 9,
  "illustration rare": 10,
  "pikachu rare": 10,
  "rare ultra": 11,
  "ultra rare": 11,
  "rare shiny gx": 12,
  "shiny ultra rare": 12,
  "rare rainbow": 13,
  "special illustration rare": 14,
  "mega attack rare": 14,
  "rare secret": 15,
  "hyper rare": 15,
  "rgb rare": 15,
  "futuristic rare": 15,
  "black white rare": 15,
  "mega hyper rare": 16,
  promo: 90,
};

export function rarityKey(rarity) {
  if (rarity == null || rarity === "None") return "none";
  return rarity.toLowerCase().replace(/_/g, " ");
}

export function rarityRank(rarity) {
  const key = rarityKey(rarity);
  if (key === "none") return 99;
  return RANK[key] ?? 50;
}
