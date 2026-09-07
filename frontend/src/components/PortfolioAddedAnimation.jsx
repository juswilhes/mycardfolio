import { useEffect, useMemo } from "react";

// Kurze Feier-Animation, wenn eine Karte ins Portfolio wandert:
// Karte springt heran, Konfetti-Partikel stieben auseinander, dann
// schrumpft alles Richtung Kopfzeile ("Sammlung") und ruft onDone().
export default function PortfolioAddedAnimation({ card, onDone }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 90 + Math.random() * 120;
        return {
          id: i,
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist,
          rot: (Math.random() * 2 - 1) * 220,
          delay: Math.random() * 60,
          glyph: ["✨", "🎉", "⭐", "🟡", "✦"][i % 5],
        };
      }),
    []
  );

  // Ziel = Mitte des Reiters "Sammlung" in der Kopfzeile, relativ zur
  // Bildschirmmitte (dort startet die Karte).
  const target = useMemo(() => {
    const el = typeof document !== "undefined" && document.getElementById("nav-sammlung");
    if (!el) return { x: "0px", y: "-42vh" };
    const r = el.getBoundingClientRect();
    return {
      x: `${Math.round(r.left + r.width / 2 - window.innerWidth / 2)}px`,
      y: `${Math.round(r.top + r.height / 2 - window.innerHeight / 2)}px`,
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(onDone, 1650);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden">
      <style>{`
        @keyframes pf-card {
          0%   { transform: translateY(24px) scale(.3) rotate(-12deg); opacity: 0; }
          18%  { transform: translateY(0) scale(1.08) rotate(4deg); opacity: 1; }
          32%  { transform: translateY(0) scale(1) rotate(0deg); }
          70%  { transform: translate(0,0) scale(1) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--pf-tx,-42vw), var(--pf-ty,-40vh)) scale(.1) rotate(-6deg); opacity: 0; }
        }
        @keyframes pf-particle {
          0%   { transform: translate(0,0) scale(.2) rotate(0deg); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(1) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes pf-badge {
          0%   { transform: translateY(14px) scale(.8); opacity: 0; }
          25%  { transform: translateY(0) scale(1); opacity: 1; }
          75%  { opacity: 1; }
          100% { transform: translateY(-6px) scale(.95); opacity: 0; }
        }
        @keyframes pf-ring {
          0%   { transform: scale(.2); opacity: .55; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pf-anim { animation-duration: .01ms !important; }
        }
      `}</style>

      <div className="relative flex flex-col items-center">
        <div
          className="pf-anim absolute rounded-full"
          style={{
            width: 150, height: 150,
            background: "var(--yellow)",
            animation: "pf-ring .7s ease-out forwards",
          }}
        />

        {particles.map((p) => (
          <span
            key={p.id}
            className="pf-anim absolute text-xl select-none"
            style={{
              "--tx": `${p.tx}px`,
              "--ty": `${p.ty}px`,
              "--rot": `${p.rot}deg`,
              animation: `pf-particle 1s ease-out ${p.delay}ms forwards`,
            }}
          >
            {p.glyph}
          </span>
        ))}

        <img
          src={card.image_large ?? card.image_small}
          alt=""
          className="pf-anim w-40 rounded-2xl shadow-2xl"
          style={{
            "--pf-tx": target.x,
            "--pf-ty": target.y,
            animation: "pf-card 1.65s cubic-bezier(.2,.8,.2,1) forwards",
          }}
        />

        <div
          className="pf-anim mt-5 bg-surface border border-line rounded-full px-4 py-2 text-sm font-medium shadow-lg"
          style={{ animation: "pf-badge 1.4s ease-out forwards" }}
        >
          Zum Portfolio hinzugefügt&nbsp;🎉
        </div>
      </div>
    </div>
  );
}
