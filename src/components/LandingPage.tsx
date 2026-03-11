import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import {
  ChevronRight,
  FolderOpen,
  FolderGit2,
  Globe,
  Link,
  Lock,
  Search,
  Settings2,
} from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { AuthConnection, ProviderRepository } from "../types/auth";

interface LandingPageProps {
  connections: AuthConnection[];
  onOpenRepository: () => void;
  onOpenSettings: () => void;
}

const PANEL =
  "rounded-md bg-[color-mix(in_srgb,var(--bg-secondary)_74%,transparent)]";
const PANEL_HEADER =
  "mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]";
const INPUT =
  "h-8 rounded-md bg-[color-mix(in_srgb,var(--bg-primary)_92%,transparent)] px-3 text-xs text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--accent)_45%,transparent)]";
const BTN_SECONDARY =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-[color-mix(in_srgb,var(--bg-primary)_90%,transparent)] px-3 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[color-mix(in_srgb,var(--bg-tertiary)_70%,transparent)]";
const BTN_PRIMARY =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-3.5 text-xs font-semibold text-[#0b1117] transition hover:brightness-105 disabled:opacity-55";

export default function LandingPage({
  connections,
  onOpenRepository,
  onOpenSettings,
}: LandingPageProps) {
  const { repoPath, openRepository } = useAppContext();
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [repoQuery, setRepoQuery] = useState("");
  const [repositories, setRepositories] = useState<ProviderRepository[]>([]);
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [destinationFolder, setDestinationFolder] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("gitk-rs:clone-destination");
    if (stored) {
      setDestinationFolder(stored);
    }
  }, []);

  useEffect(() => {
    if (destinationFolder.trim()) {
      window.localStorage.setItem("gitk-rs:clone-destination", destinationFolder.trim());
    }
  }, [destinationFolder]);

  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.id === selectedConnectionId) ?? null,
    [connections, selectedConnectionId]
  );

  const pickDestinationFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select destination folder",
    });
    if (!selected) {
      return null;
    }
    return typeof selected === "string"
      ? selected
      : (selected as { path?: string }).path || (selected as string);
  };

  const handleBrowseDestination = async () => {
    try {
      const path = await pickDestinationFolder();
      if (path) {
        setDestinationFolder(path);
      }
    } catch (error) {
      setCloneError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleLoadRepositories = async (connectionId: string, query = repoQuery) => {
    if (!isTauri) {
      return;
    }
    setSelectedConnectionId(connectionId);
    setRepoLoading(true);
    setRepoError(null);
    try {
      const data = await invoke<ProviderRepository[]>("list_provider_repositories", {
        connectionId,
        query: query.trim().length > 0 ? query.trim() : null,
        limit: 50,
      });
      setRepositories(data);
    } catch (error) {
      setRepositories([]);
      setRepoError(error instanceof Error ? error.message : String(error));
    } finally {
      setRepoLoading(false);
    }
  };

  const handleClone = async (url: string, connectionId?: string) => {
    const trimmed = url.trim();
    if (!trimmed) {
      setCloneError("Repository URL is required");
      return;
    }

    setCloneLoading(true);
    setCloneError(null);
    try {
      const destinationParent = destinationFolder.trim();
      if (!destinationParent) {
        setCloneError("Choose a destination folder first.");
        return;
      }

      const clonedPath = await invoke<string>("clone_repository", {
        repoUrl: trimmed,
        destinationParent,
        connectionId: connectionId ?? null,
      });

      setCloneUrl("");
      await openRepository(clonedPath);
    } catch (error) {
      setCloneError(error instanceof Error ? error.message : String(error));
    } finally {
      setCloneLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-2 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent)]">
              <FolderGit2 size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight leading-tight">GitK-RS</h1>
              <p className="text-sm text-[var(--text-secondary)]">
                Open, browse, and clone repositories from providers in one place.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={onOpenSettings} className={BTN_SECONDARY}>
              <Settings2 size={15} />
              Settings
            </button>
            <button onClick={onOpenRepository} className={BTN_PRIMARY}>
              <FolderOpen size={15} />
              Open Local Repository
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-12">
          <aside className="space-y-2 lg:col-span-4">
            <section className={`${PANEL} p-2.5`}>
              <h2 className={PANEL_HEADER}>Workspace</h2>
              {repoPath ? (
                <div className="rounded bg-[color-mix(in_srgb,var(--bg-primary)_90%,transparent)] px-2 py-1.5 text-xs text-[var(--text-secondary)]">
                  Last opened:
                  <span className="ml-1 font-medium text-[var(--text-primary)]">
                    {repoPath.split("/").pop()}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">No local repository open yet.</p>
              )}
            </section>

            <section className={`${PANEL} p-2.5`}>
              <h2 className={PANEL_HEADER}>Connected Providers</h2>
              {connections.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--text-secondary)]">
                    Connect GitHub, GitLab, Bitbucket, or Azure DevOps to browse repositories.
                  </p>
                  <button onClick={onOpenSettings} className={BTN_SECONDARY}>
                    <Settings2 size={14} />
                    Connect Providers
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {connections.map((connection) => {
                    const active = selectedConnectionId === connection.id;
                    return (
                      <button
                        key={connection.id}
                        onClick={() => void handleLoadRepositories(connection.id)}
                        className={`w-full rounded-md px-2 py-1.5 text-left transition ${
                          active
                            ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
                            : "bg-[color-mix(in_srgb,var(--bg-primary)_88%,transparent)] hover:bg-[color-mix(in_srgb,var(--bg-tertiary)_62%,transparent)]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                            {connection.display_name}
                          </p>
                          <ChevronRight size={13} className="text-[var(--text-secondary)]" />
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">
                          {connection.provider} · {connection.host}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>

          <main className="space-y-2 lg:col-span-8">
            <section className={`${PANEL} p-2.5`}>
              <h2 className={PANEL_HEADER}>
                <FolderOpen size={15} />
                Clone Destination
              </h2>
              <div className="flex flex-col gap-1.5 sm:flex-row">
                <input
                  value={destinationFolder}
                  onChange={(event) => setDestinationFolder(event.target.value)}
                  placeholder="Choose a folder where repositories will be cloned"
                  className={`${INPUT} flex-1`}
                />
                <button onClick={() => void handleBrowseDestination()} className={BTN_SECONDARY}>
                  <FolderOpen size={14} />
                  Browse
                </button>
              </div>
              {destinationFolder ? (
                <p className="mt-1.5 truncate rounded bg-[color-mix(in_srgb,var(--bg-primary)_90%,transparent)] px-2 py-1 font-mono text-[11px] text-[var(--text-secondary)]">
                  {destinationFolder}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                  Select destination folder before cloning.
                </p>
              )}
            </section>

            <section className={`${PANEL} p-2.5`}>
              <h2 className={PANEL_HEADER}>
                <Link size={15} />
                Clone From URL
              </h2>
              <div className="flex flex-col gap-1.5 sm:flex-row">
                <input
                  value={cloneUrl}
                  onChange={(event) => setCloneUrl(event.target.value)}
                  placeholder="https://github.com/owner/repository.git"
                  className={`${INPUT} flex-1`}
                />
                <button
                  onClick={() => void handleClone(cloneUrl, selectedConnectionId ?? undefined)}
                  disabled={cloneLoading || !destinationFolder.trim()}
                  className={BTN_PRIMARY}
                >
                  {cloneLoading ? "Cloning..." : "Clone"}
                </button>
              </div>
              {cloneError && <p className="mt-1.5 text-xs text-[var(--danger)]">{cloneError}</p>}
            </section>

            <section className={`${PANEL} p-2.5`}>
              <h2 className={PANEL_HEADER}>
                <Search size={15} />
                {selectedConnection
                  ? `${selectedConnection.display_name} Repositories`
                  : "Browse Repositories"}
              </h2>

              {selectedConnection ? (
                <>
                  <div className="mb-2 flex flex-col gap-1.5 sm:flex-row">
                    <input
                      value={repoQuery}
                      onChange={(event) => setRepoQuery(event.target.value)}
                      placeholder="Search repositories"
                      className={`${INPUT} flex-1`}
                    />
                    <button
                      onClick={() => void handleLoadRepositories(selectedConnection.id, repoQuery)}
                      disabled={repoLoading}
                      className={BTN_SECONDARY}
                    >
                      {repoLoading ? "Loading..." : "Refresh"}
                    </button>
                  </div>

                  {repoError && (
                    <div className="mb-2 rounded bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-2 py-1.5">
                      <p className="text-xs font-medium text-[var(--danger)]">Failed to load repositories</p>
                      <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{repoError}</p>
                      <button onClick={onOpenSettings} className={`${BTN_SECONDARY} mt-1.5 h-7 px-2 text-[11px]`}>
                        <Settings2 size={12} />
                        Check provider settings
                      </button>
                    </div>
                  )}

                  <div className="max-h-80 space-y-1 overflow-y-auto pr-0.5">
                    {repoLoading ? (
                      <p className="text-xs text-[var(--text-secondary)]">Loading repositories...</p>
                    ) : repoError ? (
                      <p className="text-xs text-[var(--text-secondary)]">Unable to fetch repository list right now.</p>
                    ) : repositories.length === 0 ? (
                      <div className="rounded bg-[color-mix(in_srgb,var(--bg-primary)_90%,transparent)] px-2 py-1.5 text-xs text-[var(--text-secondary)]">
                        No repositories found for this connection.
                      </div>
                    ) : (
                      repositories.map((repo) => (
                        <div
                          key={repo.id}
                          className="flex items-center gap-2 rounded bg-[color-mix(in_srgb,var(--bg-primary)_90%,transparent)] px-2 py-1.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-[var(--text-primary)]">{repo.full_name}</p>
                            <p className="truncate text-[11px] text-[var(--text-secondary)]">{repo.clone_url}</p>
                          </div>
                          {repo.private ? (
                            <Lock size={13} className="text-[var(--text-secondary)]" />
                          ) : (
                            <Globe size={13} className="text-[var(--text-secondary)]" />
                          )}
                          <button
                            onClick={() => void handleClone(repo.clone_url, selectedConnection.id)}
                            disabled={cloneLoading || !destinationFolder.trim()}
                            className={`${BTN_PRIMARY} h-7 px-2.5 text-[11px]`}
                          >
                            Clone
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">
                  Select a provider from the left panel to browse repositories.
                </p>
              )}
            </section>
          </main>
        </div>
      </div>

      <footer className="px-4 py-4">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-xs text-[var(--text-secondary)]">
            GitK-RS • A modern Git visualization tool built with Rust and React
          </p>
        </div>
      </footer>
    </div>
  );
}
