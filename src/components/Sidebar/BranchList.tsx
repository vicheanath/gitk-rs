import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Branch } from "../../types/git";
import CreateBranchDialog from "./CreateBranchDialog";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Folder,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

type BranchTreeNode =
  | {
      type: "folder";
      name: string;
      path: string;
      children: BranchTreeNode[];
    }
  | {
      type: "branch";
      branch: Branch;
    };

interface MutableFolderNode {
  childrenFolders: Map<string, MutableFolderNode>;
  branches: Branch[];
}

function buildBranchTree(branches: Branch[]): BranchTreeNode[] {
  const root: MutableFolderNode = {
    childrenFolders: new Map(),
    branches: [],
  };

  for (const branch of branches) {
    const parts = branch.name.split("/").filter(Boolean);
    if (parts.length <= 1) {
      root.branches.push(branch);
      continue;
    }

    let current = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const segment = parts[i];
      const existing = current.childrenFolders.get(segment);
      if (existing) {
        current = existing;
      } else {
        const next: MutableFolderNode = {
          childrenFolders: new Map(),
          branches: [],
        };
        current.childrenFolders.set(segment, next);
        current = next;
      }
    }

    current.branches.push(branch);
  }

  const toNodes = (folder: MutableFolderNode, basePath = ""): BranchTreeNode[] => {
    const folderNodes: BranchTreeNode[] = Array.from(folder.childrenFolders.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, childFolder]) => {
        const path = basePath ? `${basePath}/${name}` : name;
        return {
          type: "folder" as const,
          name,
          path,
          children: toNodes(childFolder, path),
        };
      });

    const branchNodes: BranchTreeNode[] = folder.branches
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((branch) => ({ type: "branch" as const, branch }));

    return [...folderNodes, ...branchNodes];
  };

  return toNodes(root);
}

function collectFolderPaths(nodes: BranchTreeNode[], acc = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (node.type === "folder") {
      acc.add(node.path);
      collectFolderPaths(node.children, acc);
    }
  }
  return acc;
}

export default function BranchList() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const loadBranches = () => {
    setLoading(true);
    setError(null);
    invoke<Branch[]>("get_branches")
      .then((data) => {
        setBranches(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.toString());
        setLoading(false);
      });
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const branchTree = useMemo(() => buildBranchTree(branches), [branches]);

  useEffect(() => {
    const allFolderPaths = collectFolderPaths(branchTree);
    setExpandedFolders(allFolderPaths);
  }, [branchTree]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const renderBranchNode = (node: BranchTreeNode, level = 0): JSX.Element => {
    if (node.type === "folder") {
      const expanded = expandedFolders.has(node.path);
      return (
        <li key={`folder:${node.path}`} className="branch-tree-node">
          <button
            type="button"
            className="branch-folder-row"
            onClick={() => toggleFolder(node.path)}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
          >
            <span className="branch-folder-chevron">
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
            <span className="branch-folder-icon">
              <Folder size={12} />
            </span>
            <span className="branch-folder-name">{node.name}</span>
          </button>
          {expanded && node.children.length > 0 && (
            <ul className="branch-items branch-items-nested">
              {node.children.map((child) => renderBranchNode(child, level + 1))}
            </ul>
          )}
        </li>
      );
    }

    const branch = node.branch;
    return (
      <li
        key={branch.name}
        className={`branch-item branch-tree-branch ${branch.is_current ? "current" : ""} ${branch.is_remote ? "remote" : ""}`}
        title={branch.commit_id.substring(0, 8)}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <div className="branch-info">
          {branch.is_current && (
            <span className="branch-indicator">
              <CircleDot size={12} />
            </span>
          )}
          <span className="branch-name">{branch.name.split("/").pop() ?? branch.name}</span>
          {branch.is_remote && <span className="branch-remote-indicator">[remote]</span>}
        </div>
        <div className="branch-actions">
          {!branch.is_current && !branch.is_remote && (
            <>
              <button onClick={() => handleCheckout(branch.name)} title="Checkout">
                <Check size={14} />
              </button>
              <button onClick={() => handleDelete(branch.name)} className="danger" title="Delete">
                <Trash2 size={14} />
              </button>
            </>
          )}
          {!branch.is_current && branch.is_remote && (
            <button onClick={() => handleCheckout(branch.name)} title="Checkout">
              <Check size={14} />
            </button>
          )}
        </div>
      </li>
    );
  };

  const handleCheckout = async (branchName: string) => {
    try {
      await invoke("checkout_branch", { name: branchName });
      loadBranches();
    } catch (err) {
      alert(`Failed to checkout branch: ${err}`);
    }
  };

  const handleDelete = async (branchName: string) => {
    if (!confirm(`Delete branch "${branchName}"?`)) {
      return;
    }
    try {
      await invoke("delete_branch", { name: branchName });
      loadBranches();
    } catch (err) {
      alert(`Failed to delete branch: ${err}`);
    }
  };

  if (loading) {
    return <div className="sidebar-state">Loading branches...</div>;
  }

  if (error) {
    return <div className="sidebar-state error">Error: {error}</div>;
  }

  return (
    <div className="branch-list classic-gitk">
      <div className="branch-list-header">
        <h3>Branches ({branches.length})</h3>
        <div className="branch-list-actions">
          <button onClick={() => setShowCreateDialog(true)} title="Create Branch">
            <Plus size={14} />
          </button>
          <button onClick={loadBranches} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
      <CreateBranchDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={loadBranches}
      />
      <ul className="branch-items">
        {branchTree.map((node) => renderBranchNode(node))}
      </ul>
    </div>
  );
}

