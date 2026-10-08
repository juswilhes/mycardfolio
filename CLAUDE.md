# mycardfolio – Projektregeln für Claude

Pokémon-TCG-Sammlungstracker, live unter https://mycardfolio.de. Betreiber: Justus (spricht Deutsch, technisch kein Profi – **kurz und verständlich antworten**, bei Ops-Schritten erklären, *warum*).

## Stack
- `backend/`: Node + Express + better-sqlite3 (SQLite), Port 3001. `frontend/`: React + Vite + Tailwind, Port 5173 (Proxy `/api` und `/uploads` → 3001).
- Ein Docker-Image liefert Backend + gebautes Frontend aus. Server: IONOS-VPS, Caddy davor.
- UI-Texte, Kommentare, Commit-Nachrichten: **Deutsch**. Kommentare nur, wenn das *Warum* nicht offensichtlich ist.

## Lokal starten
```
cd backend  && npm install && npm run dev     # http://localhost:3001
cd frontend && npm install && npm run dev     # http://localhost:5173
```
Die Karten-Datenbank `backend/data.sqlite` (~45 MB) ist **nicht in Git**. Ohne sie gibt es keine Karten – eine Kopie von Justus dort hineinlegen. Nie Produktionsdaten oder `.env` committen.

## Deploy (WICHTIG)
**Jeder Push auf `main` deployt automatisch** (GitHub Actions → Server). Deshalb:
- Nur committen + pushen. **Nicht zusätzlich per SSH deployen** (doppelte Deploys → Fehler-Mails).
- Vorsicht bei Änderungen an Datenbank/Anmeldung: sie sind sofort live. Größeres lieber auf einem Branch bauen, testen, dann nach `main` mergen.
- Nach dem Push prüfen, ob der Lauf grün ist (`https://api.github.com/repos/juswilhes/mycardfolio/actions/runs?per_page=3`).

## Wichtige Regeln aus der Praxis
- **React-Falle:** nie `useEffect(load, [])`, wenn `load` ein Promise zurückgibt (React hält es für die Cleanup-Funktion → Blank Screen). Immer `useEffect(() => { load(); }, [])`.
- Nie ein Konto/Passwort für Anmeldungen benutzen oder Zugangsdaten eintragen; Tests, die einen Login brauchen, dem Nutzer überlassen.
- Sicherheit: Sitzungs-/Reset-Token liegen nur als SHA-256-Hash in der DB (`authService.js`); Kontosperre nach 5 Fehlversuchen.
- **Nachtlauf 1:00 Uhr (Europe/Berlin)**, `services/priceFetcher.js runDailyPriceJob`: (1) `newCardsSync.js` sucht bei TCGdex neue Sets (nur wirklich neue, <7 Monate, kein Pocket) und neue Karten in Sets mit exakt gleicher ID und importiert sie über `services/tcgdexImport.js` (dasselbe nutzt `npm run import-tcgdex`); (2) alle Preise; (3) Karten ohne Preis; (4) `analysisCache.js`: alle Auswertungen der Analyse neu rechnen + am Monatsersten den Monatsstand speichern; (5) `imageRepair.js`: fehlende/kaputte Kartenbilder -> Ersatz von scrydex (`images.scrydex.com/pokemon/<id>/small|large`), danach offizielle Pokémon-Datenbank (`assets.pokemon.com/.../web/<SET>/<SET>_EN_<Nr>.png`). **Achtung:** scrydex liefert für unbekannte Karten Status 200 + Platzhalter (Kartenrückseite, 45551/186316 Bytes) - Erkennung nur per HEAD mit `Accept-Encoding: identity` (sonst keine Content-Length). Vollprüfung aller Karten sonntags nachts und einmalig nach Logik-Änderungen (Marker `image_full_check_v2` in app_meta, bei Änderungen hochzählen); (6) Portfolio-Tagespunkt. Set-IDs unterscheiden sich je Quelle (unser `sv1` = TCGdex `sv01`): deshalb die Duplikat-Schutzregeln in newCardsSync.js nicht lockern.
- **Alles nur nachts um 1 Uhr (Justus):** Auch die Daten der Analyse (Booster vs. Top-Karten, Pull Rates, Wert pro Pack, Ziehen oder kaufen, Preisbewegungen) werden nur im Nachtlauf neu gerechnet und aus dem Speicher `services/analysisCache.js` ausgeliefert - nie bei jedem Seitenaufruf. Neue Analyse = Rechenfunktion in `BUILDERS` dort eintragen und im Endpunkt `analysis("name")` ausliefern. Ausnahme: Eingaben des Betreibers (Box-/Boosterpreise, Pull Rates) bauen den Speicher sofort neu, sonst sähe er sein Speichern nicht.
- **Ein Preis, eine Reihe:** "Aktueller Preis" einer Karte = letzter Tageswert der Preisreihe, die der Graph zeigt (`latestTrend` in `cardService.js`); der 30-Tage-Schnitt (`avg30`) ist nur Zusatzinfo darunter, nie die Hauptzahl. Überall (Kartenseite, Sammlung, Set-Analyse) `latestTrend` nutzen, nie eigene Preisberechnungen - sonst weichen Zahl und Graph wieder voneinander ab. Euro-Formatierung nur über `frontend/src/lib/format.js`.
- Preise kommen über TCGdex (Cardmarket, EUR, **keine sprachspezifischen Preise**). **Preise werden NUR einmal täglich um 1:00 Uhr (Europe/Berlin) geholt** (`services/priceFetcher.js`: alle Karten, danach Karten ohne Preis) - nie beim Öffnen einer Seite, Hinzufügen oder Import (Seiten lesen nur aus der DB; sonst wird die Seite bei 20.000+ Karten langsam). Kein "Preis jetzt aktualisieren"-Button. Schwere Abfragen über alle Karten: korrelierte Teilabfragen je Karte (`CARD_CURRENT_PRICE_SQL`), nicht die View `card_price_avg30` joinen (blockiert den Server); Preisbewegungen sind 30 Min. gecacht. Neue Sets: `npm run import-tcgdex -- <setId>`.
- Rechtstexte (`frontend/src/lib/legal.js`, `LEGAL_REVIEWED=false`) sind Entwürfe und noch nicht anwaltlich geprüft – Banner nicht entfernen.

## Marktplatz (Stand)
- „Stufe 1": läuft **ohne Stripe** als Kontaktbörse (Angebot, Foto Pflicht ab 10 €, Fragen, „Kontakt aufnehmen" per Mail, „Verkauft", Bewertungen). Kein Käuferschutz (Warnhinweis im UI).
- Bezahlung (Stripe Connect) ist gebaut, schaltet sich mit `STRIPE_SECRET_KEY` ein. **Vor Livegang umbauen:** Verkäufer soll die Stripe-Gebühren tragen (Direct Charges, Konten mit `fees.payer=account`), sonst zahlt die Plattform 2 €/Verkäufer/Monat drauf.
- Registrierung ist auf dem Server geschlossen (`REGISTRATION_OPEN=false`).

## Analyse-Seite
- Der Reiter "Markt" wurde entfernt (`MarketMovers`/`SetsOverview` liegen ungenutzt im Code, falls daraus eigene Analysen werden sollen). Reihenfolge: Meine Sammlung zuerst.
- Nav-Punkt "Analyse" (`/analyse`, früher "Statistik"): Auswahl verschiedener Analysen. Neue Analyse = neuer Eintrag in `ANALYSES` in `frontend/src/pages/Stats.jsx` (+ Komponente, ggf. Endpunkt unter `/api/stats`). "Meine Sammlung" bleibt in jedem Fall erhalten. Umschalter = `SegmentedToggle` (gleich wie bei "Alle Karten").
- **Regel (Justus):** Alles, was zu einer Analyse gehört, steht NUR unter "Analyse" - nicht zusätzlich auf Set- oder Kartenseiten. Auch die Pflege der Daten (Betreiber-Ansicht) passiert dort.
- "Booster vs. Top-Karten" (früher "Display & Booster"): Box-/Boosterpreis pro Set pflegt der Betreiber von Hand in der Analyse (`PATCH /api/sets/:id/prices`); Sondersets ohne Display (30th Celebration, Black Bolt) haben nur einen Boosterpreis. Klick auf ein Set zeigt die 20 teuersten Karten. Verlauf: Tabelle `set_value_snapshots`, ein Stand je Set und Monat, geschrieben vom Nachtlauf am Monatsersten (1 Uhr), beim Serverstart nachgeholt und bei Preisänderung für den laufenden Monat aktualisiert (`services/setValueSnapshots.js`).
- "Wert pro Pack": erwarteter Wert eines Boosters aus Pull Rates x aktuelle Kartenpreise (`getPackValueAnalysis` in `marketStats.js`), Display = 36 Booster; Common/Uncommon/Rare nicht eingerechnet (keine Pull Rates), daher Untergrenze. Boosterpreise kommen aus "Booster vs. Top-Karten".
- "Set-Rangliste": Hit Rate, Wert pro Pack und Top-20-Wert je Set in einer sortierbaren Tabelle; setzt die fertigen Auswertungen zusammen (`buildSetRanking` in `marketStats.js`, abgeleiteter Eintrag `DERIVED` in `analysisCache.js`).
- "Ziehen oder kaufen": je Set die Chase-Karten (Seltenheiten mit Quote pro Karte) mit Preis; erwartete Packs = Quote, Kosten = Packs x Boosterpreis, Vergleich mit dem Kaufpreis (`getPullOrBuy` in `marketStats.js`, Rechnung im Frontend).
- "Pull Rates": Matrix Seltenheit x Set, Daten von Hand (`pull_rates`, `PATCH /api/sets/:id/pull-rates`), Pflege über "Pull Rates pflegen" in der Analyse. Die Hit Rate (Chance auf mind. 1 besondere Karte pro Pack) wird in `marketStats.js` berechnet. Sets, die in fremden Boostern stecken (Classic Collection -> 30th Celebration), stehen in `BOOSTER_OF` und erscheinen in den Analysen nicht als eigene Spalte, sondern zählen zum Booster-Set.

## Offene Punkte
Meta-Tags/Canonical pro Seite (SEO), DSGVO-Export um Marktplatzdaten erweitern, Wunschliste + Watchlist zusammenlegen, Frontend-Abhängigkeiten (Vite/React Router) auf neue Hauptversionen heben.
