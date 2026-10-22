# Holt die neueste Datenbank-Sicherung vom Server auf diesen PC (Kopie außerhalb des Servers:
# fällt der Server aus, sind die Sicherungen in /srv/backups mit weg). Läuft wöchentlich als
# geplante Aufgabe "mycardfolio Sicherung holen" (Windows-Aufgabenplanung), behält die letzten 4.
# Braucht den SSH-Schlüssel dieses PCs für root@31.70.140.8.
$ErrorActionPreference = "Stop"
$server = "root@31.70.140.8"
$target = Join-Path $env:USERPROFILE "Documents\mycardfolio-Sicherungen"
$keep = 4
$log = Join-Path $target "abruf.log"

New-Item -ItemType Directory -Force -Path $target | Out-Null
try {
  $latest = (& ssh -o BatchMode=yes -o ConnectTimeout=20 $server "ls -1t /srv/backups/mycardfolio-*.sqlite | head -1").Trim()
  if (-not $latest) { throw "Keine Sicherung auf dem Server gefunden" }
  $name = Split-Path $latest -Leaf
  $dest = Join-Path $target $name
  if (-not (Test-Path $dest)) {
    & scp -o BatchMode=yes -q "${server}:$latest" "$dest.part"
    if ($LASTEXITCODE -ne 0) { throw "scp fehlgeschlagen ($LASTEXITCODE)" }
    Move-Item -Force "$dest.part" $dest
  }
  Get-ChildItem $target -Filter "mycardfolio-*.sqlite" | Sort-Object Name -Descending | Select-Object -Skip $keep | Remove-Item -Force
  Add-Content $log "$(Get-Date -Format 'yyyy-MM-dd HH:mm')  ok  $name"
} catch {
  Add-Content $log "$(Get-Date -Format 'yyyy-MM-dd HH:mm')  FEHLER  $($_.Exception.Message)"
  exit 1
}
