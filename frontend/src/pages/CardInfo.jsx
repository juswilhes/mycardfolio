import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getCardInfo, addToCollection } from "../api.js";

// Route: /database/:externalId
// Zeigt alle bekannten Infos zu EINER Karte. Die Stammdaten (Illustrator,
// Attacken, Schwächen, Flavor-Text, ...) kommen aus der lokalen DB und sind
// daher sofort da; nur die Preise werden noch live nachgeladen.
export default function CardInfo() {
  const { externalId } = useParams();
  const [card, setCard] = useState(null);
  const [error, setError] = useState(false);
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setCard(null);
    setError(false);
    getCardInfo(externalId).then(setCard).catch(() => setError(true));
  }, [externalId]);

  async function handleAdd() {
    setAdding(true);
    try {
      await addToCollection({ externalId, quantity: 1 });
      navigate("/");
    } finally {
      setAdding(false);
    }
  }

  if (error) return <p className="text-rose text-sm">Karteninfo konnte nicht geladen werden.</p>;
  if (!card) return <p className="text-subtle text-sm">Lade Kartendetails …</p>;

  const typeLine = [card.supertype, ...(card.subtypes ?? [])].filter(Boolean).join(" · ");

  const facts = [
    ["Illustrator", card.artist],
    ["Seltenheit", card.rarity],
    ["HP", card.hp],
    ["Typ", (card.types ?? []).join(", ")],
    ["Set", card.set_name],
    ["Nummer", card.number ? `#${card.number}` : null],
    ["Pokédex-Nr.", (card.national_pokedex ?? []).join(", ")],
    ["Entwickelt sich aus", card.evolves_from],
    ["Schwäche", (card.weaknesses ?? []).map((w) => `${w.type} ${w.value}`).join(", ")],
    ["Resistenz", (card.resistances ?? []).map((r) => `${r.type} ${r.value}`).join(", ")],
    ["Rückzugskosten", (card.retreat_cost ?? []).length ? `${card.retreat_cost.length}` : null],
    ["Regulierung", card.regulation_mark],
  ].filter(([, v]) => v);

  return (
    <div>
      <Link to="/sets" className="text-sm text-subtle hover:text-ink">
        ← Zur Kartendatenbank
      </Link>

      <div className="flex flex-col sm:flex-row gap-6 mt-4 mb-8">
        <img
          src={card.image_large ?? card.image_small}
          alt={`${card.name} (Englisch)`}
          className="w-52 rounded-2xl shrink-0 self-start shadow-sm"
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{card.name}</h1>
          {typeLine && <p className="text-subtle text-sm mt-1">{typeLine}</p>}
          <p className="text-subtle text-sm">
            {card.set_name}
            {card.number ? ` · #${card.number}` : ""}
          </p>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="mt-4 bg-yellow text-yellowInk font-medium px-4 py-2 rounded-full text-sm disabled:opacity-60"
          >
            {adding ? "Wird hinzugefügt …" : "+ Zum Portfolio hinzufügen"}
          </button>
        </div>
      </div>

      {/* Steckbrief */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 mb-8">
        {facts.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-subtle">{label}</p>
            <p className="text-sm">{value}</p>
          </div>
        ))}
      </div>

      {/* Fähigkeiten */}
      {(card.abilities ?? []).length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm text-subtle mb-3">Fähigkeiten</h2>
          {card.abilities.map((a, i) => (
            <div key={i} className="border-t border-line py-3">
              <p className="text-sm font-medium">
                {a.name}
                {a.type && a.type !== "Ability" ? (
                  <span className="text-subtle font-normal"> · {a.type}</span>
                ) : null}
              </p>
              {a.text && <p className="text-sm text-subtle mt-1">{a.text}</p>}
            </div>
          ))}
        </section>
      )}

      {/* Attacken */}
      {(card.attacks ?? []).length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm text-subtle mb-3">Attacken</h2>
          {card.attacks.map((atk, i) => (
            <div key={i} className="border-t border-line py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium flex items-center flex-wrap gap-1.5">
                  {(atk.cost ?? []).map((c, j) => (
                    <span
                      key={j}
                      className="inline-block text-[10px] leading-none uppercase tracking-wide bg-canvas border border-line rounded-full px-1.5 py-1 text-subtle font-normal"
                    >
                      {c}
                    </span>
                  ))}
                  <span className="ml-0.5">{atk.name}</span>
                </p>
                {atk.damage && <span className="text-sm font-mono shrink-0">{atk.damage}</span>}
              </div>
              {atk.text && <p className="text-sm text-subtle mt-1">{atk.text}</p>}
            </div>
          ))}
        </section>
      )}

      {/* Regeltext / Flavor */}
      {(card.rules ?? []).length > 0 && (
        <section className="mb-8 border-t border-line pt-3">
          {card.rules.map((r, i) => (
            <p key={i} className="text-sm text-subtle mb-2">{r}</p>
          ))}
        </section>
      )}
      {card.flavor_text && (
        <p className="text-sm italic text-subtle border-l-2 border-line pl-3 mb-8">
          {card.flavor_text}
        </p>
      )}

      {/* Preise */}
      <h2 className="text-sm text-subtle mb-2">Aktuelle Preise</h2>
      {(card.prices ?? []).length === 0 ? (
        <p className="text-subtle text-sm">Für diese Karte liegen aktuell keine Preisdaten vor.</p>
      ) : (
        <div className="border-t border-line">
          {card.prices.map((p, i) => (
            <div key={i} className="flex justify-between py-3 border-b border-line text-sm">
              <span className="text-subtle">
                {p.source} · {p.price_type}
              </span>
              <span className="font-mono">
                {p.price.toFixed(2)} {p.currency}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
