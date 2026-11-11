import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";

// Kartenbild, das per Klick als Großansicht (Lightbox) aufgeht - damit man
// Details, Zustand und Text einer Karte genau ansehen kann. Schließen per
// Klick daneben, auf das Bild, den Schließen-Button oder Escape.
export default function ZoomableCardImage({ src, largeSrc, alt, className = "" }) {
  const [open, setOpen] = useState(false);
  // Neigung zur Maus + Lichtreflex (Justus 11.11.2026, Glas & Glanz): nur mit Maus und ohne "weniger Bewegung".
  // Die Werte gehen direkt als CSS-Variablen ans Element (kein React-Render je Mausbewegung).
  const tiltRef = useRef(null);
  const canTilt = typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (prefers-reduced-motion: no-preference)").matches;
  function onTilt(e) {
    const el = tiltRef.current;
    if (!el || !canTilt) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${((x - 0.5) * 14).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${((0.5 - y) * 12).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    el.classList.add("is-tilting");
  }
  function endTilt() {
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.classList.remove("is-tilting");
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${alt} vergrößern`}
        ref={tiltRef}
        onPointerMove={onTilt}
        onPointerLeave={endTilt}
        className="relative shrink-0 self-start cursor-zoom-in group card-tilt"
      >
        <img src={src} alt={alt} className={className} />
        <span aria-hidden="true" className="card-holo" />
        <span aria-hidden="true" className="card-glare" />
        <span className="absolute bottom-2 right-2 bg-ink/70 text-canvas text-xs rounded-full w-7 h-7 flex items-center justify-center opacity-80 group-hover:opacity-100">
          <Icon name="search" className="w-4 h-4" />
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 cursor-zoom-out"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-label={alt}
        >
          <img
            src={largeSrc ?? src}
            alt={alt}
            className="max-h-[92vh] max-w-[92vw] object-contain rounded-2xl shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Schließen"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white text-xl hover:bg-white/25"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
