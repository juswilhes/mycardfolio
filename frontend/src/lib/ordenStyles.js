// Form + Farbschema je Orden. Jede Kennung bekommt ein eigenes kleines Motiv
// (siehe ordenShapes.js) statt einer schlichten Einzelform - im Stil des
// Kunstkenner-Blüten-Clusters. fillRule "evenodd" dort, wo eine Form aus
// überlappenden Kreisen eine Aussparung braucht (Pokéball, Lupe, Mondsichel,
// Zielscheibe); sonst "nonzero", damit sich überlappende Teile zu einer
// Silhouette vereinen statt Löcher zu bilden.
export const ORDEN_STYLES = {
  erster_fang: { shape: "pokeball", fillRule: "evenodd", light: "#ffb199", base: "#ef6a52", dark: "#c94a34" },
  erster_handel: { shape: "coinstack", light: "#b8ecd4", base: "#4caf7d", dark: "#2f7d55" },
  weltenbummler: { shape: "scatter", light: "#a9d6ff", base: "#4a90e2", dark: "#2a5f9e" },
  halber_weg: { shape: "venn", light: "#ffd9a0", base: "#f2994a", dark: "#c9701e" },
  meistersammler: { shape: "crown", light: "#fff2b8", base: "#f7d038", dark: "#c9a017" },
  kunstkenner: { shape: "flower", light: "#f3c9ff", base: "#c86bef", dark: "#8f3fc2" },
  fanclub: { shape: "heartcluster", light: "#ffd0e0", base: "#ef6f9e", dark: "#c04879" },
  pokedex_forscher: { shape: "magnifier", fillRule: "evenodd", light: "#baf7d2", base: "#35b871", dark: "#1f7d4c" },
  elementmeister: { shape: "elements", light: "#d9c2ff", base: "#8e5cf2", dark: "#5c34ad" },
  wertvoller_fund: { shape: "gemsparkle", light: "#fff0b3", base: "#f2c14e", dark: "#c99423" },
  kostbarkeit: { shape: "moonstar", fillRule: "evenodd", light: "#eaf4ff", base: "#a9c4de", dark: "#6f8aa8" },
  volltreffer: { shape: "target", fillRule: "evenodd", light: "#ffc79e", base: "#f2703c", dark: "#c94a1f" },
  gewinnstratege: { shape: "growthchart", light: "#c8f2a0", base: "#79c94a", dark: "#4f9428" },
  meistergrad: { shape: "medal", light: "#dbe7ff", base: "#7fa8e0", dark: "#4a76b0" },
  sprachtalent: { shape: "diamondpair", light: "#a8ecec", base: "#38b8b8", dark: "#227d7d" },
  treuer_trainer: { shape: "wreath", light: "#e3c9a0", base: "#b9843f", dark: "#8a5f28" },
};
