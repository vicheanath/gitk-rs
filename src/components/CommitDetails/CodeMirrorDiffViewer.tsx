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

// Theme-aware diff colors from application CSS variables
const C = {
  bg:       "var(--bg-primary)",
  lnBg:     "color-mix(in srgb, var(--bg-secondary) 82%, transparent)",
  lnText:   "var(--text-secondary)",
  border:   "color-mix(in srgb, var(--border-color) 68%, transparent)",
  text:     "var(--text-primary)",
  metaBg:   "color-mix(in srgb, var(--bg-secondary) 88%, transparent)",
  metaText: "var(--text-secondary)",
  addBg:    "var(--diff-add-bg)",
  addLnBg:  "color-mix(in srgb, var(--diff-add-border) 26%, var(--bg-secondary))",
  addText:  "var(--diff-add-text)",
  addWord:  "color-mix(in srgb, var(--diff-add-border) 44%, transparent)",
  remBg:    "var(--diff-remove-bg)",
  remLnBg:  "color-mix(in srgb, var(--diff-remove-border) 26%, var(--bg-secondary))",
  remText:  "var(--diff-remove-text)",
  remWord:  "color-mix(in srgb, var(--diff-remove-border) 44%, transparent)",
  hunkBg:   "var(--diff-hunk-bg)",
  hunkText: "var(--diff-hunk-text)",
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

type LineKind = "added" | "removed" | "context" | "hunk" | "meta";

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
  let inHunk = false;

  for (const raw of text.split("\n")) {
    if (
      raw.startsWith("diff ") || raw.startsWith("index ") ||
      raw.startsWith("--- ")  || raw.startsWith("+++ ")
    ) {
      inHunk = false;
      continue;
    }

    if (raw.startsWith("@@")) {
      const m = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) { oldNo = parseInt(m[1]) - 1; newNo = parseInt(m[2]) - 1; }
      inHunk = true;
      lines.push({ kind: "hunk", content: raw, oldNo: null, newNo: null });
      continue;
    }

    if (
      raw.startsWith("new file mode ") ||
      raw.startsWith("deleted file mode ") ||
      raw.startsWith("similarity index ") ||
      raw.startsWith("rename from ") ||
      raw.startsWith("rename to ") ||
      raw.startsWith("old mode ") ||
      raw.startsWith("new mode ") ||
      raw.startsWith("Binary files ") ||
      raw.startsWith("GIT binary patch") ||
      raw.startsWith("\\ No newline at end of file")
    ) {
      lines.push({ kind: "meta", content: raw, oldNo: null, newNo: null });
      continue;
    }

    if (!inHunk) {
      if (raw.trim().length > 0) {
        lines.push({ kind: "meta", content: raw, oldNo: null, newNo: null });
      }
      continue;
    }

    if (raw.startsWith("-") && !raw.startsWith("---")) {
      lines.push({ kind: "removed", content: raw.slice(1), oldNo: ++oldNo, newNo: null });
      continue;
    }

    if (raw.startsWith("+") && !raw.startsWith("+++")) {
      lines.push({ kind: "added", content: raw.slice(1), oldNo: null, newNo: ++newNo });
      continue;
    }

    if (raw.startsWith(" ")) {
      lines.push({ kind: "context", content: raw.slice(1), oldNo: ++oldNo, newNo: ++newNo });
      continue;
    }

    lines.push({ kind: "meta", content: raw, oldNo: null, newNo: null });
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

function MetaRow({ content }: { content: string }) {
  return (
    <tr style={{ background: C.metaBg }}>
      <td style={{ ...LN, background: "transparent", borderRight: "none" }} />
      <td style={{ ...LN, background: "transparent" }} />
      <td style={{ ...MONO, width: 20, textAlign: "center", color: C.metaText, borderBottom: `1px solid ${C.border}` }}> </td>
      <td style={{ ...MONO, padding: "0 16px", color: C.metaText, whiteSpace: "pre", borderBottom: `1px solid ${C.border}` }}>
        {content || " "}
      </td>
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
        color: add ? "var(--success)" : rem ? "var(--danger)" : "transparent", borderBottom: `1px solid ${C.border}` }}>
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
      <td style={{ ...MONO, width: 20, textAlign: "center", userSelect: "none", fontWeight: 700, color: isAdded ? "var(--success)" : isRemoved ? "var(--danger)" : "transparent", borderBottom: `1px solid ${C.border}` }}>
        {isAdded ? "+" : isRemoved ? "-" : " "}
      </td>
      <td style={{ ...MONO, padding: "0 16px", color: changed ? (isOld ? C.remText : C.addText) : C.text, whiteSpace: "pre", borderBottom: `1px solid ${C.border}`, boxShadow: changed ? `inset 2px 0 0 ${isOld ? "var(--danger)" : "var(--success)"}` : "none" }}>
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

    const isEmptyDocument = viewMode !== "diff" && content === "";

    if (!content && !isEmptyDocument) return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <span style={{ fontSize: 12, color: C.lnText }}>No changes</span>
      </div>
    );

    return (
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", background: C.bg }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto" }}>
          <tbody>
            {parsed
              ? parsed.map((l, i) => {
                  if (l.kind === "hunk") {
                    return <HunkRow key={i} content={l.content} />;
                  }

                  if (l.kind === "meta") {
                    return <MetaRow key={i} content={l.content} />;
                  }

                  return <DiffRow key={i} line={l} />;
                })
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
