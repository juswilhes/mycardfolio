import { useEffect, useMemo } from "react";

const eur = (n) => `${Math.abs(Number(n)).toFixed(2)} €`;
const COLORS = ["var(--yellow)", "var(--mint)", "var(--rose)", "#5a9bff", "#c98bff"];

// Animation nach einem Verkauf. Ab > 50 % Gewinn auf den Einstand: große
// Party (Konfetti-Regen, großer Betrag). Sonst dezent, bei Verlust ruhig.
export default function SaleCelebrationAnimation({ card, realized, cost, proceeds, big, onDone }) {
  const hasCost = cost > 0;
  const profit = realized >= 0;
  const pct = hasCost ? (realized / cost) * 100 : null;

  const burst = useMemo(
    () =>
      Array.from({ length: big ? 26 : 14 }, (_, i) => {
        const a = (i / (big ? 26 : 14)) * Math.PI * 2 + Math.random() * 0.4;
        const d = (big ? 140 : 90) + Math.random() * (big ? 160 : 110);
        return {
          id: i,
          tx: Math.cos(a) * d,
          ty: Math.sin(a) * d,
          rot: (Math.random() * 2 - 1) * 260,
          delay: Math.random() * 80,
          glyph: (profit ? ["💰", "🪙", "✨", "🎉", "⭐"] : ["💸", "·"])[i % (profit ? 5 : 2)],
        };
      }),
    [big, profit]
  );

  const confetti = useMemo(
    () =>
      big
        ? Array.from({ length: 90 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            delay: Math.random() * 900,
            dur: 1600 + Math.random() * 1600,
            rot: Math.random() * 720 - 360,
            color: COLORS[i % COLORS.length],
            w: 6 + Math.random() * 6,
            h: 10 + Math.random() * 10,
          }))
        : [],
    [big]
  );

  useEffect(() => {
    const t = setTimeout(onDone, big ? 2800 : 1700);
    return () => clearTimeout(t);
  }, [onDone, big]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden">
      <style>{`
        @keyframes sale-card {
          0%   { transform: scale(.3) rotateY(-90deg); opacity: 0; }
          22%  { transform: scale(1.12) rotateY(10deg); opacity: 1; }
          38%  { transform: scale(1) rotateY(0deg); }
          78%  { transform: scale(1) translateY(0); opacity: 1; }
          100% { transform: scale(.55) translateY(-30vh); opacity: 0; }
        }
        @keyframes sale-particle {
          0%   { transform: translate(0,0) scale(.2); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(1) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes sale-badge {
          0%   { transform: translateY(16px) scale(.7); opacity: 0; }
          30%  { transform: translateY(0) scale(1.05); opacity: 1; }
          45%  { transform: scale(1); }
          85%  { opacity: 1; }
          100% { transform: translateY(-8px) scale(.96); opacity: 0; }
        }
        @keyframes sale-glow {
          0%,100% { opacity: 0; transform: scale(.6); }
          40%     { opacity: .5; transform: scale(1.8); }
        }
        @keyframes sale-confetti {
          0%   { transform: translateY(-12vh) rotate(0deg); opacity: 0; }
          8%   { opacity: 1; }
          100% { transform: translateY(115vh) rotate(var(--rot)); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sale-anim { animation-duration: .01ms !important; }
        }
      `}</style>

      {confetti.map((c) => (
        <span
          key={c.id}
          className="sale-anim absolute top-0 rounded-[2px]"
          style={{
            left: `${c.x}vw`,
            width: c.w,
            height: c.h,
            background: c.color,
            "--rot": `${c.rot}deg`,
            animation: `sale-confetti ${c.dur}ms linear ${c.delay}ms forwards`,
          }}
        />
      ))}

      <div className="relative flex flex-col items-center">
        {big && (
          <div
            className="sale-anim absolute rounded-full"
            style={{
              width: 220,
              height: 220,
              background: "var(--mint)",
              animation: "sale-glow 1s ease-out forwards",
            }}
          />
        )}

        {burst.map((p) => (
          <span
            key={p.id}
            className="sale-anim absolute text-xl select-none"
            style={{
              "--tx": `${p.tx}px`,
              "--ty": `${p.ty}px`,
              "--rot": `${p.rot}deg`,
              animation: `sale-particle ${big ? 1.2 : 1}s ease-out ${p.delay}ms forwards`,
            }}
          >
            {p.glyph}
          </span>
        ))}

        <img
          src={card.image_large ?? card.image_small}
          alt=""
          className="sale-anim w-40 rounded-2xl shadow-2xl"
          style={{ animation: `sale-card ${big ? 2.8 : 1.7}s cubic-bezier(.2,.8,.2,1) forwards` }}
        />

        <div
          className={`sale-anim mt-5 rounded-full px-5 py-2.5 shadow-lg text-center ${
            big
              ? "bg-mint text-white text-base font-semibold"
              : "bg-surface border border-line text-sm font-medium"
          }`}
          style={{ animation: `sale-badge ${big ? 2.6 : 1.5}s ease-out forwards` }}
        >
          {big ? (
            <>
              🎉 Fetter Gewinn! 🎉
              <div className="text-sm font-normal mt-0.5">
                +{eur(realized)} · +{pct.toFixed(0)} %
              </div>
            </>
          ) : !hasCost ? (
            <>
              Verkauft <span className="text-subtle">für {eur(proceeds ?? realized)}</span>
            </>
          ) : profit ? (
            <>
              Verkauft <span className="text-mint">+{eur(realized)} (+{pct.toFixed(0)} %)</span>
            </>
          ) : (
            <>
              Verkauft <span className="text-rose">−{eur(realized)} ({pct.toFixed(0)} %)</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
