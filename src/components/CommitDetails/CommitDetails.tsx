import { useState } from "react";
import FileList from "./FileList";
import DiffViewer from "./DiffViewer";
import TreeView from "./TreeView";
import ResizableDivider from "../ResizableDivider/ResizableDivider";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
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
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle"
  );

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

  const handleCopySha = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(details.id);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = details.id;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1400);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 1800);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 bg-[var(--bg-primary)] p-2">
      <Card className="p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Commit</span>
            <span className="rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-primary)]">
              {details.id.substring(0, 8)}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">{rowNumber}/{totalCommits}</span>
            <Button
              type="button"
              size="sm"
              className={cn(
                "h-6 text-[10px]",
                copyState === "copied" && "text-[var(--success)]",
                copyState === "failed" && "text-[var(--danger)]"
              )}
              onClick={handleCopySha}
              title="Copy full commit SHA"
            >
              {copyState === "copied"
                ? "Copied"
                : copyState === "failed"
                  ? "Copy failed"
                  : "Copy SHA"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1 text-xs text-[var(--text-secondary)]">
            <span>{details.author}</span>
            <span>•</span>
            <span>{formattedDate}</span>
            <span>•</span>
            <span className="text-[var(--success)]">+{fileStats.additions}</span>
            <span className="text-[var(--danger)]">-{fileStats.deletions}</span>
          </div>
        </div>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-[82px_1fr] gap-2 text-xs">
            <span className="uppercase tracking-wide text-[var(--text-muted)]">SHA</span>
            <code className="overflow-x-auto rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-1.5 py-1 font-mono text-[var(--text-primary)]">
              {details.id}
            </code>
          </div>
          <div className="grid grid-cols-[82px_1fr] gap-2 text-xs">
            <span className="uppercase tracking-wide text-[var(--text-muted)]">Author</span>
            <span className="text-[var(--text-primary)]">{details.author} &lt;{details.email}&gt;</span>
          </div>
          <div className="grid grid-cols-[82px_1fr] gap-2 text-xs">
            <span className="uppercase tracking-wide text-[var(--text-muted)]">Committer</span>
            <span className="text-[var(--text-primary)]">
              {details.committer} &lt;{details.committer_email}&gt;
            </span>
          </div>
          <div className="grid grid-cols-[82px_1fr] gap-2 text-xs">
            <span className="uppercase tracking-wide text-[var(--text-muted)]">Message</span>
            <pre className="whitespace-pre-wrap rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1.5 text-[var(--text-primary)]">
              {details.message}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded border border-[var(--border-primary)] p-1">
            <Button
              variant={navigatorMode === "tree" ? "default" : "ghost"}
              className="h-6"
              onClick={() => setNavigatorMode("tree")}
            >
              Tree
            </Button>
            <Button
              variant={navigatorMode === "files" ? "default" : "ghost"}
              className="h-6"
              onClick={() => setNavigatorMode("files")}
            >
              Files
            </Button>
          </div>

          <div className="inline-flex items-center gap-1 rounded border border-[var(--border-primary)] p-1">
            <Button
              variant={diffDisplayMode === "unified" ? "default" : "ghost"}
              className="h-6"
              onClick={() => setDiffDisplayMode("unified")}
            >
              Unified
            </Button>
            <Button
              variant={diffDisplayMode === "split" ? "default" : "ghost"}
              className="h-6"
              onClick={() => setDiffDisplayMode("split")}
            >
              Split
            </Button>
          </div>

          <label className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]">
            Context
            <Input
              type="number"
              min="0"
              max="100"
              className="h-7 w-16"
              value={contextLines}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!Number.isNaN(val) && val >= 0 && val <= 100) {
                  setContextLines(val);
                }
              }}
            />
          </label>

          <label className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              className="h-3.5 w-3.5"
              checked={ignoreWhitespace}
              onChange={(e) => setIgnoreWhitespace(e.target.checked)}
            />
            Ignore whitespace
          </label>
        </CardContent>
      </Card>

      <div className="flex min-h-0 flex-1 gap-2">
        <aside className="min-h-0 overflow-hidden rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)]" style={{ width: `${sidebarWidth}%` }}>
          <div className="border-b border-[var(--border-primary)] px-2 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
            Changed files ({details.files.length})
          </div>
          <div className="min-h-0 h-[calc(100%-30px)] overflow-auto">
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
          </div>
        </aside>
        <ResizableDivider direction="vertical" onResize={handleSidebarResize} />

        <section className="min-h-0 flex-1 overflow-hidden rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          {!selectedFile ? (
            <div className="flex h-full items-center justify-center p-4">
              <p className="text-sm text-[var(--text-secondary)]">Select a file to view its changes</p>
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
            <div className="grid h-full min-h-0 grid-cols-2 gap-2 p-2 max-[980px]:grid-cols-1">
              <div className="min-h-0 overflow-hidden rounded border border-[var(--border-primary)]">
                <div className="border-b border-[var(--border-primary)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)]">Old</div>
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
              <div className="min-h-0 overflow-hidden rounded border border-[var(--border-primary)]">
                <div className="border-b border-[var(--border-primary)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)]">New</div>
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
