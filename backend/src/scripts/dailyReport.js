// Täglicher Betreiber-Bericht per E-Mail.
//   npm run report   (per Cron: docker compose exec -T app npm run report)
import { dailySummary, pruneStats } from "../services/stats.js";
import { sendAdminMail, mailReady, ADMIN_EMAIL } from "../services/mailer.js";
import { fetchCommunityTopics } from "../services/communityTopics.js";

const s = dailySummary();
const topics = await fetchCommunityTopics().catch(() => []); // fällt eine Quelle aus, geht die Mail trotzdem raus

const trendMax = Math.max(1, ...s.trend.map((d) => d.visitors)); // Balken zeigen die Besucher, nicht die Aufrufe
const hum = (n) => (n == null ? "–" : n); // vor dem ersten Ping unbekannt
const bar = (n) => "▮".repeat(Math.round((n / trendMax) * 12)).padEnd(12, "▯");
const health = s.errors5xx === 0 ? "keine Serverfehler" : `${s.errors5xx} Serverfehler (5xx)!`;

const text = [
  `mycardfolio – Tagesbericht für ${s.yesterday}`,
  s.adminFiltered ? `(ohne deine eigenen Zugriffe)` : ``,
  ``,
  `WACHSTUM`,
  `  Neue Registrierungen:   ${s.newUsers}`,
  `  Nutzer:                 ${s.otherUsers}  (${s.verifiedUsers} E-Mail bestätigt)`,
  ``,
  `NUTZUNG GESTERN`,
  `  MENSCHLICHE BESUCHER:   ${hum(s.humans)}   (haben auf der Seite gescrollt/geklickt)`,
  `  Besucher insgesamt:     ${s.visitors}   (ohne erkannte Roboter)`,
  `  Roboter-Zugriffe:       ${s.botHits}   (Suchmaschinen, KI-Crawler, Skripte)`,
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
  `LETZTE 7 TAGE  (Menschen / Besucher / Aufrufe)`,
  ...s.trend.map((d) => `  ${d.day}  ${bar(d.visitors)}  ${hum(d.humans)} / ${d.visitors} / ${d.hits}`),
  ``,
  `ANREGUNGEN FÜR DIE NEWS-SEITE (Schlagzeilen und Community-Themen von heute)`,
  ...topics.flatMap((t) => [
    `  ${t.name}`,
    ...(t.items.length
      ? t.items.flatMap((i) => [`   - ${i.title}`, ...(i.teaser ? [`     ${i.teaser}`] : []), `     ${i.link}`])
      : [`   (heute nicht abrufbar: ${t.error})`]),
  ]),
].join("\n");

const c = "#241c15", g = "#6b6b6b";
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const row = (l, v) =>
  `<tr><td style="padding:3px 14px 3px 0;color:${g}">${l}</td><td style="padding:3px 0;font-weight:600">${v}</td></tr>`;
const sect = (title, rows) =>
  `<h3 style="margin:18px 0 4px;font-size:13px;letter-spacing:.04em;color:${g}">${title}</h3><table style="border-collapse:collapse;font-size:14px">${rows}</table>`;

const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:${c};max-width:540px">
    <h2 style="margin:0">mycardfolio – Tagesbericht</h2>
    <p style="margin:2px 0 4px;color:${g}">für ${s.yesterday}${s.adminFiltered ? " · ohne deine eigenen Zugriffe" : ""}</p>
    ${sect("WACHSTUM", row("Neue Registrierungen", s.newUsers) + row("Nutzer", `${s.otherUsers} <span style="font-weight:400;color:${g}">(${s.verifiedUsers} bestätigt)</span>`))}
    ${sect("NUTZUNG GESTERN", row("<b>Menschliche Besucher</b>", `<span style="font-size:18px">${hum(s.humans)}</span> <span style="font-weight:400;color:${g}">(haben gescrollt/geklickt)</span>`) + row("Besucher insgesamt", `${s.visitors} <span style="font-weight:400;color:${g}">(ohne erkannte Roboter)</span>`) + row("Roboter-Zugriffe", s.botHits) + row("Seitenaufrufe", s.hits) + row("Anmeldungen", s.logins) + row("Nutzer mit neuen Karten", `${s.activeCollectors} <span style="font-weight:400;color:${g}">(${s.cardsAddedYesterday} Karten)</span>`))}
    <h3 style="margin:18px 0 4px;font-size:13px;letter-spacing:.04em;color:${g}">GESUNDHEIT</h3>
    <p style="margin:0;font-weight:600;color:${s.errors5xx === 0 ? "#1a7f4b" : "#c02626"}">${health}</p>
    ${sect("STAND JETZT", row("Aktive Sitzungen", s.activeSessions) + row("Sammler mit Karten", s.collectors) + row("Karten insgesamt", s.totalCards))}
    <h3 style="margin:18px 0 4px;font-size:13px;letter-spacing:.04em;color:${g}">TOP-SEITEN GESTERN</h3>
    <table style="border-collapse:collapse;font-size:14px">${s.topPages.map((p) => `<tr><td style="padding:2px 14px 2px 0;font-weight:600">${p.hits}</td><td style="padding:2px 0;color:${g}">${p.path}</td></tr>`).join("") || `<tr><td style="color:${g}">(keine)</td></tr>`}</table>
    <h3 style="margin:18px 0 4px;font-size:13px;letter-spacing:.04em;color:${g}">LETZTE 7 TAGE &nbsp;<span style="font-weight:400">Menschen / Besucher / Aufrufe</span></h3>
    <pre style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;color:${c};margin:0">${s.trend.map((d) => `${d.day}  ${bar(d.visitors)}  ${hum(d.humans)} / ${d.visitors} / ${d.hits}`).join("\n")}</pre>
    <h3 style="margin:22px 0 2px;font-size:13px;letter-spacing:.04em;color:${g}">ANREGUNGEN FÜR DIE NEWS-SEITE</h3>
    <p style="margin:0 0 6px;font-size:12px;color:${g}">Schlagzeilen und Community-Themen von heute – als Ideen für Artikel.</p>
    ${topics
      .map(
        (t) => `<p style="margin:12px 0 2px;font-weight:600">${esc(t.name)}</p>${
          t.items.length
            ? t.items
                .map(
                  (i) => `<p style="margin:4px 0;font-size:14px"><a href="${esc(i.link)}" style="color:${c}">${esc(i.title)}</a>${i.teaser ? `<br><span style="color:${g};font-size:13px">${esc(i.teaser)}</span>` : ""}</p>`
                )
                .join("")
            : `<p style="margin:4px 0;font-size:13px;color:${g}">(heute nicht abrufbar: ${esc(t.error)})</p>`
        }`
      )
      .join("")}
  </div>
`;

// Zum Ansehen ohne Mailversand: REPORT_HTML_OUT=/pfad/bericht.html npm run report
if (process.env.REPORT_HTML_OUT) (await import("node:fs")).writeFileSync(process.env.REPORT_HTML_OUT, html);

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
