// Täglicher Betreiber-Bericht per E-Mail.
//   npm run report   (per Cron: docker compose exec -T app npm run report)
import { dailySummary, pruneStats } from "../services/stats.js";
import { sendAdminMail, mailReady, ADMIN_EMAIL } from "../services/mailer.js";

const s = dailySummary();

const trendMax = Math.max(1, ...s.trend.map((d) => Math.max(d.hits, d.visitors)));
const bar = (n) => "▮".repeat(Math.round((n / trendMax) * 12)).padEnd(12, "▯");
const health = s.errors5xx === 0 ? "keine Serverfehler" : `${s.errors5xx} Serverfehler (5xx)!`;

const text = [
  `mycardfolio – Tagesbericht für ${s.yesterday}`,
  ``,
  `WACHSTUM`,
  `  Neue Registrierungen:   ${s.newUsers}`,
  `  Nutzer gesamt:          ${s.totalUsers}  (${s.verifiedUsers} E-Mail bestätigt)`,
  ``,
  `NUTZUNG GESTERN`,
  `  Besucher:               ${s.visitors}`,
  `  Seitenaufrufe:          ${s.hits}`,
  `  Anmeldungen:            ${s.logins}`,
  `  Nutzer mit neuen Karten:${s.activeCollectors}  (${s.cardsAddedYesterday} Karten)`,
  ``,
  `GESUNDHEIT`,
  `  ${health}`,
  ``,
  `STAND JETZT`,
  `  Aktive Sitzungen:       ${s.activeSessions}`,
  `  Sammler mit Karten:     ${s.collectors}`,
  `  Karten insgesamt:       ${s.totalCards}`,
  ``,
  `TOP-SEITEN GESTERN`,
  ...(s.topPages.length
    ? s.topPages.map((p) => `  ${String(p.hits).padStart(4)}  ${p.path}`)
    : [`  (keine)`]),
  ``,
  `LETZTE 7 TAGE  (Besucher / Aufrufe)`,
  ...s.trend.map((d) => `  ${d.day}  ${bar(d.visitors)}  ${d.visitors} / ${d.hits}`),
].join("\n");

const c = "#241c15", g = "#6b6b6b";
const row = (l, v) =>
  `<tr><td style="padding:3px 14px 3px 0;color:${g}">${l}</td><td style="padding:3px 0;font-weight:600">${v}</td></tr>`;
const sect = (title, rows) =>
  `<h3 style="margin:18px 0 4px;font-size:13px;letter-spacing:.04em;color:${g}">${title}</h3><table style="border-collapse:collapse;font-size:14px">${rows}</table>`;

const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:${c};max-width:540px">
    <h2 style="margin:0">mycardfolio – Tagesbericht</h2>
    <p style="margin:2px 0 4px;color:${g}">für ${s.yesterday}</p>
    ${sect("WACHSTUM", row("Neue Registrierungen", s.newUsers) + row("Nutzer gesamt", `${s.totalUsers} <span style="font-weight:400;color:${g}">(${s.verifiedUsers} bestätigt)</span>`))}
    ${sect("NUTZUNG GESTERN", row("Besucher", s.visitors) + row("Seitenaufrufe", s.hits) + row("Anmeldungen", s.logins) + row("Nutzer mit neuen Karten", `${s.activeCollectors} <span style="font-weight:400;color:${g}">(${s.cardsAddedYesterday} Karten)</span>`))}
    <h3 style="margin:18px 0 4px;font-size:13px;letter-spacing:.04em;color:${g}">GESUNDHEIT</h3>
    <p style="margin:0;font-weight:600;color:${s.errors5xx === 0 ? "#1a7f4b" : "#c02626"}">${health}</p>
    ${sect("STAND JETZT", row("Aktive Sitzungen", s.activeSessions) + row("Sammler mit Karten", s.collectors) + row("Karten insgesamt", s.totalCards))}
    <h3 style="margin:18px 0 4px;font-size:13px;letter-spacing:.04em;color:${g}">TOP-SEITEN GESTERN</h3>
    <table style="border-collapse:collapse;font-size:14px">${s.topPages.map((p) => `<tr><td style="padding:2px 14px 2px 0;font-weight:600">${p.hits}</td><td style="padding:2px 0;color:${g}">${p.path}</td></tr>`).join("") || `<tr><td style="color:${g}">(keine)</td></tr>`}</table>
    <h3 style="margin:18px 0 4px;font-size:13px;letter-spacing:.04em;color:${g}">LETZTE 7 TAGE &nbsp;<span style="font-weight:400">Besucher / Aufrufe</span></h3>
    <pre style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;color:${c};margin:0">${s.trend.map((d) => `${d.day}  ${bar(d.visitors)}  ${d.visitors} / ${d.hits}`).join("\n")}</pre>
  </div>
`;

async function main() {
  if (!ADMIN_EMAIL || !mailReady()) {
    console.error(
      `[report] ${!ADMIN_EMAIL ? "ADMIN_EMAIL nicht gesetzt" : "Kein SMTP konfiguriert"} – Bericht nur im Log:\n`
    );
    console.log(text);
  } else {
    await sendAdminMail(`mycardfolio – Tagesbericht ${s.yesterday}`, { text, html });
    console.log(`[report] Bericht für ${s.yesterday} an ${ADMIN_EMAIL} gesendet.`);
  }
  try {
    pruneStats();
  } catch {
    /* egal */
  }
  process.exit(0);
}

main();
