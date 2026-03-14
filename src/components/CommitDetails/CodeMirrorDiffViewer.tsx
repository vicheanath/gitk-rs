import { forwardRef, type RefObject } from "react";
import { DiffFileView } from "../../types/git";
import StructuredDiffTable, {
  StructuredDiffMode,
} from "../Diff/StructuredDiffTable";

export interface CodeMirrorDiffViewerProps {
  diffFiles: DiffFileView[];
  loading?: boolean;
  error?: string | null;
  viewMode?: "diff" | "old" | "new";
  alwaysShowFileHeaders?: boolean;
  sentinelRef?: RefObject<HTMLDivElement>;
}

const C = {
  bg: "var(--bg-primary)",
  lnText: "var(--text-secondary)",
  danger: "var(--danger)",
};

function mapMode(viewMode: "diff" | "old" | "new"): StructuredDiffMode {
  if (viewMode === "old") {
    return "old";
  }
  if (viewMode === "new") {
    return "new";
  }
  return "unified";
}

function fallbackMessage(viewMode: "diff" | "old" | "new"): string {
  if (viewMode === "old") {
    return "No old-side changes for current context.";
  }
  if (viewMode === "new") {
    return "No new-side changes for current context.";
  }
  return "No changed lines for current context.";
}

const CodeMirrorDiffViewer = forwardRef<HTMLDivElement, CodeMirrorDiffViewerProps>(
  function CodeMirrorDiffViewer(
    {
      diffFiles,
      loading = false,
      error = null,
      viewMode = "diff",
      alwaysShowFileHeaders = false,
      sentinelRef,
    },
    scrollRef
  ) {
    if (loading) {
      return (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: C.bg,
          }}
        >
          <span style={{ fontSize: 12, color: C.lnText }}>Loading...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: C.bg,
          }}
        >
          <span style={{ fontSize: 12, color: C.danger }}>{error}</span>
        </div>
      );
    }

    return (
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", background: C.bg }}>
        <StructuredDiffTable
          files={diffFiles}
          mode={mapMode(viewMode)}
          emptyMessage={fallbackMessage(viewMode)}
          alwaysShowFileHeaders={alwaysShowFileHeaders}
        />
        {sentinelRef ? <div ref={sentinelRef} style={{ height: 1 }} /> : null}
      </div>
    );
  }
);

export default CodeMirrorDiffViewer;
