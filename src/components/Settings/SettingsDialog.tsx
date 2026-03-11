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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center overflow-hidden bg-black/60" onMouseDown={handleBackdropClick}>
      <div
        className="flex max-h-[calc(100vh-16px)] w-[min(900px,96vw)] flex-col overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl"
        ref={dialogRef}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">Settings</h1>
            <p className="text-sm text-[var(--text-secondary)]">Personalize appearance and repository behavior</p>
          </div>
          <button className="rounded-md border border-transparent p-1 text-[var(--text-secondary)] transition hover:border-[var(--border-color)] hover:text-[var(--danger)]" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
          {/* Appearance */}
          <section className="rounded-lg border border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-primary)_40%,transparent)]">
            <div className="border-b border-[var(--border-color)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Appearance</h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Customize your visual experience</p>
            </div>
            <div className="space-y-4 px-4 py-3">
              {/* Theme */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)]">Theme</label>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Choose from {THEME_OPTIONS.length} built-in themes</p>
                <div className="mt-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] p-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-6 w-10 shrink-0 rounded border border-white/20 settings-theme-current-swatch"
                      data-theme-preview={selectedTheme.value}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{selectedTheme.label}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{selectedTheme.description}</p>
                    </div>
                  </div>
                </div>
                <select
                  className="mt-2 w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] transition hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none"
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

              {/* Font Size */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)]">Font size</label>
                <select
                  className="mt-2 w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] transition hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none"
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

              {/* Date Format */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)]">Date format</label>
                <select
                  className="mt-2 w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] transition hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none"
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

          {/* Workspace */}
          <section className="rounded-lg border border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-primary)_40%,transparent)]">
            <div className="border-b border-[var(--border-color)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Workspace</h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Repository and diff viewer settings</p>
            </div>
            <div className="space-y-4 px-4 py-3">
              {/* Context Lines */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)]">Context lines in diffs</label>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Number of unchanged lines shown around changes</p>
                <input
                  className="mt-2 w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] transition hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none"
                  type="number"
                  min={0}
                  max={100}
                  value={settings.diffContextLines}
                  onChange={(e) =>
                    field("diffContextLines", Number(e.target.value))
                  }
                />
              </div>

              {/* Ignore Whitespace */}
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer rounded border border-[var(--border-color)] bg-[var(--bg-primary)] accent-[var(--accent)]"
                    checked={settings.diffIgnoreWhitespace}
                    onChange={(e) =>
                      field("diffIgnoreWhitespace", e.target.checked)
                    }
                  />
                  <span className="text-sm font-medium text-[var(--text-primary)]">Ignore whitespace changes</span>
                </label>
                <p className="ml-7 mt-0.5 text-xs text-[var(--text-secondary)]">Hide commits that only change whitespace</p>
              </div>

              {/* Max Commits */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)]">Maximum commits to load</label>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Higher values = slower, takes effect on next repository open</p>
                <select
                  className="mt-2 w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] transition hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none"
                  value={settings.maxCommits}
                  onChange={(e) =>
                    field(
                      "maxCommits",
                      Number(e.target.value) as AppSettings["maxCommits"]
                    )
                  }
                >
                  <option value={500}>500</option>
                  <option value={1000}>1,000</option>
                  <option value={2000}>2,000</option>
                  <option value={5000}>5,000</option>
                </select>
              </div>
            </div>
          </section>

          {/* Git Accounts */}
          <section className="rounded-lg border border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-primary)_40%,transparent)]">
            <div className="border-b border-[var(--border-color)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Git Accounts</h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Connect GitHub, GitLab, Gitea, and other providers</p>
            </div>
            <div className="space-y-4 px-4 py-3">
              {/* Provider */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)]">Provider</label>
                  <select
                    className="mt-2 w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] transition hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none"
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

                {/* Host */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)]">Custom Host</label>
                  <input
                    className="mt-2 w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] transition hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none"
                    value={host}
                    onChange={(event) => setHost(event.target.value)}
                    placeholder={providerPreset.defaultHost}
                  />
                </div>
              </div>

              {/* Username and Display Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)]">Username</label>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Optional</p>
                  <input
                    className="mt-2 w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] transition hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)]">Display name</label>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">e.g., Work account</p>
                  <input
                    className="mt-2 w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] transition hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Work account"
                  />
                </div>
              </div>

              {/* Token and Scopes */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)]">{providerPreset.tokenLabel}</label>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Required. Treat this like a password.</p>
                <input
                  className="mt-2 w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] transition hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none"
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="Paste token"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-[var(--text-primary)]">Token scopes</label>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Optional. Comma-separated.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void invoke("open_url", { url: providerPreset.docsUrl })}
                    className="shrink-0 text-xs text-[var(--accent)] hover:underline"
                  >
                    ? Docs
                  </button>
                </div>
                <input
                  className="mt-2 w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] transition hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none"
                  value={scopes}
                  onChange={(event) => setScopes(event.target.value)}
                  placeholder="repo, read_api, code"
                />
              </div>

              {authError ? (
                <div className="rounded-md border border-[#ef4444]/30 bg-[color-mix(in_srgb,#ef4444_8%,transparent)] px-3 py-2 text-xs text-[#ef4444]">
                  {authError}
                </div>
              ) : null}

              <button
                className="w-full rounded-md bg-[var(--accent)] px-4 py-2 font-semibold text-[#0c1117] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={() => void handleConnect()}
                disabled={authBusy}
              >
                {authBusy ? "Connecting..." : "Connect Account"}
              </button>

              {/* Connected Accounts List */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Connected accounts</h3>
                <div className="mt-3 space-y-2">
                  {connections.length === 0 ? (
                    <div className="rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                      No connected accounts yet
                    </div>
                  ) : (
                    connections.map((connection) => (
                      <div key={connection.id} className="flex items-center justify-between gap-3 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--text-primary)]">{connection.display_name}</p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {connection.provider} • {connection.host}
                            {connection.username ? ` • @${connection.username}` : ""}
                          </p>
                        </div>
                        <button
                          className="shrink-0 rounded border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[color-mix(in_srgb,var(--danger)_45%,var(--border-color))] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50"
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
              </div>
            </div>
          </section>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border-color)] px-6 py-4">
          <span className="text-xs text-[var(--text-secondary)]">Changes save automatically</span>
          <div className="flex items-center gap-2">
            <button
              className="rounded border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
              onClick={() => updateSettings(DEFAULT_SETTINGS)}
            >
              Reset to defaults
            </button>
            <button
              className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#0c1117] transition hover:brightness-110"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
