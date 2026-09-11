import { shapeToPathD } from "./ordenShapes.js";

// Eine einzige, wiederverwendete Canvas-2D-Instanz nur als Geometrie-Werkzeug
// (isPointInPath) - es wird nie irgendetwas darauf gezeichnet oder angezeigt.
let sharedCtx = null;
function getCtx() {
  if (!sharedCtx && typeof document !== "undefined") {
    sharedCtx = document.createElement("canvas").getContext("2d");
  }
  return sharedCtx;
}

const maskCache = new Map();

// Rastert eine Orden-Form (0..100 Koordinaten) auf ein grid x grid Raster und
// stuft jede gefüllte Zelle als "outline" (Rand), "light" (Glanz oben links),
// "shadow" (Schatten unten rechts) oder "base" ein - klassische Retro-Sprite-
// Schattierung, die für jede Form gleich funktioniert. Pro Geometrie nur
// einmal berechnet und danach gecacht.
export function pixelMask(geometryKey, style, grid = 16) {
  const cacheKey = `${geometryKey}-${grid}`;
  const cached = maskCache.get(cacheKey);
  if (cached) return cached;

  const ctx = getCtx();
  if (!ctx) return [];
  const path = new Path2D(shapeToPathD(style));
  const cell = 100 / grid;
  const inside = [];
  for (let row = 0; row < grid; row++) {
    const line = [];
    for (let col = 0; col < grid; col++) {
      line.push(ctx.isPointInPath(path, (col + 0.5) * cell, (row + 0.5) * cell));
    }
    inside.push(line);
  }

  const cells = [];
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      if (!inside[row][col]) continue;
      const edge =
        row === 0 ||
        col === 0 ||
        row === grid - 1 ||
        col === grid - 1 ||
        !inside[row - 1][col] ||
        !inside[row + 1][col] ||
        !inside[row][col - 1] ||
        !inside[row][col + 1];
      const diag = col / grid + row / grid;
      const tone = edge ? "outline" : diag < 0.75 ? "light" : diag > 1.15 ? "shadow" : "base";
      cells.push({ row, col, tone });
    }
  }
  maskCache.set(cacheKey, cells);
  return cells;
}

export const PIXEL_GRID = 16;
