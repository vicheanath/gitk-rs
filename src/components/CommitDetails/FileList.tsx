import { ChangedFile } from "../../types/git";
import { useFileListViewModel } from "../../viewmodels/useFileListViewModel";

interface FileListProps {
  files: ChangedFile[];
  onFileSelect: (filePath: string) => void;
  selectedFile: string | null;
}

export default function FileList({
  files,
  onFileSelect,
  selectedFile,
}: FileListProps) {
  const { rows, isEmpty } = useFileListViewModel({
    files,
    selectedFile,
  });

  if (isEmpty) {
    return (
      <div className="p-3 text-xs text-[var(--text-secondary)]">
        <p>No files changed</p>
      </div>
    );
  }

  return (
    <div className="p-2">
      <ul className="space-y-1">
        {rows.map(({ file, selected, icon, color }) => (
          <li
            key={file.path}
            className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs transition-colors hover:bg-[var(--bg-secondary)] ${
              selected ? "bg-[var(--bg-secondary)]" : ""
            }`}
            onClick={() => onFileSelect(file.path)}
          >
            <span className="w-3 text-center" style={{ color }}>{icon}</span>
            <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">{file.path}</span>
            {(file.additions > 0 || file.deletions > 0) && (
              <span className="ml-auto inline-flex items-center gap-1 text-[10px]">
                <span className="text-[var(--success)]">+{file.additions}</span>
                <span className="text-[var(--danger)]">-{file.deletions}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
