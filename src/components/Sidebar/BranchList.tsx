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
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

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

function getAncestorFolderPaths(path: string): string[] {
  const parts = path.split("/").filter(Boolean);
  const folders = parts.slice(0, -1);
  const ancestors: string[] = [];
  for (let i = 0; i < folders.length; i += 1) {
    ancestors.push(folders.slice(0, i + 1).join("/"));
  }
  return ancestors;
}

export default function BranchList() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const toolbarBtnClass =
    "inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50";
  const rowClass =
    "group flex items-center justify-between gap-2 rounded px-1.5 py-0.5 text-[11px] transition-colors hover:bg-[var(--bg-secondary)]";

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
    const currentBranch = branches.find((branch) => branch.is_current);
    if (!currentBranch) {
      setExpandedFolders(new Set());
      return;
    }

    setExpandedFolders(new Set(getAncestorFolderPaths(currentBranch.name)));
  }, [branches]);

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
        <li key={`folder:${node.path}`} className="space-y-0.5">
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)]"
            onClick={() => toggleFolder(node.path)}
            style={{ paddingLeft: `${level * 14 + 8}px` }}
          >
            <span className="inline-flex h-3 w-3 items-center justify-center text-[var(--text-muted)]">
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </span>
            <span className="inline-flex h-3 w-3 items-center justify-center text-[var(--text-muted)]">
              <Folder size={11} />
            </span>
            <span className="truncate font-medium text-[var(--text-secondary)]">{node.name}</span>
          </button>
          {expanded && node.children.length > 0 && (
            <ul className="space-y-0.5">
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
        className={`${rowClass} ${branch.is_current ? "bg-[var(--bg-secondary)]" : ""}`}
        title={branch.commit_id.substring(0, 8)}
        style={{ paddingLeft: `${level * 14 + 8}px` }}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {branch.is_current && (
            <span className="inline-flex h-3 w-3 items-center justify-center text-[var(--accent-primary)]">
              <CircleDot size={11} />
            </span>
          )}
          <span className="truncate text-[11px] font-medium text-[var(--text-primary)]">
            {branch.name.split("/").pop() ?? branch.name}
          </span>
          {branch.is_remote && (
            <Badge variant="muted">
              remote
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          {!branch.is_current && !branch.is_remote && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={toolbarBtnClass}
                onClick={() => handleCheckout(branch.name)}
                title="Checkout"
              >
                <Check size={11} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`${toolbarBtnClass} text-[var(--danger)]`}
                onClick={() => handleDelete(branch.name)}
                title="Delete"
              >
                <Trash2 size={11} />
              </Button>
            </>
          )}
          {!branch.is_current && branch.is_remote && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={toolbarBtnClass}
              onClick={() => handleCheckout(branch.name)}
              title="Checkout"
            >
              <Check size={11} />
            </Button>
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
    return (
      <div className="space-y-2 px-1.5 pb-2">
        <div className="rounded bg-[var(--bg-secondary)] px-3 py-4 text-xs text-[var(--text-secondary)]">
          Loading branches...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2 px-1.5 pb-2">
        <div className="rounded bg-[var(--danger)]/10 px-2 py-1 text-xs text-[var(--danger)]">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-1.5 pb-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Branches
          </h3>
          <span className="text-[9px] text-[var(--text-muted)]">
            {branches.length} total
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={toolbarBtnClass}
            onClick={() => setShowCreateDialog(true)}
            title="Create Branch"
          >
            <Plus size={11} />
          </button>
          <button
            type="button"
            className={toolbarBtnClass}
            onClick={loadBranches}
            title="Refresh"
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </div>
      <CreateBranchDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={loadBranches}
      />
      <section className="space-y-1.5 rounded bg-[var(--bg-secondary)] p-1.5">
        {branchTree.length === 0 ? (
          <div className="px-1.5 py-0.5 text-[11px] text-[var(--text-muted)]">
            No branches found
          </div>
        ) : (
          <ul className="space-y-0.5">
            {branchTree.map((node) => renderBranchNode(node))}
          </ul>
        )}
      </section>
    </div>
  );
}
