/** @type {import('tailwindcss').Config} */
export default {
  // "class" bedeutet: Dark Mode wird aktiv, sobald <html> die Klasse
  // "dark" traegt (siehe hooks/useTheme.js) - nicht automatisch nur
  // nach Systemeinstellung.
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Jede Farbe zeigt auf eine CSS-Variable aus index.css.
        // Klassen wie "bg-canvas" oder "text-ink" bleiben im Code gleich,
        // liefern aber je nach Modus einen anderen tatsaechlichen Wert.
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        line: "var(--line)",
        ink: "var(--ink)",
        subtle: "var(--subtle)",
        yellow: "var(--yellow)",
        yellowInk: "var(--yellow-ink)",
        mint: "var(--mint)",
        rose: "var(--rose)",
      },
      fontFamily: {
        sans: ["'Poppins'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
