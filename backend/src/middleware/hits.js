import db from "../db/index.js";

const bump = db.prepare(`
  INSERT INTO daily_hits (day, path, hits) VALUES (?, ?, 1)
  ON CONFLICT(day, path) DO UPDATE SET hits = hits + 1
`);

const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

// Dynamische ID-Segmente zusammenfassen, damit "Top-Seiten" nicht in
// tausend Einzel-URLs zerfallen.
function normalize(path) {
  return path
    .replace(/\/card\/[^/]+/, "/card/:id")
    .replace(/\/sets\/[^/]+/, "/sets/:id")
    .replace(/\/database\/[^/]+/, "/database/:id")
    .slice(0, 120);
}

// Zählt echte Seitenaufrufe: GET, kein /api, keine Datei (kein Punkt im
// letzten Segment). Speichert nur einen Zähler pro Tag/Pfad – keine IP.
export function countPageView(req, _res, next) {
  try {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      const last = req.path.split("/").pop() || "";
      if (!last.includes(".")) bump.run(localDay(), normalize(req.path));
    }
  } catch {
    /* Zählung darf nie einen Request stören */
  }
  next();
}
