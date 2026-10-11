import db from "../db/index.js";

// Der Link "Auf Cardmarket ansehen" muss auf die genaue Karte führen. Cardmarkets echte
// Adressen enthalten Set- und Kartennamen (.../Singles/Scarlet-Violet/Drowzee-V2-SVI210),
// aus der Produktnummer allein lassen sie sich nicht bauen (die Nummer-Adresse landete auf der
// Startseite). pokemontcg.io pflegt je Karte eine Weiterleitung auf die richtige Seite
// (prices.pokemontcg.io/cardmarket/<id>) - die lesen wir einmal je Karte aus und speichern
// das Ziel in cards.cardmarket_page. NULL = noch nicht geprüft, '' = dort unbekannt
// (z. B. brandneue Sets). Karten ohne Treffer bekommen als Ersatz die Cardmarket-Suche.
const REDIRECT_URL = "https://prices.pokemontcg.io/cardmarket/";
const UTM = "utm_source=mycardfolio&utm_medium=referral"; // damit Cardmarket die Besucher von uns erkennt
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function cardmarketLink({ cardmarket_page, name }) {
  if (cardmarket_page) return `${cardmarket_page}?${UTM}`;
  return name ? `https://www.cardmarket.com/de/Pokemon/Products/Search?searchString=${encodeURIComponent(name)}&${UTM}` : null;
}

// -> Adresse | '' (kein Treffer) | null (Fehler, später noch einmal)
async function resolveOne(externalId) {
  for (let t = 0; t < 3; t++) {
    try {
      const res = await fetch(REDIRECT_URL + encodeURIComponent(externalId), { redirect: "manual", signal: AbortSignal.timeout(10_000) });
      if (res.status >= 300 && res.status < 400) {
        const m = (res.headers.get("location") ?? "").match(/^https:\/\/(?:www\.)?cardmarket\.com\/(?:en|de)\/(Pokemon\/Products\/Singles\/[^?#]+)/i);
        return m ? `https://www.cardmarket.com/de/${m[1]}` : "";
      }
      if (res.status === 404) return "";
    } catch {
      /* Netzwerkfehler: noch einmal */
    }
    await sleep(800 * (t + 1));
  }
  return null;
}

const pendingStmt = (withEmpty) =>
  db.prepare(`
    SELECT id, external_id FROM cards
    WHERE game_id = (SELECT id FROM games WHERE slug = 'pokemon')
      AND (cardmarket_page IS NULL ${withEmpty ? "OR cardmarket_page = ''" : ""})
    ORDER BY view_count DESC, id LIMIT ?
  `);
const saveStmt = db.prepare(`UPDATE cards SET cardmarket_page = ? WHERE id = ?`);

export async function fillCardmarketPages({ limit = 5000, retryEmpty = false } = {}) {
  const todo = pendingStmt(retryEmpty).all(limit);
  const stats = { gefunden: 0, unbekannt: 0, offen: 0 };
  let next = 0;
  let failStreak = 0;
  let nextStart = 0;
  async function worker() {
    while (next < todo.length && failStreak < 25) {
      const card = todo[next++];
      const wait = Math.max(0, nextStart - Date.now());
      nextStart = Math.max(Date.now(), nextStart) + 120; // höflich: ca. 8 Abrufe pro Sekunde
      if (wait) await sleep(wait);
      const page = await resolveOne(card.external_id);
      if (page === null) {
        stats.offen++;
        failStreak++;
        continue;
      }
      failStreak = 0;
      saveStmt.run(page, card.id);
      page ? stats.gefunden++ : stats.unbekannt++;
    }
  }
  await Promise.all(Array.from({ length: 5 }, worker));
  if (todo.length) console.log(`[cardmarket-links] ${stats.gefunden} Adressen gefunden, ${stats.unbekannt} unbekannt (Suche als Ersatz), ${stats.offen} später erneut.`);
  return stats;
}

// Nach dem Deploy einmal im Hintergrund (nur Netzwerk, kaum Rechenlast), danach hält der
// Nachtlauf neue Karten aktuell.
export function catchUpCardmarketPages() {
  const open = db.prepare(`SELECT COUNT(*) n FROM cards WHERE cardmarket_page IS NULL`).get().n;
  if (!open) return;
  setTimeout(() => {
    fillCardmarketPages({ limit: 30000 }).catch((e) => console.error("[cardmarket-links] Nachholen fehlgeschlagen:", e.message));
  }, 90_000);
}
