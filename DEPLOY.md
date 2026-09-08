# mycardfolio live schalten

Ziel: die App unter **https://mycardfolio.de** erreichbar machen. Backend
und Frontend laufen als **ein** Dienst (der Node-Server liefert das gebaute
Frontend gleich mit aus). Empfohlener Weg: **IONOS VPS + Docker** – Daten
bleiben in Deutschland, Hoster ist IONOS (passt zum Impressum).

---

## 0. Vorher erledigen

- [x] `frontend/src/lib/legal.js` ausgefüllt, `LEGAL_REVIEWED = true`.
- [ ] E-Mail-Postfach `info@mycardfolio.de` bei IONOS anlegen.
- [ ] Repo zu **GitHub** pushen (privat genügt):
  ```bash
  git remote add origin https://github.com/<user>/mycardfolio.git
  git push -u origin main
  ```
- [ ] Rechtstexte vor „echten" Nutzern einmal fachkundig prüfen lassen
  (eRecht24 / Anwalt). Für den Start / Testbetrieb im kleinen Kreis okay.

---

## 1. IONOS VPS bestellen

- IONOS → **VPS** (Linux). Kleinster Tarif reicht (1 vCPU, 2 GB RAM).
- Betriebssystem: **Ubuntu 24.04**.
- Nach der Bereitstellung bekommst du **IP-Adresse** + **Root-Passwort**.

## 2. DNS bei IONOS setzen

Domain `mycardfolio.de` → **DNS**:
- `A`-Record `@` → die VPS-IP
- `A`-Record `www` → dieselbe VPS-IP
- `mycardfolio.eu`: als Weiterleitung (301) auf `https://mycardfolio.de`

(DNS kann bis zu einer Stunde brauchen, bis es überall greift.)

## 3. Auf dem Server einrichten

Per SSH einloggen (`ssh root@<VPS-IP>`), dann:

```bash
# Docker installieren
curl -fsSL https://get.docker.com | sh

# Firewall: nur SSH, HTTP, HTTPS
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# Projekt holen
git clone https://github.com/<user>/mycardfolio.git /srv/mycardfolio
cd /srv/mycardfolio

# Produktions-Konfiguration anlegen
cp .env.production.example .env
nano .env      # Werte prüfen (Domain stimmt schon)

# Bauen und starten
docker compose up -d --build
docker compose logs -f app     # Log ansehen (mit Strg+C beenden)
```

Im Log erscheint einmalig der **„Passwort setzen"-Link** (mit
`https://mycardfolio.de/...`), sobald deine Daten aus Schritt 4 da sind.

## 4. Deine bestehende Sammlung übernehmen

Auf dem Server ist die Datenbank leer (auch die ~20 000 Karten-Stammdaten).
Am einfachsten die lokale Datei hochladen. **Lokal** (Windows, im Projekt):

```bash
# Backend lokal stoppen, dann:
scp backend/data.sqlite root@<VPS-IP>:/tmp/data.sqlite
```

**Auf dem Server**:

```bash
docker compose cp /tmp/data.sqlite app:/data/data.sqlite
docker compose restart app
docker compose logs app | grep passwort-zuruecksetzen   # Link kopieren
```

Link im Browser öffnen → Passwort setzen → deine Sammlung ist da.

> Ohne Upload: einfach registrieren; dann fehlen aber die Karten-Stammdaten.
> Die kommen mit `docker compose exec app npm run import` (dauert etwas).

## 5. Prüfen

- [ ] `https://mycardfolio.de` lädt, Schloss-Symbol (gültiges Zertifikat).
- [ ] Registrierung / Login funktioniert, bleibt nach Reload angemeldet.
- [ ] `/impressum` und `/datenschutz`: keine Platzhalter, kein Entwurf-Banner.
- [ ] `https://www.mycardfolio.de` leitet auf `https://mycardfolio.de` um.

## 6. Updates einspielen

```bash
cd /srv/mycardfolio && git pull && docker compose up -d --build
```

## 7. Backup (wichtig)

Die SQLite-Datei liegt im Docker-Volume `mcf-data`. Tägliches Backup per Cron:

```bash
echo '0 3 * * * cd /srv/mycardfolio && docker compose exec -T app sh -c "cat /data/data.sqlite" > /srv/backups/mycardfolio-$(date +\%F).sqlite' | crontab -
mkdir -p /srv/backups
```

---

## 8. Danach (nicht blockierend)

- Echter E-Mail-Versand statt Konsolen-Stub (`backend/src/services/mailer.js`)
  – IONOS-SMTP oder Resend. Erst dann können Fremde ihr Konto bestätigen /
  Passwort zurücksetzen.
- Kartenbilder über einen eigenen Proxy statt Hotlink.
- Cardmarket-Datenlizenz prüfen.
- SQLite → PostgreSQL, sobald es mehr als eine Handvoll Nutzer sind.
- Fehler-Monitoring (Sentry).

---

## Alternative: Render (schneller, aber US-Hoster)

Statt VPS: [render.com](https://render.com) erkennt das `Dockerfile`, Disk
unter `/data` mounten, Env-Variablen wie in `.env.production.example`
setzen. In dem Fall gehört in `legal.js` unter `HOSTING` **Render Services,
Inc.** (San Francisco, USA) statt IONOS, und die Datenschutzerklärung
braucht einen Hinweis auf die Auftragsverarbeitung in den USA.
