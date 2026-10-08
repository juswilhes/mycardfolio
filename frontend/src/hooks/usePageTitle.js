import { useEffect } from "react";

export const SITE_TITLE = "mycardfolio – Pokémon-Sammlung & Portfolio-Wert im Blick";

// Setzt den Browser-Tab-Titel (der Server liefert für Suchmaschinen schon den
// passenden Titel, das hier hält ihn beim Navigieren innerhalb der App aktuell).
export function usePageTitle(title) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}
