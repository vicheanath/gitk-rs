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
      <div key={node.path} className="tree-node">
        <div
          className={`tree-item ${isSelected ? "selected" : ""}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            if (isDirectory) {
              toggleExpand(node.path);
            } else {
              handleFileClick(node.path);
            }
          }}
        >
          <span className="tree-icon">
            {isDirectory ? (
              <span className="tree-folder">{isExpanded ? "v" : ">"}</span>
            ) : (
              <span className="tree-file">-</span>
            )}
          </span>
          <span className="tree-name">{node.name}</span>
          {!isDirectory && node.size !== undefined && (
            <span className="tree-size">{formatTreeItemSize(node.size)}</span>
          )}
        </div>
        {isDirectory && isExpanded && hasChildren && (
          <div className="tree-children">
            {node.children!.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="tree-view">
        <p>Loading tree...</p>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="tree-view">
        <p>No files in this commit</p>
      </div>
    );
  }

  return (
    <div className="tree-view classic-gitk">
      <div className="tree-header">
        <h3>File Tree</h3>
        <span className="tree-info">
          {itemCount} item{itemCount !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="tree-content">
        {tree.map((node) => renderTreeNode(node))}
      </div>
    </div>
  );
}
