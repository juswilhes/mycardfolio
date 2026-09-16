import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
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
      "/api": "http://localhost:3001",
    },
  },
});
