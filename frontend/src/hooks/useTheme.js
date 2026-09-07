import { useEffect, useState } from "react";

const STORAGE_KEY = "mycardfolio-theme";

// Beim allerersten Laden: Falls der Nutzer schon mal gewaehlt hat,
// diese Wahl nutzen. Sonst der Systemeinstellung des Geraets folgen.
function getInitialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  // Jedes Mal, wenn sich "theme" aendert: Klasse "dark" an/aus auf <html>
  // schalten (davon liest tailwind.config.js -> alle Farben passen sich an)
  // und die Wahl merken, damit sie beim naechsten Besuch erhalten bleibt.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  return { theme, toggleTheme, isDark: theme === "dark" };
}
