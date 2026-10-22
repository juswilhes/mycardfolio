// Einfaches, persönliches HTML-Layout für Mails an Nutzer (Willkommens- und Neuigkeiten-Mails).
// Bewusst schlicht wie ein Brief (Noah Kagan: persönlich statt Werbeprospekt): Logo, Text, höchstens ein
// Knopf, Unterschrift. Nur Inline-Styles und Tabellen, weil viele Mailprogramme kein CSS-Stylesheet können.
// Jede Mail geht zusätzlich als reiner Text raus (Mailprogramme ohne HTML, Spamfilter).
const SITE = "https://mycardfolio.de";
const C = { canvas: "#fbf3e6", card: "#ffffff", ink: "#241c15", subtle: "#8a7a63", line: "#ecdfc7", yellow: "#f8c93a", yellowInk: "#3d2c00" };

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// blocks: Liste aus { p: "Text (HTML erlaubt, vorher escapen)" } | { highlight: "…" } | { list: ["…"] } | { button: { label, href } }
export function mailHtml({ preheader = "", blocks, signature, footer }) {
  const font = "font-family:Helvetica,Arial,sans-serif;";
  const body = blocks
    .map((b) => {
      if (b.p) return `<p style="${font}font-size:16px;line-height:1.6;color:${C.ink};margin:0 0 16px">${b.p}</p>`;
      if (b.list)
        return `<ul style="${font}font-size:16px;line-height:1.6;color:${C.ink};margin:0 0 16px;padding-left:22px">${b.list
          .map((li) => `<li style="margin:0 0 6px">${li}</li>`)
          .join("")}</ul>`;
      if (b.highlight)
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td style="background:#fdf3d3;border-left:4px solid ${C.yellow};border-radius:10px;padding:14px 16px">
<p style="${font}font-size:17px;line-height:1.55;color:${C.ink};margin:0;font-weight:bold">${b.highlight}</p></td></tr></table>`;
      if (b.button)
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 22px"><tr><td style="background:${C.yellow};border-radius:999px">
<a href="${esc(b.button.href)}" style="${font}display:inline-block;padding:12px 26px;font-size:15px;font-weight:bold;color:${C.yellowInk};text-decoration:none">${esc(b.button.label)}</a>
</td></tr></table>`;
      return "";
    })
    .join("\n");
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.canvas}">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 18px"><a href="${SITE}"><img src="${SITE}/logo.png" alt="mycardfolio" height="34" style="height:34px;border:0"></a></td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:18px;padding:30px 28px">
${body}
<p style="${font}font-size:16px;line-height:1.5;color:${C.ink};margin:22px 0 0">${signature}</p>
</td></tr>
<tr><td style="${font}font-size:12px;line-height:1.5;color:${C.subtle};padding:16px 6px 0">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}
