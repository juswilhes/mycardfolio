#!/bin/bash
# Taegliches Backup der SQLite-Datenbank.
#   - "VACUUM INTO" erzeugt eine konsistente, kompakte Kopie in einem Schritt
#     (auch waehrend die App schreibt - kein Risiko halber Schreibvorgaenge).
#   - Die Kopie wird aus dem Container auf den Host geholt (/srv/backups).
#   - Aeltere Backups als BACKUP_KEEP_DAYS werden geloescht.
#
# Einrichtung (auf dem Server):
#   chmod +x /srv/mycardfolio/scripts/backup.sh
#   /srv/mycardfolio/scripts/backup.sh            # Testlauf
#   ( crontab -l 2>/dev/null; echo "0 3 * * * /srv/mycardfolio/scripts/backup.sh >> /srv/backups/backup.log 2>&1" ) | crontab -
set -euo pipefail

COMPOSE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/srv/backups}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%F_%H%M)"

cd "$COMPOSE_DIR"
mkdir -p "$BACKUP_DIR"

docker compose exec -T app node -e "require('better-sqlite3')('/data/data.sqlite').exec(\"VACUUM INTO '/data/_backup.sqlite'\")"
docker compose cp app:/data/_backup.sqlite "$BACKUP_DIR/mycardfolio-$STAMP.sqlite"
docker compose exec -T app rm -f /data/_backup.sqlite

find "$BACKUP_DIR" -name 'mycardfolio-*.sqlite' -mtime "+$BACKUP_KEEP_DAYS" -delete

echo "$(date '+%F %T')  Backup ok: $BACKUP_DIR/mycardfolio-$STAMP.sqlite ($(du -h "$BACKUP_DIR/mycardfolio-$STAMP.sqlite" | cut -f1))"
