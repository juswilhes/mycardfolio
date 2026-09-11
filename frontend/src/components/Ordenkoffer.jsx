// Der "Ordenkoffer" als echter kleiner Reisekoffer: Griff oben, zwei
// Schnallen, Eckbeschläge, innen eine helle Stoff-Auskleidung für den
// Inhalt (Fortschritt + Orden-Raster). Feste Koffer-Farben unabhängig vom
// Hell-/Dunkelmodus - ein Koffer sieht in beiden Modi gleich aus.
export default function Ordenkoffer({ children }) {
  return (
    <div className="relative mt-6 mb-6">
      {/* Griff */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -top-[22px]"
        style={{
          width: 84,
          height: 24,
          borderRadius: "16px 16px 0 0",
          border: "7px solid #5b3a22",
          borderBottom: "none",
        }}
      />

      <div
        className="relative rounded-[28px] border-4 pt-8 pb-5 px-4 sm:px-6 shadow-lg"
        style={{
          background: "linear-gradient(155deg, #cf9a66 0%, #ac6f3f 55%, #8f5730 100%)",
          borderColor: "#5b3a22",
        }}
      >
        {/* Schnallen */}
        <div
          className="absolute top-[10px] left-[30%] -translate-x-1/2"
          style={{ width: 22, height: 15, borderRadius: 4, background: "#e8c766", border: "2px solid #8a6a1f" }}
        />
        <div
          className="absolute top-[10px] right-[30%] translate-x-1/2"
          style={{ width: 22, height: 15, borderRadius: 4, background: "#e8c766", border: "2px solid #8a6a1f" }}
        />

        {/* Eckbeschläge */}
        {[
          { top: 8, left: 8 },
          { top: 8, right: 8 },
          { bottom: 8, left: 8 },
          { bottom: 8, right: 8 },
        ].map((pos, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full"
            style={{ ...pos, background: "#5b3a22", boxShadow: "inset 0 0 0 1.5px #3d2716" }}
          />
        ))}

        {/* Innenauskleidung */}
        <div
          className="rounded-2xl px-4 sm:px-5 py-4"
          style={{ background: "#f4e9d4", boxShadow: "inset 0 2px 8px rgba(59,38,17,.35)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
