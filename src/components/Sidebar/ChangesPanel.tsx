import { useEffect, useMemo, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Folder,
  GitCommitHorizontal,
  List,
  Minus,
  RefreshCw,
  RotateCcw,
  Waypoints,
} from "lucide-react";
import { DiffFileView, DiffViewResponse, WorkingTreeFile } from "../../types/git";
import { useAppContext } from "../../context/AppContext";
import { Button } from "../ui/button";
import StructuredDiffTable from "../Diff/StructuredDiffTable";

type ViewMode = "tree" | "list";
type SectionKind = "staged" | "unstaged";

interface SelectedChange {
  path: string;
  section: SectionKind;
}

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

function getAncestorFolderPaths(path: string): string[] {
  const parts = path.split("/").filter(Boolean);
  const folders = parts.slice(0, -1);
  const ancestors: string[] = [];
  for (let i = 0; i < folders.length; i += 1) {
    ancestors.push(folders.slice(0, i + 1).join("/"));
  }
  return ancestors;
}

function getStatusForSection(file: WorkingTreeFile, section: SectionKind) {
  return section === "staged" ? file.staged_status : file.unstaged_status;
}

function formatStatus(file: WorkingTreeFile, section: SectionKind): string {
  const status = getStatusForSection(file, section);
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

function statusTone(file: WorkingTreeFile, section: SectionKind): string {
  if (file.conflicted) return "conflict";
  const status = getStatusForSection(file, section);
  if (status === "deleted") return "deleted";
  if (status === "modified") return "modified";
  if (status === "renamed" || status === "typechange") return "renamed";
  return "added";
}

function statusToneClass(tone: string): string {
  switch (tone) {
    case "conflict":
      return "text-[var(--danger)]";
    case "deleted":
      return "text-[var(--danger)]";
    case "modified":
      return "text-[var(--warning)]";
    case "renamed":
      return "text-[var(--accent-primary)]";
    default:
      return "text-[var(--success)]";
  }
}

function countFilesInNode(node: ChangeNode): number {
  if (node.type === "file") return 1;
  return node.children.reduce((sum, child) => sum + countFilesInNode(child), 0);
}

export default function ChangesPanel() {
  const { loadCommitGraph, setSelectedCommit } = useAppContext();
  const [files, setFiles] = useState<WorkingTreeFile[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Record<SectionKind, boolean>>({
    staged: true,
    unstaged: true,
  });
  const [selectedChange, setSelectedChange] = useState<SelectedChange | null>(null);
  const [diffFile, setDiffFile] = useState<DiffFileView | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iconBtnClass = "h-5 w-5";
  const toolbarBtnClass =
    "inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50";
  const rowClass =
    "group flex cursor-pointer items-center justify-between gap-1.5 rounded px-1.5 py-0.5 text-[11px] transition-colors hover:bg-[var(--bg-secondary)]";

  const renderSectionHeader = (
    section: SectionKind,
    label: string,
    count: number,
    actions: ReactNode
  ) => (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        className="inline-flex min-w-0 items-center gap-1 text-[11px] text-[var(--text-secondary)]"
        onClick={() => toggleSection(section)}
      >
        {expandedSections[section] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span className="truncate font-medium">{label}</span>
        <span className="rounded bg-[var(--bg-tertiary)] px-1 py-0 text-[9px] text-[var(--text-muted)]">
          {count}
        </span>
      </button>
      <div className="flex items-center gap-1">{actions}</div>
    </div>
  );

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
    setSelectedChange((current) => {
      if (
        current &&
        files.some(
          (file) =>
            file.path === current.path &&
            (current.section === "staged" ? file.staged : file.unstaged || (!file.staged && !file.unstaged))
        )
      ) {
        return current;
      }

      if (unstagedFiles.length > 0) {
        return { path: unstagedFiles[0].path, section: "unstaged" };
      }

      if (stagedFiles.length > 0) {
        return { path: stagedFiles[0].path, section: "staged" };
      }

      return null;
    });
  }, [files, stagedFiles, unstagedFiles]);

  useEffect(() => {
    if (!selectedChange || selectedChange.section !== "unstaged") {
      setExpandedFolders(new Set());
      return;
    }

    const ancestors = getAncestorFolderPaths(selectedChange.path);
    setExpandedFolders(new Set(ancestors));
  }, [selectedChange]);

  useEffect(() => {
    if (!selectedChange) {
      setDiffFile(null);
      setDiffError(null);
      return;
    }

    let cancelled = false;

    const loadDiff = async () => {
      setDiffLoading(true);
      setDiffError(null);
      try {
        const result = await invoke<DiffViewResponse>("get_working_tree_diff_view", {
          path: selectedChange.path,
          staged: selectedChange.section === "staged",
          contextLines: 3,
          ignoreWhitespace: false,
        });

        if (!cancelled) {
          const selectedDiffFile: DiffFileView | null =
            result.files.find(
              (file) =>
                file.path === selectedChange.path ||
                file.oldPath === selectedChange.path ||
                file.newPath === selectedChange.path
            ) ??
            (result.files.length > 0 ? result.files[0] : null);
          setDiffFile(selectedDiffFile);
        }
      } catch (err) {
        if (!cancelled) {
          setDiffError(String(err));
          setDiffFile(null);
        }
      } finally {
        if (!cancelled) {
          setDiffLoading(false);
        }
      }
    };

    void loadDiff();

    return () => {
      cancelled = true;
    };
  }, [selectedChange]);

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

  const toggleSection = (section: SectionKind) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
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

  const renderFileRow = (
    file: WorkingTreeFile,
    section: SectionKind,
    compactPath = false,
    level = 0
  ) => {
    const tone = statusTone(file, section);
    const fileName = file.path.split("/").pop() ?? file.path;
    const pathSuffix = compactPath
      ? file.path.split("/").slice(0, -1).join("/")
      : file.path;
    const selected =
      selectedChange?.path === file.path && selectedChange.section === section;

    return (
      <li
        key={`${section}:${file.path}`}
        className={`${rowClass} ${
          selected ? "bg-[var(--bg-secondary)]" : ""
        }`}
        style={compactPath ? { paddingLeft: `${level * 14 + 8}px` } : undefined}
        onClick={() => setSelectedChange({ path: file.path, section })}
      >
        <div className="flex min-w-0 items-center gap-1">
          <span className={`w-3 text-center font-mono text-[9px] font-semibold ${statusToneClass(tone)}`}>
            {formatStatus(file, section)}
          </span>
          <span className="inline-flex h-3 w-3 items-center justify-center text-[var(--text-muted)]">
            <FileCode2 size={11} />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[11px] text-[var(--text-primary)]" title={file.path}>
              {compactPath ? fileName : file.path}
            </span>
            {compactPath && pathSuffix ? (
              <span className="truncate text-[9px] text-[var(--text-muted)]" title={pathSuffix}>
                {pathSuffix}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          {section === "staged" ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={iconBtnClass}
                onClick={(event) => {
                  event.stopPropagation();
                  void runAction(() => invoke("unstage_paths", { paths: [file.path] }));
                }}
                disabled={busy}
                title="Unstage changes"
              >
                <Minus size={12} />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={iconBtnClass}
                onClick={(event) => {
                  event.stopPropagation();
                  void runAction(() => invoke("discard_paths", { paths: [file.path] }));
                }}
                disabled={busy}
                title="Discard changes"
              >
                <RotateCcw size={12} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={iconBtnClass}
                onClick={(event) => {
                  event.stopPropagation();
                  void runAction(() => invoke("stage_paths", { paths: [file.path] }));
                }}
                disabled={busy}
                title="Stage changes"
              >
                <Check size={12} />
              </Button>
            </>
          )}
        </div>
      </li>
    );
  };

  const renderTreeNode = (node: ChangeNode, level = 0): JSX.Element => {
    if (node.type === "file") {
      return renderFileRow(node.file, "unstaged", true, level);
    }

    const expanded = expandedFolders.has(node.path);
    const folderFileCount = node.children.reduce((sum, child) => sum + countFilesInNode(child), 0);
    const folderPathMeta = node.path.includes("/")
      ? node.path.slice(0, node.path.lastIndexOf("/"))
      : "";

    return (
      <li key={node.path} className="space-y-0.5">
        <button
          type="button"
          className="flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)]"
          style={{ paddingLeft: `${level * 14 + 8}px` }}
          onClick={() => toggleFolder(node.path)}
        >
          <span className="inline-flex h-3 w-3 items-center justify-center text-[var(--text-muted)]">
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </span>
          <span className="inline-flex h-3 w-3 items-center justify-center text-[var(--text-muted)]"><Folder size={11} /></span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[11px] font-medium text-[var(--text-secondary)]" title={node.path}>
              {node.name}
            </span>
            {folderPathMeta ? (
              <span className="truncate text-[9px] text-[var(--text-muted)]" title={folderPathMeta}>
                {folderPathMeta}
              </span>
            ) : null}
          </span>
          <span
            className="rounded bg-[var(--bg-tertiary)] px-1 py-0 text-[9px] text-[var(--text-muted)]"
            title={`${folderFileCount} file${folderFileCount > 1 ? "s" : ""}`}
          >
            {folderFileCount}
          </span>
        </button>
        {expanded ? (
          <ul className="space-y-0.5">
            {node.children.map((child) => renderTreeNode(child, level + 1))}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <div className="space-y-2 px-1.5 pb-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Changes
          </h3>
          <span className="text-[9px] text-[var(--text-muted)]">
            {stagedFiles.length} staged, {unstagedFiles.length} unstaged
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`${toolbarBtnClass} ${
              viewMode === "tree" ? "ring-1 ring-[var(--accent-primary)]" : ""
            }`}
            onClick={() => setViewMode("tree")}
            title="Tree view"
          >
            <Waypoints size={11} />
          </button>
          <button
            type="button"
            className={`${toolbarBtnClass} ${
              viewMode === "list" ? "ring-1 ring-[var(--accent-primary)]" : ""
            }`}
            onClick={() => setViewMode("list")}
            title="List view"
          >
            <List size={11} />
          </button>
          <button
            type="button"
            className={toolbarBtnClass}
            onClick={() => void refreshAll()}
            disabled={busy}
            title="Refresh"
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      <div className="space-y-1.5 rounded bg-[var(--bg-secondary)] p-1.5">
        <textarea
          className="w-full resize-y rounded bg-[var(--bg-primary)] px-1.5 py-1 text-[11px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:ring-1 focus:ring-[var(--accent-primary)]"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Message"
          rows={2}
        />
        <Button
          type="button"
          variant="ghost"
          className="h-6 text-[11px]"
          onClick={() => void handleCommit()}
          disabled={busy || stagedFiles.length === 0 || !message.trim()}
        >
          <GitCommitHorizontal size={11} />
          Commit
        </Button>
      </div>

      {error ? <div className="rounded bg-[var(--danger)]/10 px-2 py-1 text-xs text-[var(--danger)]">{error}</div> : null}

      {loading ? (
        <div className="px-2 py-4 text-xs text-[var(--text-secondary)]">Loading changes...</div>
      ) : files.length === 0 ? (
        <div className="rounded bg-[var(--bg-secondary)] px-3 py-4 text-xs text-[var(--text-secondary)]">
          Working tree clean
        </div>
      ) : (
        <>
          <section className="space-y-1.5 rounded bg-[var(--bg-secondary)] p-1.5">
            {renderSectionHeader(
              "staged",
              "Staged Changes",
              stagedFiles.length,
              <button
                type="button"
                className={toolbarBtnClass}
                onClick={() => void runAction(() => invoke("unstage_all"))}
                disabled={busy || stagedFiles.length === 0}
                title="Unstage all"
              >
                <Minus size={11} />
              </button>
            )}
            {!expandedSections.staged ? null : stagedFiles.length === 0 ? (
              <div className="px-1.5 py-0.5 text-[11px] text-[var(--text-muted)]">No staged files</div>
            ) : (
              <ul className="space-y-0.5">
                {stagedFiles.map((file) => renderFileRow(file, "staged", false))}
              </ul>
            )}
          </section>

          <section className="space-y-1.5 rounded bg-[var(--bg-secondary)] p-1.5">
            {renderSectionHeader(
              "unstaged",
              "Changes",
              unstagedFiles.length,
              <>
                <button
                  type="button"
                  className={toolbarBtnClass}
                  onClick={() => void runAction(() => invoke("stage_all"))}
                  disabled={busy || unstagedFiles.length === 0}
                  title="Stage all"
                >
                  <Check size={11} />
                </button>
                <button
                  type="button"
                  className={toolbarBtnClass}
                  onClick={() => void runAction(() => invoke("discard_all"))}
                  disabled={busy || unstagedFiles.length === 0}
                  title="Discard all"
                >
                  <RotateCcw size={11} />
                </button>
              </>
            )}
            {!expandedSections.unstaged ? null : unstagedFiles.length === 0 ? (
              <div className="px-1.5 py-0.5 text-[11px] text-[var(--text-muted)]">No unstaged files</div>
            ) : viewMode === "tree" ? (
              <ul className="space-y-0.5">
                {unstagedTree.map((node) => renderTreeNode(node))}
              </ul>
            ) : (
              <ul className="space-y-0.5">
                {unstagedFiles.map((file) => renderFileRow(file, "unstaged", false))}
              </ul>
            )}
          </section>

          <section className="overflow-hidden rounded bg-[var(--bg-secondary)]">
            <div className="px-2 py-1.5">
              <div>
                <div className="text-xs font-medium text-[var(--text-primary)]">Diff Preview</div>
                <div className="truncate text-[10px] text-[var(--text-muted)]">
                  {selectedChange
                    ? `${selectedChange.section === "staged" ? "Staged" : "Working Tree"} • ${selectedChange.path}`
                    : "Select a file to preview changes"}
                </div>
              </div>
            </div>
            <div className="max-h-64 overflow-auto bg-[var(--bg-primary)] p-2 font-mono text-[11px] leading-5 text-[var(--text-secondary)]">
              {diffLoading ? <p className="text-[var(--text-secondary)]">Loading diff...</p> : null}
              {!diffLoading && diffError ? <p className="text-[var(--danger)]">{diffError}</p> : null}
              {!diffLoading && !diffError && !selectedChange ? (
                <p className="text-[var(--text-muted)]">Select a file to preview changes</p>
              ) : null}
              {!diffLoading && !diffError && selectedChange ? (
                <StructuredDiffTable
                  files={diffFile ? [diffFile] : []}
                  mode="unified"
                  emptyMessage="No changed lines for current context."
                />
              ) : null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
