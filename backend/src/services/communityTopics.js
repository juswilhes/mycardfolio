// Anregungen für die News-Seite im Tagesbericht: aktuelle Schlagzeilen und Community-Themen aus
// frei abrufbaren Feeds (kein Schlüssel, keine Kosten). X/Instagram/TikTok sind nicht erreichbar,
// Reddit drosselt Server-Abrufe - es ist "best effort": fällt eine Quelle aus, wird sie in der Mail
// als nicht abrufbar vermerkt und der Rest funktioniert trotzdem.
const UA = "mycardfolio-daily-report/1.0 (+https://mycardfolio.de)";

const SOURCES = [
  { name: "Pokezentrum – deutsche News", url: "https://pokezentrum.de/feed/", n: 3 },
  // Dauer-Threads ("... Thread") sind festgepinnt und stünden jeden Tag drin
  { name: "PokéBeach-Forum – Community", url: "https://www.pokebeach.com/forums/forums/-/index.rss", n: 3, skip: /thread/i },
  { name: "Reddit r/PokemonTCG – Top des Tages", url: "https://www.reddit.com/r/PokemonTCG/top/.rss?t=day&limit=6", n: 3 },
];

const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…" };
const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => entities[n.toLowerCase()] ?? m);
const clean = (html) =>
  decode(decode(String(html ?? "").replace(/<!\[CDATA\[|\]\]>/g, "")).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
const pick = (block, tag) => block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))?.[1] ?? "";
const short = (s, max) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);

// RSS (<item>) und Atom (<entry>)
function parseFeed(xml) {
  const isAtom = /<entry[\s>]/.test(xml) && !/<item[\s>]/.test(xml);
  const blocks = xml.split(isAtom ? /<entry[\s>]/ : /<item[\s>]/).slice(1);
  return blocks.map((b) => {
    const link = isAtom ? (b.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? "") : clean(pick(b, "link"));
    const body = clean(pick(b, isAtom ? "content" : "description") || pick(b, "content:encoded"))
      .replace(/submitted by.*$/i, "")
      .replace(/\[link\]|\[comments\]/g, "")
      .trim();
    return { title: clean(pick(b, "title")), link: decode(link), teaser: short(body, 170) };
  }).filter((e) => e.title && e.link);
}

async function fetchSource(src) {
  try {
    const res = await fetch(src.url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" }, redirect: "follow", signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return { name: src.name, items: [], error: `HTTP ${res.status}` };
    const items = parseFeed(await res.text()).filter((e) => !src.skip?.test(e.title)).slice(0, src.n);
    return { name: src.name, items, error: items.length ? null : "keine Einträge" };
  } catch (e) {
    return { name: src.name, items: [], error: e.name === "TimeoutError" ? "Zeitüberschreitung" : e.message };
  }
}

export const fetchCommunityTopics = () => Promise.all(SOURCES.map(fetchSource));
