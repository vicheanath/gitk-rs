import { useMemo } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, FilePlus, FileMinus, FilePen } from "lucide-react";
import { ChangedFile, TreeNode } from "../../types/git";
import {
  formatTreeItemSize,
  useTreeViewViewModel,
} from "../../viewmodels/useTreeViewViewModel";
import { cn } from "../../lib/utils";

interface TreeViewProps {
  commitId: string;
  changedFiles?: ChangedFile[];
  selectedFile?: string | null;
  onFileSelect?: (filePath: string) => void;
}

const STATUS_ICON: Record<string, { icon: React.ReactNode; color: string }> = {
  added:    { icon: <FilePlus size={13} />,  color: "var(--success)" },
  deleted:  { icon: <FileMinus size={13} />, color: "var(--danger)" },
  modified: { icon: <FilePen size={13} />,   color: "#60a5fa" },
  renamed:  { icon: <FilePen size={13} />,   color: "#f59e0b" },
};

function FileIcon({ status }: { path?: string; status?: string }) {
  if (status && STATUS_ICON[status]) {
    const { icon, color } = STATUS_ICON[status];
    return <span style={{ color }}>{icon}</span>;
  }
  return <File size={13} className="text-[var(--text-muted)]" />;
}

export default function TreeView({
  commitId,
  changedFiles = [],
  selectedFile,
  onFileSelect,
}: TreeViewProps) {
  // Build a status lookup map from changedFiles
  const statusMap = useMemo<Record<string, ChangedFile["status"]>>(() => {
    const map: Record<string, ChangedFile["status"]> = {};
    for (const f of changedFiles) map[f.path] = f.status;
    return map;
  }, [changedFiles]);
  const {
    tree,
    loading,
    isPathExpanded,
    isPathSelected,
    toggleExpand,
    handleFileClick,
  } = useTreeViewViewModel({
    commitId,
    changedFiles,
    selectedFile,
    onFileSelect,
  });

  const renderTreeNode = (node: TreeNode, level = 0) => {
    const isExpanded = isPathExpanded(node.path);
    const isSelected = isPathSelected(node.path);
    const hasChildren = node.children && node.children.length > 0;
    const isDirectory = node.type === "tree";

    return (
      <div key={node.path}>
        <div
          data-file-path={!isDirectory ? node.path : undefined}
          className={cn(
            "group flex cursor-pointer items-center gap-1.5 border-b border-[color-mix(in_srgb,var(--border-color)_35%,transparent)] py-[3px] pr-2 text-xs transition-colors",
            "hover:bg-[color-mix(in_srgb,var(--bg-tertiary)_55%,transparent)]",
            isSelected && "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--text-primary)]"
          )}
          style={{ paddingLeft: `${level * 14 + 6}px` }}
          onClick={() => {
            if (isDirectory) toggleExpand(node.path);
            else handleFileClick(node.path);
          }}
        >
          {/* Expand/collapse chevron */}
          <span className="shrink-0 text-[var(--text-muted)]">
            {isDirectory ? (
              isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
            ) : (
              <span className="inline-block w-3" />
            )}
          </span>

          {/* Folder or file icon */}
          <span className="shrink-0">
            {isDirectory ? (
              isExpanded
                ? <FolderOpen size={13} className="text-[#f59e0b]" />
                : <Folder size={13} className="text-[#f59e0b]" />
            ) : (
              <FileIcon path={node.path} status={statusMap[node.path]} />
            )}
          </span>

          <span className={cn(
            "min-w-0 flex-1 truncate",
            isSelected ? "font-medium text-[var(--text-primary)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
          )}>
            {node.name}
          </span>

          {/* Size for files */}
          {!isDirectory && node.size !== undefined && (
            <span className="ml-1 shrink-0 text-[10px] text-[var(--text-muted)]">
              {formatTreeItemSize(node.size)}
            </span>
          )}
        </div>

        {isDirectory && isExpanded && hasChildren && (
          <div>
            {node.children!.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-5 animate-pulse rounded bg-[var(--bg-tertiary)]" style={{ width: `${55 + (i * 13) % 35}%`, marginLeft: i % 2 === 1 ? "14px" : "0" }} />
        ))}
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="p-3 text-center text-xs text-[var(--text-secondary)]">
        No files in this commit
      </div>
    );
  }

  return (
    <div>
      {tree.map((node) => renderTreeNode(node))}
    </div>
  );
}
