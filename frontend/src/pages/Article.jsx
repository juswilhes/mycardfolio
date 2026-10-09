import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getArticle, deleteArticle } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import ArticleEditor from "../components/ArticleEditor.jsx";
import ArticleCover from "../components/ArticleCover.jsx";
import Prose from "../components/Prose.jsx";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { formatDate } from "../lib/format.js";

// Route: /news/:slug – ein Artikel, öffentlich (Entwürfe nur für den Betreiber).
export default function Article() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = !!user?.is_operator;
  const [article, setArticle] = useState(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  usePageTitle(article ? `${article.title} | mycardfolio` : null);

  useEffect(() => {
    getArticle(slug).then(setArticle).catch(() => setMissing(true));
  }, [slug]);

  async function remove() {
    if (!window.confirm("Diesen Artikel wirklich löschen?")) return;
    await deleteArticle(article.id);
    navigate("/news", { replace: true });
  }

  if (missing) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <p className="mb-4">Diesen Artikel gibt es nicht (mehr).</p>
        <Link to="/news" className="underline text-subtle hover:text-ink">Zu allen Artikeln</Link>
      </div>
    );
  }
  if (!article) return <p className="text-subtle text-sm">Lade Artikel …</p>;

  return (
    <article className="max-w-3xl mx-auto">
      <Link to="/news" className="text-sm text-subtle hover:text-ink">← Alle Artikel</Link>

      {canEdit && (
        <div className="flex gap-3 mt-4">
          <button onClick={() => setEditing((v) => !v)} className="text-xs border border-line rounded-full px-3 py-1.5 hover:border-ink">
            {editing ? "Bearbeiten schließen" : "Bearbeiten"}
          </button>
          <button onClick={remove} className="text-xs border border-line rounded-full px-3 py-1.5 hover:border-rose text-rose">
            Löschen
          </button>
        </div>
      )}
      {editing && (
        <div className="mt-4">
          <ArticleEditor
            article={article}
            onCancel={() => setEditing(false)}
            onSaved={(saved) => {
              setArticle(saved);
              setEditing(false);
            }}
          />
        </div>
      )}

      <p className="text-xs text-subtle mt-6 mb-2">
        {article.category} · {formatDate(article.published_at)}
        {!article.published && <span className="text-rose"> · Entwurf (nur für dich sichtbar)</span>}
      </p>
      <h1 className="text-2xl sm:text-3xl font-semibold leading-tight mb-3">{article.title}</h1>
      <p className="text-subtle text-lg leading-relaxed mb-6">{article.summary}</p>
      <ArticleCover article={article} className="rounded-2xl border border-line mb-8" />
      <Prose text={article.body} />

      <div className="mt-10 bg-surface border border-line rounded-2xl p-5 text-center">
        <p className="font-medium mb-1">Selbst nachschauen?</p>
        <p className="text-subtle text-sm mb-4">Karten, Preise und Preisverläufe stehen dir ohne Konto offen.</p>
        <Link to="/sets" className="inline-block bg-yellow text-yellowInk font-medium px-5 py-2.5 rounded-full text-sm">
          Karten durchsuchen
        </Link>
      </div>
    </article>
  );
}
