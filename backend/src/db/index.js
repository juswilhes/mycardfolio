import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "..", "..", "data.sqlite"));

db.pragma("journal_mode = WAL");

// --- Schema ---------------------------------------------------------------
// "games" macht die App von Anfang an multi-tcg-fähig (Pokemon, MTG, Yu-Gi-Oh, ...)
// statt Pokemon fest zu verdrahten.
db.exec(`
CREATE TABLE IF NOT EXISTS games (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  slug  TEXT UNIQUE NOT NULL,     -- z.B. "pokemon", "mtg"
  name  TEXT NOT NULL
);

-- Set-Stammdaten (Erweiterungen). Kommen aus dem lokalen Datensatz, nicht
-- mehr live von der API -> die "Alle Karten"-Seite lädt dadurch sofort.
CREATE TABLE IF NOT EXISTS card_sets (
  id             TEXT PRIMARY KEY,   -- z.B. "sv8"
  game_id        INTEGER NOT NULL REFERENCES games(id),
  name           TEXT NOT NULL,
  series         TEXT,
  printed_total  INTEGER,
  total          INTEGER,
  release_date   TEXT,
  logo           TEXT,
  symbol         TEXT
);

CREATE TABLE IF NOT EXISTS cards (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id       INTEGER NOT NULL REFERENCES games(id),
  external_id   TEXT NOT NULL,     -- ID aus der jeweiligen Karten-API
  name          TEXT NOT NULL,
  set_name      TEXT,
  number        TEXT,
  rarity        TEXT,
  image_small   TEXT,
  image_large   TEXT,              -- Bild in Englisch (API liefert i.d.R. EN-Artwork)
  UNIQUE(game_id, external_id)
);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id     INTEGER NOT NULL REFERENCES cards(id),
  source      TEXT NOT NULL,       -- z.B. "tcgplayer", "cardmarket"
  price_type  TEXT NOT NULL,       -- z.B. "market", "low", "trend"
  currency    TEXT NOT NULL,
  price       REAL NOT NULL,
  fetched_at  TEXT NOT NULL        -- ISO-Datum, ein Wert pro Tag/Fetch
);

CREATE TABLE IF NOT EXISTS collection_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id         INTEGER NOT NULL REFERENCES cards(id),
  quantity        INTEGER NOT NULL DEFAULT 1,
  condition       TEXT DEFAULT 'near_mint',
  purchase_price  REAL,
  purchase_date   TEXT,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ein Tages-Snapshot des GESAMTEN Portfolios (für den Wert-über-Zeit-Graphen).
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  captured_on  TEXT PRIMARY KEY,     -- YYYY-MM-DD
  total_value  REAL NOT NULL,
  total_cost   REAL NOT NULL,
  card_count   INTEGER NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Verkaufte Karten: beim Verkauf wird der Sammlungseintrag hierher verschoben,
-- damit realisierter Gewinn/Verlust und Verkaufshistorie erhalten bleiben.
CREATE TABLE IF NOT EXISTS sales (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id        INTEGER REFERENCES cards(id),
  external_id    TEXT,
  name           TEXT NOT NULL,
  set_name       TEXT,
  number         TEXT,
  image_small    TEXT,
  quantity       INTEGER NOT NULL DEFAULT 1,
  condition      TEXT,
  language       TEXT,
  purchase_price REAL,
  shipping_cost  REAL,
  sale_price     REAL,
  sale_shipping  REAL,
  sale_fees      REAL,
  sold_on        TEXT,
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_price_card ON price_snapshots(card_id, fetched_at);
CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);
`);

// --- Migrationen --------------------------------------------------------
// Erweiterte Karten-Stammdaten (Artist, Flavor-Text, Attacken, ...). Als
// ALTER TABLE, damit vorhandene data.sqlite-Dateien nicht neu angelegt
// werden müssen und die Sammlung erhalten bleibt.
const cardColumns = new Set(db.prepare(`PRAGMA table_info(cards)`).all().map((c) => c.name));
const addColumn = (name, type) => {
  if (!cardColumns.has(name)) {
    db.exec(`ALTER TABLE cards ADD COLUMN ${name} ${type}`);
    cardColumns.add(name);
  }
};
addColumn("set_id", "TEXT");
addColumn("supertype", "TEXT");
addColumn("subtypes", "TEXT");        // JSON-Array
addColumn("types", "TEXT");           // JSON-Array
addColumn("hp", "TEXT");
addColumn("artist", "TEXT");
addColumn("flavor_text", "TEXT");
addColumn("national_pokedex", "TEXT"); // JSON-Array
addColumn("evolves_from", "TEXT");
addColumn("abilities", "TEXT");        // JSON
addColumn("attacks", "TEXT");          // JSON
addColumn("weaknesses", "TEXT");       // JSON
addColumn("resistances", "TEXT");      // JSON
addColumn("retreat_cost", "TEXT");     // JSON-Array
addColumn("rules", "TEXT");            // JSON-Array
addColumn("legalities", "TEXT");       // JSON
addColumn("regulation_mark", "TEXT");
addColumn("raw_json", "TEXT");         // vollständige Rohdaten, falls später mehr gebraucht wird
addColumn("artist_source", "TEXT");    // woher der Illustrator kommt: "dataset" | "tcgdex" | "manual"
addColumn("artist_manual", "INTEGER"); // 1 = vom Nutzer gesetzt, darf beim Re-Import nicht überschrieben werden
addColumn("cardmarket_product_id", "INTEGER"); // für den Direktlink zu Cardmarket
addColumn("cardmarket_updated", "TEXT");       // Zeitstempel des letzten Cardmarket-Werts

db.exec(`CREATE INDEX IF NOT EXISTS idx_cards_set ON cards(set_id)`);

// Sammlungs-Einträge: Versandkosten getrennt vom Kaufpreis führen, damit
// man später Gebühren/Versand sauber auswerten kann. currency vorbereitet
// (aktuell immer EUR).
const ciColumns = new Set(db.prepare(`PRAGMA table_info(collection_items)`).all().map((c) => c.name));
const addCiColumn = (name, type) => {
  if (!ciColumns.has(name)) {
    db.exec(`ALTER TABLE collection_items ADD COLUMN ${name} ${type}`);
    ciColumns.add(name);
  }
};
addCiColumn("shipping_cost", "REAL");
addCiColumn("currency", "TEXT DEFAULT 'EUR'");
addCiColumn("language", "TEXT DEFAULT 'en'"); // Sprache der Druckvariante: 'de' | 'en'

// Pokemon als erstes unterstütztes Spiel anlegen
db.prepare(
  `INSERT OR IGNORE INTO games (slug, name) VALUES ('pokemon', 'Pokémon TCG')`
).run();

export default db;
