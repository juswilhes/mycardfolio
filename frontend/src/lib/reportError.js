// Meldet einen unbehandelten Fehler ans Backend (client_errors-Tabelle),
// damit ein Fehler, den nur eine einzelne Nutzerin sieht, nicht nur über
// eine mündliche Beschreibung diagnostizierbar ist. Darf selbst nie
// zusätzliche Fehler werfen oder die Seite verlangsamen.
export function reportError(error, extra = {}) {
  try {
    const body = JSON.stringify({
      message: String(error?.message ?? error ?? "Unbekannter Fehler"),
      stack: String(error?.stack ?? ""),
      url: window.location.href,
      ...extra,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/client-error", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* egal - Fehlermeldung darf nie selbst crashen */
  }
}
