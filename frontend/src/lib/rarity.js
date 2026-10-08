// Anzeigename einer Seltenheit aus der Datenquelle.
export function rarityLabel(rarity, setName = "") {
  if (rarity === "None") return /classic collection/i.test(setName) ? "Classic Collection" : "Ohne Seltenheit";
  // Rohwerte aus der Datenquelle ("MEGA_ATTACK_RARE") lesbar machen
  if (/^[A-Z_]+$/.test(rarity)) {
    return rarity.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  }
  return rarity;
}
