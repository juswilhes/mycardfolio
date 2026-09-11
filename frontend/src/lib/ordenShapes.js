// Geometrie-Helfer für die Orden (SVG, 0..100 Viewport). Jeder Orden ist eine
// kleine "Szene" aus mehreren einfachen Formen (Kreise, Ellipsen, Polygone),
// die zu einem Pfad zusammengesetzt werden - wie beim Kunstkenner-Blüten-
// Cluster, nur pro Orden mit einem eigenen, zum Thema passenden Motiv.

export function polygonPoints(sides, r = 40, cx = 50, cy = 50) {
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

function pointsToPathD(pointsStr) {
  const pts = pointsStr.trim().split(" ");
  return `M${pts[0]} ` + pts.slice(1).map((p) => `L${p}`).join(" ") + " Z";
}

function circlePathD(cx, cy, r) {
  return `M${cx - r},${cy} A${r},${r} 0 1,0 ${cx + r},${cy} A${r},${r} 0 1,0 ${cx - r},${cy} Z`;
}

// Ellipse, wahlweise gedreht - für Münzen/Blätter, die "von der Seite"
// wirken sollen statt als perfekter Kreis.
function ellipsePathD(cx, cy, rx, ry, rotationDeg = 0) {
  const rad = (rotationDeg * Math.PI) / 180;
  const dx = rx * Math.cos(rad);
  const dy = rx * Math.sin(rad);
  const p1 = [cx + dx, cy + dy];
  const p2 = [cx - dx, cy - dy];
  return `M${p1} A${rx},${ry} ${rotationDeg} 1,0 ${p2} A${rx},${ry} ${rotationDeg} 1,0 ${p1} Z`;
}

// Ein Herz, parametrisiert über Mittelpunkt + Skalierung - für Cluster aus
// mehreren, unterschiedlich großen Herzen (Fanclub).
const HEART_UNIT = [
  [0, 44],
  [-32, 20], [-46, 0], [-46, -18],
  [-46, -34], [-34, -44], [-20, -44],
  [-9, -44], [-2, -37], [0, -30],
  [2, -37], [9, -44], [20, -44],
  [34, -44], [46, -34], [46, -18],
  [46, 0], [32, 20], [0, 44],
];
function heartPathD(cx, cy, scale) {
  const p = HEART_UNIT.map(([x, y]) => `${(cx + x * scale).toFixed(1)},${(cy + y * scale).toFixed(1)}`);
  return (
    `M${p[0]} C${p[1]} ${p[2]} ${p[3]} C${p[4]} ${p[5]} ${p[6]} ` +
    `C${p[7]} ${p[8]} ${p[9]} C${p[10]} ${p[11]} ${p[12]} ` +
    `C${p[13]} ${p[14]} ${p[15]} C${p[16]} ${p[17]} ${p[18]} Z`
  );
}

function diamondPoints(cx, cy, s) {
  return `${cx},${cy - s} ${cx + s * 0.62},${cy} ${cx},${cy + s} ${cx - s * 0.62},${cy}`;
}

// Liefert für jeden Orden einen zusammengesetzten SVG-Pfad (0..100) - jeder
// mit einem eigenen kleinen Motiv statt einer schlichten Einzelform.
export function shapeToPathD(style) {
  switch (style.shape) {
    // Erster Fang: ein Pokéball-Umriss (Kreis, Trennlinie, Knopf mit Loch).
    case "pokeball":
      return [
        circlePathD(50, 50, 42),
        "M4,45 L96,45 L96,55 L4,55 Z",
        circlePathD(50, 50, 8),
        circlePathD(50, 50, 3.5),
      ].join(" ");

    // Erster Handel: drei gestapelte Münzen.
    case "coinstack":
      return [
        ellipsePathD(48, 68, 24, 14),
        ellipsePathD(52, 50, 24, 14),
        ellipsePathD(48, 32, 24, 14),
      ].join(" ");

    // Weltenbummler: verstreute Wegpunkte/Fußspuren unterschiedlicher Größe.
    case "scatter":
      return [
        circlePathD(30, 32, 15),
        circlePathD(70, 30, 12),
        circlePathD(66, 70, 14),
        circlePathD(26, 68, 11),
        circlePathD(50, 50, 7),
      ].join(" ");

    // Halber Weg: zwei Kreise, die sich in der Mitte treffen.
    case "venn":
      return [circlePathD(38, 50, 29), circlePathD(62, 50, 29)].join(" ");

    // Meistersammler: eine Krone mit drei Zacken und Edelstein-Spitzen.
    case "crown":
      return [
        "M20,72 L20,56 L30,40 L38,56 L50,32 L62,56 L70,40 L80,56 L80,72 Z",
        circlePathD(30, 38, 5),
        circlePathD(50, 30, 6),
        circlePathD(70, 38, 5),
      ].join(" ");

    // Kunstkenner: die Blüte aus überlappenden Kreisen (Original-Motiv).
    case "flower":
      return (
        flowerPetals(6, 21, 17).map((p) => circlePathD(p.cx, p.cy, p.r)).join(" ") +
        " " +
        circlePathD(50, 50, 15)
      );

    // Fanclub: ein kleiner Strauß aus drei Herzen.
    case "heartcluster":
      return [heartPathD(35, 66, 0.42), heartPathD(65, 63, 0.46), heartPathD(50, 36, 0.58)].join(" ");

    // Pokédex-Forscher: eine Lupe (Ring + Griff).
    case "magnifier":
      return [
        circlePathD(42, 42, 26),
        circlePathD(42, 42, 18),
        "M58.3,65.3 L65.3,58.3 L93.5,86.5 L86.5,93.5 Z",
      ].join(" ");

    // Elementmeister: vier Elementar-Zacken um einen Kern.
    case "elements":
      return [
        pointsToPathD(diamondPoints(50, 22, 16)),
        pointsToPathD(diamondPoints(78, 50, 16)),
        pointsToPathD(diamondPoints(50, 78, 16)),
        pointsToPathD(diamondPoints(22, 50, 16)),
        circlePathD(50, 50, 13),
      ].join(" ");

    // Wertvoller Fund: ein Edelstein mit zwei kleinen Funkeln.
    case "gemsparkle":
      return [
        pointsToPathD("50,8 76,28 76,72 50,92 24,72 24,28"),
        pointsToPathD(starPoints(4, 9, 3, 20, 18)),
        pointsToPathD(starPoints(4, 7, 2.5, 80, 24)),
      ].join(" ");

    // Kostbarkeit: eine Mondsichel mit einem kleinen Stern.
    case "moonstar":
      return [
        circlePathD(40, 52, 32),
        circlePathD(58, 52, 28),
        pointsToPathD(starPoints(5, 9, 3.5, 82, 24)),
      ].join(" ");

    // Volltreffer: eine Zielscheibe (konzentrische Ringe).
    case "target":
      return [circlePathD(50, 50, 42), circlePathD(50, 50, 28), circlePathD(50, 50, 14)].join(" ");

    // Gewinnstratege: ein Balkendiagramm mit Pfeilspitze nach oben.
    case "growthchart":
      return [
        "M16,84 L16,56 L32,56 L32,84 Z",
        "M42,84 L42,36 L58,36 L58,84 Z",
        "M68,84 L68,14 L84,14 L84,84 Z",
        "M68,20 L84,20 L76,4 Z",
      ].join(" ");

    // Meistergrad: eine Medaille mit zwei Bandenden.
    case "medal":
      return [
        "M38,50 L46,50 L34,94 Z",
        "M54,50 L62,50 L66,94 Z",
        circlePathD(50, 38, 26),
        circlePathD(50, 38, 17),
      ].join(" ");

    // Sprachtalent: zwei überlappende Rauten.
    case "diamondpair":
      return [pointsToPathD(diamondPoints(38, 50, 27)), pointsToPathD(diamondPoints(62, 50, 27))].join(" ");

    // Treuer Trainer: ein Lorbeerkranz aus kleinen Blättern.
    case "wreath": {
      const leaves = [];
      const left = [
        [28, 26, -55], [19, 42, -78], [18, 60, -102], [24, 76, -128], [34, 88, -150],
      ];
      const right = left.map(([x, y, r]) => [100 - x, y, -r]);
      for (const [x, y, r] of [...left, ...right]) leaves.push(ellipsePathD(x, y, 11, 5.5, r));
      leaves.push(circlePathD(50, 92, 5));
      return leaves.join(" ");
    }

    default:
      return circlePathD(50, 50, 42);
  }
}
