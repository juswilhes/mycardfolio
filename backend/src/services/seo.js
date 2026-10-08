import db from "../db/index.js";
import { latestTrendByExternal } from "./cardService.js";

// Meta-Tags pro Seite (Titel, Beschreibung, canonical, Vorschaubild) und die
// Sitemap. Die App ist eine Single-Page-App: ohne dieses Einsetzen auf dem
// Server hätte jede Seite denselben Titel und dieselbe canonical-URL (die
// Startseite) - Suchmaschinen und Link-Vorschauen (WhatsApp, Discord)
// sehen nur das HTML vom Server, nicht das, was React danach anzeigt.

export const SITE_URL = "https://mycardfolio.de";
const SITE_NAME = "mycardfolio";
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;
const DEFAULT_TITLE = "mycardfolio – Pokémon-Sammlung & Portfolio-Wert im Blick";
const DEFAULT_DESCRIPTION =
  "mycardfolio verwaltet deine Pokémon-Sammelkarten: aktuelle Cardmarket-Preise in Euro, Gewinn und Verlust deines Portfolios über die Zeit, Set-Fortschritt und Massen-Import.";

const eur = (n) => `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const shorten = (s, max) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Feste Seiten: indexierbar (mit Titel/Beschreibung) bzw. nur für Angemeldete
// und Formulare (noindex - sollen nicht in der Suche auftauchen).
const PUBLIC_PAGES = {
  "/": { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
  "/sets": {
    title: "Alle Pokémon-Karten & Sets – Preise und Suche | mycardfolio",
    description:
      "Alle Pokémon-Sets und Karten durchsuchen: aktuelle Cardmarket-Preise in Euro, Seltenheiten, Illustratoren und Preisverlauf – kostenlos und ohne Anmeldung.",
  },
  "/marktplatz": {
    title: "Marktplatz für Pokémon-Karten | mycardfolio",
    description: "Pokémon-Karten und Sealed-Produkte von anderen Sammlern: Angebote ansehen und den Verkäufer kontaktieren.",
  },
  "/impressum": { title: "Impressum | mycardfolio", description: "Impressum und Anbieterkennzeichnung von mycardfolio." },
  "/datenschutz": { title: "Datenschutzerklärung | mycardfolio", description: "So geht mycardfolio mit deinen Daten um." },
  "/marktplatz-agb": {
    title: "Marktplatz-Bedingungen | mycardfolio",
    description: "Nutzungsbedingungen für den Marktplatz von mycardfolio.",
  },
};
const PRIVATE_PAGES = new Set([
  "/login", "/register", "/passwort-vergessen", "/passwort-zuruecksetzen", "/verify", "/import",
  "/verkauft", "/analyse", "/statistik", "/konto", "/orden", "/watchlist", "/add",
]);

const cardStmt = db.prepare(`
  SELECT external_id, name, name_de, set_name, number, rarity, image_large, image_small
  FROM cards WHERE external_id = ?
`);
const setStmt = db.prepare(`SELECT id, name, total, printed_total, release_date, logo FROM card_sets WHERE id = ?`);
const artistStmt = db.prepare(`SELECT COUNT(*) AS n FROM cards WHERE artist = ? COLLATE NOCASE`);

// Meta-Angaben für einen Pfad. robots=false -> noindex.
export function metaFor(rawPath) {
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;
  const canonical = `${SITE_URL}${path === "/" ? "/" : path}`;
  const base = { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, image: DEFAULT_IMAGE, canonical, robots: true, type: "website" };

  if (PUBLIC_PAGES[path]) return { ...base, ...PUBLIC_PAGES[path] };
  if (PRIVATE_PAGES.has(path)) return { ...base, robots: false };

  let m;
  if ((m = path.match(/^\/database\/([^/]+)$/))) {
    const c = cardStmt.get(decodeURIComponent(m[1]));
    if (!c) return { ...base, robots: false, missing: true };
    // deutscher Name nur, wenn er sich wirklich unterscheidet (nicht nur Bindestrich/Groß-Klein)
    const plain = (n) => n.toLowerCase().replace(/[-s]+/g, " ");
    const german = c.name_de && plain(c.name_de) !== plain(c.name) ? c.name_de : null;
    const label = german ? `${german} (${c.name})` : c.name;
    const price = latestTrendByExternal(c.external_id)?.price;
    const parts = [`${label} aus dem Pokémon-Set ${c.set_name}, Nr. ${c.number}${c.rarity ? `, Seltenheit ${c.rarity}` : ""}.`];
    parts.push(price != null ? `Aktueller Cardmarket-Preis: ${eur(price)} mit Preisverlauf.` : "Mit Kartendaten und Preisverlauf.");
    return {
      ...base,
      title: shorten(`${label} Preis – ${c.set_name} ${c.number} | ${SITE_NAME}`, 70),
      description: shorten(parts.join(" "), 200),
      image: c.image_large || c.image_small || DEFAULT_IMAGE,
      type: "article",
    };
  }
  if ((m = path.match(/^\/sets\/([^/]+)$/))) {
    const s = setStmt.get(decodeURIComponent(m[1]));
    if (!s) return { ...base, robots: false, missing: true };
    const year = s.release_date ? ` (${s.release_date.slice(0, 4)})` : "";
    const total = s.total || s.printed_total;
    return {
      ...base,
      title: shorten(`${s.name}${year} – Kartenliste & Preise | ${SITE_NAME}`, 70),
      description: shorten(
        `Alle ${total ? `${total} ` : ""}Karten des Pokémon-Sets ${s.name}${year}: Kartenliste mit aktuellen Cardmarket-Preisen in Euro, Seltenheiten und Sammelfortschritt.`,
        200
      ),
      image: s.logo || DEFAULT_IMAGE,
    };
  }
  if ((m = path.match(/^\/illustrator\/([^/]+)$/))) {
    const name = decodeURIComponent(m[1]);
    const n = artistStmt.get(name).n;
    if (!n) return { ...base, robots: false, missing: true };
    return {
      ...base,
      title: shorten(`Pokémon-Karten von ${name} – Illustrator | ${SITE_NAME}`, 70),
      description: `${n} Pokémon-Karte${n === 1 ? "" : "n"} des Illustrators ${name} mit aktuellen Cardmarket-Preisen.`,
    };
  }
  // Marktplatz-Angebote und Verkäuferprofile sind kurzlebig und persönlich -> nicht indexieren
  return { ...base, robots: false };
}

// Der Block zwischen den Markierungen in frontend/index.html wird ersetzt.
const SEO_BLOCK = /<!--seo:start-->[\s\S]*?<!--seo:end-->/;

export function renderIndex(html, meta) {
  const t = esc(meta.title);
  const d = esc(meta.description);
  const block = `<!--seo:start-->
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <meta name="robots" content="${meta.robots ? "index, follow" : "noindex, follow"}" />
    <link rel="canonical" href="${esc(meta.canonical)}" />
    <meta property="og:type" content="${meta.type}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:locale" content="de_DE" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:url" content="${esc(meta.canonical)}" />
    <meta property="og:image" content="${esc(meta.image)}" />
    <meta name="twitter:card" content="${meta.image === DEFAULT_IMAGE ? "summary" : "summary_large_image"}" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${esc(meta.image)}" />
    <!--seo:end-->`;
  return html.replace(SEO_BLOCK, () => block);
}

// --- Sitemap ---------------------------------------------------------------
// Alle öffentlichen Seiten: feste Seiten, jedes Set, jede Karte, jeder
// Illustrator. Wird nur im Nachtlauf (und beim Start) neu gebaut, nicht pro Abruf.
const allSetsStmt = db.prepare(`SELECT id FROM card_sets ORDER BY release_date DESC`);
const allCardsStmt = db.prepare(`SELECT external_id FROM cards`);
const allArtistsStmt = db.prepare(`SELECT DISTINCT artist FROM cards WHERE artist IS NOT NULL AND artist != ''`);

let sitemapXml = null;

export function rebuildSitemap() {
  const urls = Object.keys(PUBLIC_PAGES).map((p) => p);
  for (const s of allSetsStmt.all()) urls.push(`/sets/${encodeURIComponent(s.id)}`);
  for (const a of allArtistsStmt.all()) urls.push(`/illustrator/${encodeURIComponent(a.artist)}`);
  for (const c of allCardsStmt.all()) urls.push(`/database/${encodeURIComponent(c.external_id)}`);
  const body = urls.map((u) => `  <url><loc>${esc(SITE_URL + u)}</loc></url>`).join("\n");
  sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  console.log(`[seo] Sitemap neu gebaut (${urls.length} Seiten).`);
  return sitemapXml;
}

export const sitemap = () => sitemapXml ?? rebuildSitemap();
