import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
  FolderGit2,
  GitCommitHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  X,
} from "lucide-react";
import { AuthConnection } from "./types/auth";
import { useAppContext } from "./context/AppContext";
import CommitGraphList from "./components/CommitGraphList/CommitGraphList";
import CommitDetails from "./components/CommitDetails/CommitDetails";
import ResizableDivider from "./components/ResizableDivider/ResizableDivider";
import SettingsDialog from "./components/Settings/SettingsDialog";
import AboutDialog from "./components/AboutDialog";
import KeyboardShortcutsDialog from "./components/KeyboardShortcutsDialog";
import { useAppShellViewModel } from "./viewmodels/useAppShellViewModel";
import { useEditorTabsViewModel } from "./viewmodels/useEditorTabsViewModel";
import Sidebar from "./components/Sidebar/Sidebar";
import SearchBar, { SearchBarRef } from "./components/SearchBar";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import "./styles/App.css";
import "./styles/CommitGraphList.css";

function App() {
  const {
    repoPath,
    isRepoOpen,
    nodes,
    edges,
    selectedCommit,
    searchQuery,
    loadingGraph,
    graphError,
    openRepository,
    closeRepository,
    loadCommitGraph,
    setSelectedCommit,
    setSearchQuery,
    selectPrevCommit,
    selectNextCommit,
  } = useAppContext();

  const {
    sidebarWidth,
    graphWidth,
    scrollContainerRef,
    handleSidebarResize,
    handleGraphResize,
    handleOpenRepo,
  } = useAppShellViewModel({ openRepository });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [connections, setConnections] = useState<AuthConnection[]>([]);
  const searchBarRef = useRef<SearchBarRef>(null);

  const { openTabs, activeTab, selectCommitFromGraph, activateTab, closeTab } =
    useEditorTabsViewModel({
      isRepoOpen,
      nodes,
      setSelectedCommit,
    });

  useKeyboardShortcuts({
    onArrowUp: selectPrevCommit,
    onArrowDown: selectNextCommit,
    onSearch: () => searchBarRef.current?.focus(),
    onToggleSidebar: () => setSidebarOpen((v) => !v),
  });

  const handleToggleSidebar = () => {
    setSidebarOpen((value) => !value);
  };

  useEffect(() => {
    const isTauri =
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (!isTauri) return;

    void invoke<AuthConnection[]>("list_git_auth_connections")
      .then((result) => setConnections(result))
      .catch(() => setConnections([]));
  }, [settingsOpen]);

  useEffect(() => {
    const isTauri =
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

    if (!isTauri) {
      return;
    }

    let unlisten: (() => void) | undefined;

    void listen<string>("native-menu-action", (event) => {
      switch (event.payload) {
        case "open_repository":
          void handleOpenRepo();
          break;
        case "close_repository":
          closeRepository();
          break;
        case "reload_graph":
          if (isRepoOpen) {
            void loadCommitGraph();
          }
          break;
        case "focus_search":
          searchBarRef.current?.focus();
          break;
        case "toggle_sidebar":
          setSidebarOpen((value) => !value);
          break;
        case "open_settings":
          setSettingsOpen(true);
          break;
        case "open_about":
          setAboutOpen(true);
          break;
        case "show_shortcuts":
          setShortcutsOpen(true);
          break;
      }
    }).then((cleanup) => {
      unlisten = cleanup;
    });

    return () => {
      unlisten?.();
    };
  }, [closeRepository, handleOpenRepo, isRepoOpen, loadCommitGraph]);

  if (!isRepoOpen) {
    return (
      <div className="app">
        <div className="min-h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
          <div className="mx-auto flex h-full max-w-4xl flex-col gap-6 px-6 py-14">
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 shadow-lg">
              <div className="mb-5 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-tertiary)] text-[var(--accent)]">
                  <FolderGit2 size={20} />
                </span>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">GitK-RS</h1>
                  <p className="text-sm text-[var(--text-secondary)]">A modern Git visualization tool</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button onClick={handleOpenRepo} className="primary-button">
                  Open Repository
                </button>
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="secondary-button"
                >
                  Settings
                </button>
              </div>

              <p className="mt-4 text-xs text-[var(--text-secondary)]">
                Repository dialog will only open when you click <strong>Open Repository</strong>.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Connected Providers
              </h2>
              {connections.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  No providers connected yet. Add accounts in Settings to manage GitHub, GitLab, Bitbucket, and Azure DevOps.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {connections.map((connection) => (
                    <div
                      key={connection.id}
                      className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2"
                    >
                      <p className="text-sm font-semibold">{connection.display_name}</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {connection.provider} • {connection.host}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <SettingsDialog
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app gitk-layout">
      <div className="flex min-h-9 items-center gap-2 border-b border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-secondary)_94%,#000000_6%)] px-2.5 py-1 text-xs font-medium">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="inline-flex shrink-0 items-center gap-1 rounded border border-[color-mix(in_srgb,var(--border-color)_88%,#ffffff_12%)] bg-[color-mix(in_srgb,var(--bg-primary)_82%,#ffffff_18%)] px-2 py-1 text-[var(--text-primary)]" aria-label="GitK-RS">
            <FolderGit2 size={14} />
            <span className="font-semibold">GitK-RS</span>
          </div>
          {isRepoOpen && (
            <div className="inline-flex min-w-0 items-center gap-1 text-[var(--text-secondary)]">
              <span className="text-[11px] uppercase tracking-wide max-[900px]:hidden">Repository</span>
              <span className="truncate text-xs font-medium text-[var(--text-primary)]">
                {repoPath?.split("/").pop() || "Repository"}
              </span>
            </div>
          )}
        </div>
        {isRepoOpen && (
          <div className="flex min-w-[220px] flex-[0_1_560px] justify-center max-[680px]:min-w-0 max-[680px]:flex-1">
            <div className="m-0 w-full max-w-[540px]">
              <SearchBar ref={searchBarRef} onSearch={setSearchQuery} />
            </div>
          </div>
        )}
        <div className="ml-auto inline-flex items-center gap-1" role="toolbar" aria-label="Window actions">
          {isRepoOpen && (
            <button
              className="inline-flex h-6 w-7 items-center justify-center rounded border border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-primary)_86%,transparent)] text-[var(--text-secondary)] transition hover:border-[color-mix(in_srgb,var(--accent)_34%,var(--border-color))] hover:bg-[color-mix(in_srgb,var(--bg-tertiary)_78%,#ffffff_22%)] hover:text-[var(--text-primary)]"
              onClick={handleToggleSidebar}
              title="Toggle Sidebar (b)"
            >
              {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>
          )}
          <button
            className="inline-flex h-6 items-center gap-1 rounded border border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-primary)_86%,transparent)] px-2 text-xs text-[var(--text-secondary)] transition hover:border-[color-mix(in_srgb,var(--accent)_34%,var(--border-color))] hover:bg-[color-mix(in_srgb,var(--bg-tertiary)_78%,#ffffff_22%)] hover:text-[var(--text-primary)]"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
          >
            <Settings2 size={16} />
            <span>Settings</span>
          </button>
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <div className="app-body">
        {sidebarOpen && (
          <>
            <div className="app-sidebar" style={{ width: `${sidebarWidth}px` }}>
              <Sidebar />
            </div>
            <ResizableDivider direction="vertical" onResize={handleSidebarResize} />
          </>
        )}
        <div className="app-main">
          <div className="app-editor-tabs" role="tablist" aria-label="Editor Tabs">
            {openTabs.map((tab) => {
              const isActive = tab.id === activeTab?.id;
              const tabLabel = tab.type === "graph" ? "Graph" : `${tab.title} (${tab.commitId.slice(0, 7)})`;

              return (
                <div
                  key={tab.id}
                  className={`app-editor-tab ${isActive ? "active" : ""}`}
                  role="tab"
                  aria-selected={isActive}
                >
                  <button
                    type="button"
                    className="app-editor-tab-button"
                    onClick={() => activateTab(tab)}
                    title={tabLabel}
                  >
                    {tab.type === "graph" ? <GitCommitHorizontal size={13} /> : null}
                    <span className="app-editor-tab-label">{tab.type === "graph" ? tab.title : tab.title}</span>
                    {tab.type === "commit" ? (
                      <span className="app-editor-tab-meta">{tab.commitId.slice(0, 7)}</span>
                    ) : null}
                  </button>
                  {tab.type === "commit" ? (
                    <button
                      type="button"
                      className="app-editor-tab-close"
                      onClick={() => closeTab(tab.id)}
                      title="Close tab"
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="app-tab-panel">
            {activeTab?.type === "graph" ? (
              <div ref={scrollContainerRef} className="app-graph-list-container">
                {loadingGraph ? (
                  <div className="graph-loading">
                    <p>Loading commit graph...</p>
                  </div>
                ) : graphError ? (
                  <div className="graph-error">
                    <div className="graph-error-content">
                      <p>Error loading graph: {graphError}</p>
                      <div className="graph-error-actions">
                        <button className="secondary-button" onClick={handleOpenRepo}>
                          Open Another Repository
                        </button>
                        <button
                          className="primary-button"
                          onClick={() => void loadCommitGraph()}
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <CommitGraphList
                      nodes={nodes}
                      edges={edges}
                      selectedCommit={selectedCommit || undefined}
                      onCommitSelect={selectCommitFromGraph}
                      searchQuery={searchQuery}
                      graphWidth={graphWidth}
                    />
                    <ResizableDivider
                      direction="vertical"
                      onResize={handleGraphResize}
                    />
                  </>
                )}
              </div>
            ) : (
              <CommitDetails commitId={activeTab.commitId} nodes={nodes} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
