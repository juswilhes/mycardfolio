import {
  getSetValueAnalysis,
  getPullRateOverview,
  getPackValueAnalysis,
  getPullOrBuy,
  getMarketMovers,
  resetMoversCache,
  buildSetRanking,
  getSiteCounts,
} from "./marketStats.js";
import { listCardTypes } from "./cardRepository.js";

// Die Auswertungen der Analyse werden nicht bei jedem Seitenaufruf neu
// gerechnet, sondern einmal im Nachtlauf um 1 Uhr (nach den neuen Preisen,
// siehe priceFetcher.js) und danach nur ausgeliefert. Neu gerechnet wird
// außerdem beim Serverstart und sofort, wenn der Betreiber Preise oder Pull
// Rates ändert (sonst sähe er sein Speichern nicht). Eine neue Analyse
// trägt ihre Rechenfunktion einfach in BUILDERS ein.
const BUILDERS = {
  setValue: getSetValueAnalysis,
  pullRates: getPullRateOverview,
  packValue: getPackValueAnalysis,
  pullOrBuy: getPullOrBuy,
  siteCounts: getSiteCounts,
  cardTypes: listCardTypes,
};
// Setzt sich aus den Auswertungen oben zusammen (wird danach gerechnet).
const DERIVED = {
  setRanking: () => buildSetRanking(analysis("setValue"), analysis("pullRates"), analysis("packValue")),
};
const MOVER_DAYS = [7, 30, 120];

const cache = new Map();

export function rebuildAnalysisCache() {
  for (const [name, build] of Object.entries(BUILDERS)) {
    try {
      cache.set(name, build());
    } catch (e) {
      console.error(`[analyse] ${name} konnte nicht berechnet werden:`, e);
    }
  }
  for (const [name, build] of Object.entries(DERIVED)) {
    try {
      cache.set(name, build());
    } catch (e) {
      console.error(`[analyse] ${name} konnte nicht berechnet werden:`, e);
    }
  }
  resetMoversCache();
  for (const days of MOVER_DAYS) {
    try {
      getMarketMovers({ days });
    } catch (e) {
      console.error(`[analyse] Preisbewegungen (${days} Tage) fehlgeschlagen:`, e);
    }
  }
  console.log("[analyse] Auswertungen neu berechnet.");
}

// Liefert die gespeicherte Auswertung (beim ersten Zugriff ohne Stand wird sie
// einmal berechnet).
export function analysis(name) {
  if (!cache.has(name)) cache.set(name, (BUILDERS[name] ?? DERIVED[name])());
  return cache.get(name);
}
