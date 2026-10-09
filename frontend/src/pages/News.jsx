import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getArticles } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import ArticleEditor from "../components/ArticleEditor.jsx";
import ArticleCover from "../components/ArticleCover.jsx";
import { formatDate } from "../lib/format.js";

const Meta = ({ a }) => (
  <p className="text-[11px] text-subtle mb-1">
    {a.category} · {formatDate(a.published_at)}
    {!a.published && <span className="text-rose"> · Entwurf</span>}
  </p>
);

// Route: /news – alle Artikel, öffentlich. Der neueste steht groß in der Mitte,
// die älteren klein in einer Spalte am linken Rand (auf dem Handy darunter).
// Der Betreiber sieht zusätzlich Entwürfe und kann hier neue Artikel schreiben.
export default function News() {
  const { user } = useAuth();
  const canEdit = !!user?.is_operator;
  const [articles, setArticles] = useState(null);
  const [writing, setWriting] = useState(false);

  const load = () => getArticles().then(setArticles).catch(() => setArticles([]));
  useEffect(() => {
    load();
  }, []);

  const [latest, ...older] = articles ?? [];

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold mb-1">News & Artikel</h1>
      <p className="text-subtle text-sm mb-6">
        Wissenswertes rund ums Sammeln – Auswertungen, Erklärungen und Neuigkeiten von mycardfolio.
      </p>

      {canEdit && !writing && (
        <button onClick={() => setWriting(true)} className="text-xs border border-line rounded-full px-3 py-1.5 hover:border-ink mb-6">
          Neuer Artikel
        </button>
      )}
      {writing && (
        <ArticleEditor
          onCancel={() => setWriting(false)}
          onSaved={() => {
            setWriting(false);
            load();
          }}
        />
      )}

      {articles === null ? (
        <p className="text-subtle text-sm">Lade Artikel …</p>
      ) : !latest ? (
        <p className="text-subtle text-sm">Noch keine Artikel – schau bald wieder vorbei.</p>
      ) : (
        <div className={older.length ? "grid lg:grid-cols-[250px_1fr] gap-8 items-start" : ""}>
          {older.length > 0 && (
            <aside className="order-2 lg:order-1">
              <h2 className="text-xs font-medium text-subtle mb-3">Ältere Artikel</h2>
              <div className="space-y-3">
                {older.map((a) => (
                  <Link
                    key={a.id}
                    to={`/news/${a.slug}`}
                    className="flex gap-3 bg-surface border border-line rounded-xl overflow-hidden shadow-sm hover:border-ink transition lg:block"
                  >
                    {/* eigenes <img>: schmal neben dem Text auf dem Handy, volle Breite oben in der Randspalte */}
                    <img
                      src={a.image || "/news/cover-default.svg"}
                      alt=""
                      loading="lazy"
                      className="w-28 shrink-0 object-cover bg-line lg:w-full lg:aspect-[1200/630]"
                    />
                    <div className="py-2 pr-3 lg:p-3">
                      <Meta a={a} />
                      <h3 className="text-sm font-medium leading-snug">{a.title}</h3>
                    </div>
                  </Link>
                ))}
              </div>
            </aside>
          )}

          <Link
            to={`/news/${latest.slug}`}
            className="order-1 lg:order-2 block bg-surface border border-line rounded-2xl overflow-hidden shadow-sm hover:border-ink transition"
          >
            <ArticleCover article={latest} />
            <div className="p-6">
              <Meta a={latest} />
              <h2 className="text-xl sm:text-2xl font-semibold leading-snug mb-2">{latest.title}</h2>
              <p className="text-subtle leading-relaxed mb-4">{latest.summary}</p>
              <span className="text-sm font-medium underline">Weiterlesen</span>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
