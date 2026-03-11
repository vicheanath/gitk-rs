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
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog info-dialog" onClick={(event) => event.stopPropagation()}>
        <h2>Keyboard Shortcuts</h2>
        <div className="shortcuts-list">
          {shortcuts.map((shortcut) => (
            <div key={`${shortcut.keys.join("-")}-${shortcut.description}`} className="shortcuts-row">
              <div className="shortcuts-keys">
                {shortcut.keys.map((key) => (
                  <kbd key={key} className="shortcuts-key">
                    {key}
                  </kbd>
                ))}
              </div>
              <div className="shortcuts-description">{shortcut.description}</div>
            </div>
          ))}
        </div>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
