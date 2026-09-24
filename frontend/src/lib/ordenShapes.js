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

// Reines M/L/Z-Polygon als Pfad, IMMER im Uhrzeigersinn. Überlappende Teile
// mit entgegengesetzter Zeichenrichtung löschen sich bei nonzero-Füllung aus
// (Loch/Lücke mitten im Orden) - so bleibt jede Silhouette ein Stück.
function polyD(str) {
  const nums = str.match(/-?\d+(?:\.\d+)?/g).map(Number);
  let pts = [];
  for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    area += x1 * y2 - x2 * y1;
  }
  if (area < 0) pts = pts.reverse();
  return `M${pts[0]} ` + pts.slice(1).map((p) => `L${p}`).join(" ") + " Z";
}


function pointsToPathD(pointsStr) {
  const pts = pointsStr.trim().split(" ");
  return `M${pts[0]} ` + pts.slice(1).map((p) => `L${p}`).join(" ") + " Z";
}

function circlePathD(cx, cy, r) {
  return `M${cx - r},${cy} A${r},${r} 0 1,1 ${cx + r},${cy} A${r},${r} 0 1,1 ${cx - r},${cy} Z`;
}

// Ellipse, wahlweise gedreht - für Münzen/Blätter, die "von der Seite"
// wirken sollen statt als perfekter Kreis.
function ellipsePathD(cx, cy, rx, ry, rotationDeg = 0) {
  const rad = (rotationDeg * Math.PI) / 180;
  const dx = rx * Math.cos(rad);
  const dy = rx * Math.sin(rad);
  const p1 = [cx + dx, cy + dy];
  const p2 = [cx - dx, cy - dy];
  return `M${p1} A${rx},${ry} ${rotationDeg} 1,1 ${p2} A${rx},${ry} ${rotationDeg} 1,1 ${p1} Z`;
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
// mit einem eigenen kleinen Motiv, passend zum Namen des Ordens. Alle Teile
// überlappen sich bewusst, damit nichts als lose Einzelteile wirkt.
// { d, extra }: "d" folgt style.fillRule (nötig für Formen mit Aussparungen
// wie Kompass/Lupe/Perfektion/Zielscheibe); "extra" ist ein optionaler
// zweiter, IMMER nonzero gefüllter Teil - so kann z.B. der Lupengriff frei
// über eine Aussparungs-Form greifen, ohne versehentlich neue Löcher
// hineinzuschneiden.
export function shapeToPathD(style) {
  switch (style.shape) {
    // Kieselorden: drei überlappende, glatte Kiesel.
    case "pebbles":
      return {
        d: [
          ellipsePathD(36, 62, 27, 17, -14),
          ellipsePathD(66, 56, 22, 14, 18),
          ellipsePathD(52, 36, 17, 11, -6),
        ].join(" "),
      };

    // Forscherorden: eine Lupe (Ring + Griff, der Griff überlappt den
    // Ring bewusst, statt nur daneben zu schweben).
    case "magnifier":
      return {
        d: [circlePathD(42, 42, 26), circlePathD(42, 42, 18)].join(" "),
        extra: polyD("M56.53,61.48 L61.48,56.53 L94.48,89.53 L89.53,94.48 Z"),
      };

    // Kompassorden: Kompassring mit vierzackiger Nadel, deren Spitzen in den
    // Ring hineinragen (so hängt alles zusammen; Nadel = extra, damit sie
    // nicht als Loch aus dem Ring geschnitten wird).
    case "compass":
      return {
        d: [circlePathD(50, 50, 42), circlePathD(50, 50, 34)].join(" "),
        extra: pointsToPathD(starPoints(4, 38, 8)),
      };

    // Pinselorden: ein schräg liegender Malerpinsel (Stiel, Zwinge, Borsten).
    case "brush":
      return {
        d: [
          polyD("M76,8 L92,24 L52,64 L33,45 Z"),
          polyD("M33,45 L55,67 L44,74 L26,56 Z"),
          "M30,58 L42,70 C44,86 32,94 14,92 C10,74 18,62 30,58 Z",
        ].join(" "),
      };

    // Mosaikorden: vier Mosaiksteine um eine Raute in der Mitte.
    case "mosaic":
      return {
        d: [
          polyD("M10,10 L47,10 L47,47 L10,47 Z"),
          polyD("M53,10 L90,10 L90,47 L53,47 Z"),
          polyD("M10,53 L47,53 L47,90 L10,90 Z"),
          polyD("M53,53 L90,53 L90,90 L53,90 Z"),
          pointsToPathD(diamondPoints(50, 50, 22)),
        ].join(" "),
      };

    // Babelorden: ein Turm aus drei Stufen mit Spitze.
    case "tower":
      return {
        d: [
          polyD("M24,92 L76,92 L76,68 L24,68 Z"),
          polyD("M31,70 L69,70 L69,46 L31,46 Z"),
          polyD("M38,48 L62,48 L62,28 L38,28 Z"),
          polyD("M43,30 L57,30 L50,6 Z"),
        ].join(" "),
      };

    // Goldorden: drei gestapelte Goldbarren mit Funkeln.
    case "goldbars":
      return {
        d: [
          polyD("M6,90 L48,90 L54,72 L12,72 Z"),
          polyD("M46,90 L94,90 L88,72 L42,72 Z"),
          polyD("M28,76 L72,76 L78,52 L34,52 Z"),
          pointsToPathD(starPoints(4, 14, 4, 70, 42)),
        ].join(" "),
      };

    // Elementarorden: vier Elementar-Zacken um einen gemeinsamen Kern.
    case "elements":
      return {
        d: [
          pointsToPathD(diamondPoints(50, 22, 17)),
          pointsToPathD(diamondPoints(78, 50, 17)),
          pointsToPathD(diamondPoints(50, 78, 17)),
          pointsToPathD(diamondPoints(22, 50, 17)),
          circlePathD(50, 50, 19),
        ].join(" "),
      };

    // Herzorden: ein kleiner Strauß aus drei Herzen.
    case "heartcluster":
      return { d: [heartPathD(35, 66, 0.42), heartPathD(65, 63, 0.46), heartPathD(50, 36, 0.58)].join(" ") };

    // Marktorden: ein Marktstand mit Dach, Girlande und Tresen.
    case "stall":
      return {
        d: [
          polyD("M8,32 L26,10 L74,10 L92,32 Z"),
          circlePathD(16, 34, 7),
          circlePathD(30, 34, 7),
          circlePathD(44, 34, 7),
          circlePathD(58, 34, 7),
          circlePathD(72, 34, 7),
          circlePathD(86, 34, 7),
          polyD("M16,36 L16,90 L84,90 L84,36 Z"),
        ].join(" "),
      };

    // Perfektionsorden: ein makelloser Stern, dessen Spitzen den Ring berühren.
    case "perfect":
      return {
        d: [circlePathD(50, 50, 42), circlePathD(50, 50, 34)].join(" "),
        extra: pointsToPathD(starPoints(5, 38, 16, 50, 53)),
      };

    // Zielorden: ein Zielring mit Fadenkreuz und Mittelpunkt (alles verbunden).
    case "target":
      return {
        d: [circlePathD(50, 50, 42), circlePathD(50, 50, 30)].join(" "),
        extra: [
          circlePathD(50, 50, 12),
          polyD("M46,8 L54,8 L54,92 L46,92 Z"),
          polyD("M8,46 L92,46 L92,54 L8,54 Z"),
        ].join(" "),
      };

    // Vollendungsorden: ein Haken, dessen Ende den Ring durchbricht - "geschafft".
    case "complete":
      return {
        d: [circlePathD(50, 50, 42), circlePathD(50, 50, 34)].join(" "),
        extra: polyD("M16,52 L26,42 L45,61 L74,24 L86,34 L45,81 Z"),
      };

    // Strategenorden: ein Schach-Turm.
    case "rook":
      return {
        d: [
          polyD("M24,90 L76,90 L76,76 L24,76 Z"),
          polyD("M32,78 L36,44 L64,44 L68,78 Z"),
          polyD("M27,46 L27,18 L38,18 L38,27 L46,27 L46,18 L54,18 L54,27 L62,27 L62,18 L73,18 L73,46 Z"),
        ].join(" "),
      };

    // Kronenorden: eine Krone mit drei Zacken und Edelstein-Spitzen.
    case "crown":
      return {
        d: [
          polyD("M20,72 L20,56 L30,40 L38,56 L50,32 L62,56 L70,40 L80,56 L80,72 Z"),
          circlePathD(30, 38, 5),
          circlePathD(50, 30, 6),
          circlePathD(70, 38, 5),
        ].join(" "),
      };

    // Treueorden: ein Lorbeerkranz aus kleinen, sich überlappenden Blättern,
    // unten durch eine gemeinsame Schleife verbunden.
    case "wreath": {
      const leaves = [];
      const left = [
        [30, 24, -55], [21, 38, -80], [19, 54, -105], [23, 70, -130], [36, 86, -155],
      ];
      const right = left.map(([x, y, r]) => [100 - x, y, -r]);
      for (const [x, y, r] of [...left, ...right]) leaves.push(ellipsePathD(x, y, 14, 7, r));
      leaves.push(circlePathD(50, 90, 8));
      return { d: leaves.join(" ") };
    }

    default:
      return { d: circlePathD(50, 50, 42) };
  }
}
