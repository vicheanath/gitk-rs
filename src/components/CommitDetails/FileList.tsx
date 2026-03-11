import { FilePlus, FileMinus, FilePen, FileQuestion } from "lucide-react";
import { ChangedFile } from "../../types/git";
import { useFileListViewModel } from "../../viewmodels/useFileListViewModel";
import { cn } from "../../lib/utils";

interface FileListProps {
  files: ChangedFile[];
  onFileSelect: (filePath: string) => void;
  selectedFile: string | null;
}

const STATUS_CONFIG: Record<ChangedFile["status"], { icon: React.ReactNode; badge: string; badgeClass: string; color: string }> = {
  added:    { icon: <FilePlus size={13} />,    badge: "A", badgeClass: "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--success)_35%,transparent)]", color: "var(--success)" },
  deleted:  { icon: <FileMinus size={13} />,   badge: "D", badgeClass: "bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-[var(--danger)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--danger)_35%,transparent)]",   color: "var(--danger)" },
  modified: { icon: <FilePen size={13} />,     badge: "M", badgeClass: "bg-[color-mix(in_srgb,#60a5fa_18%,transparent)] text-[#60a5fa] ring-1 ring-inset ring-[color-mix(in_srgb,#60a5fa_35%,transparent)]",                    color: "#60a5fa" },
  renamed:  { icon: <FilePen size={13} />,     badge: "R", badgeClass: "bg-[color-mix(in_srgb,#f59e0b_18%,transparent)] text-[#f59e0b] ring-1 ring-inset ring-[color-mix(in_srgb,#f59e0b_35%,transparent)]",                    color: "#f59e0b" },
};

function DiffBar({ additions, deletions }: { additions: number; deletions: number }) {
  const total = additions + deletions;
  if (total === 0) return null;
  const addPct = Math.round((additions / total) * 100);
  return (
    <div className="flex h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
      <div className="h-full bg-[var(--success)]" style={{ width: `${addPct}%` }} />
      <div className="h-full flex-1 bg-[var(--danger)]" />
    </div>
  );
}

export default function FileList({
  files,
  onFileSelect,
  selectedFile,
}: FileListProps) {
  const { rows, isEmpty } = useFileListViewModel({ files, selectedFile });

  if (isEmpty) {
    return (
      <div className="p-3 text-center text-xs text-[var(--text-secondary)]">
        No files changed
      </div>
    );
  }

  return (
    <ul>
      {rows.map(({ file, selected }) => {
        const cfg = STATUS_CONFIG[file.status] ?? { icon: <FileQuestion size={13} />, badge: "?", badgeClass: "", color: "var(--text-muted)" };
        const fileName = file.path.split("/").pop() ?? file.path;
        const dirName = file.path.includes("/") ? file.path.substring(0, file.path.lastIndexOf("/")) : "";

        return (
          <li
            key={file.path}
            className={cn(
              "group flex cursor-pointer items-center gap-2 border-b border-[color-mix(in_srgb,var(--border-color)_35%,transparent)] px-2 py-[3px] text-xs transition-colors",
              "hover:bg-[color-mix(in_srgb,var(--bg-tertiary)_55%,transparent)]",
              selected && "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
            )}
            onClick={() => onFileSelect(file.path)}
          >
            {/* Status icon */}
            <span style={{ color: cfg.color }} className="shrink-0">{cfg.icon}</span>

            {/* Filename + dir */}
            <span className="min-w-0 flex-1 truncate">
              <span className={cn(
                "font-medium",
                selected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
              )}>
                {fileName}
              </span>
              {dirName && (
                <span className="ml-1 text-[10px] text-[var(--text-muted)]">{dirName}/</span>
              )}
            </span>

            {/* Diff bar + stats */}
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              <DiffBar additions={file.additions} deletions={file.deletions} />
              {(file.additions > 0 || file.deletions > 0) && (
                <span className="hidden items-center gap-0.5 text-[10px] group-hover:flex">
                  <span className="text-[var(--success)]">+{file.additions}</span>
                  <span className="text-[var(--danger)]">-{file.deletions}</span>
                </span>
              )}
              {/* Status badge */}
              <span className={cn("shrink-0 rounded px-1 py-0.5 font-mono text-[10px] font-semibold", cfg.badgeClass)}>
                {cfg.badge}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
