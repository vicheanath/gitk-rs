import FileList from "./FileList";
import TreeView from "./TreeView";
import { ChangedFile } from "../../types/git";

interface FileNavigatorProps {
  commitId: string;
  changedFiles: ChangedFile[];
  selectedFile?: string | null;
  onFileSelect: (filePath: string) => void;
  navigatorMode: "tree" | "files";
  filesCount: number;
}

export default function FileNavigator({
  commitId,
  changedFiles,
  selectedFile,
  onFileSelect,
  navigatorMode,
  filesCount,
}: FileNavigatorProps) {
  return (
    <aside className="flex min-h-0 h-full flex-col overflow-hidden rounded-md bg-[color-mix(in_srgb,var(--bg-secondary)_84%,transparent)]">
      <div className="shrink-0 border-b border-[var(--border-color)] px-2 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
        Changed files
        <span className="ml-1.5 rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">{filesCount}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {navigatorMode === "tree" ? (
          <TreeView
            commitId={commitId}
            changedFiles={changedFiles}
            selectedFile={selectedFile}
            onFileSelect={onFileSelect}
          />
        ) : (
          <FileList
            files={changedFiles}
            selectedFile={selectedFile ?? null}
            onFileSelect={onFileSelect}
          />
        )}
      </div>
    </aside>
  );
}
