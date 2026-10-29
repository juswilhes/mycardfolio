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
  const input = Buffer.from(await res.arrayBuffer());
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
  const file = path.join(cacheRoot, host, `${rel}.webp`);
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
