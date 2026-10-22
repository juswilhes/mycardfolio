import db from "../db/index.js";
import { latestTrendByExternal } from "./cardService.js";
import { slugOfSet, resolveSetParam, rebuildSetSlugs } from "./setSlugs.js";
import { getArticleBySlug, listPublishedArticles } from "./articles.js";
import { nicknamesOf } from "./cardNicknames.js";
import { slugOfCard, resolveCardParam, rebuildCardSlugs } from "./cardSlugs.js";
import { analysis } from "./analysisCache.js";

// Meta-Tags pro Seite (Titel, Beschreibung, canonical, Vorschaubild) und die
// Sitemap. Die App ist eine Single-Page-App: ohne dieses Einsetzen auf dem
// Server hätte jede Seite denselben Titel und dieselbe canonical-URL (die
// Startseite) - Suchmaschinen und Link-Vorschauen (WhatsApp, Discord)
// sehen nur das HTML vom Server, nicht das, was React danach anzeigt.

const SITE_URL = "https://mycardfolio.de";
const SITE_NAME = "mycardfolio";
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;
const DEFAULT_TITLE = "mycardfolio – Pokémon-Sammlung & Portfolio-Wert im Blick";
const DEFAULT_DESCRIPTION =
  "mycardfolio verwaltet deine Pokémon-Sammelkarten: aktuelle Cardmarket-Preise in Euro, Gewinn und Verlust deines Portfolios über die Zeit, Set-Fortschritt und Massen-Import.";

const eur = (n) => `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const shorten = (s, max) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Sichtbarer Text im HTML: Suchmaschinen und Link-Vorschauen sehen nur das, was der Server
// ausliefert - React ersetzt diesen Block, sobald die App geladen ist. Die Klassen stammen aus
// dem App-Stylesheet (auch ohne JavaScript sieht es ordentlich aus).
const link = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;
const wrap = (inner) => `<div class="px-6 py-8 max-w-5xl mx-auto">${inner}</div>`;
const dateDe = (iso) => new Date(iso).toLocaleDateString("de-DE");
const crumbs = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE_URL + path })),
});
// Titel mit Markenzusatz, wenn er in die ~70 Zeichen der Suchergebnisse passt
const titled = (base) => (base.length + SITE_NAME.length + 3 <= 70 ? `${base} | ${SITE_NAME}` : shorten(base, 70));
const setLink = (id, name) => link(`/sets/${encodeURIComponent(slugOfSet(id))}`, name);
const setCardsStmt = db.prepare(`SELECT external_id, name, name_de, number FROM cards WHERE set_id = ? ORDER BY CAST(number AS INTEGER), number`);
const newestSetsStmt = db.prepare(`SELECT id, name, release_date FROM card_sets ORDER BY release_date DESC LIMIT 12`);
const allSetsListStmt = db.prepare(`SELECT id, name, release_date, total FROM card_sets ORDER BY release_date DESC`);

// Text und Links für Startseite und Kartenübersicht (Einstieg für Suchroboter in alle Sets)
function pageExtras(path) {
  if (path === "/") {
    const items = newestSetsStmt.all().map((s) => `<li>${setLink(s.id, s.name)}</li>`).join("");
    return {
      body: wrap(
        `<h1>Pokémon-Karten: Wert, Preise und Sammlung im Blick</h1>` +
          `<p>Wie viel sind deine Pokémon-Karten wert? mycardfolio zeigt für über 20.000 Karten den aktuellen Cardmarket-Preis in Euro, den Preisverlauf und den Wert deiner Sammlung – kostenlos und ohne Anmeldung zum Nachschlagen.</p>` +
          `<p>${link("/sets", "Alle Karten und Sets durchsuchen")} · ${link("/news", "News und Auswertungen")}</p>` +
          `<h2>Neueste Sets</h2><ul>${items}</ul>`
      ),
    };
  }
  if (path === "/sets") {
    const items = allSetsListStmt
      .all()
      .map((s) => `<li>${setLink(s.id, s.name)}${s.release_date ? ` (${s.release_date.slice(0, 4)})` : ""}${s.total ? ` – ${s.total} Karten` : ""}</li>`)
      .join("");
    return {
      body: wrap(`<h1>Alle Pokémon-Karten und Sets – Wert und Preise</h1><p>Suche eine Karte, um ihren aktuellen Wert und Preisverlauf zu sehen, oder wähle ein Set.</p><ul>${items}</ul>`),
      jsonld: [crumbs([["Start", "/"], ["Alle Karten", "/sets"]])],
    };
  }
  return {};
}

// Feste Seiten: indexierbar (mit Titel/Beschreibung) bzw. nur für Angemeldete
// und Formulare (noindex - sollen nicht in der Suche auftauchen).
const PUBLIC_PAGES = {
  "/": {
    title: "mycardfolio – Pokémon-Karten Wert, Preise & Sammlung im Blick",
    description:
      "Wie viel sind deine Pokémon-Karten wert? Aktuelle Cardmarket-Preise in Euro für über 20.000 Karten, Preisverlauf, Wert deiner Sammlung und Set-Fortschritt – kostenlos.",
  },
  "/sets": {
    title: "Pokémon-Karten Wert & Preise – alle Sets | mycardfolio",
    description:
      "Alle Pokémon-Sets und Karten durchsuchen: aktueller Wert in Euro nach Cardmarket, Seltenheiten, Illustratoren und Preisverlauf – kostenlos und ohne Anmeldung.",
  },
  "/news": {
    title: "News & Artikel für Pokémon-Sammler | mycardfolio",
    description:
      "Artikel rund ums Sammeln: Hit Rates, Pull Rates, Kartenpreise und Auswertungen von mycardfolio – verständlich erklärt.",
  },
  "/impressum": { title: "Impressum | mycardfolio", description: "Impressum und Anbieterkennzeichnung von mycardfolio." },
  "/datenschutz": { title: "Datenschutzerklärung | mycardfolio", description: "So geht mycardfolio mit deinen Daten um." },
};
const PRIVATE_PAGES = new Set([
  "/login", "/register", "/passwort-vergessen", "/passwort-zuruecksetzen", "/verify", "/import",
  "/sammlung", "/verkauft", "/analyse", "/statistik", "/konto", "/orden", "/watchlist", "/add",
]);

const cardStmt = db.prepare(`
  SELECT external_id, name, name_de, set_id, set_name, number, rarity, artist, image_large, image_small
  FROM cards WHERE external_id = ?
`);
const setStmt = db.prepare(`SELECT id, name, total, printed_total, release_date, logo FROM card_sets WHERE id = ?`);
const artistStmt = db.prepare(`SELECT COUNT(*) AS n FROM cards WHERE artist = ? COLLATE NOCASE`);

// Meta-Angaben für einen Pfad. robots=false -> noindex.
export function metaFor(rawPath) {
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;
  const canonical = `${SITE_URL}${path === "/" ? "/" : path}`;
  const base = { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, image: DEFAULT_IMAGE, canonical, robots: true, type: "website" };

  if (PUBLIC_PAGES[path]) return { ...base, ...PUBLIC_PAGES[path], ...pageExtras(path) };
  if (PRIVATE_PAGES.has(path)) return { ...base, robots: false };

  let m;
  if ((m = path.match(/^\/database\/([^/]+)$/))) {
    const c = cardStmt.get(resolveCardParam(decodeURIComponent(m[1])));
    if (!c) return { ...base, robots: false, missing: true };
    base.canonical = `${SITE_URL}/database/${slugOfCard(c.external_id)}`;
    // deutscher Name nur, wenn er sich wirklich unterscheidet (nicht nur Bindestrich/Groß-Klein)
    const plain = (n) => n.toLowerCase().replace(/[-s]+/g, " ");
    const german = c.name_de && plain(c.name_de) !== plain(c.name) ? c.name_de : null;
    const label = german ? `${german} (${c.name})` : c.name;
    // Sammler suchen oft nach dem Spitznamen ("Moonbreon Preis") - deshalb vorne in Titel und Text
    const nick = nicknamesOf(c.external_id).join(" / ");
    const trend = latestTrendByExternal(c.external_id);
    const price = trend?.price;
    const setPath = `/sets/${encodeURIComponent(slugOfSet(c.set_id))}`;
    const description =
      (nick ? `„${nick}": ` : "") +
      (price != null
        ? `Wie viel ist ${label} (${c.set_name}, Nr. ${c.number}) wert? Aktueller Cardmarket-Wert: ${eur(price)}${c.rarity ? ` · ${c.rarity}` : ""}. Mit Preisverlauf und Ø 30 Tage.`
        : `${label} aus dem Pokémon-Set ${c.set_name}, Nr. ${c.number}${c.rarity ? `, Seltenheit ${c.rarity}` : ""}. Mit Kartendaten und Preisverlauf.`);
    const when = trend?.fetched_at ? ` (Cardmarket, Stand ${dateDe(trend.fetched_at)})` : "";
    const body = wrap(
      `<nav>${link("/", "Start")} › ${link("/sets", "Alle Karten")} › ${link(setPath, c.set_name)}</nav>` +
        `<h1>${nick ? `${esc(nick)}: ` : ""}${esc(label)} – ${esc(c.set_name)} ${esc(c.number)}: Wert und Preis</h1>` +
        (nick ? `<p>Unter Sammlern ist die Karte als „${esc(nick)}" bekannt.</p>` : "") +
        (price != null
          ? `<p>${esc(label)} aus dem Pokémon-Set ${esc(c.set_name)} (Nr. ${esc(c.number)}) ist aktuell etwa <strong>${esc(eur(price))}</strong> wert${esc(when)}.${
              trend.avg30 != null ? ` Der Durchschnitt der letzten 30 Tage liegt bei ${esc(eur(trend.avg30))}.` : ""
            }</p>`
          : `<p>Für ${esc(label)} aus dem Pokémon-Set ${esc(c.set_name)} liegt aktuell kein Preis vor.</p>`) +
        `<ul><li>Set: ${link(setPath, c.set_name)}</li><li>Kartennummer: ${esc(c.number)}</li>${c.rarity ? `<li>Seltenheit: ${esc(c.rarity)}</li>` : ""}${
          c.artist ? `<li>Illustrator: ${link(`/illustrator/${encodeURIComponent(c.artist)}`, c.artist)}</li>` : ""
        }</ul>` +
        `<p>Die Preise stammen von Cardmarket und werden jede Nacht aktualisiert. Auf der Seite siehst du den Preisverlauf und kannst die Karte zu deiner Sammlung hinzufügen.</p>`
    );
    return {
      ...base,
      title: titled(`${nick ? `${nick}: ` : ""}${label} Wert & Preis – ${c.set_name} ${c.number}`),
      description: shorten(description, 200),
      image: c.image_large || c.image_small || DEFAULT_IMAGE,
      type: "article",
      body,
      jsonld: [crumbs([["Start", "/"], ["Alle Karten", "/sets"], [c.set_name, setPath], [label, base.canonical.replace(SITE_URL, "")]])],
    };
  }
  if ((m = path.match(/^\/news\/([^/]+)$/))) {
    const a = getArticleBySlug(decodeURIComponent(m[1]));
    if (!a || !a.published) return { ...base, robots: false, missing: true };
    return {
      ...base,
      // Markenzusatz nur, wenn der Titel dann nicht zu lang für die Suchergebnisse wird
      title: a.title.length + SITE_NAME.length + 3 <= 70 ? `${a.title} | ${SITE_NAME}` : shorten(a.title, 70),
      description: shorten(a.summary, 200),
      // Link-Vorschauen (WhatsApp, Discord ...) können kein SVG: dann das Logo
      image: a.image && !a.image.endsWith(".svg") ? `${SITE_URL}${a.image}` : DEFAULT_IMAGE,
      type: "article",
    };
  }
  if ((m = path.match(/^\/sets\/([^/]+)$/))) {
    const s = setStmt.get(resolveSetParam(decodeURIComponent(m[1])));
    if (!s) return { ...base, robots: false, missing: true };
    base.canonical = `${SITE_URL}/sets/${slugOfSet(s.id)}`;
    const year = s.release_date ? ` (${s.release_date.slice(0, 4)})` : "";
    const total = s.total || s.printed_total;
    const top = analysis("setTopCards")?.[s.id] ?? [];
    const cards = setCardsStmt.all(s.id);
    const best = top[0];
    const setPath = base.canonical.replace(SITE_URL, "");
    const body = wrap(
      `<nav>${link("/", "Start")} › ${link("/sets", "Alle Karten")}</nav>` +
        `<h1>${esc(s.name)}${esc(year)} – Kartenliste, Wert und Preise</h1>` +
        `<p>Alle ${total ? `${total} ` : ""}Karten des Pokémon-Sets ${esc(s.name)} mit aktuellem Cardmarket-Wert in Euro.${best ? ` Die wertvollste Karte ist ${esc(best.name)} mit etwa ${esc(eur(best.price))}.` : ""}</p>` +
        (top.length
          ? `<h2>Die wertvollsten Karten aus ${esc(s.name)}</h2><ol>${top
              .map((c) => `<li>${link(`/database/${encodeURIComponent(c.slug)}`, c.name)} – ${esc(eur(c.price))}</li>`)
              .join("")}</ol>`
          : "") +
        `<h2>Alle Karten im Set</h2><ul>${cards
          .map((c) => `<li>${link(`/database/${encodeURIComponent(slugOfCard(c.external_id))}`, `${c.name_de || c.name} (${c.name_de && c.name_de !== c.name ? c.name + ", " : ""}Nr. ${c.number})`)}</li>`)
          .join("")}</ul>`
    );
    return {
      ...base,
      title: titled(`${s.name}${year} – Kartenliste, Wert & Preise`),
      description: shorten(
        `Alle ${total ? `${total} ` : ""}Karten des Pokémon-Sets ${s.name}${year} mit aktuellem Cardmarket-Wert in Euro${best ? `. Wertvollste Karte: ${best.name} (${eur(best.price)})` : ""}. Kartenliste, Seltenheiten und Sammelfortschritt.`,
        200
      ),
      image: s.logo || DEFAULT_IMAGE,
      body,
      jsonld: [crumbs([["Start", "/"], ["Alle Karten", "/sets"], [s.name, setPath]])],
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
  // alles Unbekannte nicht indexieren
  return { ...base, robots: false };
}

// Alte Adressen (/sets/me1, /database/pl4-60) auf die lesbaren (/sets/mega-evolution,
// /database/arceus-60-gengar) umleiten.
// Alte Adressen aus der Zeit vor der neuen Seite, die Google noch kennt: 301 auf den passenden Artikel
// (nur solange er veröffentlicht ist, sonst bleibt es beim 404).
const OLD_ARTICLE_PATHS = {
  "/die-besten-tipps-zur-bewertung-ihrer-trading-cards": "wie-finde-ich-heraus-was-meine-pokemon-karte-wert-ist",
};

export function redirectFor(rawPath) {
  const oldSlug = OLD_ARTICLE_PATHS[rawPath.replace(/\/+$/, "")];
  if (oldSlug && getArticleBySlug(oldSlug)?.published) return `/news/${oldSlug}`;
  const card = rawPath.match(/^\/database\/([^/]+)\/?$/);
  if (card) {
    const param = decodeURIComponent(card[1]);
    const id = resolveCardParam(param);
    if (!cardStmt.get(id)) return null;
    const slug = slugOfCard(id);
    return param === slug && !rawPath.endsWith("/") ? null : `/database/${encodeURIComponent(slug)}`;
  }
  const m = rawPath.match(/^\/sets\/([^/]+)\/?$/);
  if (!m) return null;
  const param = decodeURIComponent(m[1]);
  const id = resolveSetParam(param);
  if (!setStmt.get(id)) return null;
  const slug = slugOfSet(id);
  return param === slug && !rawPath.endsWith("/") ? null : `/sets/${encodeURIComponent(slug)}`;
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
    ${(meta.jsonld ?? []).map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`).join("\n    ")}
    <!--seo:end-->`;
  const out = html.replace(SEO_BLOCK, () => block);
  return meta.body ? out.replace('<div id="root"></div>', () => `<div id="root">${meta.body}</div>`) : out;
}

// --- Sitemap ---------------------------------------------------------------
// Alle öffentlichen Seiten: feste Seiten, jedes Set, jede Karte, jeder
// Illustrator. Wird nur im Nachtlauf (und beim Start) neu gebaut, nicht pro Abruf.
const allSetsStmt = db.prepare(`SELECT id FROM card_sets ORDER BY release_date DESC`);
const allCardsStmt = db.prepare(`SELECT external_id FROM cards`);
const allArtistsStmt = db.prepare(`SELECT DISTINCT artist FROM cards WHERE artist IS NOT NULL AND artist != ''`);

let sitemapXml = null;

export function rebuildSitemap() {
  rebuildSetSlugs(); // neue Sets seit dem letzten Nachtlauf bekommen ihren Slug
  rebuildCardSlugs(); // ... und neue Karten
  const urls = Object.keys(PUBLIC_PAGES).map((p) => p);
  for (const s of allSetsStmt.all()) urls.push(`/sets/${encodeURIComponent(slugOfSet(s.id))}`);
  for (const a of listPublishedArticles(500)) urls.push(`/news/${encodeURIComponent(a.slug)}`);
  for (const a of allArtistsStmt.all()) urls.push(`/illustrator/${encodeURIComponent(a.artist)}`);
  for (const c of allCardsStmt.all()) urls.push(`/database/${encodeURIComponent(slugOfCard(c.external_id))}`);
  const body = urls.map((u) => `  <url><loc>${esc(SITE_URL + u)}</loc></url>`).join("\n");
  sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  console.log(`[seo] Sitemap neu gebaut (${urls.length} Seiten).`);
  return sitemapXml;
}

export const sitemap = () => sitemapXml ?? rebuildSitemap();
