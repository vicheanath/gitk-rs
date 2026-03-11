import { forwardRef, useMemo } from "react";
import { ChangedFile } from "../../types/git";
import { useDiffViewerViewModel } from "../../viewmodels/useDiffViewerViewModel";

export interface CodeMirrorDiffViewerProps {
  commitId: string;
  files: ChangedFile[];
  selectedFile?: string | null;
  viewMode?: "diff" | "old" | "new";
  contextLines?: number;
  ignoreWhitespace?: boolean;
}

// GitHub dark-mode exact colors
const C = {
  bg:       "#0d1117",
  lnBg:     "#161b22",
  lnText:   "#8b949e",
  border:   "#21262d",
  text:     "#e6edf3",
  addBg:    "#12261e",
  addLnBg:  "#1b3a2a",
  addText:  "#aff5b4",
  addWord:  "#1f6f43",
  remBg:    "#2a1a1d",
  remLnBg:  "#4a252a",
  remText:  "#ffdcd7",
  remWord:  "#7a3238",
  hunkBg:   "rgba(33,87,175,0.15)",
  hunkText: "#79c0ff",
};

// Inline char-level diff (common-prefix-suffix approach)
type Seg = { text: string; hl: boolean };

function charDiff(a: string, b: string): [Seg[], Seg[]] {
  let s = 0, ae = a.length - 1, be = b.length - 1;
  while (s <= ae && s <= be && a[s] === b[s]) s++;
  while (ae >= s && be >= s && a[ae] === b[be]) { ae--; be--; }
  const build = (str: string, lo: number, hi: number): Seg[] => {
    const out: Seg[] = [];
    if (lo > 0)   out.push({ text: str.slice(0, lo), hl: false });
    if (lo <= hi) out.push({ text: str.slice(lo, hi + 1), hl: true });
    const tail = str.slice(hi + 1);
    if (tail)     out.push({ text: tail, hl: false });
    return out.length ? out : [{ text: str, hl: false }];
  };
  return [build(a, s, ae), build(b, s, be)];
}

type LineKind = "added" | "removed" | "context" | "hunk";

interface DiffLine {
  kind: LineKind;
  content: string;
  oldNo: number | null;
  newNo: number | null;
  oldSegs?: Seg[];
  newSegs?: Seg[];
}

function parseDiff(text: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldNo = 0, newNo = 0;

  for (const raw of text.split("\n")) {
    if (
      raw.startsWith("diff ") || raw.startsWith("index ") ||
      raw.startsWith("--- ")  || raw.startsWith("+++ ")  ||
      raw.startsWith("Binary ")
    ) continue;

    if (raw.startsWith("@@")) {
      const m = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) { oldNo = parseInt(m[1]) - 1; newNo = parseInt(m[2]) - 1; }
      lines.push({ kind: "hunk", content: raw, oldNo: null, newNo: null });
    } else if (raw.startsWith("-") && !raw.startsWith("---")) {
      lines.push({ kind: "removed", content: raw.slice(1), oldNo: ++oldNo, newNo: null });
    } else if (raw.startsWith("+") && !raw.startsWith("+++")) {
      lines.push({ kind: "added", content: raw.slice(1), oldNo: null, newNo: ++newNo });
    } else {
      const txt = raw.startsWith(" ") ? raw.slice(1) : raw;
      lines.push({ kind: "context", content: txt, oldNo: ++oldNo, newNo: ++newNo });
    }
  }

  // Trim trailing blank context
  while (lines.length > 0 && lines[lines.length - 1].kind === "context" && lines[lines.length - 1].content === "")
    lines.pop();

  // Pair adjacent removed/added lines → inline char diffs
  let i = 0;
  while (i < lines.length) {
    if (lines[i].kind === "removed") {
      const rs = i;
      while (i < lines.length && lines[i].kind === "removed") i++;
      const as_ = i;
      while (i < lines.length && lines[i].kind === "added") i++;
      const pairs = Math.min(i - as_, as_ - rs);
      for (let k = 0; k < pairs; k++) {
        const [os, ns] = charDiff(lines[rs + k].content, lines[as_ + k].content);
        lines[rs + k].oldSegs = os;
        lines[as_ + k].newSegs = ns;
      }
    } else { i++; }
  }

  return lines;
}

// Shared monospace style
const MONO: React.CSSProperties = {
  fontFamily: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
  fontSize: 12,
  lineHeight: "20px",
};

const LN: React.CSSProperties = {
  ...MONO,
  width: 48, minWidth: 48,
  textAlign: "right",
  padding: "0 10px",
  userSelect: "none",
  color: C.lnText,
  borderRight: `1px solid ${C.border}`,
};

function HunkRow({ content }: { content: string }) {
  return (
    <tr style={{ background: C.hunkBg }}>
      <td style={{ ...LN, background: "transparent", borderRight: "none" }} />
      <td style={{ ...LN, background: "transparent" }} />
      <td style={{ width: 20 }} />
      <td style={{ ...MONO, padding: "2px 16px", color: C.hunkText, whiteSpace: "pre", borderBottom: `1px solid ${C.border}` }}>{content}</td>
    </tr>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  const add = line.kind === "added";
  const rem = line.kind === "removed";
  const segs = add ? line.newSegs : line.oldSegs;

  return (
    <tr style={{ background: add ? C.addBg : rem ? C.remBg : "transparent" }}>
      <td style={{ ...LN, background: add ? C.addLnBg : rem ? C.remLnBg : C.lnBg, borderBottom: `1px solid ${C.border}` }}>{line.oldNo ?? ""}</td>
      <td style={{ ...LN, background: add ? C.addLnBg : rem ? C.remLnBg : C.lnBg, borderBottom: `1px solid ${C.border}` }}>{line.newNo ?? ""}</td>
      <td style={{ ...MONO, width: 20, textAlign: "center", userSelect: "none", fontWeight: 700,
        color: add ? "#3fb950" : rem ? "#f85149" : "transparent", borderBottom: `1px solid ${C.border}` }}>
        {add ? "+" : rem ? "-" : " "}
      </td>
      <td style={{ ...MONO, padding: "0 16px", color: add ? C.addText : rem ? C.remText : C.text, whiteSpace: "pre", borderBottom: `1px solid ${C.border}` }}>
        {segs && segs.length > 1
          ? segs.map((s, i) => s.hl
              ? <mark key={i} style={{ background: add ? C.addWord : C.remWord, color: "inherit", borderRadius: 2, padding: "0 1px" }}>{s.text}</mark>
              : <span key={i}>{s.text}</span>)
          : (line.content || " ")}
      </td>
    </tr>
  );
}

function RawRow({ lineNo, content, changed, vm }: { lineNo: number; content: string; changed: boolean; vm: "old" | "new" }) {
  const isOld = vm === "old";
  const isAdded = changed && !isOld;
  const isRemoved = changed && isOld;
  return (
    <tr style={{ background: changed ? (isOld ? C.remBg : C.addBg) : "transparent" }}>
      <td colSpan={2} style={{ ...LN, width: 48, background: changed ? (isOld ? C.remLnBg : C.addLnBg) : C.lnBg, borderBottom: `1px solid ${C.border}` }}>{lineNo}</td>
      <td style={{ ...MONO, width: 20, textAlign: "center", userSelect: "none", fontWeight: 700, color: isAdded ? "#3fb950" : isRemoved ? "#f85149" : "transparent", borderBottom: `1px solid ${C.border}` }}>
        {isAdded ? "+" : isRemoved ? "-" : " "}
      </td>
      <td style={{ ...MONO, padding: "0 16px", color: changed ? (isOld ? C.remText : C.addText) : C.text, whiteSpace: "pre", borderBottom: `1px solid ${C.border}`, boxShadow: changed ? `inset 2px 0 0 ${isOld ? "#f85149" : "#3fb950"}` : "none" }}>
        {content || " "}
      </td>
    </tr>
  );
}

const CodeMirrorDiffViewer = forwardRef<HTMLDivElement, CodeMirrorDiffViewerProps>(
  function CodeMirrorDiffViewer(
    { commitId, files, selectedFile, viewMode = "diff", contextLines = 3, ignoreWhitespace = false },
    scrollRef
  ) {
    const { content, loading, oldChangedLines, newChangedLines } =
      useDiffViewerViewModel({ commitId, files, selectedFile, viewMode, contextLines, ignoreWhitespace, showAllFilesInDiff: false });

    const parsed = useMemo(() =>
      viewMode === "diff" && content ? parseDiff(content) : null,
      [content, viewMode]
    );
    const changedSet = useMemo(() =>
      new Set(viewMode === "old" ? (oldChangedLines ?? []) : (newChangedLines ?? [])),
      [viewMode, oldChangedLines, newChangedLines]
    );
    const rawLines = useMemo(() =>
      viewMode !== "diff" && content ? content.split("\n") : null,
      [content, viewMode]
    );

    if (loading) return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <span style={{ fontSize: 12, color: C.lnText }}>Loading…</span>
      </div>
    );
    if (!content) return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <span style={{ fontSize: 12, color: C.lnText }}>No changes</span>
      </div>
    );

    return (
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", background: C.bg }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto" }}>
          <tbody>
            {parsed
              ? parsed.map((l, i) => l.kind === "hunk"
                  ? <HunkRow key={i} content={l.content} />
                  : <DiffRow key={i} line={l} />)
              : rawLines?.map((l, i) => (
                  <RawRow key={i} lineNo={i + 1} content={l} changed={changedSet.has(i + 1)} vm={viewMode as "old" | "new"} />
                ))
            }
          </tbody>
        </table>
      </div>
    );
  }
);

export default CodeMirrorDiffViewer;
