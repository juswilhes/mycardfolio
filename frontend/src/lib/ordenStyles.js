// Form + Farbschema je Orden. Jede Kennung bekommt ein eigenes kleines Motiv
// (siehe ordenShapes.js), das zum NAMEN des Ordens passt (Kieselorden ->
// Kiesel, Kompassorden -> Kompass ...). fillRule "evenodd" dort, wo eine Form
// aus überlappenden Kreisen eine Aussparung braucht (Kompass, Lupe,
// Perfektion, Vollendung, Zielscheibe); sonst "nonzero", damit sich
// überlappende Teile zu einer Silhouette vereinen statt Löcher zu bilden.
export const ORDEN_STYLES = {
  erster_fang: { shape: "pebbles", light: "#ece8df", base: "#a8a294", dark: "#6f6a5e" },
  pokedex_forscher: { shape: "magnifier", fillRule: "evenodd", light: "#baf7d2", base: "#35b871", dark: "#1f7d4c" },
  weltenbummler: { shape: "compass", fillRule: "evenodd", light: "#a9d6ff", base: "#4a90e2", dark: "#2a5f9e" },
  kunstkenner: { shape: "brush", light: "#f3c9ff", base: "#c86bef", dark: "#8f3fc2" },
  halber_weg: { shape: "mosaic", light: "#ffd9a0", base: "#f2994a", dark: "#c9701e" },
  sprachtalent: { shape: "tower", light: "#a8ecec", base: "#38b8b8", dark: "#227d7d" },
  wertvoller_fund: { shape: "goldbars", light: "#fff0b3", base: "#f2c14e", dark: "#c99423" },
  elementmeister: { shape: "elements", light: "#d9c2ff", base: "#8e5cf2", dark: "#5c34ad" },
  fanclub: { shape: "heartcluster", light: "#ffd0e0", base: "#ef6f9e", dark: "#c04879" },
  erster_handel: { shape: "stall", light: "#f6d3ad", base: "#c8794a", dark: "#8f4e2a" },
  meistergrad: { shape: "perfect", fillRule: "evenodd", light: "#dbe7ff", base: "#7fa8e0", dark: "#4a76b0" },
  volltreffer: { shape: "target", fillRule: "evenodd", light: "#ffc79e", base: "#f2703c", dark: "#c94a1f" },
  meistersammler: { shape: "complete", fillRule: "evenodd", light: "#d3f5c8", base: "#5cc46a", dark: "#348a40" },
  gewinnstratege: { shape: "rook", light: "#d8dde6", base: "#7b8aa3", dark: "#4c5a73" },
  kostbarkeit: { shape: "crown", light: "#fff2b8", base: "#f7d038", dark: "#c9a017" },
  treuer_trainer: { shape: "wreath", light: "#e3c9a0", base: "#b9843f", dark: "#8a5f28" },
};
