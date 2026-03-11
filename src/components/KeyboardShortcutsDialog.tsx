const shortcuts = [
  { keys: ["Up", "Down"], description: "Navigate commits" },
  { keys: ["/"], description: "Focus search" },
  { keys: ["B"], description: "Toggle sidebar" },
  { keys: ["Cmd/Ctrl + O"], description: "Open repository" },
  { keys: ["Cmd/Ctrl + R"], description: "Reload graph" },
  { keys: ["Cmd/Ctrl + F"], description: "Focus search from native menu" },
  { keys: ["Cmd/Ctrl + ,"], description: "Open settings" },
];

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsDialog({
  open,
  onClose,
}: KeyboardShortcutsDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/55" onClick={onClose}>
      <div className="w-[min(620px,94vw)] rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <h2 className="mb-3 text-base font-semibold text-[var(--text-primary)]">Keyboard Shortcuts</h2>
        <div className="mb-4 flex flex-col gap-2">
          {shortcuts.map((shortcut) => (
            <div key={`${shortcut.keys.join("-")}-${shortcut.description}`} className="grid grid-cols-[minmax(180px,220px)_1fr] items-center gap-3 max-[680px]:grid-cols-1">
              <div className="flex flex-wrap gap-1.5">
                {shortcut.keys.map((key) => (
                  <kbd key={key} className="inline-flex min-h-7 items-center justify-center rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 text-xs text-[var(--text-primary)]">
                    {key}
                  </kbd>
                ))}
              </div>
              <div className="text-sm text-[var(--text-secondary)]">{shortcut.description}</div>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="rounded border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-1.5 text-sm text-[var(--text-primary)] transition hover:border-[color-mix(in_srgb,var(--accent)_50%,var(--border-color))]">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
