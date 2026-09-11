import { useMemo } from "react";
import { ORDEN_STYLES } from "../lib/ordenStyles.js";
import { pixelMask, PIXEL_GRID } from "../lib/pixelBadge.js";

// Ein Orden als kleines Retro-Sprite: 16 unterschiedliche Silhouetten
// (Kreis, Diamant, Sechseck, Fliege, Stern, Blüte, Herz, Edelstein, Tropfen,
// Mondsichel, Flamme, Banner, Schild, Blatt, Achteck) werden auf ein Pixel-
// Raster projiziert und in vier Tönen schattiert (Goldrand/Glanz/Grundfarbe/
// Schatten) - wie ein Abzeichen aus einem 16-Bit-Spiel. Nicht erhaltene
// Orden zeigen nur die Silhouette als dunkle Aussparung, wie ein leeres
// Fach im Ordenkoffer.
export default function OrdenBadge({ id, earned, size = 64 }) {
  const style = ORDEN_STYLES[id] ?? ORDEN_STYLES.erster_fang;
  const geometryKey = `${style.shape}-${style.sides ?? ""}-${style.spikes ?? ""}`;
  const cells = useMemo(() => pixelMask(geometryKey, style, PIXEL_GRID), [geometryKey, style]);
  const tones = { outline: "#7a5a20", light: style.light, base: style.base, shadow: style.dark };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${PIXEL_GRID} ${PIXEL_GRID}`} shapeRendering="crispEdges">
      {cells.map(({ row, col, tone }) => (
        <rect
          key={`${row}-${col}`}
          x={col}
          y={row}
          width="1"
          height="1"
          fill={earned ? tones[tone] : tone === "outline" ? "#3f4550" : "#181b20"}
        />
      ))}
    </svg>
  );
}
