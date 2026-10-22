# Holt die neueste Datenbank-Sicherung vom Server auf diesen PC (Kopie ausserhalb des Servers:
# faellt der Server aus, sind die Sicherungen in /srv/backups mit weg) und speichert sie nur
# VERSCHLUESSELT (AES-256-GCM, scripts/backup-crypt.mjs). Laeuft woechentlich als geplante Aufgabe
# "mycardfolio Sicherung holen", behaelt die letzten 4.
#
# Schluessel: wird beim ersten Lauf zufaellig erzeugt und mit Windows-DPAPI an dieses Windows-Konto
# gebunden gespeichert (%USERPROFILE%\.mycardfolio\backup-key.dpapi). Zum Aufbewahren im
# Passwortmanager anzeigen:   powershell -File scripts\pull-backup.ps1 -ShowKey
# Wiederherstellen:           $env:MCF_BACKUP_KEY="<schluessel>"; node scripts\backup-crypt.mjs decrypt <datei.enc> <ziel.sqlite>
param([switch]$ShowKey)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security

$server = "root@31.70.140.8"
$target = Join-Path $env:USERPROFILE "Documents\mycardfolio-Sicherungen"
$keyFile = Join-Path $env:USERPROFILE ".mycardfolio\backup-key.dpapi"
$crypt = Join-Path $PSScriptRoot "backup-crypt.mjs"
$node = "C:\Program Files\nodejs\node.exe"
$keep = 4
$log = Join-Path $target "abruf.log"

function Get-BackupKey {
  if (-not (Test-Path $keyFile)) {
    New-Item -ItemType Directory -Force -Path (Split-Path $keyFile) | Out-Null
    $raw = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($raw)
    $prot = [System.Security.Cryptography.ProtectedData]::Protect($raw, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    [System.IO.File]::WriteAllBytes($keyFile, $prot)
  }
  $raw = [System.Security.Cryptography.ProtectedData]::Unprotect([System.IO.File]::ReadAllBytes($keyFile), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
  return (($raw | ForEach-Object { $_.ToString("x2") }) -join "")
}

function Get-Sha256($path) { (Get-FileHash -Algorithm SHA256 $path).Hash }

if ($ShowKey) { Get-BackupKey; exit 0 }

New-Item -ItemType Directory -Force -Path $target | Out-Null
try {
  $env:MCF_BACKUP_KEY = Get-BackupKey

  # Unverschluesselte Altbestaende (vor Einfuehrung der Verschluesselung) nachtraeglich verschluesseln
  $todo = @(Get-ChildItem $target -Filter "mycardfolio-*.sqlite" | ForEach-Object { $_.FullName })

  $latest = (& ssh -o BatchMode=yes -o ConnectTimeout=20 $server "ls -1t /srv/backups/mycardfolio-*.sqlite | head -1").Trim()
  if (-not $latest) { throw "Keine Sicherung auf dem Server gefunden" }
  $name = Split-Path $latest -Leaf
  $plain = Join-Path $target $name
  if (-not (Test-Path "$plain.enc") -and -not (Test-Path $plain)) {
    & scp -o BatchMode=yes -q "${server}:$latest" "$plain.part"
    if ($LASTEXITCODE -ne 0) { throw "scp fehlgeschlagen ($LASTEXITCODE)" }
    Move-Item -Force "$plain.part" $plain
    $todo += $plain
  }

  foreach ($file in ($todo | Select-Object -Unique)) {
    & $node $crypt encrypt $file "$file.enc"
    if ($LASTEXITCODE -ne 0) { throw "Verschluesseln fehlgeschlagen: $file" }
    # Probe: entschluesseln und mit dem Original vergleichen, erst dann das Original loeschen
    & $node $crypt decrypt "$file.enc" "$file.check"
    if ($LASTEXITCODE -ne 0) { throw "Probe-Entschluesselung fehlgeschlagen: $file" }
    if ((Get-Sha256 $file) -ne (Get-Sha256 "$file.check")) { throw "Probe stimmt nicht mit dem Original ueberein: $file" }
    Remove-Item -Force "$file.check", $file
  }

  Get-ChildItem $target -Filter "mycardfolio-*.sqlite.enc" | Sort-Object Name -Descending | Select-Object -Skip $keep | Remove-Item -Force
  Add-Content $log "$(Get-Date -Format 'yyyy-MM-dd HH:mm')  ok  $name (verschluesselt)"
} catch {
  Get-ChildItem $target -Filter "*.check" -ErrorAction SilentlyContinue | Remove-Item -Force
  Add-Content $log "$(Get-Date -Format 'yyyy-MM-dd HH:mm')  FEHLER  $($_.Exception.Message)"
  exit 1
} finally {
  Remove-Item Env:\MCF_BACKUP_KEY -ErrorAction SilentlyContinue
}
