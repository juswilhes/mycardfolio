import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getLanding, getArticles } from "../api.js";
import { eur, formatDate } from "../lib/format.js";

const FEATURES = [
  { icon: "💶", title: "Cardmarket-Preise in Euro", text: "Trendpreise, jede Nacht frisch – dazu der 30-Tage-Schnitt und ein Preisverlauf mit wählbarem Zeitraum." },
  { icon: "📈", title: "Wertverlauf deines Portfolios", text: "Kaufpreis inkl. Versand erfassen und sehen, wie sich der Wert deiner ganzen Sammlung entwickelt." },
  { icon: "🧩", title: "Set-Fortschritt", text: "Pro Set auf einen Blick, wie viele Karten dir noch fehlen – mit Fortschrittsbalken und Filter „Fehlt mir“." },
  { icon: "📥", title: "Massen-Import", text: "Excel-Tabelle einfügen – mycardfolio erkennt Name, Nummer, Menge und Preis, egal wie deine Tabelle aufgebaut ist." },
  { icon: "🔎", title: "Karten-Datenbank", text: "Über 20.000 Karten, deutsche Namen inklusive. Zum Nachschlagen brauchst du gar kein Konto." },
  { icon: "📊", title: "Analysen", text: "Hit Rate, Wert pro Pack, Ziehen oder kaufen und eine Set-Rangliste – damit der nächste Booster keine Wundertüte bleibt." },
  { icon: "🛒", title: "Marktplatz", text: "Karten und Sealed-Produkte anbieten oder finden – als Kontaktbörse für Sammler, mit Bewertungen." },
  { icon: "🏅", title: "Orden sammeln", text: "Wie in der Arena, nur ohne Kampf: Erreiche Meilensteine mit deiner Sammlung und sammle Orden." },
  { icon: "❤️", title: "Watchlist", text: "Karten im Auge behalten, ohne sie zu besitzen – mit aktuellem Preis auf einen Blick." },
];

const STEPS = [
  ["Suchen", "Karte per Name, deutschem Namen oder Nummer finden – sofort, ohne Anmeldung."],
  ["Erfassen", "Kaufpreis, Zustand und Menge eintragen. Ein Konto reicht, keine Kreditkarte."],
  ["Im Blick behalten", "Aktuelle Cardmarket-Preise, Gewinn/Verlust und Set-Fortschritt auf einen Blick."],
];

const num = (v, digits = 0) => v.toLocaleString("de-DE", { maximumFractionDigits: digits });

function Section({ title, intro, children, action }) {
  return (
    <section className="mb-14">
      <div className="flex items-end justify-between gap-4 mb-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {intro && <p className="text-subtle text-sm mb-5 max-w-2xl">{intro}</p>}
      {children}
    </section>
  );
}

function MoverRow({ m }) {
  const up = m.delta_pct >= 0;
  return (
    <Link to={`/database/${m.external_id}`} className="flex items-center gap-3 py-2 border-b border-line last:border-0 group">
      <img src={m.image_small} alt="" className="w-10 rounded shrink-0" loading="lazy" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm truncate group-hover:underline">{m.name}</span>
        <span className="block text-[11px] text-subtle truncate">{m.set_name}</span>
      </span>
      <span className="text-right shrink-0">
        <span className="block text-sm font-mono">{eur(m.current)}</span>
        <span className={`block text-[11px] font-mono ${up ? "text-mint" : "text-rose"}`}>
          {up ? "+" : ""}
          {num(m.delta_pct)} %
        </span>
      </span>
    </Link>
  );
}

// Öffentliche Startseite für nicht angemeldete Besucher (und Suchmaschinen):
// Überblick über alles, was die Seite kann, mit echten Zahlen aus den
// Nacht-Auswertungen (GET /api/stats/landing) und den neuesten Artikeln.
// Die Suche selbst lebt auf "Alle Karten" – hier nur der Pitch + Link dorthin.
export default function Landing() {
  const { registrationOpen } = useAuth();
  const [data, setData] = useState(null);
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    getLanding().then(setData).catch(() => setData(false));
    getArticles()
      .then((list) => setArticles(list.filter((a) => a.published).slice(0, 3)))
      .catch(() => setArticles([]));
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero */}
      <section className="text-center pt-6 pb-10">
        <Logo className="h-12 inline-block mb-8" />
        <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
          Deine Pokémon-Sammlung. Immer im Blick, immer aktuell.
        </h1>
        <p className="text-subtle mt-4 max-w-xl mx-auto">
          mycardfolio zeigt dir den Wert deiner Sammelkarten in Euro, wie sich dein Portfolio entwickelt und was dir
          noch zum Komplettset fehlt. Die neuen Preise holen wir jede Nacht um 1 Uhr – während du schläfst wie ein Relaxo.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
          <Link to="/sets" className="bg-yellow text-yellowInk font-medium px-6 py-3 rounded-full text-sm">
            Karten durchsuchen
          </Link>
          <Link to="/login" className="border border-line px-6 py-3 rounded-full text-sm hover:border-ink">
            Anmelden
          </Link>
          {registrationOpen && (
            <Link to="/register" className="border border-line px-6 py-3 rounded-full text-sm hover:border-ink">
              Kostenloses Konto erstellen
            </Link>
          )}
        </div>
        <p className="text-xs text-subtle mt-3">
          Kartensuche und Datenbank sind kostenlos und brauchen kein Konto.
          {!registrationOpen && " Neue Anmeldungen sind gerade geschlossen."}
        </p>
      </section>

      {/* Zahlen */}
      {data && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-14">
          {[
            [num(data.counts.cards), "Karten in der Datenbank"],
            [num(data.counts.sets), "Sets, von Base bis heute"],
            ["1 Uhr", "frische Preise, jede Nacht"],
            ["Cardmarket", "Preise in Euro"],
          ].map(([value, label]) => (
            <div key={label} className="bg-surface border border-line rounded-2xl px-4 py-4 text-center shadow-sm">
              <p className="text-xl font-semibold font-mono">{value}</p>
              <p className="text-[11px] text-subtle mt-1">{label}</p>
            </div>
          ))}
        </section>
      )}

      {/* Preisbewegungen */}
      {data && (data.gainers.length > 0 || data.losers.length > 0) && (
        <Section
          title="📈 Preisbewegungen der Woche"
          intro="Auch ein Karpador wird irgendwann zum Garados – bei manchen Karten geht es nur etwas schneller. Die größten Bewegungen der letzten 7 Tage, ganz ohne Konto."
          action={<Link to="/sets" className="text-xs text-subtle hover:text-ink underline shrink-0">Alle Karten →</Link>}
        >
          <div className="grid md:grid-cols-2 gap-4">
            {data.gainers.length > 0 && (
              <div className="bg-surface border border-line rounded-2xl px-4 py-2 shadow-sm">
                <p className="text-xs text-mint font-medium pt-2">Steigt</p>
                {data.gainers.map((m) => <MoverRow key={m.external_id} m={m} />)}
              </div>
            )}
            {data.losers.length > 0 && (
              <div className="bg-surface border border-line rounded-2xl px-4 py-2 shadow-sm">
                <p className="text-xs text-rose font-medium pt-2">Fällt</p>
                {data.losers.map((m) => <MoverRow key={m.external_id} m={m} />)}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Booster-Check */}
      {data && data.boosters.length > 0 && (
        <Section
          title="🎁 Lohnt sich der Booster? Wir haben nachgerechnet."
          intro="Aus den Pull Rates und den aktuellen Kartenpreisen berechnen wir, was ein Pack im Schnitt wert ist. 100 % hieße: Der Inhalt ist so viel wert wie der Booster kostet. (Spoiler: Meist ist er weniger wert – Spaß am Aufreißen gibt es gratis dazu.)"
          action={<Link to="/news/ziehen-oder-kaufen" className="text-xs text-subtle hover:text-ink underline shrink-0">Mehr dazu →</Link>}
        >
          <div className="bg-surface border border-line rounded-2xl px-4 py-2 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-subtle border-b border-line">
                  <th className="py-2 pr-3 font-normal">Set</th>
                  <th className="py-2 pr-3 font-normal text-right">Hit Rate</th>
                  <th className="py-2 pr-3 font-normal text-right">Wert pro Pack</th>
                  <th className="py-2 pr-3 font-normal text-right">Booster</th>
                  <th className="py-2 font-normal text-right">Rückfluss</th>
                </tr>
              </thead>
              <tbody>
                {data.boosters.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3">
                      <Link to={`/sets/${s.slug}`} className="font-medium hover:underline">{s.name}</Link>
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">{s.hitRatePct != null ? `${num(s.hitRatePct, 1)} %` : "–"}</td>
                    <td className="py-2 pr-3 text-right font-mono">{eur(s.packValue)}</td>
                    <td className="py-2 pr-3 text-right font-mono">{eur(s.boosterPriceCents / 100)}</td>
                    <td className="py-2 text-right font-mono font-medium">{num(s.ratio)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-subtle py-2">
              Die drei Sets mit dem besten Verhältnis. Die komplette Analyse mit Rangliste und „Ziehen oder kaufen“ gibt es für
              angemeldete Nutzer.
            </p>
          </div>
        </Section>
      )}

      {/* Funktionen */}
      <Section title="Alles, was ein Sammlerherz braucht" intro="Von der ersten Karte bis zum Komplettset – ein Platz für deine ganze Sammlung.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-surface border border-line rounded-2xl p-5 shadow-sm">
              <p className="text-2xl mb-2" aria-hidden="true">{f.icon}</p>
              <h3 className="font-medium mb-1">{f.title}</h3>
              <p className="text-subtle text-sm leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* News */}
      {articles.length > 0 && (
        <Section
          title="📰 Frisch aus dem Labor"
          intro="Artikel und Auswertungen – verständlich erklärt, ohne dass du dafür Professor werden musst."
          action={<Link to="/news" className="text-xs text-subtle hover:text-ink underline shrink-0">Alle Artikel →</Link>}
        >
          <div className="grid md:grid-cols-3 gap-4">
            {articles.map((a) => (
              <Link
                key={a.id}
                to={`/news/${a.slug}`}
                className="block bg-surface border border-line rounded-2xl p-5 shadow-sm hover:border-ink transition"
              >
                <p className="text-[11px] text-subtle mb-1">
                  {a.category} · {formatDate(a.published_at)}
                </p>
                <h3 className="font-medium mb-1 leading-snug">{a.title}</h3>
                <p className="text-subtle text-sm leading-relaxed">{a.summary}</p>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* So geht's */}
      <Section title="So funktioniert's">
        <div className="grid sm:grid-cols-3 gap-4">
          {STEPS.map(([title, text], i) => (
            <div key={title} className="text-center">
              <div className="w-8 h-8 rounded-full bg-yellow text-yellowInk font-mono font-semibold flex items-center justify-center mx-auto mb-3">
                {i + 1}
              </div>
              <h3 className="font-medium mb-1">{title}</h3>
              <p className="text-subtle text-sm leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section title="Häufige Fragen">
        <div className="space-y-2">
          {[
            ["Kostet mycardfolio etwas?", "Nein. Kartensuche und Datenbank sind kostenlos und ohne Konto nutzbar."],
            [
              "Woher kommen die Preise?",
              "Von Cardmarket (Trendwert in Euro), bezogen über die offene Schnittstelle von TCGdex. Es sind Preise der englischen Karten – für deutsche Karten gibt es keine frei verfügbare Quelle.",
            ],
            ["Wie aktuell sind die Preise?", "Wir holen alle Preise einmal täglich um 1 Uhr nachts. Die Seiten zeigen den Stand dieser Nacht."],
            ["Sind die Preise verbindlich?", "Nein, es sind Richtwerte ohne Gewähr – keine Kauf- oder Verkaufsempfehlung."],
            [
              "Kann ich ein Konto erstellen?",
              registrationOpen
                ? "Ja, kostenlos – eine E-Mail-Adresse genügt."
                : "Neue Anmeldungen sind aktuell geschlossen. Kartensuche, Datenbank und Artikel stehen dir trotzdem offen.",
            ],
          ].map(([q, a]) => (
            <details key={q} className="bg-surface border border-line rounded-xl px-4 py-3 group">
              <summary className="cursor-pointer text-sm font-medium list-none flex items-center justify-between">
                {q}
                <span className="text-subtle group-open:rotate-45 transition">＋</span>
              </summary>
              <p className="text-subtle text-sm mt-2 leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* Schluss */}
      <section className="text-center bg-surface border border-line rounded-2xl px-6 py-10 shadow-sm">
        <h2 className="text-xl font-semibold mb-2">Bereit für den ersten Schritt?</h2>
        <p className="text-subtle text-sm max-w-md mx-auto mb-5">
          Jede Reise beginnt mit einem Starter-Pokémon. Deine beginnt mit der Kartensuche – kostenlos und ohne Konto.
        </p>
        <Link to="/sets" className="inline-block bg-yellow text-yellowInk font-medium px-6 py-3 rounded-full text-sm">
          Los geht's
        </Link>
      </section>

      <p className="text-xs text-subtle text-center mt-10">
        Unabhängiges Fan-Projekt – nicht verbunden mit Nintendo, The Pokémon Company, Creatures Inc. oder GAME FREAK inc.
        Preisangaben sind Cardmarket-Trendwerte, unverbindlich und ohne Gewähr.
      </p>
    </div>
  );
}
