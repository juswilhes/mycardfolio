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
        a.earned ? "bg-white/10 border-[#c9a24a]" : "bg-black/20 border-white/10 border-dashed"
      }`}
    >
      <div className="mb-1">
        <OrdenBadge id={a.id} earned={a.earned} size={64} />
      </div>
      <p className={`text-sm font-medium ${a.earned ? "text-[#f5ead2]" : "text-white/50"}`}>{a.title}</p>
      <p className="text-[11px] text-white/45 leading-snug">{a.desc}</p>
      {a.earned ? (
        <p className="text-[10px] text-[#c9a24a] mt-0.5">Erhalten am {fmtDate(a.earned_at)}</p>
      ) : (
        <div className="w-full mt-1">
          <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
            <div className="h-full bg-[#c9a24a]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] text-white/40">
            {Math.min(a.current, a.target)} / {a.target}
          </span>
        </div>
      )}
    </div>
  );
}

// Route: /orden – der "Ordenkoffer". 16 Orden für Meilensteine in der
// Sammlung, als Pixel-Sprites gestaltet und in einem Etui präsentiert, wie
// die Arenaorden-Box aus den Spielen: erhaltene bunt, offene als dunkle
// Aussparung mit Fortschrittsbalken.
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
        <p className="text-sm font-medium mb-1 text-[#f5ead2]">
          {earnedCount} von {total} Orden gesammelt
        </p>
        <div className="h-2.5 rounded-full bg-black/30 overflow-hidden mb-5">
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
