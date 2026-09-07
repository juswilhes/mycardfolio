# mycardfolio

Trackt den Wert deiner Trading-Card-Sammlung. Start: Pokémon, die Architektur
ist aber von Anfang an für mehrere Spiele ausgelegt.

Was drin ist:

- **Kartendatenbank** – alle ~20.000 englischen Pokémon-Karten lokal, mit
  Suche und Set-Browser. Pro Karte: Illustrator, Seltenheit, Kartennummer,
  Kartentyp, Erscheinungsjahr, Set, Pokédex-Nr.
- **Portfolio** – Karten mit Menge, Zustand, Sprache, Kaufpreis und
  Versandkosten erfassen; Einstandswert, aktueller Wert und Gewinn/Verlust
  je Karte und für die ganze Sammlung.
- **Preise** – Cardmarket-Trendpreis in Euro, täglich aktualisiert, mit
  Preisverlaufs-Graph.

## Setup

Voraussetzung: Node 20+.

### 1. Backend

```bash
cd backend
npm install
npm run import          # einmalig: Kartendaten lokal in data.sqlite laden
npm run backfill-artists # optional: fehlende Illustratoren ergänzen
npm run dev
```

Läuft auf `http://localhost:3001` und legt beim ersten Start `data.sqlite` an.
`npm run import` klont beim ersten Mal den öffentlichen Datensatz
`PokemonTCG/pokemon-tcg-data` nach `backend/vendor/` (ca. 30 MB, gitignored)
und schreibt Sets + Karten in die Datenbank. Ohne diesen Schritt ist die
Kartendatenbank leer.

Eine `.env` ist optional (`cp .env.example .env`) – ein API-Key von
pokemontcg.io hebt nur das Rate-Limit für den seltenen Fallback-Abruf an.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Läuft auf `http://localhost:5173` und spricht über einen Proxy mit dem Backend.
**Beide** Prozesse müssen laufen.

### Automatischer Start (Windows)

`start-mycardfolio.bat` startet Backend + Frontend (minimiert) und öffnet den
Browser. Eine Kopie im Autostart-Ordner
(`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`) startet alles beim
Login. Zum Deaktivieren die Datei dort löschen.

## Woher die Daten kommen

| Daten | Quelle | Wie |
| --- | --- | --- |
| Karten-Stammdaten, Sets, Bilder | `pokemon-tcg-data` (GitHub) | einmaliger lokaler Import (`npm run import`) |
| Fehlende Illustratoren | TCGdex-API | einmaliger Nachlauf (`npm run backfill-artists`), manuell überschreibbar |
| Preise (Cardmarket, EUR) | TCGdex-API | täglicher Cron-Job für Sammlungskarten |
| Preis-Fallback | TCGplayer (USD → EUR) | nur wenn Cardmarket keinen Wert hat, Kurs von frankfurter.dev |

Der Import ist bewusst lokal: Suche und Set-Browser laufen dadurch sofort und
offline, statt bei jedem Klick eine externe API zu fragen (das war der Grund
für die langen Wartezeiten in der ersten Version).

Bekannte Grenzen:

- Angezeigt wird immer der Preis der **englischen** Karte. Für die deutsche
  Druckvariante gibt es keine frei verfügbare Preisquelle.
- **eBay** ist nicht dabei – für verkaufte Preise gibt es keinen kostenlosen
  Zugang.

## Wie die App aufgebaut ist

### Backend (Node/Express + better-sqlite3)

- `db/index.js` – Schema + Migrationen. Tabellen: `games`, `card_sets`,
  `cards` (Stammdaten inkl. Illustrator, Attacken, Cardmarket-Produkt-ID …),
  `price_snapshots` (Preishistorie), `collection_items` (deine Sammlung:
  Menge, Zustand, Sprache, Kaufpreis, Versand). Neue Spalten kommen per
  `ALTER TABLE` dazu, ohne die Datenbank neu anzulegen.
- `scripts/importCardData.js` – `npm run import`, Import des lokalen Datensatzes.
- `scripts/backfillArtists.js` – `npm run backfill-artists`, Illustrator-Nachlauf.
- `services/cardRepository.js` – Lesezugriffe auf die lokalen Kartendaten
  (Suche, Sets, Kartendetails).
- `services/priceProvider.js` – Cardmarket-Preise (EUR) über TCGdex,
  inkl. Set-/Kartenzuordnung und Cache. USD→EUR-Fallback.
- `services/priceFetcher.js` – **Cron-Job** täglich 06:00 Uhr, zieht für jede
  Karte in der Sammlung den aktuellen Cardmarket-Preis nach. Dadurch wächst
  die Preishistorie von selbst.
- `services/cardService.js` – gemeinsame DB-Statements: `upsertCardRow`,
  `recordPrices` (max. ein Snapshot pro Tag/Quelle/Typ), Sammlungs- und
  Preis-Queries.
- `services/pokemonTcgApi.js` – nur noch Fallback für Karten, die (noch) nicht
  im lokalen Datensatz stecken; liefert keine Preise mehr.
- `routes/` – REST-Endpunkte: `cards` (Suche, Kartendetail, Illustrator
  bearbeiten, Preisverlauf), `sets` (Set-Liste/-Karten), `collection`
  (auflisten, hinzufügen, bearbeiten, löschen).

### Frontend (React + Vite + Tailwind + Recharts)

- `pages/Collection.jsx` – Sammlung als Liste mit Portfolio-Kachel
  (Gesamtwert, Investiert, Gewinn/Verlust). ✕ pro Zeile zum Entfernen.
- `pages/CardDetail.jsx` – eine Sammlungskarte: Preis-Sektion, Kaufdaten,
  Wertentwicklung, „Bearbeiten" / „Aus Sammlung entfernen".
- `pages/Sets.jsx` / `pages/SetDetail.jsx` – Kartendatenbank nach Serien/Sets.
- `pages/CardInfo.jsx` – Detailseite jeder Karte (auch ohne Besitz):
  Steckbrief (7 Felder), Preis-Sektion, Illustrator inline bearbeitbar.
- `pages/AddCard.jsx` – Kartensuche; „+ Sammlung" öffnet den Erfassungs-Dialog.
- `components/CollectionItemDialog.jsx` – Dialog zum Hinzufügen **und**
  Bearbeiten (Menge, Zustand, Sprache, Kaufpreis, Versand, Kaufdatum, Notiz).
- `components/PortfolioAddedAnimation.jsx` – kurze Feier-Animation beim
  Hinzufügen (respektiert `prefers-reduced-motion`).
- `components/PriceSection.jsx` / `PriceChart.jsx` – aktueller Preis,
  Tiefstpreis, Ø 30 Tage, Trend-Graph, Cardmarket-Link, Erklärung.
- `components/Logo.jsx` – offizielles Logo; eigene Variante für den Dunkelmodus.
- `hooks/useTheme.js` – Hell-/Dunkelmodus über eine `dark`-Klasse auf `<html>`.
  Alle Farben stehen als CSS-Variablen in `index.css`, `tailwind.config.js`
  zeigt auf dieselben Variablen.

## Warum diese Struktur

- **Multi-TCG von Anfang an:** `games`-Tabelle + `game_id` in jeder Karte.
  Ein zweites Spiel (Magic, Yu-Gi-Oh, …) braucht später nur einen neuen
  `games`-Eintrag + einen Repository/Preis-Service, kein DB-Redesign.
- **Preis-Snapshots statt „ein Preis pro Karte":** Jeder Abruf schreibt eine
  neue Zeile (max. eine pro Tag/Quelle/Typ) statt den alten Wert zu
  überschreiben. So entsteht der Verlauf für den Graphen von selbst, und
  mehrere Preistypen (Trend / Tiefstpreis / Ø 30 Tage) laufen parallel.
- **Trennung Stammdaten vs. Sammlung:** `cards` beschreibt die Karte an sich,
  `collection_items` beschreibt, was *du* besitzt. Genau die Trennung, die
  man später für einen Marktplatz braucht: ein `listings`-Table würde
  ebenfalls auf `cards` verweisen, nicht auf die private Sammlung.
- **Lokaler Kartendatensatz:** macht die App schnell und offline-fähig; Preise
  bleiben der einzige Teil, der regelmäßig nachgeladen werden muss.
- **SQLite:** kein Server-Setup, eine Datei. Später 1:1 auf Postgres migrierbar.

## Nächste sinnvolle Schritte

- **Deployment** (Backend z. B. Railway/Fly.io, Frontend Vercel/Netlify) –
  erst dann läuft der Cron-Job wirklich dauerhaft im Hintergrund.
- **Nutzer-Accounts** – aktuell ist die Sammlung global, nicht pro Person.
- **Deutsche Kartenpreise** – nur mit bezahltem Cardmarket-Zugang oder
  eigener Datenerfassung machbar.
- **eBay-Angebotspreise** – über einen kostenlosen eBay-Entwickler-Account
  ließe sich „ab wie viel wird die Karte gerade angeboten" ergänzen.
- **Zweites Kartenspiel** (z. B. Scryfall-API für Magic).
- Später: `listings`-Tabelle + Checkout für einen Verkaufsplattform-Ausbau.
