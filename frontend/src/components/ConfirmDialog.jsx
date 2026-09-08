import { useEffect } from "react";

// Kleiner Bestätigungsdialog (Ja/Nein). Wird z. B. beim Abmelden genutzt.
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Ja",
  cancelLabel = "Abbrechen",
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xs bg-surface border border-line rounded-3xl p-6 shadow-xl">
        <p className="font-semibold mb-1">{title}</p>
        {message && <p className="text-subtle text-sm mb-5">{message}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-line rounded-full py-2.5 text-sm hover:border-ink"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 rounded-full py-2.5 text-sm font-medium disabled:opacity-60 ${
              danger ? "bg-rose text-white" : "bg-yellow text-yellowInk"
            }`}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
