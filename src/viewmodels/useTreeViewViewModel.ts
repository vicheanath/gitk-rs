import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChangedFile, TreeNode } from "../types/git";

interface UseTreeViewViewModelProps {
  commitId: string;
  changedFiles: ChangedFile[];
  selectedFile?: string | null;
  onFileSelect?: (filePath: string) => void;
}

export function useTreeViewViewModel({
  commitId,
  changedFiles,
  selectedFile,
  onFileSelect,
}: UseTreeViewViewModelProps) {
  const [fullTree, setFullTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(selectedFile ?? null);

  const changedPathsSet = useMemo(() => {
    const paths = new Set<string>();
    changedFiles.forEach((file) => {
      paths.add(file.path);
      const parts = file.path.split("/");
      for (let i = 1; i < parts.length; i += 1) {
        paths.add(parts.slice(0, i).join("/"));
      }
    });
    return paths;
  }, [changedFiles]);

  useEffect(() => {
    setSelectedPath(selectedFile ?? null);
  }, [selectedFile]);

  useEffect(() => {
    if (!selectedFile) {
      return;
    }

    const parts = selectedFile.split("/");
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      for (let index = 1; index < parts.length; index += 1) {
        next.add(parts.slice(0, index).join("/"));
      }
      return next;
    });
  }, [selectedFile]);

  useEffect(() => {
    let cancelled = false;

    if (!commitId) {
      setFullTree([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    invoke<TreeNode[]>("get_commit_tree", { oid: commitId })
      .then((treeData) => {
        if (cancelled) {
          return;
        }
        setFullTree(treeData);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load tree:", error);
          setFullTree([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [commitId]);

  const tree = useMemo(() => {
    if (changedFiles.length === 0) {
      return [];
    }
    return filterTree(fullTree, changedPathsSet);
  }, [fullTree, changedFiles.length, changedPathsSet]);

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleFileClick = (path: string) => {
    setSelectedPath(path);
    onFileSelect?.(path);
  };

  const isPathExpanded = (path: string) => expandedPaths.has(path);
  const isPathSelected = (path: string) => selectedPath === path;

  const itemCount = tree.length;

  return {
    tree,
    loading,
    itemCount,
    isPathExpanded,
    isPathSelected,
    toggleExpand,
    handleFileClick,
  };
}

function filterTree(nodes: TreeNode[], changedPathsSet: Set<string>): TreeNode[] {
  const filtered: TreeNode[] = [];

  nodes.forEach((node) => {
    const filteredChildren = node.children
      ? filterTree(node.children, changedPathsSet)
      : undefined;

    const isChanged = changedPathsSet.has(node.path);
    const isParentOfChanged = Boolean(filteredChildren && filteredChildren.length > 0);

    if (!isChanged && !isParentOfChanged) {
      return;
    }

    filtered.push({
      ...node,
      children: filteredChildren,
    });
  });

  return filtered;
}

export function formatTreeItemSize(bytes?: number): string {
  if (bytes === undefined) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
