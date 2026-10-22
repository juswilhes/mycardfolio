// Spitznamen, unter denen Sammler bestimmte Karten kennen ("Moonbreon" = Umbreon VMAX 215/203).
// Die Suche findet die Karten auch darüber, die Kartenseite zeigt den Spitznamen, und Titel/
// Beschreibung für Google enthalten ihn (viele suchen nach "Moonbreon Preis").
// Nur Spitznamen mit Beleg (Sammler-Glossare, Händler, Foren) und nur für eindeutig zugeordnete
// Karten-IDs aus unserer Datenbank. "aliases" = nur Suchhilfen (deutsche Schreibweisen), werden
// nicht angezeigt. Neuer Spitzname = Eintrag hier.
export const NICKNAMES = [
  { name: "Moonbreon", ids: ["swsh7-215"] },
  { name: "Sunbreon", ids: ["sv8pt5-161"] },
  { name: "Bubble Mew", ids: ["sv4pt5-232"] },
  { name: "Mewtube", ids: ["sm35-78"] },
  { name: "Van Gogh Pikachu", ids: ["svp-85"] },
  { name: "Birthday Pikachu", aliases: ["Geburtstags-Pikachu"], ids: ["basep-24", "cel25c-24_A"] },
  { name: "Logan Paul Charizard", aliases: ["Logan Paul Glurak"], ids: ["base1-4"] },
  { name: "Hat Lillie", ids: ["sm1-147"] },
  { name: "ADP", ids: ["sm12-156", "sm12-220", "sm12-221", "sm12-258"] },
  { name: "Fat Chu", ids: ["swsh4-44", "swsh4-188"] },
];

const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const byCard = new Map();
for (const n of NICKNAMES) for (const id of n.ids) byCard.set(id, [...(byCard.get(id) ?? []), n.name]);

export const nicknamesOf = (externalId) => byCard.get(externalId) ?? [];

// Karten-IDs, deren Spitzname zur Suche passt: ganzer Name oder (ab 4 Zeichen) der Anfang davon,
// damit schon beim Tippen ("moonbr") etwas erscheint. Leerzeichen/Bindestriche egal.
export function cardIdsForNickname(query) {
  const q = norm(query);
  if (!q) return [];
  const ids = [];
  for (const n of NICKNAMES) {
    const hit = [n.name, ...(n.aliases ?? [])].some((a) => {
      const k = norm(a);
      return k === q || (q.length >= 4 && k.startsWith(q));
    });
    if (hit) ids.push(...n.ids);
  }
  return ids;
}
