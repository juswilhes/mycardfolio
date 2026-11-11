import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// "--mode live": das lokale Frontend holt seine Daten von der Live-Seite (nur lesen, ohne lokales Backend) -
// praktisch, um Design-Änderungen mit echten Daten anzusehen. Standard bleibt das lokale Backend.
export default defineConfig(({ mode }) => {
  const api = mode === "live" ? { target: "https://mycardfolio.de", changeOrigin: true } : "http://localhost:3001";
  return {
    plugins: [react()],
    // Source Maps im Produktions-Build: ohne die sind Fehlermeldungen aus dem
    // Browser nur minifizierte Funktionsnamen ("n is not a function") statt
    // echter Datei/Zeile - macht jeden client-seitigen Fehler unnötig schwer
    // zu diagnostizieren.
    build: {
      sourcemap: true,
    },
    server: {
      proxy: {
        "/api": api,
        "/uploads": api,
        "/img": api,
      },
    },
  };
});
