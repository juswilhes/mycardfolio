// Täglicher Betreiber-Bericht per E-Mail.
//   npm run report            (bzw. per Cron: docker compose exec -T app npm run report)
import { dailySummary, pruneHits } from "../services/stats.js";
import { sendAdminMail, mailReady, ADMIN_EMAIL } from "../services/mailer.js";

const s = dailySummary();

const bar = (n, max) => "▮".repeat(max ? Math.round((n / max) * 12) : 0).padEnd(12, "▯");
const trendMax = Math.max(1, ...s.trend.map((d) => d.hits));

const textLines = [
  `mycardfolio – Tagesbericht für ${s.yesterday}`,
  ``,
  `Seitenaufrufe gestern:   ${s.hitsYesterday}`,
  `Neue Registrierungen:    ${s.newUsers}`,
  `Anmeldungen (Sessions):  ${s.loginsYesterday}`,
  `Verkäufe erfasst:        ${s.salesYesterday}`,
  ``,
  `Gesamt`,
  `  Nutzer:            ${s.totalUsers} (davon ${s.verifiedUsers} E-Mail bestätigt)`,
  `  Aktive Sitzungen:  ${s.activeSessions}`,
  `  Sammler mit Karten:${s.collectors}`,
  `  Karten insgesamt:  ${s.totalCards}`,
  `  Verkäufe gesamt:   ${s.totalSales}`,
  ``,
  `Top-Seiten gestern`,
  ...s.topPages.map((p) => `  ${String(p.hits).padStart(4)}  ${p.path}`),
  ``,
  `Aufrufe letzte 7 Tage`,
  ...s.trend.map((d) => `  ${d.day}  ${bar(d.hits, trendMax)} ${d.hits}`),
];
const text = textLines.join("\n");

const row = (label, value) =>
  `<tr><td style="padding:4px 12px 4px 0;color:#6b6b6b">${label}</td><td style="padding:4px 0;font-weight:600">${value}</td></tr>`;

const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#241c15;max-width:520px">
    <h2 style="margin:0 0 4px">mycardfolio – Tagesbericht</h2>
    <p style="margin:0 0 16px;color:#6b6b6b">für ${s.yesterday}</p>
    <table style="border-collapse:collapse;font-size:14px">
      ${row("Seitenaufrufe gestern", s.hitsYesterday)}
      ${row("Neue Registrierungen", s.newUsers)}
      ${row("Anmeldungen (Sessions)", s.loginsYesterday)}
      ${row("Verkäufe erfasst", s.salesYesterday)}
    </table>
    <h3 style="margin:20px 0 6px;font-size:14px">Gesamt</h3>
    <table style="border-collapse:collapse;font-size:14px">
      ${row("Nutzer", `${s.totalUsers} <span style="font-weight:400;color:#6b6b6b">(${s.verifiedUsers} bestätigt)</span>`)}
      ${row("Aktive Sitzungen", s.activeSessions)}
      ${row("Sammler mit Karten", s.collectors)}
      ${row("Karten insgesamt", s.totalCards)}
      ${row("Verkäufe gesamt", s.totalSales)}
    </table>
    <h3 style="margin:20px 0 6px;font-size:14px">Top-Seiten gestern</h3>
    <table style="border-collapse:collapse;font-size:14px">
      ${s.topPages.map((p) => `<tr><td style="padding:2px 12px 2px 0;font-weight:600">${p.hits}</td><td style="padding:2px 0;color:#6b6b6b">${p.path}</td></tr>`).join("") || '<tr><td style="color:#6b6b6b">–</td></tr>'}
    </table>
    <h3 style="margin:20px 0 6px;font-size:14px">Aufrufe – letzte 7 Tage</h3>
    <pre style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;color:#241c15;margin:0">${s.trend.map((d) => `${d.day}  ${bar(d.hits, trendMax)} ${d.hits}`).join("\n")}</pre>
  </div>
`;

async function main() {
  if (!ADMIN_EMAIL) {
    console.error("[report] ADMIN_EMAIL nicht gesetzt – Bericht wird nur ausgegeben.\n");
    console.log(text);
  } else if (!mailReady()) {
    console.error(`[report] Kein SMTP konfiguriert – Bericht an ${ADMIN_EMAIL} nur im Log:\n`);
    console.log(text);
  } else {
    await sendAdminMail(`mycardfolio – Tagesbericht ${s.yesterday}`, { text, html });
    console.log(`[report] Bericht für ${s.yesterday} an ${ADMIN_EMAIL} gesendet.`);
  }
  try {
    pruneHits();
  } catch {
    /* egal */
  }
  process.exit(0);
}

main();
