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
import SetupCliDialog from "./components/SetupCliDialog";
import LandingPage from "./components/LandingPage";
import { useAppShellViewModel } from "./viewmodels/useAppShellViewModel";
import { useEditorTabsViewModel } from "./viewmodels/useEditorTabsViewModel";
import Sidebar from "./components/Sidebar/Sidebar";
import SearchBar, { SearchBarRef } from "./components/SearchBar";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { cn } from "./lib/utils";
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
  const [setupCliOpen, setSetupCliOpen] = useState(false);
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
        case "setup_cli":
          setSetupCliOpen(true);
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
      <>
        <LandingPage
          connections={connections}
          onOpenRepository={handleOpenRepo}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <SettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="gitk-layout flex h-screen w-full flex-col overflow-hidden">
      <div className="flex min-h-9 items-center gap-1 border-b border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-secondary)_94%,#000000_6%)] px-2 py-1 text-xs font-medium">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <div className="inline-flex shrink-0 items-center gap-1 rounded border border-[color-mix(in_srgb,var(--border-color)_88%,#ffffff_12%)] bg-[color-mix(in_srgb,var(--bg-primary)_82%,#ffffff_18%)] px-1.5 py-0.5 text-[var(--text-primary)]" aria-label="GitK-RS">
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
      <SetupCliDialog open={setupCliOpen} onClose={() => setSetupCliOpen(false)} />
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <>
            <div
              className="w-[220px] min-w-[150px] max-w-[400px] shrink-0 overflow-y-auto border-r border-[var(--border-color)] bg-[var(--bg-secondary)] text-xs"
              style={{ width: `${sidebarWidth}px` }}
            >
              <Sidebar />
            </div>
            <ResizableDivider direction="vertical" onResize={handleSidebarResize} />
          </>
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div
            className="relative z-[2] flex shrink-0 items-stretch gap-px overflow-x-auto border-b border-[var(--border-color)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--bg-secondary)_94%,#ffffff_6%),var(--bg-secondary))] px-1.5 pb-0 pt-1 [scrollbar-width:thin]"
            role="tablist"
            aria-label="Editor Tabs"
          >
            {openTabs.map((tab) => {
              const isActive = tab.id === activeTab?.id;
              const tabLabel = tab.type === "graph" ? "Graph" : `${tab.title} (${tab.commitId.slice(0, 7)})`;

              return (
                <div
                  key={tab.id}
                  className={cn(
                    "inline-flex min-w-0 max-w-[280px] items-center rounded-t-[0.45rem] border border-b-0 border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-primary)_88%,transparent)] text-[var(--text-secondary)]",
                    isActive &&
                      "border-[color-mix(in_srgb,var(--accent)_40%,var(--border-color))] bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-[inset_0_2px_0_color-mix(in_srgb,var(--accent)_58%,transparent)]"
                  )}
                  role="tab"
                  aria-selected={isActive}
                >
                  <button
                    type="button"
                    className="inline-flex min-w-0 max-w-full items-center gap-1 border-none bg-transparent px-2 py-1.5 text-inherit"
                    onClick={() => activateTab(tab)}
                    title={tabLabel}
                  >
                    {tab.type === "graph" ? <GitCommitHorizontal size={13} /> : null}
                    <span className="min-w-0 truncate whitespace-nowrap">
                      {tab.type === "graph" ? tab.title : tab.title}
                    </span>
                    {tab.type === "commit" ? (
                      <span className="whitespace-nowrap text-[10px] text-[var(--text-secondary)]">
                        {tab.commitId.slice(0, 7)}
                      </span>
                    ) : null}
                  </button>
                  {tab.type === "commit" ? (
                    <button
                      type="button"
                      className="mr-1 inline-flex h-[22px] w-[22px] items-center justify-center rounded border-none bg-transparent text-inherit transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
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

          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg-secondary)]">
            {activeTab?.type === "graph" ? (
              <div
                ref={scrollContainerRef}
                className="app-graph-list-container relative flex min-h-0 flex-1 flex-row overflow-hidden"
              >
                {loadingGraph ? (
                  <div className="flex h-full w-full items-center justify-center text-sm text-[var(--text-secondary)]">
                    <p>Loading commit graph...</p>
                  </div>
                ) : graphError ? (
                  <div className="flex h-full w-full items-center justify-center text-sm text-[var(--danger)]">
                    <div className="flex flex-col items-center gap-2 p-2 text-center">
                      <p>Error loading graph: {graphError}</p>
                      <div className="flex gap-2">
                        <button
                          className="inline-flex items-center rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1.5 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)]"
                          onClick={handleOpenRepo}
                        >
                          Open Another Repository
                        </button>
                        <button
                          className="inline-flex items-center rounded border border-[#9be9a8] bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[#0b1117] transition hover:bg-[var(--accent-hover)] hover:shadow-[0_0_0_1px_var(--accent)]"
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
              <CommitDetails commitId={activeTab.commitId} nodes={nodes} graphWidth={graphWidth} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
