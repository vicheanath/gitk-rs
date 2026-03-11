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
        className="flex max-h-[calc(100vh-16px)] w-[min(1060px,96vw)] flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl"
        ref={dialogRef}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]">Settings</span>
            <span className="text-[11px] text-[var(--text-secondary)]">Personalize appearance and repository behavior</span>
          </div>
          <button className="rounded-md border border-transparent p-1 text-[var(--text-secondary)] transition hover:border-[var(--border-color)] hover:text-[var(--danger)]" onClick={onClose} title="Close">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden p-2.5">
          <div className="grid h-full grid-cols-[1.2fr_0.8fr] gap-2 max-[680px]:grid-cols-1">
          {/* Appearance */}
          <section className="rounded-lg border border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-primary)_74%,transparent)] p-2">
            <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">Appearance</h3>

            <div className="flex flex-col gap-1 py-1">
              <label className="flex flex-col items-start gap-1 text-xs text-[var(--text-primary)]">
                <span>Theme</span>
                <span className="text-[10px] text-[var(--text-secondary)]">Choose from 10 built-in themes</span>
              </label>
              <div className="flex w-full flex-col items-stretch gap-1">
                <div className="mb-1 flex items-center justify-between gap-2 max-[680px]:flex-col max-[680px]:items-start">
                  <div className="inline-flex min-w-0 items-center gap-2 rounded-md border border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-primary)_80%,transparent)] px-2 py-1.5">
                    <span
                      className="h-[18px] w-6 shrink-0 rounded border border-white/20 settings-theme-current-swatch"
                      data-theme-preview={selectedTheme.value}
                      aria-hidden="true"
                    />
                    <span className="inline-flex min-w-0 flex-col">
                      <span className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)]">Current</span>
                      <span className="text-[11px] font-semibold text-[var(--text-primary)]">{selectedTheme.label}</span>
                      <span className="truncate text-[10px] text-[var(--text-secondary)]">{selectedTheme.description}</span>
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full border border-[var(--border-color)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">{THEME_OPTIONS.length} themes</span>
                </div>
                <select
                  className="min-h-8 w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
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

            <div className="flex items-center justify-between gap-3 py-1 max-[680px]:flex-col max-[680px]:items-start">
              <label className="text-xs text-[var(--text-primary)]">Font size</label>
              <div className="flex items-center gap-1.5">
                <select
                  className="min-w-[130px] rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
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

            <div className="flex items-center justify-between gap-3 py-1 max-[680px]:flex-col max-[680px]:items-start">
              <label className="text-xs text-[var(--text-primary)]">Date format</label>
              <div className="flex items-center gap-1.5">
                <select
                  className="min-w-[130px] rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
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

          <section className="rounded-lg border border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-primary)_74%,transparent)] p-2">
            <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">Workspace</h3>

            <div className="flex items-center justify-between gap-3 py-1 max-[680px]:flex-col max-[680px]:items-start">
              <label className="text-xs text-[var(--text-primary)]">Context lines</label>
              <div className="flex items-center gap-1.5">
                <input
                  className="w-[72px] rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
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

            <div className="flex items-center justify-between gap-3 py-1 max-[680px]:flex-col max-[680px]:items-start">
              <label className="text-xs text-[var(--text-primary)]">Ignore whitespace</label>
              <div className="flex items-center gap-1.5">
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={settings.diffIgnoreWhitespace}
                    onChange={(e) =>
                      field("diffIgnoreWhitespace", e.target.checked)
                    }
                  />
                  Enabled
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 py-1 max-[680px]:flex-col max-[680px]:items-start">
              <label className="text-xs text-[var(--text-primary)]">Max commits to load</label>
              <div className="flex items-center gap-1.5">
                <select
                  className="min-w-[130px] rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
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
                <span className="text-[10px] text-[var(--text-secondary)]">
                  Takes effect on next repository open
                </span>
              </div>
            </div>
          </section>

          <section className="col-span-2 rounded-lg border border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-primary)_74%,transparent)] p-2 max-[680px]:col-span-1">
            <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">Git Accounts</h3>

            <div className="flex items-center justify-between gap-3 py-1 max-[680px]:flex-col max-[680px]:items-start">
              <label className="text-xs text-[var(--text-primary)]">Provider</label>
              <div className="flex w-full items-center gap-1.5">
                <select
                  className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
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

            <div className="flex items-center justify-between gap-3 py-1 max-[680px]:flex-col max-[680px]:items-start">
              <label className="text-xs text-[var(--text-primary)]">Host</label>
              <div className="flex w-full items-center gap-1.5">
                <input
                  className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
                  value={host}
                  onChange={(event) => setHost(event.target.value)}
                  placeholder={providerPreset.defaultHost}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 py-1 max-[680px]:flex-col max-[680px]:items-start">
              <label className="text-xs text-[var(--text-primary)]">Username (optional)</label>
              <div className="flex w-full items-center gap-1.5">
                <input
                  className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="username"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 py-1 max-[680px]:flex-col max-[680px]:items-start">
              <label className="text-xs text-[var(--text-primary)]">Display name</label>
              <div className="flex w-full items-center gap-1.5">
                <input
                  className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Work account"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 py-1 max-[680px]:flex-col max-[680px]:items-start">
              <label className="text-xs text-[var(--text-primary)]">{providerPreset.tokenLabel}</label>
              <div className="flex w-full items-center gap-1.5">
                <input
                  className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="Paste token"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 py-1 max-[680px]:flex-col max-[680px]:items-start">
              <label className="text-xs text-[var(--text-primary)]">Scopes (optional)</label>
              <div className="flex w-full items-center gap-1.5">
                <input
                  className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
                  value={scopes}
                  onChange={(event) => setScopes(event.target.value)}
                  placeholder="repo, read_api, code"
                />
                <a className="shrink-0 text-[10px] text-[var(--accent)] hover:underline" href={providerPreset.docsUrl} target="_blank" rel="noreferrer">
                  Token docs
                </a>
              </div>
            </div>

            <div className="mt-1 flex justify-end">
              <button
                className="rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[#0c1117] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={() => void handleConnect()}
                disabled={authBusy}
              >
                Connect
              </button>
            </div>

            {authError ? <div className="mt-1.5 text-[11px] text-[var(--danger)]">{authError}</div> : null}

            <div className="mt-2 flex flex-col gap-1.5">
              {connections.length === 0 ? (
                <div className="text-[11px] text-[var(--text-secondary)]">No connected providers yet.</div>
              ) : (
                connections.map((connection) => (
                  <div key={connection.id} className="flex items-center justify-between gap-2 rounded-md border border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-primary)_80%,transparent)] px-2 py-1.5">
                    <div>
                      <div className="text-xs font-semibold text-[var(--text-primary)]">{connection.display_name}</div>
                      <div className="text-[10px] text-[var(--text-secondary)]">
                        {connection.provider} • {connection.host}
                        {connection.username ? ` • ${connection.username}` : ""}
                      </div>
                    </div>
                    <button
                      className="rounded border border-[var(--border-color)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:border-[color-mix(in_srgb,var(--danger)_45%,var(--border-color))] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50"
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

        <div className="flex items-center justify-between border-t border-[var(--border-color)] px-4 py-2">
          <span className="text-[10px] text-[var(--text-secondary)]">Changes save automatically</span>
          <div className="inline-flex items-center gap-2">
            <button
              className="rounded border border-[var(--border-color)] px-2.5 py-1 text-xs text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
              onClick={() => updateSettings(DEFAULT_SETTINGS)}
            >
              Reset
            </button>
            <button
              className="rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[#0c1117] transition hover:brightness-105"
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
