// Ver- und Entschlüsselt eine Datenbank-Sicherung mit AES-256-GCM (für die Kopie auf dem PC,
// siehe pull-backup.ps1). Der Schlüssel (64 Hex-Zeichen) kommt aus der Umgebungsvariable
// MCF_BACKUP_KEY, nie von der Kommandozeile.
//   node backup-crypt.mjs encrypt <eingabe.sqlite> <ausgabe.sqlite.enc>
//   node backup-crypt.mjs decrypt <eingabe.sqlite.enc> <ausgabe.sqlite>
// Dateiformat: "MCFB1" | 12 Byte IV | verschlüsselte Daten | 16 Byte Prüfwert (GCM-Tag).
import fs from "node:fs";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";

const MAGIC = Buffer.from("MCFB1");
const [mode, input, output] = process.argv.slice(2);
const keyHex = process.env.MCF_BACKUP_KEY ?? "";
if (!["encrypt", "decrypt"].includes(mode) || !input || !output) {
  console.error("Aufruf: node backup-crypt.mjs encrypt|decrypt <eingabe> <ausgabe>");
  process.exit(2);
}
if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
  console.error("MCF_BACKUP_KEY fehlt oder ist kein 256-Bit-Schlüssel (64 Hex-Zeichen).");
  process.exit(2);
}
const key = Buffer.from(keyHex, "hex");
const tmp = `${output}.part`;

try {
  if (mode === "encrypt") {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const out = fs.createWriteStream(tmp);
    out.write(Buffer.concat([MAGIC, iv]));
    await pipeline(fs.createReadStream(input), cipher, out, { end: false });
    out.end(cipher.getAuthTag());
    await new Promise((resolve, reject) => out.on("finish", resolve).on("error", reject));
  } else {
    const size = fs.statSync(input).size;
    const fd = fs.openSync(input, "r");
    const head = Buffer.alloc(MAGIC.length + 12);
    const tag = Buffer.alloc(16);
    fs.readSync(fd, head, 0, head.length, 0);
    fs.readSync(fd, tag, 0, 16, size - 16);
    fs.closeSync(fd);
    if (!head.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Keine mycardfolio-Sicherung (Kennung fehlt).");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, head.subarray(MAGIC.length));
    decipher.setAuthTag(tag);
    // Erst nach erfolgreicher Prüfung des Tags wird die Ausgabe umbenannt - eine manipulierte oder
    // mit falschem Schlüssel gelesene Datei bleibt so nie als scheinbar gültige Sicherung liegen.
    await pipeline(fs.createReadStream(input, { start: head.length, end: size - 17 }), decipher, fs.createWriteStream(tmp));
  }
  fs.renameSync(tmp, output);
} catch (e) {
  fs.rmSync(tmp, { force: true });
  console.error(`Fehler: ${e.message}`);
  process.exit(1);
}
