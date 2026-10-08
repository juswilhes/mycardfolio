import { Link } from "react-router-dom";

// Stellt Artikeltext dar: Leerzeile = neuer Absatz, "## " Überschrift,
// "### " Zwischenüberschrift, "- " Liste, "> " Zitat, **fett**, [Text](Ziel).
// Alles wird als React-Elemente gerendert (kein HTML), Links nur auf "/..."
// oder http(s) - so kann ein Artikel nichts Gefährliches einschleusen.
function inline(text, key) {
  const out = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let i = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1] != null) {
      out.push(<strong key={k}>{m[1]}</strong>);
    } else if (m[3].startsWith("/") && !m[3].startsWith("//")) {
      out.push(<Link key={k} to={m[3]} className="underline hover:text-ink">{m[2]}</Link>);
    } else if (/^https?:\/\//.test(m[3])) {
      out.push(<a key={k} href={m[3]} target="_blank" rel="noreferrer" className="underline hover:text-ink">{m[2]}</a>);
    } else {
      out.push(m[2]);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Prose({ text }) {
  const blocks = String(text ?? "").replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (block.startsWith("### ")) {
          return <h3 key={i} className="font-semibold mt-6 mb-2">{inline(block.slice(4), i)}</h3>;
        }
        if (block.startsWith("## ")) {
          return <h2 key={i} className="text-lg font-semibold mt-8 mb-2">{inline(block.slice(3), i)}</h2>;
        }
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1.5 mb-4 leading-relaxed">
              {lines.map((l, j) => <li key={j}>{inline(l.slice(2), `${i}-${j}`)}</li>)}
            </ul>
          );
        }
        if (block.startsWith("> ")) {
          return (
            <blockquote key={i} className="border-l-2 border-yellow pl-4 my-5 text-subtle italic leading-relaxed">
              {inline(lines.map((l) => l.replace(/^>\s?/, "")).join(" "), i)}
            </blockquote>
          );
        }
        return <p key={i} className="mb-4 leading-relaxed">{inline(lines.join(" "), i)}</p>;
      })}
    </div>
  );
}
