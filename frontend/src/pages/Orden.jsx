import { useEffect, useState } from "react";
import { getAchievements } from "../api.js";
import OrdenBadge from "../components/OrdenBadge.jsx";

const fmtDate = (iso) =>
  new Date(iso + "Z").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

function Badge({ a }) {
  const pct = a.earned ? 100 : Math.min(100, Math.round((a.current / a.target) * 100));
  return (
    <div
      className={`rounded-2xl p-4 flex flex-col items-center text-center gap-1.5 border transition ${
        a.earned ? "bg-yellow/10 border-yellow shadow-sm" : "bg-surface/60 border-line border-dashed"
      }`}
    >
      <div className="mb-1">
        <OrdenBadge id={a.id} earned={a.earned} size={68} />
      </div>
      <p className={`text-sm font-medium ${a.earned ? "" : "text-subtle"}`}>{a.title}</p>
      <p className="text-[11px] text-subtle leading-snug">{a.desc}</p>
      {a.earned ? (
        <p className="text-[10px] text-subtle mt-0.5">Erhalten am {fmtDate(a.earned_at)}</p>
      ) : (
        <div className="w-full mt-1">
          <div className="h-1.5 rounded-full bg-line overflow-hidden">
            <div className="h-full bg-yellow" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] text-subtle">
            {Math.min(a.current, a.target)} / {a.target}
          </span>
        </div>
      )}
    </div>
  );
}

// Route: /orden – 16 Orden für Meilensteine in der Sammlung, jeder mit
// eigener Form und eigenem "Edelstein"-Design; erhalten = golden gerahmt,
// offen = mattes Silber mit Fortschrittsbalken.
export default function Orden() {
  const [achievements, setAchievements] = useState(null);

  useEffect(() => {
    getAchievements().then(setAchievements).catch(() => setAchievements([]));
  }, []);

  if (achievements === null) return <p className="text-subtle text-sm">Lade Orden …</p>;

  const earnedCount = achievements.filter((a) => a.earned).length;
  const total = achievements.length;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">🏅 Deine Orden</h1>
      <p className="text-subtle text-sm mb-4">
        Für jeden kleinen und großen Meilenstein deiner Sammelreise gibt es einen Orden.
      </p>

      <div className="bg-surface border border-line rounded-2xl px-6 py-4 mb-6 shadow-sm">
        <p className="text-sm font-medium mb-1">
          {earnedCount} von {total} Orden gesammelt
        </p>
        <div className="h-2.5 rounded-full bg-line overflow-hidden">
          <div
            className="h-full bg-yellow transition-all"
            style={{ width: `${(earnedCount / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {achievements.map((a) => (
          <Badge key={a.id} a={a} />
        ))}
      </div>
    </div>
  );
}
