// Geometrie-Helfer für die Emaille-Orden (SVG, 0..100 Viewport).
// Reine Berechnung statt handgetippter Koordinaten, damit die Formen exakt
// und leicht anpassbar bleiben.

export function polygonPoints(sides, r = 40, cx = 50, cy = 50) {
  // Rotation so, dass gerade Seitenzahlen oben/unten eine flache Kante haben
  // (wie das achteckige Vorbild), statt auf einer Spitze zu stehen.
  const rot = -90 + 180 / sides;
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const angle = ((rot + (360 / sides) * i) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(" ");
}

export function starPoints(spikes, outerR, innerR, cx = 50, cy = 50) {
  const step = Math.PI / spikes;
  let angle = -Math.PI / 2;
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
    angle += step;
  }
  return pts.join(" ");
}

export function flowerPetals(count = 6, ringR = 21, petalR = 17, cx = 50, cy = 50) {
  const petals = [];
  for (let i = 0; i < count; i++) {
    const angle = ((360 / count) * i * Math.PI) / 180;
    petals.push({ cx: cx + ringR * Math.cos(angle), cy: cy + ringR * Math.sin(angle), r: petalR });
  }
  return petals;
}

export const HEART_PATH =
  "M50 90 C18 66 4 46 4 28 C4 12 16 2 30 2 C41 2 48 9 50 16 C52 9 59 2 70 2 C84 2 96 12 96 28 C96 46 82 66 50 90 Z";

export const DROP_PATH =
  "M50 4 C69 29 83 50 83 67 C83 85 68 97 50 97 C32 97 17 85 17 67 C17 50 31 29 50 4 Z";

export const FLAME_PATH =
  "M50 3 C56 20 41 26 42 38 C42 45 47 49 53 45 C57 58 48 70 50 82 C33 79 24 63 24 48 C24 39 28 33 33 28 C32 38 38 42 43 38 C39 28 42 16 50 3 Z";

export const LEAF_PATH =
  "M50 6 C78 16 92 42 78 68 C68 86 56 94 50 96 C44 94 32 86 22 68 C8 42 22 16 50 6 Z";
export const LEAF_VEIN = "M50 18 C50 40 50 68 50 90";

export const SHIELD_PATH =
  "M50 3 L89 17 L89 45 C89 72 71 89 50 97 C29 89 11 72 11 45 L11 17 Z";

function pointsToPathD(pointsStr) {
  const pts = pointsStr.trim().split(" ");
  return `M${pts[0]} ` + pts.slice(1).map((p) => `L${p}`).join(" ") + " Z";
}

function circlePathD(cx, cy, r) {
  return `M${cx - r},${cy} A${r},${r} 0 1,0 ${cx + r},${cy} A${r},${r} 0 1,0 ${cx - r},${cy} Z`;
}

// Liefert für jede Orden-Form einen SVG-Pfad (0..100), unabhängig davon, ob
// sie ursprünglich als Polygon, Stern, Kreis-Cluster oder Bezier-Pfad
// beschrieben ist - Grundlage für das Pixel-Raster in OrdenBadge.
export function shapeToPathD(style) {
  switch (style.shape) {
    case "circle":
      return circlePathD(50, 50, 42);
    case "octagon":
      return pointsToPathD(polygonPoints(style.sides ?? 8, 42));
    case "star":
      return pointsToPathD(starPoints(style.spikes ?? 8, 44, 27));
    case "flower":
      return (
        flowerPetals(6, 21, 17).map((p) => circlePathD(p.cx, p.cy, p.r)).join(" ") +
        " " +
        circlePathD(50, 50, 15)
      );
    case "heart":
      return HEART_PATH;
    case "drop":
      return DROP_PATH;
    case "flame":
      return FLAME_PATH;
    case "leaf":
      return LEAF_PATH;
    case "shield":
      return SHIELD_PATH;
    default:
      return circlePathD(50, 50, 42);
  }
}
