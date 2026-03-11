import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Folder,
  GitCommitHorizontal,
  List,
  RefreshCw,
  RotateCcw,
  Waypoints,
} from "lucide-react";
import { WorkingTreeFile } from "../../types/git";
import { useAppContext } from "../../context/AppContext";

type ViewMode = "tree" | "list";

type ChangeNode =
  | { type: "folder"; name: string; path: string; children: ChangeNode[] }
  | { type: "file"; file: WorkingTreeFile };

interface MutableFolder {
  folders: Map<string, MutableFolder>;
  files: WorkingTreeFile[];
}

function buildTree(files: WorkingTreeFile[]): ChangeNode[] {
  const root: MutableFolder = { folders: new Map(), files: [] };

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    if (parts.length <= 1) {
      root.files.push(file);
      continue;
    }

    let current = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      const next = current.folders.get(part);
      if (next) {
        current = next;
        continue;
      }
      const created: MutableFolder = { folders: new Map(), files: [] };
      current.folders.set(part, created);
      current = created;
    }

    current.files.push(file);
  }

  const toNodes = (folder: MutableFolder, basePath = ""): ChangeNode[] => {
    const folderNodes = Array.from(folder.folders.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, child]) => {
        const path = basePath ? `${basePath}/${name}` : name;
        return {
          type: "folder" as const,
          name,
          path,
          children: toNodes(child, path),
        };
      });

    const fileNodes = folder.files
      .slice()
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((file) => ({ type: "file" as const, file }));

    return [...folderNodes, ...fileNodes];
  };

  return toNodes(root);
}

function collectFolderPaths(nodes: ChangeNode[], acc = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (node.type === "folder") {
      acc.add(node.path);
      collectFolderPaths(node.children, acc);
    }
  }
  return acc;
}

function formatStatus(file: WorkingTreeFile): string {
  const status = file.staged ? file.staged_status : file.unstaged_status;
  if (file.conflicted) return "C";
  switch (status) {
    case "added":
    case "untracked":
      return "A";
    case "modified":
      return "M";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "typechange":
      return "T";
    default:
      return "•";
  }
}

function statusTone(file: WorkingTreeFile): string {
  if (file.conflicted) return "conflict";
  const status = file.staged ? file.staged_status : file.unstaged_status;
  if (status === "deleted") return "deleted";
  if (status === "modified") return "modified";
  if (status === "renamed" || status === "typechange") return "renamed";
  return "added";
}

export default function ChangesPanel() {
  const { loadCommitGraph, setSelectedCommit } = useAppContext();
  const [files, setFiles] = useState<WorkingTreeFile[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<WorkingTreeFile[]>("get_working_tree_status");
      setFiles(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const stagedFiles = useMemo(() => files.filter((file) => file.staged), [files]);
  const unstagedFiles = useMemo(
    () => files.filter((file) => file.unstaged || (!file.staged && !file.unstaged)),
    [files]
  );
  const unstagedTree = useMemo(() => buildTree(unstagedFiles), [unstagedFiles]);

  useEffect(() => {
    const nextPaths = collectFolderPaths(unstagedTree);
    setExpandedFolders((prev) => {
      if (prev.size === 0) return nextPaths;
      const next = new Set<string>();
      for (const path of nextPaths) {
        if (prev.has(path)) next.add(path);
      }
      return next.size === 0 ? nextPaths : next;
    });
  }, [unstagedTree]);

  const refreshAll = async () => {
    await loadStatus();
    await loadCommitGraph();
  };

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refreshAll();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!message.trim()) {
      setError("Commit message is required");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const commitId = await invoke<string>("commit_staged", {
        message: message.trim(),
      });
      setMessage("");
      await refreshAll();
      setSelectedCommit(commitId);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderFileRow = (file: WorkingTreeFile, compactPath = false, level = 0) => {
    const tone = statusTone(file);
    const fileName = file.path.split("/").pop() ?? file.path;
    const pathSuffix = compactPath
      ? file.path.split("/").slice(0, -1).join("/")
      : file.path;

    return (
      <li
        key={file.path}
        className="changes-row changes-row-file"
        style={compactPath ? { paddingLeft: `${level * 14 + 8}px` } : undefined}
      >
        <div className="changes-row-main">
          <span className={`changes-status-mark ${tone}`}>{formatStatus(file)}</span>
          <span className="changes-file-icon"><FileCode2 size={12} /></span>
          <div className="changes-file-text">
            <span className="changes-file-name" title={file.path}>{compactPath ? fileName : file.path}</span>
            {compactPath && pathSuffix ? (
              <span className="changes-file-meta" title={pathSuffix}>{pathSuffix}</span>
            ) : null}
          </div>
        </div>
        <div className="changes-row-actions">
          <button
            type="button"
            className="changes-icon-btn"
            onClick={() => void runAction(() => invoke("discard_paths", { paths: [file.path] }))}
            disabled={busy}
            title="Discard changes"
          >
            <RotateCcw size={12} />
          </button>
          <button
            type="button"
            className="changes-icon-btn"
            onClick={() => void runAction(() => invoke("stage_paths", { paths: [file.path] }))}
            disabled={busy}
            title="Stage changes"
          >
            <Check size={12} />
          </button>
        </div>
      </li>
    );
  };

  const renderTreeNode = (node: ChangeNode, level = 0): JSX.Element => {
    if (node.type === "file") {
      return renderFileRow(node.file, true, level);
    }

    const expanded = expandedFolders.has(node.path);
    return (
      <li key={node.path} className="changes-tree-node">
        <button
          type="button"
          className="changes-folder-row"
          style={{ paddingLeft: `${level * 14 + 8}px` }}
          onClick={() => toggleFolder(node.path)}
        >
          <span className="changes-folder-chevron">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          <span className="changes-folder-icon"><Folder size={12} /></span>
          <span className="changes-folder-name">{node.name}</span>
        </button>
        {expanded ? (
          <ul className="changes-tree-list">
            {node.children.map((child) => renderTreeNode(child, level + 1))}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <div className="changes-panel vscode-scm-panel">
      <div className="changes-header-row">
        <div>
          <h3>Changes</h3>
          <span className="changes-summary">
            {stagedFiles.length} staged, {unstagedFiles.length} unstaged
          </span>
        </div>
        <div className="changes-toolbar">
          <button
            type="button"
            className={`changes-icon-btn ${viewMode === "tree" ? "active" : ""}`}
            onClick={() => setViewMode("tree")}
            title="Tree view"
          >
            <Waypoints size={12} />
          </button>
          <button
            type="button"
            className={`changes-icon-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
            title="List view"
          >
            <List size={12} />
          </button>
          <button
            type="button"
            className="changes-icon-btn"
            onClick={() => void runAction(() => invoke("stage_all"))}
            disabled={busy || unstagedFiles.length === 0}
            title="Stage all"
          >
            <Check size={12} />
          </button>
          <button
            type="button"
            className="changes-icon-btn"
            onClick={() => void runAction(() => invoke("discard_all"))}
            disabled={busy || unstagedFiles.length === 0}
            title="Discard all"
          >
            <RotateCcw size={12} />
          </button>
          <button
            type="button"
            className="changes-icon-btn"
            onClick={() => void loadStatus()}
            disabled={busy}
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      <div className="changes-commit-box compact">
        <textarea
          className="changes-commit-input compact"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Message"
          rows={2}
        />
        <button
          type="button"
          className="changes-commit-btn compact"
          onClick={() => void handleCommit()}
          disabled={busy || stagedFiles.length === 0 || !message.trim()}
        >
          <GitCommitHorizontal size={12} />
          Commit
        </button>
      </div>

      {error ? <div className="sidebar-state error">{error}</div> : null}

      {loading ? (
        <div className="sidebar-state">Loading changes...</div>
      ) : files.length === 0 ? (
        <div className="sidebar-state">Working tree clean</div>
      ) : (
        <>
          <section className="changes-section compact">
            <div className="changes-section-title">Staged</div>
            {stagedFiles.length === 0 ? (
              <div className="changes-empty">No staged files</div>
            ) : (
              <ul className="changes-list compact">
                {stagedFiles.map((file) => {
                  const tone = statusTone(file);
                  return (
                    <li key={`staged:${file.path}`} className="changes-row changes-row-file staged">
                      <div className="changes-row-main">
                        <span className={`changes-status-mark ${tone}`}>{formatStatus(file)}</span>
                        <span className="changes-file-icon"><FileCode2 size={12} /></span>
                        <div className="changes-file-text">
                          <span className="changes-file-name" title={file.path}>{file.path}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="changes-section compact">
            <div className="changes-section-title">Changes</div>
            {unstagedFiles.length === 0 ? (
              <div className="changes-empty">No unstaged files</div>
            ) : viewMode === "tree" ? (
              <ul className="changes-list compact">
                {unstagedTree.map((node) => renderTreeNode(node))}
              </ul>
            ) : (
              <ul className="changes-list compact">
                {unstagedFiles.map((file) => renderFileRow(file, false))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
