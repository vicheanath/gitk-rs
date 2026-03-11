import { useRef, useState } from "react";
import { useAppContext } from "./context/AppContext";
import CommitGraphList from "./components/CommitGraphList/CommitGraphList";
import CommitDetails from "./components/CommitDetails/CommitDetails";
import ResizableDivider from "./components/ResizableDivider/ResizableDivider";
import SettingsDialog from "./components/Settings/SettingsDialog";
import ThemeToggle from "./components/ThemeToggle";
import { useAppShellViewModel } from "./viewmodels/useAppShellViewModel";
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
    setSelectedCommit,
  } = useAppContext();
  const { setSearchQuery, selectPrevCommit, selectNextCommit } = useAppContext();

  const {
    graphWidth,
    detailsHeight,
    scrollContainerRef,
    handleGraphResize,
    handleDetailsResize,
    handleOpenRepo,
  } = useAppShellViewModel({ isRepoOpen, openRepository });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const searchBarRef = useRef<SearchBarRef>(null);

  useKeyboardShortcuts({
    onArrowUp: selectPrevCommit,
    onArrowDown: selectNextCommit,
    onSearch: () => searchBarRef.current?.focus(),
    onToggleSidebar: () => setSidebarOpen((v) => !v),
  });

  if (!isRepoOpen) {
    return (
      <div className="app">
        <div className="welcome-screen">
          <h1>GitK-RS</h1>
          <p>A modern Git visualization tool</p>
          <button onClick={handleOpenRepo} className="primary-button">
            Open Repository
          </button>
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
              onClick={() => setSidebarOpen((v) => !v)}
              title="Toggle Sidebar (b)"
            >
              ☰
            </button>
          )}
          <ThemeToggle />
          <button
            className="settings-btn"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <div className="app-body">
        {sidebarOpen && (
          <>
            <div className="app-sidebar">
              <Sidebar />
            </div>
            <ResizableDivider direction="vertical" onResize={() => {}} />
          </>
        )}
        <div className="app-main">
          {/* Combined Graph and Commit List in single scroll container */}
          <div ref={scrollContainerRef} className="app-graph-list-container">
            {loadingGraph ? (
              <div className="graph-loading">
                <p>Loading commit graph...</p>
              </div>
            ) : graphError ? (
              <div className="graph-error">
                <p>Error loading graph: {graphError}</p>
              </div>
            ) : (
              <>
                <CommitGraphList
                  nodes={nodes}
                  edges={edges}
                  selectedCommit={selectedCommit || undefined}
                  onCommitSelect={setSelectedCommit}
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
          {/* Details panel below both */}
          <ResizableDivider
            direction="horizontal"
            onResize={handleDetailsResize}
          />
          <div className="app-details" style={{ height: `${detailsHeight}px` }}>
            <CommitDetails
              commitId={selectedCommit || undefined}
              nodes={nodes}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
