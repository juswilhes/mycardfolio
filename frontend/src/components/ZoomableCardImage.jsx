import { useEffect, useState } from "react";

// Kartenbild, das per Klick als Großansicht (Lightbox) aufgeht - damit man
// Details, Zustand und Text einer Karte genau ansehen kann. Schließen per
// Klick daneben, auf das Bild, den Schließen-Button oder Escape.
export default function ZoomableCardImage({ src, largeSrc, alt, className = "" }) {
  const [open, setOpen] = useState(false);

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
        className="relative shrink-0 self-start cursor-zoom-in group"
      >
        <img src={src} alt={alt} className={className} />
        <span className="absolute bottom-2 right-2 bg-ink/70 text-canvas text-xs rounded-full w-7 h-7 flex items-center justify-center opacity-80 group-hover:opacity-100">
          🔍
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
