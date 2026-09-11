import { useMemo } from "react";
import { ORDEN_STYLES } from "../lib/ordenStyles.js";
import { pixelMask, PIXEL_GRID } from "../lib/pixelBadge.js";

const LOCKED_TONES = { outline: "#3a3a3a", light: "#d8d8d8", base: "#a8a8a8", shadow: "#7c7c7c" };

// Ein Orden als kleines Retro-Sprite: dieselbe Silhouette (Kreis, Achteck,
// Tropfen, Stern, Blüte, Herz, Flamme, Blatt, Schild) wird auf ein Pixel-
// Raster projiziert und in vier Tönen schattiert (Rand/Glanz/Grundfarbe/
// Schatten) - wie ein Abzeichen aus einem 16-Bit-Spiel. Nicht erhaltene
// Orden zeigen dieselbe Silhouette nur in Grau.
export default function OrdenBadge({ id, earned, size = 64 }) {
  const style = ORDEN_STYLES[id] ?? ORDEN_STYLES.erster_fang;
  const geometryKey = `${style.shape}-${style.sides ?? ""}-${style.spikes ?? ""}`;
  const cells = useMemo(() => pixelMask(geometryKey, style, PIXEL_GRID), [geometryKey, style]);
  const tones = earned
    ? { outline: "#2b2118", light: style.light, base: style.base, shadow: style.dark }
    : LOCKED_TONES;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${PIXEL_GRID} ${PIXEL_GRID}`}
      shapeRendering="crispEdges"
      className={earned ? "drop-shadow-sm" : "opacity-70"}
    >
      {cells.map(({ row, col, tone }) => (
        <rect key={`${row}-${col}`} x={col} y={row} width="1" height="1" fill={tones[tone]} />
      ))}
    </svg>
  );
}
