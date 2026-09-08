# mycardfolio online stellen – Schritt für Schritt

Diese Anleitung bringt die App unter **https://mycardfolio.de** ins Netz.
Plane ~1 Stunde ein (plus Wartezeit, bis die Domain umgezogen ist).

---

## Kurz erklärt: die Begriffe

| Begriff | Was das ist |
|---|---|
| **VPS** (Virtual Private Server) | Ein eigener kleiner Computer in einem Rechenzentrum, der 24/7 läuft. Du hast vollen Admin-Zugriff und kannst darauf beliebige Programme laufen lassen – anders als „Webhosting", wo meist nur PHP-Webseiten gehen. Unsere App braucht einen VPS, weil ein Node-Server dauerhaft laufen muss. |
| **SSH** | Eine verschlüsselte Fernverbindung zum Server. Du tippst Befehle bei dir am PC, sie werden auf dem Server ausgeführt. Bei Windows schon eingebaut (`ssh` im Terminal). |
| **DNS / A-Record** | Das „Telefonbuch" des Internets. Ein A-Record sagt: „mycardfolio.de → diese Server-IP-Adresse". |
| **Docker** | Packt die App mit allem, was sie braucht, in einen abgeschlossenen „Container". Läuft dadurch überall gleich, egal was sonst auf dem Server ist. `docker compose` startet mehrere Container zusammen (bei uns: die App + Caddy). |
| **Caddy** | Ein kleiner Webserver, der vor der App sitzt. Er besorgt **automatisch ein kostenloses HTTPS-Zertifikat** (das Schloss-Symbol) und leitet Anfragen an die App weiter. |
| **Volume** | Ein Speicherbereich, der erhalten bleibt, auch wenn der Container neu gebaut wird. Dort liegt deine Datenbank (`data.sqlite`). |

**Der Plan:** VPS bei IONOS bestellen → Domain darauf zeigen lassen → Code auf
GitHub → per SSH auf den Server → dort Docker installieren und die App
starten → deine bestehende Sammlung hochladen → fertig.

---

## Teil A – VPS bei IONOS bestellen

1. Bei IONOS einloggen → Produkt **„VPS"** (unter „Server & Cloud" / „Cloud").
2. Kleinster Linux-Tarif reicht locker (etwa **1 vCPU, 2 GB RAM, ~4 €/Monat**).
   Später jederzeit upgradebar.
3. **Betriebssystem: Ubuntu 24.04** auswählen (kein „Plesk", kein „cPanel").
4. Bestellen. Nach 1–2 Minuten ist der Server bereit.
5. Im **IONOS Cloud Panel** findest du:
   - die **IP-Adresse** des Servers (z. B. `93.123.45.67`)
   - das **Root-Passwort** (evtl. musst du es dort einmal setzen/anzeigen)

Notiere dir beides.

---

## Teil B – Domain auf den Server zeigen lassen

1. IONOS → **Domains** → `mycardfolio.de` → **DNS**.
2. Trage zwei A-Records ein (vorhandene `@`/`www`-Einträge anpassen):
   | Typ | Name / Host | Wert |
   |---|---|---|
   | A | `@` | *deine VPS-IP* |
   | A | `www` | *deine VPS-IP* |
3. Falls dort schon Einträge stehen, die woanders hinzeigen: auf die VPS-IP ändern.
4. **`mycardfolio.eu`**: IONOS → Domain → **Weiterleitung** einrichten, Ziel
   `https://mycardfolio.de`, Typ „dauerhaft (301)".
5. DNS-Änderungen brauchen **bis zu 1 Stunde**, bis sie überall wirken. Prüfen
   kannst du auf <https://dnschecker.org> (Typ A, `mycardfolio.de` eingeben) –
   es sollte überall deine VPS-IP stehen.

> Caddy holt das HTTPS-Zertifikat erst, wenn der DNS auf den Server zeigt.
> Du kannst die App aber schon vorher starten.

---

## Teil C – E-Mail-Postfach anlegen

IONOS → **E-Mail** → neues Postfach **`info@mycardfolio.de`**. Diese Adresse
steht im Impressum und der Datenschutzerklärung.

---

## Teil D – Code zu GitHub bringen

Der Server lädt den Code von GitHub. Der Code enthält **keine Passwörter**
(die `.env`-Datei wird nicht mit hochgeladen), ein **öffentliches** Repo ist
also unproblematisch und spart Aufwand.

1. Konto auf <https://github.com> anlegen (falls noch nicht vorhanden).
2. Oben rechts **+ → New repository**:
   - Name: `mycardfolio`
   - **Public**
   - **kein** Häkchen bei „Add a README" o. Ä.
   - **Create repository**
3. GitHub zeigt dir jetzt Befehle. Du brauchst nur diese – im Projektordner
   (`C:\MYCARDFOLIO\card-tracker\card-tracker`) im Terminal:
   ```bash
   git branch -M main
   git remote add origin https://github.com/DEINNAME/mycardfolio.git
   git push -u origin main
   ```
4. Beim `push` fragt Git nach Login:
   - **Username:** dein GitHub-Name
   - **Password:** hier **nicht** dein Passwort, sondern ein **Token**.
     GitHub → oben rechts Profilbild → **Settings → Developer settings →
     Personal access tokens → Tokens (classic) → Generate new token (classic)**
     → Haken bei **`repo`** → erzeugen → den Token kopieren und als „Password"
     einfügen. (Einmalig; Git merkt ihn sich danach.)

Ergebnis: dein Code liegt unter `https://github.com/DEINNAME/mycardfolio`.

---

## Teil E – Mit dem Server verbinden (SSH)

Öffne auf deinem PC das Terminal (**PowerShell** oder Windows Terminal) und:

```bash
ssh root@DEINE-VPS-IP
```

- Beim allerersten Mal: „Are you sure you want to continue connecting?" → `yes`.
- Root-Passwort eingeben (aus dem IONOS Panel). Beim Tippen bewegt sich nichts –
  das ist normal.
- Evtl. verlangt IONOS eine Passwortänderung beim ersten Login: altes Passwort,
  dann zweimal ein neues (merken!).

Wenn du eine Zeile wie `root@vps-xxxx:~#` siehst, bist du **auf dem Server**.
Ab jetzt landen alle Befehle dort.

---

## Teil F – Server einrichten und App starten

Alles nacheinander auf dem Server (per Copy-Paste) ausführen:

```bash
# 1. System aktualisieren
apt update && apt upgrade -y

# 2. Docker installieren
curl -fsSL https://get.docker.com | sh

# 3. Firewall: nur SSH, HTTP und HTTPS erlauben
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

# 4. Code holen (DEINNAME anpassen!)
git clone https://github.com/DEINNAME/mycardfolio.git /srv/mycardfolio
cd /srv/mycardfolio

# 5. Produktions-Konfiguration anlegen
cp .env.production.example .env
```

Die `.env` ist schon für `mycardfolio.de` vorausgefüllt. Wenn du willst, kurz
ansehen mit `nano .env` (Beenden: `Strg+X`).

```bash
# 6. Bauen und starten (dauert beim ersten Mal 3–5 Minuten)
docker compose up -d --build

# 7. Läuft alles?
docker compose ps
docker compose logs app
```

Im Log sollte `API läuft auf http://localhost:3001` stehen und ein
`[setup] ... passwort-zuruecksetzen?token=...`-Link (den brauchst du gleich).

---

## Teil G – Deine bestehende Sammlung übernehmen

Auf dem Server ist die Datenbank noch leer. Wir laden deine lokale hoch.

**Auf deinem PC** (neues Terminal-Fenster, im Projektordner):

```bash
# a) lokalen Server beenden (das "mycardfolio Backend"-Fenster schließen)

# b) Datenbank sauber abschließen
cd backend
node -e "const D=require('better-sqlite3');const db=new D('data.sqlite');db.pragma('wal_checkpoint(TRUNCATE)');db.close()"
cd ..

# c) hochladen
scp backend/data.sqlite root@DEINE-VPS-IP:/tmp/data.sqlite
```

**Auf dem Server:**

```bash
cd /srv/mycardfolio
docker compose cp /tmp/data.sqlite app:/data/data.sqlite
docker compose restart app
docker compose logs app | grep passwort-zuruecksetzen
```

Den ausgegebenen Link (`https://mycardfolio.de/passwort-zuruecksetzen?token=…`)
im Browser öffnen → Passwort setzen → deine Sammlung ist da.

---

## Teil H – Testen

- <https://mycardfolio.de> öffnet sich, **Schloss-Symbol** im Browser.
- Anmelden funktioniert, nach „Neu laden" bist du noch angemeldet.
- <https://mycardfolio.de/impressum> und `/datenschutz`: deine Daten, kein
  gelber Entwurf-Hinweis.
- <https://www.mycardfolio.de> leitet auf `https://mycardfolio.de` um.

Falls die Seite „nicht erreichbar" ist: meist ist nur der DNS noch nicht durch
(Teil B). 15–60 Minuten warten, nochmal probieren.

---

## Teil I – Automatisches Backup

Damit die Datenbank nicht verloren geht, täglich um 3 Uhr sichern:

```bash
mkdir -p /srv/backups
( crontab -l 2>/dev/null; echo '0 3 * * * docker compose -f /srv/mycardfolio/docker-compose.yml exec -T app sh -c "cat /data/data.sqlite" > /srv/backups/mycardfolio-$(date +\%F).sqlite' ) | crontab -
```

Die Backups liegen dann in `/srv/backups/`. Ab und zu eine Kopie auf deinen
PC ziehen: `scp root@DEINE-VPS-IP:/srv/backups/*.sqlite .`

---

## Teil J – Später Änderungen einspielen

Wenn wir am Code weiterarbeiten und du das Update live haben willst:

```bash
# auf deinem PC im Projektordner
git push

# auf dem Server
cd /srv/mycardfolio && git pull && docker compose up -d --build
```

Die Datenbank bleibt dabei erhalten (liegt im Volume, nicht im Container).

---

## Häufige Probleme

| Symptom | Ursache / Lösung |
|---|---|
| `ssh: connect ... timed out` | Falsche IP, oder Server noch nicht fertig bereitgestellt. |
| Browser: „Zertifikat ungültig" / „nicht sicher" | Caddy hat das Zertifikat noch nicht – DNS zeigt noch nicht auf den Server, oder Port 443 ist in der Firewall zu. `docker compose logs caddy` ansehen. |
| Seite lädt nicht, `docker compose ps` zeigt „exited" | `docker compose logs app` – meist ein Tippfehler in der `.env`. |
| Login klappt, aber nach Reload wieder abgemeldet | Seite muss über **https** laufen (nicht http), sonst wird das Session-Cookie nicht gespeichert. |
| „Passwort setzen"-Link kommt nicht im Log | Nur wenn ein Konto **ohne** Passwort existiert. Nach dem Datenbank-Upload `docker compose restart app`. |

---

## Was danach noch kommt (nicht dringend)

- **Echter E-Mail-Versand**: aktuell landen Bestätigungs-/Reset-Links nur im
  Server-Log. Solange nur du das Konto nutzt, reicht das. Bevor sich Fremde
  registrieren, bauen wir echten Mailversand ein (IONOS-SMTP oder Resend).
- Kartenbilder über den eigenen Server ausliefern (statt von fremden Servern).
- Rechtstexte einmal von eRecht24 / einem Anwalt gegenlesen lassen.
