import { useEffect, useMemo } from "react";
import OrdenBadge from "./OrdenBadge.jsx";

// Feier-Animation, wenn ein neuer Orden freigeschaltet wird: Lichtstrahlen
// + Ring blitzen auf, der Orden selbst springt heran und schrumpft dann
// Richtung Kopfzeile ("Orden"), dazu Konfetti-Partikel und ein Bildschirm-
// Dimmer für den großen Moment.
export default function OrdenUnlockAnimation({ achievement, onDone }) {
  const rays = useMemo(() => Array.from({ length: 10 }, (_, i) => i * 36), []);

  const particles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 80 + Math.random() * 110;
        return {
          id: i,
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist,
          rot: (Math.random() * 2 - 1) * 220,
          delay: Math.random() * 80,
          glyph: ["✨", "⭐", "🟡", "✦"][i % 4],
        };
      }),
    []
  );

  const target = useMemo(() => {
    const el = typeof document !== "undefined" && document.getElementById("nav-orden");
    if (!el) return { x: "0px", y: "-42vh" };
    const r = el.getBoundingClientRect();
    return {
      x: `${Math.round(r.left + r.width / 2 - window.innerWidth / 2)}px`,
      y: `${Math.round(r.top + r.height / 2 - window.innerHeight / 2)}px`,
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden">
      <style>{`
        @keyframes ou-dim { 0% { opacity: 0; } 15% { opacity: 1; } 78% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes ou-ray {
          0%   { transform: rotate(var(--ray-r,0deg)) scaleY(0); opacity: 0; }
          25%  { opacity: .55; }
          100% { transform: rotate(var(--ray-r,0deg)) scaleY(1); opacity: 0; }
        }
        @keyframes ou-badge {
          0%   { transform: scale(.2) rotate(-25deg); opacity: 0; }
          12%  { transform: scale(.2) rotate(-25deg); opacity: 0; }
          38%  { transform: scale(1.18) rotate(6deg); opacity: 1; }
          52%  { transform: scale(1) rotate(0deg); }
          78%  { transform: scale(1) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--ou-tx,-42vw), var(--ou-ty,-40vh)) scale(.15) rotate(-6deg); opacity: 0; }
        }
        @keyframes ou-ring { 0% { transform: scale(.2); opacity: .6; } 100% { transform: scale(3); opacity: 0; } }
        @keyframes ou-particle {
          0%   { transform: translate(0,0) scale(.2) rotate(0deg); opacity: 0; }
          20%  { opacity: 1; }
          100% { transform: translate(var(--tx),var(--ty)) scale(1) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes ou-caption {
          0%   { transform: translateY(10px); opacity: 0; }
          40%  { transform: translateY(0); opacity: 1; }
          82%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ou-anim { animation-duration: .01ms !important; }
        }
      `}</style>

      <div className="ou-anim absolute inset-0 bg-black/60" style={{ animation: "ou-dim 2.2s ease-out forwards" }} />

      <div className="relative flex flex-col items-center">
        {rays.map((r) => (
          <div
            key={r}
            className="ou-anim absolute"
            style={{
              "--ray-r": `${r}deg`,
              width: 4,
              height: 170,
              background: "linear-gradient(to top, transparent, #f7d038)",
              animation: "ou-ray 1.1s ease-out .1s forwards",
              transformOrigin: "bottom center",
            }}
          />
        ))}

        <div
          className="ou-anim absolute rounded-full"
          style={{ width: 160, height: 160, background: "#f7d038", animation: "ou-ring .8s ease-out .35s forwards" }}
        />

        {particles.map((p) => (
          <span
            key={p.id}
            className="ou-anim absolute text-xl select-none"
            style={{
              "--tx": `${p.tx}px`,
              "--ty": `${p.ty}px`,
              "--rot": `${p.rot}deg`,
              animation: `ou-particle 1.1s ease-out ${380 + p.delay}ms forwards`,
            }}
          >
            {p.glyph}
          </span>
        ))}

        <div
          className="ou-anim"
          style={{ "--ou-tx": target.x, "--ou-ty": target.y, animation: "ou-badge 2.2s cubic-bezier(.2,.8,.2,1) forwards" }}
        >
          <OrdenBadge id={achievement.id} earned size={128} />
        </div>

        <div className="ou-anim mt-4 text-center" style={{ animation: "ou-caption 2.2s ease-out forwards" }}>
          <p className="text-yellow font-semibold text-sm tracking-wide uppercase">Orden erhalten</p>
          <p className="text-white text-lg font-semibold">{achievement.title}</p>
        </div>
      </div>
    </div>
  );
}
