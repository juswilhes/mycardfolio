// Gemeinsame Euro-Formatierung (deutsches Format: 1.234,56 €).
const fmt = (digits) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits });
const two = fmt(2);
const zero = fmt(0);

export const eur = (n) => two.format(Number(n));
export const eurAbs = (n) => two.format(Math.abs(Number(n)));
export const eurCents = (cents) => two.format(Number(cents) / 100);
export const eur0 = (n) => zero.format(Number(n));

// "8. Oktober 2026" aus einem Datum wie 2026-10-08
export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
