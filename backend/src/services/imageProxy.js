import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import sharp from "sharp";

// Kartenbilder laufen über unseren Server statt direkt von den Bild-Servern in den Browser
// (Datenschutz: sonst sieht z. B. assets.pokemon.com in den USA die IP jedes Besuchers).
// Die API schreibt Bild-Adressen dieser Hosts um ("https://images.pokemontcg.io/sv1/1.png" ->
// "/img/images.pokemontcg.io/sv1/1.png"), der Server holt das Bild, wandelt es in WebP um
// (die PNGs von pokemontcg.io sind 0,2-1,3 MB groß, WebP etwa ein Zehntel) und legt es im
// Datenordner ab. Der Platz ist begrenzt (IMG_CACHE_MAX_MB): ist er voll, wird weiter
// ausgeliefert, aber nichts mehr gespeichert.
export const IMAGE_HOSTS = new Set([
  "images.pokemontcg.io",
  "images.scrydex.com",
  "assets.tcgdex.net",
  "assets.pokemon.com",
  "tcgplayer-cdn.tcgplayer.com", // Booster-/Displaybilder (sealedPrices.js)
]);

const MAX_WIDTH = 734; // Großansicht auf der Kartenseite; kleinere Bilder werden nicht vergrößert
const CACHE_MAX = (Number(process.env.IMG_CACHE_MAX_MB) || 3000) * 1024 * 1024;
const cacheRoot = path.join(
  process.env.DATABASE_PATH ? path.dirname(path.resolve(process.env.DATABASE_PATH)) : process.cwd(),
  "img-cache"
);

let cacheBytes = 0;
let cacheCounted = false;
// Belegten Platz einmal beim Start im Hintergrund zusammenzählen
fs.promises
  .readdir(cacheRoot, { recursive: true, withFileTypes: true })
  .then(async (entries) => {
    for (const e of entries) {
      if (!e.isFile()) continue;
      try {
        cacheBytes += (await fs.promises.stat(path.join(e.parentPath ?? e.path, e.name))).size;
      } catch {
        /* Datei inzwischen weg */
      }
    }
  })
  .catch(() => {})
  .finally(() => {
    cacheCounted = true;
  });

const PREFIX = /^https:\/\/([a-z0-9.-]+)\//;

// Bild-Adresse eines erlaubten Hosts -> eigene Adresse; alles andere bleibt unverändert
export function proxiedImage(url) {
  if (typeof url !== "string") return url;
  const m = url.match(PREFIX);
  return m && IMAGE_HOSTS.has(m[1]) ? `/img/${url.slice(8)}` : url;
}

// Schreibt alle Bild-Adressen in einer API-Antwort um (beliebig tief verschachtelt)
export function rewriteImages(value) {
  if (typeof value === "string") return value.startsWith("https://") ? proxiedImage(value) : value;
  if (Array.isArray(value)) return value.map(rewriteImages);
  if (value && typeof value === "object" && value.constructor === Object) {
    const out = {};
    for (const k in value) out[k] = rewriteImages(value[k]);
    return out;
  }
  return value;
}

// Middleware: res.json gibt Bild-Adressen schon umgeschrieben aus
export function rewriteImagesInJson(_req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => json(rewriteImages(body));
  next();
}

const inflight = new Map(); // gleiche Datei wird nur einmal gleichzeitig geholt

// Produktfotos von TCGplayer (Booster, Displays) haben einen weißen Hintergrund, der auf der Seite als Kasten
// auffällt (Justus 29.10.2026). Entfernt wird nur Weiß, das vom Bildrand aus zusammenhängt - weiße Flächen auf
// der Verpackung selbst bleiben. Übergänge am Rand werden halb durchsichtig, damit keine Treppenkante bleibt.
const TRANSPARENT_HOSTS = new Set(["tcgplayer-cdn.tcgplayer.com"]);
async function withoutWhiteBackground(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const whiteish = (i, limit) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return Math.min(r, g, b) >= limit && Math.max(r, g, b) - Math.min(r, g, b) <= 24;
  };
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p] || !whiteish(p * 4, 232)) return;
    seen[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    data[p * 4 + 3] = 0;
    const x = p % w, y = (p - x) / w;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  // Kante weich: helle Nachbarn entfernter Pixel halb durchsichtig
  for (let p = 0; p < w * h; p++) {
    if (seen[p] || !whiteish(p * 4, 200)) continue;
    const x = p % w;
    if ((x > 0 && seen[p - 1]) || (x < w - 1 && seen[p + 1]) || seen[p - w] || seen[p + w]) data[p * 4 + 3] = 110;
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

async function loadImage(host, rel, file) {
  const res = await fetch(`https://${host}/${rel}`, {
    // Bewusst ohne Daten des Besuchers: nur unser Server fragt an
    headers: { "User-Agent": "mycardfolio-image-proxy" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = new Error(`upstream ${res.status}`);
    err.status = res.status === 404 ? 404 : 502;
    throw err;
  }
  let input = Buffer.from(await res.arrayBuffer());
  if (TRANSPARENT_HOSTS.has(host)) input = await withoutWhiteBackground(input);
  const webp = await sharp(input).resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  if (cacheCounted && cacheBytes + webp.length <= CACHE_MAX) {
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.writeFile(file, webp);
    cacheBytes += webp.length;
  }
  return webp;
}

export const imageRouter = Router();

// GET /img/<host>/<pfad>
imageRouter.get(/^\/([a-z0-9.-]+)\/(.+)$/, async (req, res) => {
  const host = req.params[0];
  const rel = req.params[1];
  if (!IMAGE_HOSTS.has(host) || rel.split("/").some((p) => p === ".." || p === "." || !p) || !/^[\w./%-]+$/.test(rel)) {
    return res.status(404).end();
  }
  // Bilder ohne Hintergrund unter eigenem Namen, damit keine alte Fassung mit weißem Hintergrund aus dem Speicher kommt
  const file = path.join(cacheRoot, host, TRANSPARENT_HOSTS.has(host) ? `${rel}.transparent.webp` : `${rel}.webp`);
  if (!file.startsWith(cacheRoot + path.sep)) return res.status(404).end();

  res.set("Cache-Control", "public, max-age=2592000"); // 30 Tage im Browser
  res.type("image/webp");
  try {
    return res.send(await fs.promises.readFile(file));
  } catch {
    /* noch nicht im Speicher */
  }
  try {
    if (!inflight.has(file)) inflight.set(file, loadImage(host, rel, file).finally(() => inflight.delete(file)));
    res.send(await inflight.get(file));
  } catch (err) {
    res.removeHeader("Cache-Control");
    res.status(err.status ?? 502).end();
  }
});
