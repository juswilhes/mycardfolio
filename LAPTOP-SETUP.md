# Arbeiten vom Laptop (z. B. im Urlaub)

Der Live-Server läuft unabhängig von deinem PC. Ein Push auf `main` deployt automatisch – du brauchst **keinen SSH-Zugang**.

## Einmalig einrichten (ca. 15 Minuten)

1. **Programme installieren:** [Git](https://git-scm.com), [Node.js](https://nodejs.org) (Version 22 oder neuer), [Claude Code / Claude Desktop](https://claude.com) und bei GitHub anmelden.
2. **Projekt holen:**
   ```
   git clone https://github.com/juswilhes/mycardfolio.git
   cd mycardfolio
   ```
3. **Karten-Datenbank hineinlegen:** Die Datei `data.sqlite` (aus dem Ordner `mycardfolio-laptop` auf dem Desktop deines PCs, per USB-Stick oder eigener Cloud mitnehmen) nach `backend/data.sqlite` kopieren. Ohne sie gibt es keine Karten. Sie enthält dein Konto (Passwort nur als Hash) – nicht öffentlich teilen.
4. **Abhängigkeiten installieren:**
   ```
   cd backend  && npm install
   cd ../frontend && npm install
   ```
5. **Starten** (zwei Fenster):
   ```
   cd backend  && npm run dev       # Server auf http://localhost:3001
   cd frontend && npm run dev       # Seite auf http://localhost:5173
   ```
6. **Claude öffnen:** Claude Code im Ordner `mycardfolio` starten. Die Datei `CLAUDE.md` enthält die wichtigsten Projektregeln; Claude liest sie automatisch.

## Sicher arbeiten

- **Jeder Push auf `main` geht sofort live.** Für alles, was du nicht sofort testen kannst, einen Branch nutzen:
  ```
  git switch -c urlaub          # einmal anlegen
  ... arbeiten, committen, testen ...
  git switch main
  git merge urlaub
  git push                      # ab hier live
  ```
- Nach dem Push prüft der Deploy automatisch; eine Fehler-Mail von GitHub heißt, dass der Deploy nicht geklappt hat (die Seite läuft dann mit dem alten Stand weiter).
- Passwörter, `.env`-Dateien und die Datenbank gehören **nicht** ins Git.
- Der Server selbst (Docker, Backups, `.env`) ist nur vom PC aus per SSH erreichbar. Für normale Änderungen brauchst du das nicht.

## Wenn etwas kaputt geht
Auf GitHub den letzten guten Commit suchen und `git revert <Commit>` + `git push` – das rollt die Änderung automatisch zurück.
