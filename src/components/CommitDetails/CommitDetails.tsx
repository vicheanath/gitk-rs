import FileList from "./FileList";
import DiffViewer from "./DiffViewer";
import TreeView from "./TreeView";
import ResizableDivider from "../ResizableDivider/ResizableDivider";
import { CommitNode } from "../../types/git";
import { useCommitDetailsViewModel } from "../../viewmodels/useCommitDetailsViewModel";

interface CommitDetailsProps {
  commitId?: string;
  nodes?: CommitNode[];
}

export default function CommitDetails({
  commitId,
  nodes = [],
}: CommitDetailsProps) {
  const {
    details,
    loading,
    selectedFile,
    navigatorMode,
    diffDisplayMode,
    contextLines,
    ignoreWhitespace,
    sidebarWidth,
    rowNumber,
    totalCommits,
    formattedDate,
    fileStats,
    setSelectedFile,
    setNavigatorMode,
    setDiffDisplayMode,
    setContextLines,
    setIgnoreWhitespace,
    handleSidebarResize,
  } = useCommitDetailsViewModel({
    commitId,
    nodes,
  });

  if (!commitId) {
    return (
      <div className="commit-details">
        <p className="empty-state">Select a commit to view details</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="commit-details">
        <p>Loading...</p>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="commit-details">
        <p>Failed to load commit details</p>
      </div>
    );
  }

  return (
    <div className="commit-details classic-gitk github-commit-detail">
      <div className="commit-details-top github-detail-header">
        <div className="commit-id-section">
          <span className="commit-id-label">Commit</span>
          <span className="commit-hash">{details.id.substring(0, 8)}</span>
          <span className="commit-row-info">{rowNumber}/{totalCommits}</span>
        </div>
        <div className="github-detail-meta">
          <span>{details.author}</span>
          <span className="meta-dot">•</span>
          <span>{formattedDate}</span>
          <span className="meta-dot">•</span>
          <span className="stat-additions">+{fileStats.additions}</span>
          <span className="stat-deletions">-{fileStats.deletions}</span>
        </div>
      </div>

      <div className="github-detail-controls">
        <div className="mode-group">
          <button
            className={`mode-btn ${navigatorMode === "tree" ? "active" : ""}`}
            onClick={() => setNavigatorMode("tree")}
          >
            Tree
          </button>
          <button
            className={`mode-btn ${navigatorMode === "files" ? "active" : ""}`}
            onClick={() => setNavigatorMode("files")}
          >
            Files
          </button>
        </div>

        <div className="mode-group">
          <button
            className={`mode-btn ${diffDisplayMode === "unified" ? "active" : ""}`}
            onClick={() => setDiffDisplayMode("unified")}
          >
            Unified
          </button>
          <button
            className={`mode-btn ${diffDisplayMode === "split" ? "active" : ""}`}
            onClick={() => setDiffDisplayMode("split")}
          >
            Split
          </button>
        </div>

        <label className="context-label">
          Context
          <input
            type="number"
            min="0"
            max="100"
            value={contextLines}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!Number.isNaN(val) && val >= 0 && val <= 100) {
                setContextLines(val);
              }
            }}
          />
        </label>

        <label className="ignore-space">
          <input
            type="checkbox"
            checked={ignoreWhitespace}
            onChange={(e) => setIgnoreWhitespace(e.target.checked)}
          />
          Ignore whitespace
        </label>
      </div>

      <div className="github-detail-layout">
        <aside className="github-detail-sidebar" style={{ width: `${sidebarWidth}%` }}>
          <div className="sidebar-header">
            <span>Changed files ({details.files.length})</span>
          </div>
          {navigatorMode === "tree" ? (
            <TreeView
              commitId={commitId}
              changedFiles={details.files}
              selectedFile={selectedFile}
              onFileSelect={setSelectedFile}
            />
          ) : (
            <FileList
              files={details.files}
              selectedFile={selectedFile}
              onFileSelect={setSelectedFile}
            />
          )}
        </aside>

        <ResizableDivider direction="vertical" onResize={handleSidebarResize} />

        <section className="github-detail-diff">
          {!selectedFile ? (
            <div className="diff-placeholder">
              <p>Select a file to view its changes</p>
            </div>
          ) : diffDisplayMode === "unified" ? (
            <DiffViewer
              commitId={commitId}
              files={details.files}
              selectedFile={selectedFile}
              onActiveFileChange={setSelectedFile}
              viewMode="diff"
              contextLines={contextLines}
              ignoreWhitespace={ignoreWhitespace}
              showAllFilesInDiff
            />
          ) : (
            <div className="split-diff-layout">
              <div className="split-diff-pane">
                <div className="split-pane-header">Old</div>
                <DiffViewer
                  commitId={commitId}
                  files={details.files}
                  selectedFile={selectedFile}
                  viewMode="old"
                  contextLines={contextLines}
                  ignoreWhitespace={ignoreWhitespace}
                  showAllFilesInDiff={false}
                />
              </div>
              <div className="split-diff-pane">
                <div className="split-pane-header">New</div>
                <DiffViewer
                  commitId={commitId}
                  files={details.files}
                  selectedFile={selectedFile}
                  viewMode="new"
                  contextLines={contextLines}
                  ignoreWhitespace={ignoreWhitespace}
                  showAllFilesInDiff={false}
                />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
