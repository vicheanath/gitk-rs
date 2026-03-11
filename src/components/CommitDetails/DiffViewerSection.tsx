import CodeMirrorDiffViewer from "./CodeMirrorDiffViewer";
import { ChangedFile } from "../../types/git";

interface DiffViewerSectionProps {
  commitId: string;
  files: ChangedFile[];
  selectedFile?: string | null;
  diffDisplayMode: "unified" | "split";
  contextLines: number;
  ignoreWhitespace: boolean;
}

export default function DiffViewerSection({
  commitId,
  files,
  selectedFile,
  diffDisplayMode,
  contextLines,
  ignoreWhitespace,
}: DiffViewerSectionProps) {
  if (!selectedFile) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-[var(--text-secondary)]">Select a file to view its changes</p>
      </div>
    );
  }

  if (diffDisplayMode === "unified") {
    return (
      <CodeMirrorDiffViewer
        commitId={commitId}
        files={files}
        selectedFile={selectedFile}
        viewMode="diff"
        contextLines={contextLines}
        ignoreWhitespace={ignoreWhitespace}
      />
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-2 gap-1 p-1 max-[980px]:grid-cols-1">
      <div className="min-h-0 overflow-hidden rounded bg-[var(--bg-primary)]">
        <div className="px-2 py-1 text-xs font-medium text-[var(--text-secondary)]">Old</div>
        <CodeMirrorDiffViewer
          commitId={commitId}
          files={files}
          selectedFile={selectedFile}
          viewMode="old"
          contextLines={contextLines}
          ignoreWhitespace={ignoreWhitespace}
        />
      </div>
      <div className="min-h-0 overflow-hidden rounded bg-[var(--bg-primary)]">
        <div className="px-2 py-1 text-xs font-medium text-[var(--text-secondary)]">New</div>
        <CodeMirrorDiffViewer
          commitId={commitId}
          files={files}
          selectedFile={selectedFile}
          viewMode="new"
          contextLines={contextLines}
          ignoreWhitespace={ignoreWhitespace}
        />
      </div>
    </div>
  );
}
