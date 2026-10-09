// Gemeinsame Bausteine für alle Verlaufs-Graphen: wählbarer Zeitraum und
// Tooltip-Sortierung (höherer Wert steht oben).
export const RANGES = [
  { id: "1m", label: "1 Monat", days: 30 },
  { id: "3m", label: "3 Monate", days: 90 },
  { id: "6m", label: "6 Monate", days: 180 },
  { id: "12m", label: "12 Monate", days: 365 },
];

export const rangeDays = (id) => RANGES.find((r) => r.id === id)?.days ?? 365;

// Nur Einträge innerhalb der letzten `days` Tage (getDate: Eintrag -> Datum/ISO-String).
export function withinDays(items, days, getDate) {
  const from = Date.now() - days * 24 * 60 * 60 * 1000;
  return items.filter((x) => Date.parse(getDate(x)) >= from);
}

// Für <Tooltip itemSorter>: größter Wert zuerst.
export const highestFirst = (item) => -(Number(item.value) || 0);
