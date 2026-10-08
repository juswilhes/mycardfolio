import { useState } from "react";
import { createArticle, updateArticle } from "../api.js";
import Prose from "./Prose.jsx";

const CATEGORIES = ["News", "Grundlagen", "Analyse", "Tipps"];

// Editor für News & Artikel (nur Betreiber). `article` gesetzt = bearbeiten,
// sonst neuer Artikel. Die Adresse (Slug) entsteht beim Anlegen aus dem Titel
// und bleibt danach stabil.
export default function ArticleEditor({ article, onSaved, onCancel }) {
  const [form, setForm] = useState({
    title: article?.title ?? "",
    summary: article?.summary ?? "",
    category: article?.category ?? "News",
    published_at: article?.published_at ?? new Date().toISOString().slice(0, 10),
    published: article ? !!article.published : false,
    body: article?.body ?? "",
  });
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const saved = article ? await updateArticle(article.id, form) : await createArticle(form);
      onSaved(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full border border-line rounded-xl px-3 py-2 text-sm bg-canvas text-ink focus:outline-none focus:border-ink";

  return (
    <div className="bg-surface border border-line rounded-2xl px-5 py-4 shadow-sm mb-8">
      <p className="text-sm font-medium mb-3">{article ? "✏️ Artikel bearbeiten" : "✏️ Neuer Artikel"}</p>
      <div className="space-y-3">
        <input value={form.title} onChange={set("title")} placeholder="Titel" maxLength={140} className={input} />
        <textarea
          value={form.summary}
          onChange={set("summary")}
          placeholder="Kurze Zusammenfassung (erscheint in der Liste und bei Google)"
          maxLength={300}
          rows={2}
          className={input}
        />
        <div className="flex flex-wrap gap-3">
          <input list="article-categories" value={form.category} onChange={set("category")} placeholder="Kategorie" className={`${input} sm:w-44`} />
          <datalist id="article-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          <input type="date" value={form.published_at} onChange={set("published_at")} className={`${input} sm:w-44`} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.published} onChange={set("published")} />
            Veröffentlicht
          </label>
        </div>
        <textarea
          value={form.body}
          onChange={set("body")}
          placeholder="Text …"
          rows={16}
          className={`${input} font-mono`}
        />
        <p className="text-[11px] text-subtle">
          Leerzeile = neuer Absatz · <code>## Überschrift</code> · <code>- Listenpunkt</code> · <code>&gt; Zitat</code> ·{" "}
          <code>**fett**</code> · <code>[Linktext](/analyse)</code> oder <code>[Linktext](https://…)</code>
        </p>
        {preview && (
          <div className="border border-line rounded-xl px-4 py-3">
            <Prose text={form.body} />
          </div>
        )}
        {error && <p className="text-rose text-sm">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={busy} className="bg-yellow text-yellowInk font-medium px-5 py-2 rounded-full text-sm disabled:opacity-60">
            {busy ? "Speichere …" : "Speichern"}
          </button>
          <button onClick={() => setPreview((v) => !v)} className="text-sm border border-line rounded-full px-4 py-2 hover:border-ink">
            {preview ? "Vorschau aus" : "Vorschau"}
          </button>
          <button onClick={onCancel} className="text-sm text-subtle hover:text-ink">Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
