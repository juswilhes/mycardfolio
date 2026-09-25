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
- Preise kommen über TCGdex (Cardmarket, EUR, **keine sprachspezifischen Preise**). Neue Sets: `npm run import-tcgdex -- <setId>`.
- Rechtstexte (`frontend/src/lib/legal.js`, `LEGAL_REVIEWED=false`) sind Entwürfe und noch nicht anwaltlich geprüft – Banner nicht entfernen.

## Marktplatz (Stand)
- „Stufe 1": läuft **ohne Stripe** als Kontaktbörse (Angebot, Foto Pflicht ab 10 €, Fragen, „Kontakt aufnehmen" per Mail, „Verkauft", Bewertungen). Kein Käuferschutz (Warnhinweis im UI).
- Bezahlung (Stripe Connect) ist gebaut, schaltet sich mit `STRIPE_SECRET_KEY` ein. **Vor Livegang umbauen:** Verkäufer soll die Stripe-Gebühren tragen (Direct Charges, Konten mit `fees.payer=account`), sonst zahlt die Plattform 2 €/Verkäufer/Monat drauf.
- Registrierung ist auf dem Server geschlossen (`REGISTRATION_OPEN=false`).

## Offene Punkte
Meta-Tags/Canonical pro Seite (SEO), DSGVO-Export um Marktplatzdaten erweitern, Wunschliste + Watchlist zusammenlegen, Frontend-Abhängigkeiten (Vite/React Router) auf neue Hauptversionen heben.
