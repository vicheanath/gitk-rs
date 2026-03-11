import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { GitCommitHorizontal, PanelLeftClose, PanelLeftOpen, Settings2, X } from "lucide-react";
import { useAppContext } from "./context/AppContext";
import CommitGraphList from "./components/CommitGraphList/CommitGraphList";
import CommitDetails from "./components/CommitDetails/CommitDetails";
import ResizableDivider from "./components/ResizableDivider/ResizableDivider";
import SettingsDialog from "./components/Settings/SettingsDialog";
import ThemeToggle from "./components/ThemeToggle";
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
  } = useAppShellViewModel({ isRepoOpen, openRepository });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
        <div className="welcome-screen">
          <h1>GitK-RS</h1>
          <p>A modern Git visualization tool</p>
          <div className="welcome-actions">
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
          <p className="welcome-hint">
            Select a local Git working tree to load its history and diffs.
          </p>
          <SettingsDialog
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app gitk-layout">
      <div className="app-titlebar">
        <div className="app-title">
          <span className="app-title-text">GitK-RS</span>
          {isRepoOpen && (
            <span className="app-repo-name">
              {repoPath?.split("/").pop() || "Repository"}
            </span>
          )}
        </div>
        {isRepoOpen && (
          <div className="titlebar-search">
            <SearchBar ref={searchBarRef} onSearch={setSearchQuery} />
          </div>
        )}
        <div className="app-title-actions">
          {isRepoOpen && (
            <button
              className="sidebar-toggle-btn"
              onClick={handleToggleSidebar}
              title="Toggle Sidebar (b)"
            >
              {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>
          )}
          <ThemeToggle />
          <button
            className="settings-btn"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
          >
            <Settings2 size={16} />
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
