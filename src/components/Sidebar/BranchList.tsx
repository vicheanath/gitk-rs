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
    const iconButtonClass =
      "inline-flex h-6 w-6 items-center justify-center rounded border border-(--border-primary) bg-(--bg-tertiary) text-(--text-primary) transition-colors hover:bg-(--bg-secondary) disabled:cursor-not-allowed disabled:opacity-50";

    if (node.type === "folder") {
      const expanded = expandedFolders.has(node.path);
      return (
        <li key={`folder:${node.path}`} className="space-y-1">
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs text-(--text-secondary) transition-colors hover:bg-(--bg-secondary)"
            onClick={() => toggleFolder(node.path)}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
          >
            <span className="inline-flex h-3 w-3 items-center justify-center text-(--text-muted)">
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
            <span className="inline-flex h-3 w-3 items-center justify-center text-(--text-muted)">
              <Folder size={12} />
            </span>
            <span className="truncate font-medium text-(--text-secondary)">{node.name}</span>
          </button>
          {expanded && node.children.length > 0 && (
            <ul className="space-y-1">
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
        className={`group flex items-center justify-between gap-2 rounded px-2 py-1 text-xs transition-colors hover:bg-(--bg-secondary) ${
          branch.is_current ? "bg-(--bg-secondary)" : ""
        }`}
        title={branch.commit_id.substring(0, 8)}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {branch.is_current && (
            <span className="inline-flex h-3 w-3 items-center justify-center text-(--accent-primary)">
              <CircleDot size={12} />
            </span>
          )}
          <span className="truncate font-medium text-(--text-primary)">
            {branch.name.split("/").pop() ?? branch.name}
          </span>
          {branch.is_remote && (
            <span className="rounded border border-(--border-primary) px-1 py-0.5 text-[10px] uppercase tracking-wide text-(--text-muted)">
              remote
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          {!branch.is_current && !branch.is_remote && (
            <>
              <button
                type="button"
                className={iconButtonClass}
                onClick={() => handleCheckout(branch.name)}
                title="Checkout"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                className={`${iconButtonClass} text-(--danger) hover:bg-(--bg-secondary)`}
                onClick={() => handleDelete(branch.name)}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
          {!branch.is_current && branch.is_remote && (
            <button
              type="button"
              className={iconButtonClass}
              onClick={() => handleCheckout(branch.name)}
              title="Checkout"
            >
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
    return <div className="px-2 py-4 text-xs text-(--text-secondary)">Loading branches...</div>;
  }

  if (error) {
    return <div className="px-2 py-4 text-xs text-(--danger)">Error: {error}</div>;
  }

  return (
    <div className="space-y-2 px-2 pb-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-(--text-secondary)">
          Branches ({branches.length})
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-(--border-primary) bg-(--bg-tertiary) text-(--text-primary) transition-colors hover:bg-(--bg-secondary)"
            onClick={() => setShowCreateDialog(true)}
            title="Create Branch"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-(--border-primary) bg-(--bg-tertiary) text-(--text-primary) transition-colors hover:bg-(--bg-secondary)"
            onClick={loadBranches}
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
      <CreateBranchDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={loadBranches}
      />
      <ul className="space-y-1">
        {branchTree.map((node) => renderBranchNode(node))}
      </ul>
    </div>
  );
}

