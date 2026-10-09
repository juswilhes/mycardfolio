import { useEffect, useState } from "react";
import { getSets, getCardsForSet, getPullRates, updatePullRates } from "../api.js";

// Pflege der Pull Rates (nur Betreiber, keine offizielle Quelle - Zahlen aus
// Booster-Auswertungen). Pro Seltenheit zwei Werte: "jede 1/X" = irgendeine
// Karte dieser Seltenheit, "diese 1/Y" = genau eine bestimmte Karte. Die
// Seltenheiten kommen exakt so aus den Karten des Sets (die Schreibweise
// unterscheidet sich je Set), damit sie später sicher zusammenpassen.
export default function PullRateEditor({ onSaved }) {
  const [sets, setSets] = useState(null);
  const [setId, setSetId] = useState("");
  const [rarities, setRarities] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSets()
      .then((list) => {
        setSets(list);
        setSetId(list[0]?.id ?? "");
      })
      .catch(() => setSets([]));
  }, []);

  useEffect(() => {
    if (!setId) return;
    setRarities(null);
    setForm(null);
    setSaved(false);
    let cancelled = false;
    Promise.all([getCardsForSet(setId), getPullRates(setId)])
      .then(([cards, rates]) => {
        if (cancelled) return;
        const counts = new Map();
        for (const c of cards) if (c.rarity) counts.set(c.rarity, (counts.get(c.rarity) ?? 0) + 1);
        // seltene zuerst - dort sind Pull Rates interessant
        const list = [...counts.entries()].sort((a, b) => a[1] - b[1]).map(([r]) => r);
        const byRarity = Object.fromEntries(rates.rarities.map((r) => [r.rarity, r]));
        setRarities(list);
        setForm({
          byRarity: Object.fromEntries(
            list.map((r) => [
              r,
              {
                any: byRarity[r]?.anyDenominator != null ? String(byRarity[r].anyDenominator) : "",
                specific: byRarity[r]?.specificDenominator != null ? String(byRarity[r].specificDenominator) : "",
              },
            ])
          ),
        });
      })
      .catch(() => !cancelled && setRarities([]));
    return () => {
      cancelled = true;
    };
  }, [setId]);

  const setField = (rarity, key, value) => {
    setSaved(false);
    setForm((f) => ({ ...f, byRarity: { ...f.byRarity, [rarity]: { ...f.byRarity[rarity], [key]: value } } }));
  };

  async function save() {
    setSaving(true);
    try {
      await updatePullRates(setId, {
        rarities: Object.entries(form.byRarity).map(([rarity, v]) => ({
          rarity,
          anyDenominator: v.any.trim() || null,
          specificDenominator: v.specific.trim() || null,
        })),
      });
      setSaved(true);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  const input = "border border-line rounded-full px-2 py-1 text-xs bg-canvas w-20 focus:outline-none focus:border-ink";

  return (
    <div className="bg-surface border border-line rounded-2xl px-5 py-4 shadow-sm mb-6">
      <p className="text-sm font-medium mb-3">Pull Rates pflegen</p>

      {sets === null ? (
        <p className="text-subtle text-xs">Lade Sets …</p>
      ) : (
        <select
          value={setId}
          onChange={(e) => setSetId(e.target.value)}
          className="border border-line rounded-full px-3 py-1.5 text-xs bg-canvas text-ink focus:outline-none focus:border-ink mb-3"
        >
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.release_date ? ` (${s.release_date.slice(0, 4)})` : ""}
            </option>
          ))}
        </select>
      )}

      {form && (
        <div className="space-y-2">
          {rarities.map((r) => (
            <div key={r} className="flex flex-wrap items-center gap-2">
              <span className="text-xs w-56 shrink-0 truncate" title={r}>
                {r}
              </span>
              <span className="text-xs text-subtle">jede 1/</span>
              <input type="number" min="1" value={form.byRarity[r].any} onChange={(e) => setField(r, "any", e.target.value)} className={input} />
              <span className="text-xs text-subtle">diese 1/</span>
              <input type="number" min="1" value={form.byRarity[r].specific} onChange={(e) => setField(r, "specific", e.target.value)} className={input} />
            </div>
          ))}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="text-sm bg-yellow text-yellowInk px-3 py-1 rounded-full disabled:opacity-60"
            >
              {saving ? "…" : "Speichern"}
            </button>
            {saved && <span className="text-mint text-xs">Gespeichert ✓</span>}
          </div>
        </div>
      )}
      {setId && rarities === null && <p className="text-subtle text-xs">Lade Seltenheiten …</p>}
    </div>
  );
}
