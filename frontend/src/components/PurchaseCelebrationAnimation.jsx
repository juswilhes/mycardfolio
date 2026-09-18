import { useEffect, useMemo } from "react";

const eur = (cents) => `${(cents / 100).toFixed(2)} €`;
const COLORS = ["var(--yellow)", "var(--mint)", "#5a9bff", "#c98bff", "var(--rose)"];

// Animation nach einem erfolgreichen Kauf im Marktplatz: Konfetti-Regen +
// die gekaufte Karte fliegt rein - soll sich wie ein kleines Highlight
// anfühlen, nicht wie eine trockene Bestätigungsseite.
export default function PurchaseCelebrationAnimation({ listing, onDone }) {
  const burst = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2 + Math.random() * 0.4;
        const d = 120 + Math.random() * 140;
        return {
          id: i,
          tx: Math.cos(a) * d,
          ty: Math.sin(a) * d,
          rot: (Math.random() * 2 - 1) * 260,
          delay: Math.random() * 80,
          glyph: ["🎉", "✨", "🛍️", "⭐", "💫"][i % 5],
        };
      }),
    []
  );

  const confetti = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 900,
        dur: 1600 + Math.random() * 1600,
        rot: Math.random() * 720 - 360,
        color: COLORS[i % COLORS.length],
        w: 6 + Math.random() * 6,
        h: 10 + Math.random() * 10,
      })),
    []
  );

  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  const photo = listing?.photo_url || listing?.image_url;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden">
      <style>{`
        @keyframes buy-card {
          0%   { transform: scale(.3) rotateY(-90deg); opacity: 0; }
          22%  { transform: scale(1.12) rotateY(10deg); opacity: 1; }
          38%  { transform: scale(1) rotateY(0deg); }
          78%  { transform: scale(1) translateY(0); opacity: 1; }
          100% { transform: scale(.55) translateY(-30vh); opacity: 0; }
        }
        @keyframes buy-particle {
          0%   { transform: translate(0,0) scale(.2); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(1) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes buy-badge {
          0%   { transform: translateY(16px) scale(.7); opacity: 0; }
          30%  { transform: translateY(0) scale(1.05); opacity: 1; }
          45%  { transform: scale(1); }
          85%  { opacity: 1; }
          100% { transform: translateY(-8px) scale(.96); opacity: 0; }
        }
        @keyframes buy-glow {
          0%,100% { opacity: 0; transform: scale(.6); }
          40%     { opacity: .5; transform: scale(1.8); }
        }
        @keyframes buy-confetti {
          0%   { transform: translateY(-12vh) rotate(0deg); opacity: 0; }
          8%   { opacity: 1; }
          100% { transform: translateY(115vh) rotate(var(--rot)); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .buy-anim { animation-duration: .01ms !important; }
        }
      `}</style>

      {confetti.map((c) => (
        <span
          key={c.id}
          className="buy-anim absolute top-0 rounded-[2px]"
          style={{
            left: `${c.x}vw`,
            width: c.w,
            height: c.h,
            background: c.color,
            "--rot": `${c.rot}deg`,
            animation: `buy-confetti ${c.dur}ms linear ${c.delay}ms forwards`,
          }}
        />
      ))}

      <div className="relative flex flex-col items-center">
        <div
          className="buy-anim absolute rounded-full"
          style={{ width: 220, height: 220, background: "var(--yellow)", animation: "buy-glow 1s ease-out forwards" }}
        />

        {burst.map((p) => (
          <span
            key={p.id}
            className="buy-anim absolute text-xl select-none"
            style={{
              "--tx": `${p.tx}px`,
              "--ty": `${p.ty}px`,
              "--rot": `${p.rot}deg`,
              animation: `buy-particle 1.2s ease-out ${p.delay}ms forwards`,
            }}
          >
            {p.glyph}
          </span>
        ))}

        {photo ? (
          <img
            src={photo}
            alt=""
            className="buy-anim w-40 rounded-2xl shadow-2xl object-contain bg-canvas"
            style={{ animation: "buy-card 2.6s cubic-bezier(.2,.8,.2,1) forwards" }}
          />
        ) : (
          <div
            className="buy-anim w-40 h-40 rounded-2xl shadow-2xl bg-canvas flex items-center justify-center text-5xl"
            style={{ animation: "buy-card 2.6s cubic-bezier(.2,.8,.2,1) forwards" }}
          >
            📦
          </div>
        )}

        <div
          className="buy-anim mt-5 rounded-full px-5 py-2.5 shadow-lg text-center bg-yellow text-yellowInk text-base font-semibold"
          style={{ animation: "buy-badge 2.4s ease-out forwards" }}
        >
          🎉 Gekauft!
          {listing && (
            <div className="text-sm font-normal mt-0.5 truncate max-w-[220px]">
              {listing.title} · {eur(listing.price_cents)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
