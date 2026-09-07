# MyCardfolio – Sammlungs-Tracker (Grundgerüst)

Trackt den Wert deiner Trading-Card-Sammlung. Start: Pokémon, Architektur ist
aber von Anfang an für mehrere Spiele ausgelegt.

## Setup

### Backend
```bash
cd backend
npm install
cp .env.example .env   # optional: API-Key von pokemontcg.io eintragen
npm run dev
```
Läuft auf `http://localhost:3001`, legt beim ersten Start `data.sqlite` an.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Läuft auf `http://localhost:5173` und spricht über einen Proxy mit dem Backend.

## Wie die App aufgebaut ist

**Backend (Node/Express + SQLite):**
- `db/index.js` – Schema: `games`, `cards`, `price_snapshots`, `collection_items`
- `services/pokemonTcgApi.js` – Anbindung an die kostenlose Pokemon TCG API
  (Kartendaten, englisches Artwork, TCGplayer/Cardmarket-Preise)
- `services/cardService.js` – speichert Karten + schreibt Preis-Snapshots
- `services/priceFetcher.js` – **Cron-Job**, läuft täglich um 06:00 Uhr und
  zieht für jede gespeicherte Karte den aktuellen Preis nach. Dadurch wächst
  die Preishistorie automatisch, ohne dass du etwas tun musst.
- `routes/` – REST-Endpunkte für Suche, Sammlung, Preisverlauf

**Frontend (React + Vite + Tailwind + Recharts):**
- `pages/Collection.jsx` – Sammlung als Liste, Klick auf eine Karte führt
  zur Detailseite mit größerem Preis-Graphen (`components/PriceChart.jsx`)
- `pages/AddCard.jsx` – Kartensuche + Hinzufügen zur Sammlung
- `hooks/useTheme.js` – Hell-/Dunkelmodus. Alle Farben stehen als
  CSS-Variablen in `index.css`; der Hook schaltet nur eine `dark`-Klasse
  auf `<html>` um, der Rest passiert automatisch über Tailwind
  (`tailwind.config.js` zeigt auf dieselben Variablen)
- Minimalistisches Farbschema (fast weiß/fast schwarz + Gelb als Akzent),
  angelehnt an Finanz-Apps wie Trade Republic

## Warum diese Struktur

- **Multi-TCG von Anfang an:** Die `games`-Tabelle und der `game_slug` in
  jeder Karte bedeuten, dass ein zweites Kartenspiel (Magic, Yu-Gi-Oh, …)
  später nur einen neuen Eintrag in `games` + einen neuen API-Service
  braucht — nicht ein Redesign der Datenbank.
- **Preis-Snapshots statt "ein Preis pro Karte":** Jeder Fetch schreibt eine
  neue Zeile statt den alten Preis zu überschreiben. So gibt es automatisch
  einen Verlauf für den Graphen, und man kann später auch Preise mehrerer
  Quellen (TCGplayer/USD, Cardmarket/EUR) parallel führen.
- **Trennung Karten-Stammdaten vs. Sammlung:** `cards` beschreibt die Karte
  an sich (einmal pro Karte, spielübergreifend eindeutig), `collection_items`
  beschreibt, was *du* davon besitzt (Menge, Zustand, Kaufpreis). Das ist
  exakt die Trennung, die man später für eine Verkaufsplattform braucht:
  ein `listings`-Table würde ebenfalls auf `cards` verweisen, nicht auf
  deine private Sammlung.
- **SQLite statt Postgres/MySQL:** Kein Server-Setup nötig, eine Datei reicht
  fürs Grundgerüst. Lässt sich später 1:1 auf Postgres migrieren, wenn eine
  Marktplatz-Funktion mit vielen Nutzern dazukommt.

## Nächste sinnvolle Schritte

1. Deployment (z.B. Backend auf Railway/Fly.io, Frontend auf Vercel/Netlify)
   – erst dann läuft der Cron-Job wirklich "automatisch im Hintergrund".
2. Nutzer-Accounts (aktuell ist die Sammlung global, nicht pro Person).
3. Zweites Kartenspiel andocken (z.B. Scryfall-API für Magic).
4. Später: `listings`-Tabelle + Checkout für den Verkaufsplattform-Ausbau.
