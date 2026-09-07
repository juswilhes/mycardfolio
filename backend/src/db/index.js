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

CREATE INDEX IF NOT EXISTS idx_price_card ON price_snapshots(card_id, fetched_at);
`);

// Pokemon als erstes unterstütztes Spiel anlegen
db.prepare(
  `INSERT OR IGNORE INTO games (slug, name) VALUES ('pokemon', 'Pokémon TCG')`
).run();

export default db;
