// Kleine Linien-Symbole als Vektorgrafik (statt Emojis). Übernehmen die
// Textfarbe (currentColor) und skalieren per className, z. B. "w-5 h-5".
const PATHS = {
  box: (
    <>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
      <path d="M3.3 8L12 13l8.7-5" />
      <path d="M12 13v8" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  euro: (
    <>
      <path d="M17.5 6.2A7.5 7.5 0 1 0 17.5 17.8" />
      <path d="M4 10.5h9M4 13.5h9" />
    </>
  ),
  trend: (
    <>
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="15 7 21 7 21 13" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  import: (
    <>
      <path d="M12 3v12" />
      <polyline points="7 10.5 12 15.5 17 10.5" />
      <path d="M4 20h16" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.2" y2="16.2" />
    </>
  ),
  chart: (
    <>
      <line x1="6" y1="20" x2="6" y2="13" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="18" y1="20" x2="18" y2="9" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1.2 12H6.2z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="M8.6 14.2 7 21.5l5-3 5 3-1.6-7.3" />
    </>
  ),
  heart: <path d="M12 20.5s-7.5-4.6-9.3-9.6A5 5 0 0 1 12 7.6a5 5 0 0 1 9.3 3.3C19.5 15.9 12 20.5 12 20.5z" />,
};

export default function Icon({ name, className = "w-5 h-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
