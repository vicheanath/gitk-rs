import { useEffect, useRef } from "react";
import { useSettings } from "../../context/SettingsContext";
import { AppSettings } from "../../types/settings";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { settings, updateSettings } = useSettings();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Close when clicking the backdrop
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  if (!open) return null;

  function field<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) {
    updateSettings({ [key]: value } as Partial<AppSettings>);
  }

  return (
    <div className="settings-overlay" onMouseDown={handleBackdropClick}>
      <div className="settings-dialog" ref={dialogRef}>
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="settings-body">
          {/* Appearance */}
          <section className="settings-section">
            <h3 className="settings-section-title">Appearance</h3>

            <div className="settings-row">
              <label className="settings-label">Theme</label>
              <div className="settings-control">
                <select
                  className="settings-select"
                  value={settings.theme}
                  onChange={(e) =>
                    field("theme", e.target.value as AppSettings["theme"])
                  }
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>
            </div>

            <div className="settings-row">
              <label className="settings-label">Font size</label>
              <div className="settings-control">
                <select
                  className="settings-select"
                  value={settings.fontSize}
                  onChange={(e) =>
                    field(
                      "fontSize",
                      e.target.value as AppSettings["fontSize"]
                    )
                  }
                >
                  <option value="small">Small (11px)</option>
                  <option value="medium">Medium (13px)</option>
                  <option value="large">Large (15px)</option>
                </select>
              </div>
            </div>

            <div className="settings-row">
              <label className="settings-label">Date format</label>
              <div className="settings-control">
                <select
                  className="settings-select"
                  value={settings.dateFormat}
                  onChange={(e) =>
                    field(
                      "dateFormat",
                      e.target.value as AppSettings["dateFormat"]
                    )
                  }
                >
                  <option value="relative">Relative (e.g. 2 days ago)</option>
                  <option value="absolute">Absolute (ISO 8601)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Diff / Patch */}
          <section className="settings-section">
            <h3 className="settings-section-title">Diff / Patch</h3>

            <div className="settings-row">
              <label className="settings-label">Context lines</label>
              <div className="settings-control">
                <input
                  className="settings-number-input"
                  type="number"
                  min={0}
                  max={100}
                  value={settings.diffContextLines}
                  onChange={(e) =>
                    field("diffContextLines", Number(e.target.value))
                  }
                />
              </div>
            </div>

            <div className="settings-row">
              <label className="settings-label">Ignore whitespace</label>
              <div className="settings-control">
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={settings.diffIgnoreWhitespace}
                    onChange={(e) =>
                      field("diffIgnoreWhitespace", e.target.checked)
                    }
                  />
                  <span className="settings-toggle-track" />
                </label>
              </div>
            </div>
          </section>

          {/* Performance */}
          <section className="settings-section">
            <h3 className="settings-section-title">Performance</h3>

            <div className="settings-row">
              <label className="settings-label">Max commits to load</label>
              <div className="settings-control">
                <select
                  className="settings-select"
                  value={settings.maxCommits}
                  onChange={(e) =>
                    field(
                      "maxCommits",
                      Number(e.target.value) as AppSettings["maxCommits"]
                    )
                  }
                >
                  <option value={500}>500</option>
                  <option value={1000}>1 000</option>
                  <option value={2000}>2 000</option>
                  <option value={5000}>5 000</option>
                </select>
                <span className="settings-hint">
                  Takes effect on next repository open
                </span>
              </div>
            </div>
          </section>
        </div>

        <div className="settings-footer">
          <span className="settings-saved-label">Changes save automatically</span>
          <button className="settings-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
