import { useEffect, useRef, useMemo } from "react";
import { ChangedFile } from "../../types/git";
import { useDiffViewerViewModel } from "../../viewmodels/useDiffViewerViewModel";

interface DiffViewerProps {
  commitId: string;
  files: ChangedFile[];
  selectedFile?: string | null;
  onActiveFileChange?: (filePath: string) => void;
  viewMode?: "diff" | "old" | "new";
  contextLines?: number;
  ignoreWhitespace?: boolean;
  showAllFilesInDiff?: boolean;
}

export default function DiffViewer({
  commitId,
  files,
  selectedFile,
  onActiveFileChange,
  viewMode = "diff",
  contextLines = 3,
  ignoreWhitespace = false,
  showAllFilesInDiff = false,
}: DiffViewerProps) {
  const {
    content,
    loading,
    totalAdditions,
    totalDeletions,
    oldChangedLines,
    newChangedLines,
    diffLineInfo,
  } =
    useDiffViewerViewModel({
      commitId,
      files,
      selectedFile,
      viewMode,
      contextLines,
      ignoreWhitespace,
      showAllFilesInDiff,
    });
  const contentRef = useRef<HTMLDivElement>(null);
  const lastActiveFileRef = useRef<string | null>(null);
  const suppressScrollSyncRef = useRef(false);

  const oldChangedLineSet = useMemo(
    () => new Set(oldChangedLines),
    [oldChangedLines]
  );
  const newChangedLineSet = useMemo(
    () => new Set(newChangedLines),
    [newChangedLines]
  );

  // Color only changed lines in unified patch text.
  const getDiffLineClass = (lineNum: number, lineText: string): string => {
    if (viewMode === "diff") {
      if (lineText.startsWith("+") && !lineText.startsWith("+++")) {
        return "diff-add";
      }
      if (lineText.startsWith("-") && !lineText.startsWith("---")) {
        return "diff-remove";
      }
      return "";
    }

    if (viewMode === "old") {
      return oldChangedLineSet.has(lineNum) ? "diff-remove" : "";
    }

    if (viewMode === "new") {
      return newChangedLineSet.has(lineNum) ? "diff-add" : "";
    }

    return "";
  };

  // Track active file when scrolling
  useEffect(() => {
    if (viewMode !== "diff" || !showAllFilesInDiff || !contentRef.current) {
      return;
    }

    const container = contentRef.current;
    const handleScroll = () => {
      if (suppressScrollSyncRef.current) {
        return;
      }

      const lines = Array.from(
        container.querySelectorAll<HTMLDivElement>("[data-line-kind='diff-file-header']")
      );

      const containerRect = container.getBoundingClientRect();
      const activeLine = lines.find((line) => {
        const rect = line.getBoundingClientRect();
        return rect.top <= containerRect.top + 100;
      });

      if (activeLine) {
        const filePath = activeLine.dataset.diffFilePath;
        if (filePath && filePath !== lastActiveFileRef.current) {
          lastActiveFileRef.current = filePath;
          onActiveFileChange?.(filePath);
        }
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [viewMode, showAllFilesInDiff, onActiveFileChange]);

  // Scroll to selected file
  useEffect(() => {
    if (!selectedFile || loading || !contentRef.current) {
      return;
    }

    if (viewMode === "diff" && showAllFilesInDiff && selectedFile === lastActiveFileRef.current) {
      return;
    }

    const container = contentRef.current;
    const headerLine = container.querySelector<HTMLDivElement>(
      `[data-diff-file-path="${selectedFile}"][data-line-kind="diff-file-header"]`
    );

    if (headerLine) {
      suppressScrollSyncRef.current = true;
      headerLine.scrollIntoView({ behavior: "smooth", block: "start" });
      lastActiveFileRef.current = selectedFile;
      setTimeout(() => {
        suppressScrollSyncRef.current = false;
      }, 500);
    }
  }, [selectedFile, loading, viewMode, showAllFilesInDiff]);

  // Render diff content as plain text with simple colors
  const renderDiffContent = () => {
    if (!content) return null;

    const lines = content.split("\n");
    return lines.map((line, idx) => {
      const lineNum = idx + 1;
      const lineClass = getDiffLineClass(lineNum, line);
      const lineInfo = diffLineInfo.get(lineNum);
      const lineKindClass = lineInfo?.kind ? `line-kind-${lineInfo.kind}` : "";

      if (!lineClass) {
        return (
          <div
            key={idx}
            className={`diff-simple-line ${lineKindClass}`.trim()}
            data-diff-file-path={lineInfo?.filePath}
            data-line-kind={lineInfo?.kind}
          >
            {line}
          </div>
        );
      }

      return (
        <div
          key={idx}
          className={`diff-simple-line ${lineClass} ${lineKindClass}`.trim()}
          data-diff-file-path={lineInfo?.filePath}
          data-line-kind={lineInfo?.kind}
        >
          {line}
        </div>
      );
    });
  };

  return (
    <div className="diff-viewer-simple">
      <div className="diff-header-simple">
        <span className="diff-stats-simple">
          {loading
            ? "Loading..."
            : `${files.length} file${files.length !== 1 ? "s" : ""} changed • +${totalAdditions} -${totalDeletions}`}
        </span>
      </div>
      <div className="diff-content-simple">
        {loading && <p>Loading...</p>}
        {!loading && (!content || content.trim().length === 0) && (
          <p>No diff content available</p>
        )}
        {!loading && content && content.trim().length > 0 && (
          <div ref={contentRef} className="diff-simple-viewer">
            {renderDiffContent()}
          </div>
        )}
      </div>
    </div>
  );
}