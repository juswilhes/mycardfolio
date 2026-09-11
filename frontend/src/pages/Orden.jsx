import { useEffect, useState } from "react";
import { getAchievements } from "../api.js";
import OrdenBadge from "../components/OrdenBadge.jsx";
import Ordenkoffer from "../components/Ordenkoffer.jsx";

const fmtDate = (iso) =>
  new Date(iso + "Z").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

function Badge({ a }) {
  const pct = a.earned ? 100 : Math.min(100, Math.round((a.current / a.target) * 100));
  return (
    <div
      className={`rounded-2xl p-4 flex flex-col items-center text-center gap-1.5 border transition ${
        a.earned ? "bg-white/50 border-[#c9a24a] shadow-sm" : "bg-white/20 border-[#c9b285] border-dashed"
      }`}
    >
      <div className="mb-1">
        <OrdenBadge id={a.id} earned={a.earned} size={64} />
      </div>
      <p className={`text-sm font-medium ${a.earned ? "text-[#3b2611]" : "text-[#8a6f4d]"}`}>{a.title}</p>
      <p className="text-[11px] text-[#6b563a] leading-snug">{a.desc}</p>
      {a.earned ? (
        <p className="text-[10px] text-[#8a7355] mt-0.5">Erhalten am {fmtDate(a.earned_at)}</p>
      ) : (
        <div className="w-full mt-1">
          <div className="h-1.5 rounded-full bg-[#e2cfa4] overflow-hidden">
            <div className="h-full bg-[#c9a24a]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] text-[#8a7355]">
            {Math.min(a.current, a.target)} / {a.target}
          </span>
        </div>
      )}
    </div>
  );
}

// Route: /orden – der "Ordenkoffer". 16 Orden für Meilensteine in der
// Sammlung, als Pixel-Sprites gestaltet und in einem echten kleinen
// Reisekoffer präsentiert: erhaltene bunt, offene grau mit Fortschrittsbalken.
export default function Orden() {
  const [achievements, setAchievements] = useState(null);

  useEffect(() => {
    getAchievements().then(setAchievements).catch(() => setAchievements([]));
  }, []);

  if (achievements === null) return <p className="text-subtle text-sm">Lade Ordenkoffer …</p>;

  const earnedCount = achievements.filter((a) => a.earned).length;
  const total = achievements.length;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">🏅 Dein Ordenkoffer</h1>
      <p className="text-subtle text-sm mb-4">
        Für jeden kleinen und großen Meilenstein deiner Sammelreise gibt es einen Orden.
      </p>

      <Ordenkoffer>
        <p className="text-sm font-medium mb-1 text-[#3b2611]">
          {earnedCount} von {total} Orden gesammelt
        </p>
        <div className="h-2.5 rounded-full bg-[#e2cfa4] overflow-hidden mb-5">
          <div
            className="h-full bg-[#c9a24a] transition-all"
            style={{ width: `${(earnedCount / total) * 100}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {achievements.map((a) => (
            <Badge key={a.id} a={a} />
          ))}
        </div>
      </Ordenkoffer>
    </div>
  );
}
