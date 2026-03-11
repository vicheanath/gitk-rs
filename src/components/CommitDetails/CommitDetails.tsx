import CommitInfo from "./CommitInfo";
import DiffControls from "./DiffControls";
import FileNavigator from "./FileNavigator";
import DiffViewerSection from "./DiffViewerSection";
import ResizableDivider from "../ResizableDivider/ResizableDivider";
import { CommitNode } from "../../types/git";
import { useCommitDetailsViewModel } from "../../viewmodels/useCommitDetailsViewModel";

interface CommitDetailsProps {
  commitId?: string;
  nodes?: CommitNode[];
  graphWidth?: number;
}

export default function CommitDetails({
  commitId,
  nodes = [],
  graphWidth = 0,
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
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-[var(--text-secondary)]">Select a commit to view details</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-[var(--text-secondary)]">Loading...</p>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-[var(--danger)]">Failed to load commit details</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 bg-[var(--bg-primary)] p-1.5">
      {/* Commit Information */}
      <CommitInfo
        id={details.id}
        author={details.author}
        email={details.email}
        committer={details.committer}
        committer_email={details.committer_email}
        message={details.message}
        rowNumber={rowNumber}
        totalCommits={totalCommits}
        formattedDate={formattedDate}
        additions={fileStats.additions}
        deletions={fileStats.deletions}
        graphWidth={graphWidth}
      />

      {/* Diff Display Controls */}
      <DiffControls
        navigatorMode={navigatorMode}
        setNavigatorMode={setNavigatorMode}
        diffDisplayMode={diffDisplayMode}
        setDiffDisplayMode={setDiffDisplayMode}
        contextLines={contextLines}
        setContextLines={setContextLines}
        ignoreWhitespace={ignoreWhitespace}
        setIgnoreWhitespace={setIgnoreWhitespace}
      />

      {/* Main Content: File Navigator + Diff Viewer */}
      <div className="flex min-h-0 flex-1 gap-1.5">
        <div style={{ width: `${sidebarWidth}%` }} className="min-h-0 shrink-0 overflow-hidden">
          <FileNavigator
            commitId={commitId}
            changedFiles={details.files}
            selectedFile={selectedFile}
            onFileSelect={setSelectedFile}
            navigatorMode={navigatorMode}
            filesCount={details.files.length}
          />
        </div>
        <ResizableDivider direction="vertical" onResize={handleSidebarResize} />
        <section className="min-h-0 flex-1 overflow-hidden rounded-md bg-[color-mix(in_srgb,var(--bg-secondary)_84%,transparent)]">
          <DiffViewerSection
            commitId={commitId}
            files={details.files}
            selectedFile={selectedFile}
            diffDisplayMode={diffDisplayMode}
            contextLines={contextLines}
            ignoreWhitespace={ignoreWhitespace}
          />
        </section>
      </div>
    </div>
  );
}
