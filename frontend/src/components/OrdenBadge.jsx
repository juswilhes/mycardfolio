import { polygonPoints, starPoints, flowerPetals, HEART_PATH, DROP_PATH, FLAME_PATH, LEAF_PATH, LEAF_VEIN, SHIELD_PATH } from "../lib/ordenShapes.js";
import { ORDEN_STYLES } from "../lib/ordenStyles.js";

// Ein Orden als Emaille-Pin: klare Grundform, Verlauf hell -> dunkel für den
// glänzenden Look, dünner heller Rand als "Metallfassung". Nicht erhaltene
// Orden zeigen dieselbe Form nur entsättigt und abgedunkelt (Silhouette),
// so wie leere Fächer in einem echten Ordenkoffer.
export default function OrdenBadge({ id, earned, size = 64 }) {
  const style = ORDEN_STYLES[id] ?? ORDEN_STYLES.erster_fang;
  const gradId = `orden-grad-${id}`;
  const { shape, light, base, dark } = style;

  const fill = `url(#${gradId})`;
  const stroke = earned ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.25)";

  let shapeEl;
  if (shape === "circle") {
    shapeEl = <circle cx="50" cy="50" r="42" fill={fill} stroke={stroke} strokeWidth="3" />;
  } else if (shape === "octagon") {
    shapeEl = (
      <polygon
        points={polygonPoints(style.sides ?? 8, 42)}
        fill={fill}
        stroke={stroke}
        strokeWidth="3"
        strokeLinejoin="round"
      />
    );
  } else if (shape === "star") {
    shapeEl = (
      <polygon
        points={starPoints(style.spikes ?? 8, 44, 27)}
        fill={fill}
        stroke={stroke}
        strokeWidth="3"
        strokeLinejoin="round"
      />
    );
  } else if (shape === "flower") {
    const petals = flowerPetals(6, 21, 17);
    shapeEl = (
      <>
        {petals.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={fill} stroke={stroke} strokeWidth="2" />
        ))}
        <circle cx="50" cy="50" r="15" fill={dark} stroke={stroke} strokeWidth="2" />
      </>
    );
  } else if (shape === "heart") {
    shapeEl = <path d={HEART_PATH} fill={fill} stroke={stroke} strokeWidth="3" strokeLinejoin="round" />;
  } else if (shape === "drop") {
    shapeEl = <path d={DROP_PATH} fill={fill} stroke={stroke} strokeWidth="3" strokeLinejoin="round" />;
  } else if (shape === "flame") {
    shapeEl = <path d={FLAME_PATH} fill={fill} stroke={stroke} strokeWidth="3" strokeLinejoin="round" />;
  } else if (shape === "leaf") {
    shapeEl = (
      <>
        <path d={LEAF_PATH} fill={fill} stroke={stroke} strokeWidth="3" strokeLinejoin="round" />
        <path d={LEAF_VEIN} fill="none" stroke={dark} strokeWidth="2" opacity="0.6" />
      </>
    );
  } else if (shape === "shield") {
    shapeEl = <path d={SHIELD_PATH} fill={fill} stroke={stroke} strokeWidth="3" strokeLinejoin="round" />;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={earned ? "drop-shadow-sm" : "opacity-45 grayscale"}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={light} />
          <stop offset="55%" stopColor={base} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
      </defs>
      {shapeEl}
      {earned && (
        <ellipse cx="38" cy="32" rx="14" ry="9" fill="#fff" opacity="0.35" transform="rotate(-20 38 32)" />
      )}
    </svg>
  );
}
