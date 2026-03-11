import { useEffect, useRef } from "react";
import { useSettings } from "../../context/SettingsContext";
import { AppSettings, DEFAULT_SETTINGS, THEME_OPTIONS } from "../../types/settings";
import { X } from "lucide-react";

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
          <div className="settings-title-wrap">
            <span className="settings-title">Settings</span>
            <span className="settings-subtitle">Personalize appearance and repository behavior</span>
          </div>
          <button className="settings-close" onClick={onClose} title="Close">
            <X size={15} />
          </button>
        </div>

        <div className="settings-body">
          <div className="settings-layout">
          {/* Appearance */}
          <section className="settings-section settings-section-appearance">
            <h3 className="settings-section-title">Appearance</h3>

            <div className="settings-row">
              <label className="settings-label settings-label-stack">
                <span>Theme</span>
                <span className="settings-hint">Choose from 10 built-in themes</span>
              </label>
              <div className="settings-control settings-control-grow">
                <div className="settings-theme-grid" role="radiogroup" aria-label="Theme selection">
                  {THEME_OPTIONS.map((theme) => {
                    const selected = settings.theme === theme.value;
                    return (
                      <button
                        key={theme.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`settings-theme-card${selected ? " selected" : ""}`}
                        onClick={() => field("theme", theme.value)}
                        title={theme.description}
                      >
                        <span
                          className="settings-theme-swatch"
                          data-theme-preview={theme.value}
                          aria-hidden="true"
                        />
                        <span className="settings-theme-meta">
                          <span className="settings-theme-name">{theme.label}</span>
                          <span className="settings-theme-description">{theme.description}</span>
                        </span>
                        {theme.highContrast ? (
                          <span className="settings-theme-badge">HC</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
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

          <section className="settings-section settings-section-workspace">
            <h3 className="settings-section-title">Workspace</h3>

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
        </div>

        <div className="settings-footer">
          <span className="settings-saved-label">Changes save automatically</span>
          <div className="settings-footer-actions">
            <button className="settings-reset-btn" onClick={() => updateSettings(DEFAULT_SETTINGS)}>
              Reset
            </button>
            <button className="settings-done-btn" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
