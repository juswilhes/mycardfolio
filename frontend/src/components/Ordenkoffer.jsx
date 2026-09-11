// Der "Ordenkoffer" als aufgeklapptes Etui, angelehnt an die Arenaorden-Box
// aus den Spielen: dunkle Schale, Scharnier-Linie oben, innen ein helles
// Fach für den Inhalt, unten ein facettierter Steinmuster-Streifen. Feste
// Farben unabhängig vom Hell-/Dunkelmodus - ein Etui sieht in beiden Modi
// gleich aus.
export default function Ordenkoffer({ children }) {
  return (
    <div
      className="rounded-2xl mt-4 mb-6 shadow-lg"
      style={{ background: "#0e0f12", border: "3px solid #050506", padding: 6 }}
    >
      <div className="rounded-xl" style={{ background: "#2a2c31", padding: "14px 14px 10px" }}>
        <div
          className="rounded-lg px-4 sm:px-5 py-4"
          style={{ background: "#45484e", boxShadow: "inset 0 3px 12px rgba(0,0,0,.55)" }}
        >
          {children}
        </div>

        {/* facettierter Steinstreifen wie am unteren Rand des Vorbilds */}
        <div
          className="mt-2.5 rounded"
          style={{
            height: 14,
            background:
              "repeating-linear-gradient(115deg, #7a7d84 0 10px, #5b5e64 10px 20px, #86898f 20px 30px)",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,.4)",
          }}
        />
      </div>
    </div>
  );
}
