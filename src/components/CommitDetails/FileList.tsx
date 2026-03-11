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
      <div className="file-list">
        <p>No files changed</p>
      </div>
    );
  }

  return (
    <div className="file-list classic-gitk">
      <ul className="file-list-items">
        {rows.map(({ file, selected, icon, color }) => (
          <li
            key={file.path}
            className={`file-item ${selected ? "selected" : ""}`}
            onClick={() => onFileSelect(file.path)}
          >
            <span className="file-status" style={{ color }}>{icon}</span>
            <span className="file-path">{file.path}</span>
            {(file.additions > 0 || file.deletions > 0) && (
              <span className="file-stats">
                <span className="stat-additions">+{file.additions}</span>
                <span className="stat-deletions">-{file.deletions}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
