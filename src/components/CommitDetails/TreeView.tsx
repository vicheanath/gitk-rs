import { ChangedFile, TreeNode } from "../../types/git";
import {
  formatTreeItemSize,
  useTreeViewViewModel,
} from "../../viewmodels/useTreeViewViewModel";

interface TreeViewProps {
  commitId: string;
  changedFiles?: ChangedFile[];
  selectedFile?: string | null;
  onFileSelect?: (filePath: string) => void;
}

export default function TreeView({
  commitId,
  changedFiles = [],
  selectedFile,
  onFileSelect,
}: TreeViewProps) {
  const {
    tree,
    loading,
    itemCount,
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
      <div key={node.path} className="space-y-1">
        <div
          className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-[var(--bg-secondary)] ${
            isSelected ? "bg-[var(--bg-secondary)]" : ""
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            if (isDirectory) {
              toggleExpand(node.path);
            } else {
              handleFileClick(node.path);
            }
          }}
        >
          <span className="inline-flex h-3 w-3 items-center justify-center text-[var(--text-muted)]">
            {isDirectory ? (
              <span>{isExpanded ? "v" : ">"}</span>
            ) : (
              <span>-</span>
            )}
          </span>
          <span className="truncate text-[var(--text-primary)]">{node.name}</span>
          {!isDirectory && node.size !== undefined && (
            <span className="ml-auto text-[10px] text-[var(--text-muted)]">{formatTreeItemSize(node.size)}</span>
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
      <div className="p-3 text-xs text-[var(--text-secondary)]">
        <p>Loading tree...</p>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="p-3 text-xs text-[var(--text-secondary)]">
        <p>No files in this commit</p>
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-medium text-[var(--text-secondary)]">File Tree</h3>
        <span className="text-[10px] text-[var(--text-muted)]">
          {itemCount} item{itemCount !== 1 ? "s" : ""}
        </span>
      </div>
      <div>
        {tree.map((node) => renderTreeNode(node))}
      </div>
    </div>
  );
}
