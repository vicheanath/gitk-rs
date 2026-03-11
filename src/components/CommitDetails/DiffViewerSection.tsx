import { useRef, useEffect, useCallback, useState } from "react";
import { ChevronDown, ChevronRight, FileCode } from "lucide-react";
import CodeMirrorDiffViewer from "./CodeMirrorDiffViewer";
import { ChangedFile } from "../../types/git";

interface DiffViewerSectionProps {
  commitId: string;
  files: ChangedFile[];
  selectedFile?: string | null;
  diffDisplayMode: "unified" | "split";
  contextLines: number;
  ignoreWhitespace: boolean;
}

// GitHub-style file card header
function FileHeader({ path, additions, deletions, collapsed, onToggle }: {
  path: string; additions: number; deletions: number; collapsed: boolean; onToggle: () => void;
}) {
  const name = path.split("/").pop() ?? path;
  const dir  = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "color-mix(in srgb, var(--bg-secondary) 88%, transparent)", borderBottom: "1px solid var(--border-color)",
        height: 36, padding: "0 12px", cursor: "pointer", userSelect: "none", flexShrink: 0,
      }}
    >
      <span style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center" }}>
        {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
      </span>
      <FileCode size={13} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
      <span style={{
        fontFamily: MONO, fontSize: 12, color: "var(--text-primary)",
        flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {dir && <span style={{ color: "var(--text-secondary)" }}>{dir}/</span>}{name}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {additions > 0 && <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: "var(--success)" }}>+{additions}</span>}
        {deletions > 0 && <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: "var(--danger)" }}>-{deletions}</span>}
      </div>
    </div>
  );
}

// Synchronized split view
function SplitView({ commitId, files, selectedFile, contextLines, ignoreWhitespace }: Omit<DiffViewerSectionProps, "diffDisplayMode">) {
  const leftRef  = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing  = useRef(false);

  const sync = useCallback((from: "left" | "right") => () => {
    if (syncing.current) return;
    syncing.current = true;
    const src = from === "left" ? leftRef.current : rightRef.current;
    const dst = from === "left" ? rightRef.current : leftRef.current;
    if (src && dst) { dst.scrollTop = src.scrollTop; dst.scrollLeft = src.scrollLeft; }
    requestAnimationFrame(() => { syncing.current = false; });
  }, []);

  useEffect(() => {
    const l = leftRef.current, r = rightRef.current;
    if (!l || !r) return;
    const ol = sync("left"), or_ = sync("right");
    l.addEventListener("scroll", ol); r.addEventListener("scroll", or_);
    return () => { l.removeEventListener("scroll", ol); r.removeEventListener("scroll", or_); };
  }, [sync]);

  const shared = { commitId, files, selectedFile, contextLines, ignoreWhitespace } as const;

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRight: "1px solid var(--border-color)" }}>
        <div style={{ background: "color-mix(in srgb, var(--danger) 14%, transparent)", borderBottom: "1px solid var(--border-color)", padding: "3px 12px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontFamily: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace", fontSize: 13, fontWeight: 700, color: "var(--danger)" }}>−</span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Before</span>
        </div>
        <CodeMirrorDiffViewer ref={leftRef}  {...shared} viewMode="old" />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "color-mix(in srgb, var(--success) 14%, transparent)", borderBottom: "1px solid var(--border-color)", padding: "3px 12px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontFamily: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace", fontSize: 13, fontWeight: 700, color: "var(--success)" }}>+</span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>After</span>
        </div>
        <CodeMirrorDiffViewer ref={rightRef} {...shared} viewMode="new" />
      </div>
    </div>
  );
}

export default function DiffViewerSection({
  commitId, files, selectedFile, diffDisplayMode, contextLines, ignoreWhitespace,
}: DiffViewerSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const currentFile = files.find(f => f.path === selectedFile);

  if (!selectedFile) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)" }}>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Select a file to view diff</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden", border: "1px solid var(--border-color)", borderRadius: 6 }}>
      <FileHeader
        path={selectedFile}
        additions={currentFile?.additions ?? 0}
        deletions={currentFile?.deletions ?? 0}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
      />
      {!collapsed && (
        diffDisplayMode === "unified"
          ? <CodeMirrorDiffViewer
              commitId={commitId} files={files} selectedFile={selectedFile}
              viewMode="diff" contextLines={contextLines} ignoreWhitespace={ignoreWhitespace}
            />
          : <SplitView
              commitId={commitId} files={files} selectedFile={selectedFile}
                 contextLines={contextLines} ignoreWhitespace={ignoreWhitespace}
            />
      )}
    </div>
  );
}
