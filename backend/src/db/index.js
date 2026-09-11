import Database from "better-sqlite3";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Speicherort der SQLite-Datei. In Produktion auf ein persistentes Volume
// zeigen lassen (DATABASE_PATH), lokal liegt sie im backend-Ordner.
const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, "..", "..", "data.sqlite");
const db = new Database(dbPath);

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

-- Nutzerkonten (ab "Model B": jede Person hat ihr eigenes Portfolio).
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT UNIQUE NOT NULL,          -- immer kleingeschrieben
  password_hash  TEXT NOT NULL DEFAULT '',
  display_name   TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  verify_token   TEXT,
  verify_sent_at TEXT,
  reset_token    TEXT,
  reset_expires  TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Orden-System: welche Orden hat welcher Nutzer wann erhalten (Definitionen
-- selbst liegen im Code, nicht in der DB - so lassen sich neue Orden ohne
-- Migration hinzufügen).
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id         INTEGER NOT NULL REFERENCES users(id),
  achievement_id  TEXT NOT NULL,
  earned_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, achievement_id)
);

-- Kennzahlen für den Tagesbericht an den Betreiber.
-- daily_hits: Seitenaufrufe je Pfad (keine IPs).
CREATE TABLE IF NOT EXISTS daily_hits (
  day   TEXT NOT NULL,   -- YYYY-MM-DD (Serverzeit)
  path  TEXT NOT NULL,
  hits  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path)
);
-- daily_visitors: grobe Besucherzahl. Gespeichert wird nur ein
-- nicht umkehrbarer Hash aus IP + Datum + Geheimnis, max. 7 Tage.
CREATE TABLE IF NOT EXISTS daily_visitors (
  day   TEXT NOT NULL,
  vhash TEXT NOT NULL,
  PRIMARY KEY (day, vhash)
);
-- daily_stat: sonstige Tages-Zähler (z.B. Serverfehler 5xx).
CREATE TABLE IF NOT EXISTS daily_stat (
  day TEXT NOT NULL,
  key TEXT NOT NULL,
  n   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, key)
);
-- app_meta: interne Schlüssel/Werte (z.B. das Besucher-Hash-Geheimnis).
CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
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
addCiColumn("variant", "TEXT DEFAULT 'normal'"); // 'normal' | 'holo' | 'reverse' | 'first_edition'
addCiColumn("grading_company", "TEXT"); // z.B. 'PSA', 'BGS', 'CGC' - NULL = ungegradet
addCiColumn("grade", "TEXT");           // Note als Text: '10', '9.5', 'Black Label' ...

const psColumns = new Set(db.prepare(`PRAGMA table_info(price_snapshots)`).all().map((c) => c.name));
if (!psColumns.has("variant")) {
  db.exec(`ALTER TABLE price_snapshots ADD COLUMN variant TEXT DEFAULT 'normal'`);
}

// sales: Kaufdatum + ursprüngliche Kaufnotiz mitführen, damit ein Verkauf
// rückgängig gemacht werden kann und die Karte 1:1 zurückkommt.
const salesColumns = new Set(db.prepare(`PRAGMA table_info(sales)`).all().map((c) => c.name));
const addSalesColumn = (name, type) => {
  if (!salesColumns.has(name)) {
    db.exec(`ALTER TABLE sales ADD COLUMN ${name} ${type}`);
    salesColumns.add(name);
  }
};
addSalesColumn("purchase_date", "TEXT");
addSalesColumn("purchase_notes", "TEXT");
addSalesColumn("variant", "TEXT DEFAULT 'normal'");
addSalesColumn("grading_company", "TEXT");
addSalesColumn("grade", "TEXT");

// --- Nutzer-Zuordnung (Model B) --------------------------------------------
// collection_items / sales / portfolio_snapshots gehoeren jetzt je einem
// Nutzer. Vorhandene Daten (aus der Einzelnutzer-Zeit) wandern in ein
// "Seed"-Konto, das der Betreiber per Passwort-Reset uebernimmt.
addCiColumn("user_id", "INTEGER");
addSalesColumn("user_id", "INTEGER");

// portfolio_snapshots: PK war captured_on -> auf (user_id, captured_on)
// umstellen. Dafuer Tabelle neu bauen.
const psnapCols = new Set(
  db.prepare(`PRAGMA table_info(portfolio_snapshots)`).all().map((c) => c.name)
);
let portfolioSnapshotsRebuilt = false;
if (!psnapCols.has("user_id")) {
  db.exec(`
    ALTER TABLE portfolio_snapshots RENAME TO portfolio_snapshots_old;
    CREATE TABLE portfolio_snapshots (
      user_id     INTEGER NOT NULL,
      captured_on TEXT NOT NULL,
      total_value REAL NOT NULL,
      total_cost  REAL NOT NULL,
      card_count  INTEGER NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, captured_on)
    );
  `);
  portfolioSnapshotsRebuilt = true;
}

// Seed-Konto anlegen, falls es Alt-Daten ohne Nutzer gibt und noch kein
// Konto existiert.
const orphanItems = db
  .prepare(`SELECT COUNT(*) AS n FROM collection_items WHERE user_id IS NULL`)
  .get().n;
const userCount = db.prepare(`SELECT COUNT(*) AS n FROM users`).get().n;

if (userCount === 0 && (orphanItems > 0 || portfolioSnapshotsRebuilt)) {
  const seedEmail = (process.env.SEED_USER_EMAIL || "justus-hess@outlook.de")
    .trim()
    .toLowerCase();
  const resetToken = crypto.randomBytes(24).toString("base64url");
  // reset_expires weit in der Zukunft -> Link laeuft praktisch nicht ab
  db.prepare(
    `INSERT INTO users (email, password_hash, email_verified, reset_token, reset_expires)
     VALUES (?, '', 1, ?, '2099-01-01T00:00:00.000Z')`
  ).run(seedEmail, resetToken);
  const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
  console.log(
    `\n[setup] Bestehende Sammlung wurde dem Konto "${seedEmail}" zugeordnet.\n` +
      `        Passwort setzen (Link laeuft nicht ab):\n` +
      `        ${frontend}/passwort-zuruecksetzen?token=${resetToken}\n`
  );
}

// Alt-Daten dem (ersten) Konto zuordnen.
const firstUser = db.prepare(`SELECT id FROM users ORDER BY id LIMIT 1`).get();
if (firstUser) {
  db.prepare(`UPDATE collection_items SET user_id = ? WHERE user_id IS NULL`).run(firstUser.id);
  db.prepare(`UPDATE sales SET user_id = ? WHERE user_id IS NULL`).run(firstUser.id);
}
if (portfolioSnapshotsRebuilt) {
  if (firstUser) {
    db.prepare(
      `INSERT OR IGNORE INTO portfolio_snapshots
         (user_id, captured_on, total_value, total_cost, card_count, created_at)
       SELECT ?, captured_on, total_value, total_cost, card_count, created_at
       FROM portfolio_snapshots_old`
    ).run(firstUser.id);
  }
  db.exec(`DROP TABLE portfolio_snapshots_old`);
}

db.exec(`CREATE INDEX IF NOT EXISTS idx_ci_user ON collection_items(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id)`);

// Solange ein Konto noch kein Passwort hat (Seed-Konto), bei jedem Start
// einen frischen "Passwort setzen"-Link ausgeben, damit der Betreiber
// jederzeit hineinkommt.
for (const u of db.prepare(`SELECT id, email FROM users WHERE password_hash = ''`).all()) {
  const t = crypto.randomBytes(24).toString("base64url");
  db.prepare(
    `UPDATE users SET reset_token = ?, reset_expires = '2099-01-01T00:00:00.000Z' WHERE id = ?`
  ).run(t, u.id);
  const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
  console.log(
    `\n[setup] Konto "${u.email}" hat noch kein Passwort. Jetzt setzen:\n` +
      `        ${frontend}/passwort-zuruecksetzen?token=${t}\n`
  );
}

// Pokemon als erstes unterstütztes Spiel anlegen
db.prepare(
  `INSERT OR IGNORE INTO games (slug, name) VALUES ('pokemon', 'Pokémon TCG')`
).run();

// Einmaliges Geheimnis für den Besucher-Hash (macht Rückrechnen unmöglich).
db.prepare(`INSERT OR IGNORE INTO app_meta (key, value) VALUES ('visitor_salt', ?)`).run(
  crypto.randomBytes(24).toString("hex")
);

export default db;
