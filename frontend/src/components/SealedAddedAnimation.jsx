import { useEffect, useMemo, useRef } from "react";
import Icon from "./Icon.jsx";

// Feier-Animation, wenn ein Sealed-Produkt in die Sammlung kommt (Justus 09.11.2026: "eine andere Animation, die an
// Sealed erinnert"). Anders als bei Karten (Sprung + Emoji-Konfetti): die Box FÄLLT von oben, schlägt auf (Stauchen,
// Hüpfer, Druckwelle, Folien-Streifen wie von Booster-Verpackungen), wackelt kurz und ein Glanzstreifen läuft über
// die Verpackung (nur auf dem Produkt, per Maske) - dann fliegt sie zum Menüpunkt "Sammlung" und ruft onDone().
const FOIL = ["#f2b705", "#f4d35e", "#aab4c0", "#e8a838", "#5b8fd1", "#e5736b", "#4cb89a"];
const DURATION = 2100;

export default function SealedAddedAnimation({ name, image, onDone }) {
  const strips = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const side = i % 2 ? 1 : -1;
        return {
          id: i,
          tx: side * (30 + Math.random() * 190),
          ty: -(70 + Math.random() * 150), // erst hoch, fällt dann
          rot: (Math.random() * 2 - 1) * 540,
          delay: 300 + Math.random() * 90,
          color: FOIL[i % FOIL.length],
          w: 5 + Math.random() * 4,
          h: 12 + Math.random() * 9,
        };
      }),
    []
  );

  // Ziel = Mitte des Reiters "Sammlung" in der Kopfzeile, relativ zur Bildschirmmitte
  const target = useMemo(() => {
    const el = typeof document !== "undefined" && document.getElementById("nav-sammlung");
    if (!el) return { x: "0px", y: "-42vh" };
    const r = el.getBoundingClientRect();
    return {
      x: `${Math.round(r.left + r.width / 2 - window.innerWidth / 2)}px`,
      y: `${Math.round(r.top + r.height / 2 - window.innerHeight / 2)}px`,
    };
  }, []);

  // Timer nur einmal starten: die Seite rendert während der Animation neu (Daten laden nach), onDone ist dann
  // jedes Mal eine neue Funktion und würde den Timer sonst immer wieder zurücksetzen
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => doneRef.current?.(), DURATION);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes sa-box {
          0%   { transform: translate(0, -70vh) scale(1,1) rotate(-9deg); opacity: 0; }
          5%   { opacity: 1; }
          20%  { transform: translate(0, 0) scale(1,1) rotate(0deg); }
          24%  { transform: translate(0, 0) scale(1.14,.84) rotate(0deg); }
          31%  { transform: translate(0, -30px) scale(.96,1.06) rotate(0deg); }
          38%  { transform: translate(0, 0) scale(1.05,.95) rotate(0deg); }
          43%  { transform: translate(0, 0) scale(1,1) rotate(0deg); }
          49%  { transform: translate(0, 0) scale(1,1) rotate(-3.5deg); }
          55%  { transform: translate(0, 0) scale(1,1) rotate(3.5deg); }
          61%  { transform: translate(0, 0) scale(1,1) rotate(-2deg); }
          67%  { transform: translate(0, 0) scale(1,1) rotate(0deg); }
          80%  { transform: translate(0, 0) scale(1,1) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--sa-tx,-42vw), var(--sa-ty,-40vh)) scale(.1,.1) rotate(-8deg); opacity: 0; }
        }
        @keyframes sa-shadow {
          0%   { transform: scale(.2); opacity: 0; }
          20%  { transform: scale(1); opacity: .35; }
          24%  { transform: scale(1.25); opacity: .3; }
          80%  { transform: scale(1); opacity: .3; }
          100% { transform: scale(.4); opacity: 0; }
        }
        @keyframes sa-shock {
          0%   { transform: scale(.25,.25); opacity: 0; }
          10%  { opacity: .7; }
          100% { transform: scale(2.1,1.1); opacity: 0; }
        }
        @keyframes sa-strip {
          0%   { transform: translate(0,0) rotate(0deg); opacity: 0; }
          8%   { opacity: 1; }
          45%  { transform: translate(calc(var(--tx) * .8), var(--ty)) rotate(calc(var(--rot) * .5)); opacity: 1; }
          100% { transform: translate(var(--tx), calc(var(--ty) + 190px)) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes sa-shine {
          0%   { transform: translateX(-130%); }
          100% { transform: translateX(130%); }
        }
        @keyframes sa-badge {
          0%   { transform: translateY(14px) scale(.85); opacity: 0; }
          25%  { transform: translateY(0) scale(1); opacity: 1; }
          75%  { opacity: 1; }
          100% { transform: translateY(-6px) scale(.95); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sa-anim { animation-duration: .01ms !important; animation-delay: 0ms !important; }
        }
      `}</style>

      <div className="relative flex flex-col items-center">
        {/* Boden: Schatten unter der Box und die Druckwelle beim Aufprall */}
        <div
          className="sa-anim absolute rounded-full"
          style={{ width: 190, height: 26, bottom: 44, background: "var(--ink)", filter: "blur(8px)", animation: `sa-shadow ${DURATION}ms ease-out forwards` }}
        />
        <div
          className="sa-anim absolute rounded-full"
          style={{ width: 200, height: 34, bottom: 38, border: "3px solid var(--yellow)", animation: "sa-shock .75s ease-out .3s both" }}
        />

        {strips.map((s) => (
          <span
            key={s.id}
            className="sa-anim absolute"
            style={{
              "--tx": `${s.tx}px`,
              "--ty": `${s.ty}px`,
              "--rot": `${s.rot}deg`,
              top: "38%",
              width: s.w,
              height: s.h,
              borderRadius: 1.5,
              background: `linear-gradient(135deg, ${s.color}, ${s.color}b3)`,
              boxShadow: "0 0 0 .5px rgba(0,0,0,.15)",
              animation: `sa-strip 1.25s cubic-bezier(.2,.7,.3,1) ${s.delay}ms both`,
            }}
          />
        ))}

        <div
          className="sa-anim relative w-44 h-44"
          style={{
            "--sa-tx": target.x,
            "--sa-ty": target.y,
            transformOrigin: "50% 100%",
            animation: `sa-box ${DURATION}ms cubic-bezier(.3,.1,.3,1) forwards`,
          }}
        >
          {image ? (
            <>
              <img src={image} alt="" className="w-full h-full object-contain drop-shadow-2xl" />
              {/* Glanzstreifen, per Maske nur auf der Verpackung selbst (nicht auf dem Hintergrund) */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  WebkitMaskImage: `url(${JSON.stringify(image)})`,
                  maskImage: `url(${JSON.stringify(image)})`,
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                }}
              >
                <div
                  className="sa-anim absolute inset-y-0 w-1/2"
                  style={{
                    left: "25%",
                    background: "linear-gradient(105deg, transparent 20%, rgba(255,255,255,.85) 50%, transparent 80%)",
                    animation: "sa-shine .7s ease-in-out .95s both",
                  }}
                />
              </div>
            </>
          ) : (
            <span className="flex w-full h-full items-center justify-center rounded-3xl border border-line bg-surface shadow-2xl">
              <Icon name="box" className="w-20 h-20 text-ink" />
            </span>
          )}
        </div>

        <div
          className="sa-anim mt-6 bg-surface border border-line rounded-full px-4 py-2 text-sm font-medium shadow-lg max-w-[80vw] truncate"
          style={{ animation: "sa-badge 1.5s ease-out .45s both" }}
        >
          Sealed zur Sammlung hinzugefügt
        </div>
      </div>
    </div>
  );
}
