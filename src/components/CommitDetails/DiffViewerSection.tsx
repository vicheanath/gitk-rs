import { useRef, useEffect, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChevronDown, ChevronRight, FileCode } from "lucide-react";
import CodeMirrorDiffViewer from "./CodeMirrorDiffViewer";
import { ChangedFile, DiffFileView, DiffViewResponse } from "../../types/git";

interface DiffViewerSectionProps {
  commitId: string;
  files: ChangedFile[];
  selectedFile?: string | null;
  diffDisplayMode: "unified" | "split";
  contextLines: number;
  ignoreWhitespace: boolean;
}

function fileMatchesSelection(file: DiffFileView, selectedFile: string): boolean {
  return (
    file.path === selectedFile ||
    file.oldPath === selectedFile ||
    file.newPath === selectedFile
  );
}

// GitHub-style file card header
function FileHeader({
  path,
  additions,
  deletions,
  collapsed,
  onToggle,
}: {
  path: string;
  additions: number;
  deletions: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const name = path.split("/").pop() ?? path;
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const mono = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "color-mix(in srgb, var(--bg-secondary) 88%, transparent)",
        borderBottom: "1px solid var(--border-color)",
        height: 36,
        padding: "0 12px",
        cursor: "pointer",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      <span style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center" }}>
        {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
      </span>
      <FileCode size={13} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
      <span
        style={{
          fontFamily: mono,
          fontSize: 12,
          color: "var(--text-primary)",
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {dir ? <span style={{ color: "var(--text-secondary)" }}>{dir}/</span> : null}
        {name}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {additions > 0 ? (
          <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: "var(--success)" }}>
            +{additions}
          </span>
        ) : null}
        {deletions > 0 ? (
          <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: "var(--danger)" }}>
            -{deletions}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// Synchronized split view
function SplitView({
  diffFile,
  loading,
  error,
}: {
  diffFile: DiffFileView | null;
  loading: boolean;
  error: string | null;
}) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const sync = useCallback(
    (from: "left" | "right") => () => {
      if (syncing.current) {
        return;
      }

      syncing.current = true;
      const src = from === "left" ? leftRef.current : rightRef.current;
      const dst = from === "left" ? rightRef.current : leftRef.current;

      if (src && dst) {
        dst.scrollTop = src.scrollTop;
        dst.scrollLeft = src.scrollLeft;
      }

      requestAnimationFrame(() => {
        syncing.current = false;
      });
    },
    []
  );

  useEffect(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) {
      return;
    }

    const onLeft = sync("left");
    const onRight = sync("right");

    left.addEventListener("scroll", onLeft);
    right.addEventListener("scroll", onRight);

    return () => {
      left.removeEventListener("scroll", onLeft);
      right.removeEventListener("scroll", onRight);
    };
  }, [sync]);

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRight: "1px solid var(--border-color)",
        }}
      >
        <div
          style={{
            background: "color-mix(in srgb, var(--danger) 14%, transparent)",
            borderBottom: "1px solid var(--border-color)",
            padding: "3px 12px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--danger)",
            }}
          >
            -
          </span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Before</span>
        </div>
        <CodeMirrorDiffViewer
          ref={leftRef}
          diffFile={diffFile}
          loading={loading}
          error={error}
          viewMode="old"
        />
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "color-mix(in srgb, var(--success) 14%, transparent)",
            borderBottom: "1px solid var(--border-color)",
            padding: "3px 12px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--success)",
            }}
          >
            +
          </span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>After</span>
        </div>
        <CodeMirrorDiffViewer
          ref={rightRef}
          diffFile={diffFile}
          loading={loading}
          error={error}
          viewMode="new"
        />
      </div>
    </div>
  );
}

export default function DiffViewerSection({
  commitId,
  files,
  selectedFile,
  diffDisplayMode,
  contextLines,
  ignoreWhitespace,
}: DiffViewerSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [diffFile, setDiffFile] = useState<DiffFileView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentFile = files.find((file) => file.path === selectedFile);

  useEffect(() => {
    let cancelled = false;

    if (!selectedFile) {
      setDiffFile(null);
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    const loadDiff = async () => {
      setLoading(true);
      setError(null);

      try {
        let response = await invoke<DiffViewResponse>("get_commit_diff_view", {
          oid: commitId,
          contextLines,
          ignoreWhitespace,
          filePath: selectedFile,
        });

        if (cancelled) {
          return;
        }

        let selectedDiffFile: DiffFileView | null =
          response.files.find((file) => fileMatchesSelection(file, selectedFile)) ??
          (response.files.length > 0 ? response.files[0] : null);

        if (!selectedDiffFile) {
          response = await invoke<DiffViewResponse>("get_commit_diff_view", {
            oid: commitId,
            contextLines,
            ignoreWhitespace,
          });

          if (cancelled) {
            return;
          }

          selectedDiffFile =
            response.files.find((file) => fileMatchesSelection(file, selectedFile)) ??
            null;
        }

        setDiffFile(selectedDiffFile);
      } catch (err) {
        if (!cancelled) {
          setDiffFile(null);
          setError(String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDiff();

    return () => {
      cancelled = true;
    };
  }, [commitId, selectedFile, contextLines, ignoreWhitespace]);

  if (!selectedFile) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-primary)",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Select a file to view diff
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        border: "1px solid var(--border-color)",
        borderRadius: 6,
      }}
    >
      <FileHeader
        path={selectedFile}
        additions={currentFile?.additions ?? 0}
        deletions={currentFile?.deletions ?? 0}
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
      />
      {!collapsed ? (
        diffDisplayMode === "unified" ? (
          <CodeMirrorDiffViewer
            diffFile={diffFile}
            loading={loading}
            error={error}
            viewMode="diff"
          />
        ) : (
          <SplitView diffFile={diffFile} loading={loading} error={error} />
        )
      ) : null}
    </div>
  );
}
