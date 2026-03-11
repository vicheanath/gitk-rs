import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "../../context/SettingsContext";
import { AppSettings, DEFAULT_SETTINGS, THEME_OPTIONS } from "../../types/settings";
import {
  AuthConnection,
  AuthConnectionInput,
  GitProvider,
  PROVIDER_PRESETS,
} from "../../types/auth";
import { X } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { settings, updateSettings } = useSettings();
  const dialogRef = useRef<HTMLDivElement>(null);
  const selectedTheme =
    THEME_OPTIONS.find((theme) => theme.value === settings.theme) ?? THEME_OPTIONS[0];
  const [provider, setProvider] = useState<GitProvider>("github");
  const [host, setHost] = useState("github.com");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [token, setToken] = useState("");
  const [scopes, setScopes] = useState("");
  const [connections, setConnections] = useState<AuthConnection[]>([]);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const isTauri =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  const providerPreset = useMemo(
    () =>
      PROVIDER_PRESETS.find((item) => item.provider === provider) ??
      PROVIDER_PRESETS[0],
    [provider]
  );

  const loadConnections = async () => {
    if (!isTauri) {
      setConnections([]);
      return;
    }

    try {
      const result = await invoke<AuthConnection[]>("list_git_auth_connections");
      setConnections(result);
      setAuthError(null);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadConnections();
  }, [open]);

  useEffect(() => {
    setHost(providerPreset.defaultHost);
    setDisplayName(providerPreset.label);
  }, [providerPreset.defaultHost, providerPreset.label]);

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

  const handleConnect = async () => {
    if (!isTauri) {
      setAuthError("Provider authentication is available in the desktop app only.");
      return;
    }

    if (!token.trim()) {
      setAuthError("Token is required.");
      return;
    }

    if (!displayName.trim()) {
      setAuthError("Display name is required.");
      return;
    }

    setAuthBusy(true);
    setAuthError(null);
    try {
      const payload: AuthConnectionInput = {
        provider,
        host: host.trim(),
        username: username.trim() || undefined,
        display_name: displayName.trim(),
        token: token.trim(),
        scopes: scopes
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };
      await invoke<AuthConnection>("upsert_git_auth_connection", { input: payload });
      setToken("");
      await loadConnections();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!isTauri) return;

    setAuthBusy(true);
    setAuthError(null);
    try {
      await invoke("remove_git_auth_connection", { connectionId });
      await loadConnections();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    } finally {
      setAuthBusy(false);
    }
  };

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

            <div className="settings-row settings-theme-row">
              <label className="settings-label settings-label-stack">
                <span>Theme</span>
                <span className="settings-hint">Choose from 10 built-in themes</span>
              </label>
              <div className="settings-control settings-control-grow">
                <div className="settings-theme-toolbar">
                  <div className="settings-theme-current">
                    <span
                      className="settings-theme-current-swatch"
                      data-theme-preview={selectedTheme.value}
                      aria-hidden="true"
                    />
                    <span className="settings-theme-current-meta">
                      <span className="settings-theme-current-label">Current</span>
                      <span className="settings-theme-current-name">{selectedTheme.label}</span>
                      <span className="settings-theme-current-description">{selectedTheme.description}</span>
                    </span>
                  </div>
                  <span className="settings-theme-count">{THEME_OPTIONS.length} themes</span>
                </div>
                <select
                  className="settings-select settings-theme-select"
                  value={settings.theme}
                  onChange={(e) => field("theme", e.target.value as AppSettings["theme"])}
                  aria-label="Theme selection"
                >
                  {THEME_OPTIONS.map((theme) => (
                    <option key={theme.value} value={theme.value}>
                      {theme.highContrast ? `[HC] ${theme.label}` : theme.label}
                    </option>
                  ))}
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

          <section className="settings-section settings-section-auth">
            <h3 className="settings-section-title">Git Accounts</h3>

            <div className="settings-row">
              <label className="settings-label">Provider</label>
              <div className="settings-control settings-control-grow">
                <select
                  className="settings-select"
                  value={provider}
                  onChange={(event) => setProvider(event.target.value as GitProvider)}
                >
                  {PROVIDER_PRESETS.map((item) => (
                    <option key={item.provider} value={item.provider}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="settings-row">
              <label className="settings-label">Host</label>
              <div className="settings-control settings-control-grow">
                <input
                  className="settings-text-input"
                  value={host}
                  onChange={(event) => setHost(event.target.value)}
                  placeholder={providerPreset.defaultHost}
                />
              </div>
            </div>

            <div className="settings-row">
              <label className="settings-label">Username (optional)</label>
              <div className="settings-control settings-control-grow">
                <input
                  className="settings-text-input"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="username"
                />
              </div>
            </div>

            <div className="settings-row">
              <label className="settings-label">Display name</label>
              <div className="settings-control settings-control-grow">
                <input
                  className="settings-text-input"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Work account"
                />
              </div>
            </div>

            <div className="settings-row">
              <label className="settings-label">{providerPreset.tokenLabel}</label>
              <div className="settings-control settings-control-grow">
                <input
                  className="settings-text-input"
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="Paste token"
                />
              </div>
            </div>

            <div className="settings-row">
              <label className="settings-label">Scopes (optional)</label>
              <div className="settings-control settings-control-grow">
                <input
                  className="settings-text-input"
                  value={scopes}
                  onChange={(event) => setScopes(event.target.value)}
                  placeholder="repo, read_api, code"
                />
                <a className="settings-link" href={providerPreset.docsUrl} target="_blank" rel="noreferrer">
                  Token docs
                </a>
              </div>
            </div>

            <div className="settings-auth-actions">
              <button
                className="settings-connect-btn"
                type="button"
                onClick={() => void handleConnect()}
                disabled={authBusy}
              >
                Connect
              </button>
            </div>

            {authError ? <div className="settings-auth-error">{authError}</div> : null}

            <div className="settings-auth-list">
              {connections.length === 0 ? (
                <div className="settings-auth-empty">No connected providers yet.</div>
              ) : (
                connections.map((connection) => (
                  <div key={connection.id} className="settings-auth-item">
                    <div>
                      <div className="settings-auth-title">{connection.display_name}</div>
                      <div className="settings-auth-meta">
                        {connection.provider} • {connection.host}
                        {connection.username ? ` • ${connection.username}` : ""}
                      </div>
                    </div>
                    <button
                      className="settings-auth-remove-btn"
                      type="button"
                      onClick={() => void handleDisconnect(connection.id)}
                      disabled={authBusy}
                    >
                      Disconnect
                    </button>
                  </div>
                ))
              )}
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
