// Adresse einer Karte: lesbarer Slug (z. B. "arceus-60-cherubi"), sonst die ID. Alte
// ID-Adressen funktionieren weiter (der Server leitet sie auf den Slug um).
export const cardPath = (card) => `/database/${card.slug ?? card.external_id}`;
