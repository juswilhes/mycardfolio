# mycardfolio live schalten

Ziel: die App unter **https://mycardfolio.de** erreichbar machen. Backend
und Frontend laufen dabei als **ein** Dienst (der Node-Server liefert das
gebaute Frontend gleich mit aus) – das vermeidet CORS- und Cookie-Sonderfälle.

---

## 0. Vorher erledigen (Pflicht)

- [ ] **`frontend/src/lib/legal.js` ausfüllen** – echter Name, ladungsfähige
      Anschrift, Kontakt-E-Mail, Hosting-Anbieter. Danach `LEGAL_REVIEWED = true`.
      Ohne vollständiges Impressum + Datenschutzerklärung ist eine in
      Deutschland öffentlich erreichbare Seite abmahnbar.
- [ ] Kontakt-Postfach anlegen (z. B. `kontakt@mycardfolio.de` bei IONOS).
- [ ] Repo zu **GitHub** pushen (privates Repo genügt):
      ```bash
      git remote add origin git@github.com:<user>/mycardfolio.git
      git push -u origin main
      ```

---

## 1. Hosting (Render – schnellster Weg mit Dockerfile)

1. Auf [render.com](https://render.com) mit GitHub anmelden.
2. **New → Web Service** → das Repo wählen. Render erkennt das `Dockerfile`
   automatisch (Environment: „Docker").
3. **Disk hinzufügen** (für die SQLite-Datei):
   - Name: `data`, Mount Path: `/data`, Größe: 1 GB.
4. **Environment Variables** setzen:
   | Key | Wert |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_PATH` | `/data/data.sqlite` |
   | `FRONTEND_URL` | `https://mycardfolio.de` |
   | `CORS_ORIGIN` | `https://mycardfolio.de,https://www.mycardfolio.de` |
   | `TRUST_PROXY` | `1` |
   | `PORT` | `3001` |
5. **Deploy**. Nach dem Build läuft der Dienst unter `https://<name>.onrender.com`.

> Alternativen mit demselben Dockerfile: Railway, Fly.io. Der IONOS-VPS geht
> auch, ist aber mehr Handarbeit (Node + Reverse-Proxy + TLS selbst aufsetzen).

---

## 2. Deine bestehende Sammlung mitnehmen

Auf dem Server ist die Datenbank zunächst leer (auch die 20 000 Karten-
Stammdaten fehlen). Am einfachsten die lokale `data.sqlite` hochladen:

1. Lokal Backend stoppen, dann `backend/data.sqlite` sichern.
2. Über die Render-Shell (Dienst → „Shell") die Datei nach `/data/data.sqlite`
   kopieren – z. B. Datei kurz irgendwo hochladen und mit `curl` ziehen, oder
   `render disk`-Upload nutzen.
3. Dienst neu starten. Im Deploy-Log erscheint der **„Passwort setzen"-Link**
   (jetzt mit `https://mycardfolio.de/...`). Öffnen → Passwort setzen → deine
   Sammlung ist da.

Wer frisch startet: einfach registrieren und die Karten neu importieren
(dazu muss vorher einmal `npm run import` gegen die Server-DB laufen, oder
die lokale `data.sqlite` mit den Stammdaten hochgeladen werden).

---

## 3. Domain verbinden (IONOS)

1. In Render: Service → **Settings → Custom Domains** → `mycardfolio.de` und
   `www.mycardfolio.de` hinzufügen. Render zeigt die Ziel-Werte an.
2. Im IONOS-DNS-Center:
   - `mycardfolio.de` → **A-Record** auf die von Render genannte IP
     (oder ALIAS/ANAME, falls IONOS das unterstützt), **oder** die
     Nameserver auf Render umstellen.
   - `www` → **CNAME** auf `<name>.onrender.com`.
3. TLS-Zertifikat stellt Render automatisch aus (Let's Encrypt), sobald das
   DNS zeigt. Kann bis zu einer Stunde dauern.
4. `mycardfolio.eu` als 301-Weiterleitung auf `mycardfolio.de` einrichten
   (geht bei IONOS direkt in der Domain-Verwaltung).

---

## 4. Nach dem Livegang prüfen

- [ ] `https://mycardfolio.de` lädt, Login/Registrierung funktioniert.
- [ ] `https://mycardfolio.de/impressum` und `/datenschutz` sind erreichbar,
      Platzhalter sind weg, Entwurf-Banner ist weg.
- [ ] Cookie wird gesetzt (`mcf_session`, Secure, HttpOnly) – nach Reload noch
      angemeldet.
- [ ] E-Mail-Versand: aktuell nur Konsolen-Stub. **Vor echten Nutzern** in
      `backend/src/services/mailer.js` einen Anbieter einbauen (SMTP von IONOS,
      Resend oder Postmark) und `FRONTEND_URL` prüfen.
- [ ] Automatisches Backup der Disk in Render aktivieren.

---

## 5. Danach (nicht blockierend für den Launch)

- Kartenbilder über einen eigenen Proxy statt Hotlink (Zuverlässigkeit +
  Datenschutz).
- Cardmarket-Datenlizenz prüfen (Weitergabe der Trendpreise).
- SQLite → PostgreSQL, sobald mehr als eine Handvoll Nutzer.
- Fehler-Monitoring (Sentry).
