// Wortmarke + Icon als Inline-SVG, damit es in Hell-/Dunkelmodus mitgeht:
// "my"/"card" nutzen currentColor (= var(--ink) über die Wrapper-Klasse),
// das Icon ist eine in sich geschlossene gelbe Karte und funktioniert auf
// jedem Hintergrund.
export default function Logo({ className = "h-8" }) {
  return (
    <svg
      className={`${className} w-auto text-ink`}
      viewBox="0 0 760 220"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="mycardfolio"
    >
      <g>
        <rect
          x="30" y="26" width="118" height="164" rx="24"
          transform="rotate(9 89 108)"
          fill="none" stroke="#241c15" strokeWidth="7"
        />
        <rect
          x="14" y="34" width="118" height="164" rx="24"
          fill="#f8c93a" stroke="#241c15" strokeWidth="7"
        />
        <polyline
          points="38,150 62,120 82,134 108,90"
          fill="none" stroke="#241c15" strokeWidth="7"
          strokeLinecap="round" strokeLinejoin="round"
        />
      </g>

      <text x="200" y="132" fontFamily="'Poppins','Arial',sans-serif" fontWeight="700" fontSize="72" fill="currentColor">my</text>
      <text x="290" y="132" fontFamily="'Poppins','Arial',sans-serif" fontWeight="800" fontSize="72" fill="currentColor">card</text>
      <text x="490" y="132" fontFamily="'Poppins','Arial',sans-serif" fontWeight="800" fontSize="72" fill="#e0af1a">folio</text>
      <rect x="490" y="150" width="196" height="10" rx="5" fill="#f8c93a" />
    </svg>
  );
}
