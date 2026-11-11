// Gemeinsame Effekte für alle Graphen (Justus 11.11.2026: "alle Graphen ein kleines Leuchten").
// - glow(farbe): weicher Schein um eine Linie/Balken in ihrer eigenen Farbe (CSS drop-shadow; funktioniert auch
//   bei waagerechten Linien, anders als ein SVG-Filter mit Bounding-Box-Bereich).
// - areaDefs/areaFill: Farbverlauf unter der Hauptlinie.
// - endDot: pulsierender Punkt am letzten Wert (CSS-Klasse chart-pulse in index.css; steht bei
//   "weniger Bewegung" still).

// Für die Marken-Farben gibt es abgestimmte Leucht-Farben je Hell/Dunkel (index.css), sonst die Farbe selbst.
const GLOW_COLOR = { "var(--yellow)": "var(--glow-yellow)", "var(--holo)": "var(--glow-holo)" };
export const glow = (color, px = 6) => ({ filter: `drop-shadow(0 0 ${px}px ${GLOW_COLOR[color] ?? color})` });

// <defs> mit senkrechtem Verlauf; direkt als Kind des Charts einsetzen: {areaDefs(id, farbe)}
export function areaDefs(id, color) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.3 }} />
        <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
      </linearGradient>
    </defs>
  );
}
export const areaFill = (id) => `url(#${id})`;

// React-IDs enthalten Doppelpunkte - in url(#...) nicht erlaubt
export const safeId = (reactId) => `fx${String(reactId).replace(/[^a-zA-Z0-9]/g, "")}`;

// Index des letzten vorhandenen Werts einer Spalte
export function lastIndexOf(rows, key) {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i]?.[key] != null) return i;
  return -1;
}

// dot-Funktion für <Line>/<Area>: nur am letzten Punkt ein Punkt mit pulsierendem Ring
export const endDot = (color, lastIndex) =>
  function EndDot({ cx, cy, index }) {
    if (index !== lastIndex || cx == null || cy == null) return <g key={`d${index}`} />;
    return (
      <g key="end" style={{ pointerEvents: "none" }}>
        <circle className="chart-pulse" cx={cx} cy={cy} r={5} style={{ fill: color }} opacity={0.5} />
        <circle cx={cx} cy={cy} r={4} style={{ fill: color, stroke: "var(--canvas)" }} strokeWidth={2} />
      </g>
    );
  };

// Einheitliches Tooltip-Fenster
export const tooltipStyle = {
  background: "linear-gradient(180deg, var(--surface-hi), var(--surface-lo))",
  border: "1px solid var(--line)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--ink)",
  boxShadow: "inset 0 1px 0 var(--edge), var(--shadow-soft)",
};
