import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getArticles } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import ArticleEditor from "../components/ArticleEditor.jsx";
import { formatDate } from "../lib/format.js";

// Route: /news – alle Artikel, öffentlich. Der Betreiber sieht zusätzlich
// Entwürfe und kann hier neue Artikel schreiben.
export default function News() {
  const { user } = useAuth();
  const canEdit = !!user?.is_operator;
  const [articles, setArticles] = useState(null);
  const [writing, setWriting] = useState(false);

  const load = () => getArticles().then(setArticles).catch(() => setArticles([]));
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-1">📰 News & Artikel</h1>
      <p className="text-subtle text-sm mb-6">
        Wissenswertes rund ums Sammeln – Auswertungen, Erklärungen und Neuigkeiten von mycardfolio.
      </p>

      {canEdit && !writing && (
        <button onClick={() => setWriting(true)} className="text-xs border border-line rounded-full px-3 py-1.5 hover:border-ink mb-6">
          ✏️ Neuer Artikel
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
      ) : articles.length === 0 ? (
        <p className="text-subtle text-sm">Noch keine Artikel – schau bald wieder vorbei.</p>
      ) : (
        <div className="space-y-4">
          {articles.map((a) => (
            <Link
              key={a.id}
              to={`/news/${a.slug}`}
              className="block bg-surface border border-line rounded-2xl p-5 shadow-sm hover:border-ink transition"
            >
              <p className="text-[11px] text-subtle mb-1">
                {a.category} · {formatDate(a.published_at)}
                {!a.published && <span className="text-rose"> · Entwurf</span>}
              </p>
              <h2 className="font-medium mb-1">{a.title}</h2>
              <p className="text-subtle text-sm leading-relaxed">{a.summary}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
