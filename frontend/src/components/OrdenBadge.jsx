import { ORDEN_STYLES } from "../lib/ordenStyles.js";
import { shapeToPathD } from "../lib/ordenShapes.js";

// Ein Orden als kleines Schmuckstück: ein Metallrahmen (Gold, erhalten /
// Silber, offen) liegt als etwas größere Kopie der Silhouette dahinter,
// darüber der "Edelstein" mit radialem Glanzverlauf, dünner Kontur und
// einem Glanzlicht - 16 komplett eigenständige Formen (siehe ordenShapes.js).
export default function OrdenBadge({ id, earned, size = 64 }) {
  const style = ORDEN_STYLES[id] ?? ORDEN_STYLES.erster_fang;
  const pathD = shapeToPathD(style);
  const fillRule = style.fillRule ?? "nonzero";
  const uid = `orden-${id}`;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <linearGradient id={`${uid}-ring`} x1="15%" y1="0%" x2="85%" y2="100%">
          {earned ? (
            <>
              <stop offset="0%" stopColor="#f7e2a0" />
              <stop offset="55%" stopColor="#ca9f34" />
              <stop offset="100%" stopColor="#8a651c" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#e2e4e7" />
              <stop offset="55%" stopColor="#aeb3ba" />
              <stop offset="100%" stopColor="#797f87" />
            </>
          )}
        </linearGradient>
        <radialGradient id={`${uid}-gem`} cx="36%" cy="28%" r="85%">
          {earned ? (
            <>
              <stop offset="0%" stopColor={style.light} />
              <stop offset="55%" stopColor={style.base} />
              <stop offset="100%" stopColor={style.dark} />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#eef1f3" />
              <stop offset="100%" stopColor="#c3c8ce" />
            </>
          )}
        </radialGradient>
      </defs>

      {/* Metallrahmen - dieselbe Form, etwas größer, schimmert am Rand hervor */}
      <path
        d={pathD}
        fillRule={fillRule}
        fill={`url(#${uid}-ring)`}
        transform="translate(50 50) scale(1.16) translate(-50 -50)"
      />

      {/* Edelstein */}
      <path
        d={pathD}
        fillRule={fillRule}
        fill={`url(#${uid}-gem)`}
        stroke={earned ? style.dark : "#868c93"}
        strokeWidth="2.2"
        strokeLinejoin="round"
        opacity={earned ? 1 : 0.9}
      />

      {/* Glanzlicht */}
      {earned && (
        <ellipse cx="37" cy="31" rx="13" ry="7.5" fill="#fff" opacity="0.45" transform="rotate(-24 37 31)" />
      )}
    </svg>
  );
}
