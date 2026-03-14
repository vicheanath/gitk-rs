import { Fragment, type CSSProperties } from "react";
import { DiffFileView, DiffLineView, DiffLineViewKind } from "../../types/git";

export type StructuredDiffMode = "unified" | "old" | "new";

interface StructuredDiffTableProps {
  files: DiffFileView[];
  mode: StructuredDiffMode;
  emptyMessage?: string;
}

const C = {
  bg: "var(--bg-primary)",
  lnBg: "color-mix(in srgb, var(--bg-secondary) 82%, transparent)",
  lnText: "var(--text-secondary)",
  border: "color-mix(in srgb, var(--border-color) 68%, transparent)",
  text: "var(--text-primary)",
  metaBg: "color-mix(in srgb, var(--bg-secondary) 88%, transparent)",
  metaText: "var(--text-secondary)",
  addBg: "color-mix(in srgb, var(--diff-add-bg, #0f3a1b) 84%, transparent)",
  addLnBg:
    "color-mix(in srgb, var(--diff-add-border, #1a7f37) 42%, var(--bg-secondary))",
  addText: "var(--diff-add-text, #49d05e)",
  remBg: "color-mix(in srgb, var(--diff-remove-bg, #3d1f1f) 84%, transparent)",
  remLnBg:
    "color-mix(in srgb, var(--diff-remove-border, #cf222e) 42%, var(--bg-secondary))",
  remText: "var(--diff-remove-text, #ff7f7f)",
  hunkBg: "var(--diff-hunk-bg, rgba(9, 105, 218, 0.18))",
  hunkText: "var(--diff-hunk-text, #0550ae)",
  fileBg: "color-mix(in srgb, var(--bg-secondary) 85%, transparent)",
};

const MONO: CSSProperties = {
  fontFamily: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
  fontSize: 12,
  lineHeight: "20px",
};

const LN: CSSProperties = {
  ...MONO,
  width: 52,
  minWidth: 52,
  textAlign: "right",
  padding: "0 10px",
  userSelect: "none",
  color: C.lnText,
  borderRight: `1px solid ${C.border}`,
};

function missingSideMessage(file: DiffFileView, mode: StructuredDiffMode): string | null {
  if (mode === "old" && file.status === "added") {
    return "File is not present in the old version.";
  }
  if (mode === "new" && file.status === "deleted") {
    return "File is not present in the new version.";
  }
  return null;
}

function filterLinesForSide(lines: DiffLineView[], mode: "old" | "new"): DiffLineView[] {
  const visible: DiffLineView[] = [];
  let lastIncludedKind: DiffLineViewKind | null = null;

  for (const line of lines) {
    if (line.kind === "context") {
      visible.push(line);
      lastIncludedKind = "context";
      continue;
    }

    if (line.kind === "remove") {
      if (mode === "old") {
        visible.push(line);
        lastIncludedKind = "remove";
      } else {
        lastIncludedKind = null;
      }
      continue;
    }

    if (line.kind === "add") {
      if (mode === "new") {
        visible.push(line);
        lastIncludedKind = "add";
      } else {
        lastIncludedKind = null;
      }
      continue;
    }

    if (
      line.kind === "no-newline" &&
      (lastIncludedKind === "context" ||
        (mode === "old" && lastIncludedKind === "remove") ||
        (mode === "new" && lastIncludedKind === "add"))
    ) {
      visible.push(line);
    }
  }

  return visible;
}

function lineTone(kind: DiffLineViewKind): "add" | "remove" | "neutral" {
  if (kind === "add") {
    return "add";
  }
  if (kind === "remove") {
    return "remove";
  }
  return "neutral";
}

function lineSymbol(kind: DiffLineViewKind): string {
  if (kind === "add") {
    return "+";
  }
  if (kind === "remove") {
    return "-";
  }
  if (kind === "no-newline") {
    return "\\";
  }
  return " ";
}

function lineNumberForMode(line: DiffLineView, mode: StructuredDiffMode): number | null {
  if (mode === "old") {
    return line.oldLine;
  }
  if (mode === "new") {
    return line.newLine;
  }
  return null;
}

function renderLineText(line: DiffLineView): string {
  if (line.kind === "no-newline") {
    return line.text || "No newline at end of file";
  }
  return line.text || " ";
}

export default function StructuredDiffTable({
  files,
  mode,
  emptyMessage = "No changed lines for current context.",
}: StructuredDiffTableProps) {
  if (files.length === 0) {
    return (
      <div style={{ ...MONO, color: C.lnText, padding: "10px 14px" }}>
        {emptyMessage}
      </div>
    );
  }

  const renderUnified = mode === "unified";

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto" }}>
      <tbody>
        {files.map((file, fileIndex) => {
          const sideUnavailable = missingSideMessage(file, mode);
          const hunks = renderUnified
            ? file.hunks
            : file.hunks
                .map((hunk) => ({
                  header: hunk.header,
                  lines: filterLinesForSide(hunk.lines, mode),
                }))
                .filter((hunk) => hunk.lines.length > 0);

          const hasRenderableLines = hunks.some((hunk) => hunk.lines.length > 0);
          const showFileHeader = files.length > 1;
          const colspan = renderUnified ? 4 : 3;

          return (
            <Fragment key={`${file.path}:${fileIndex}`}>
              {showFileHeader ? (
                <tr style={{ background: C.fileBg }}>
                  <td
                    colSpan={colspan}
                    style={{
                      ...MONO,
                      padding: "4px 12px",
                      borderTop: `1px solid ${C.border}`,
                      borderBottom: `1px solid ${C.border}`,
                      color: C.text,
                      fontWeight: 600,
                    }}
                  >
                    {file.path}
                  </td>
                </tr>
              ) : null}

              {file.meta.map((meta, metaIndex) => (
                <tr key={`${file.path}:meta:${metaIndex}`} style={{ background: C.metaBg }}>
                  {renderUnified ? (
                    <>
                      <td style={{ ...LN, background: "transparent", borderRight: "none" }} />
                      <td style={{ ...LN, background: "transparent" }} />
                    </>
                  ) : (
                    <td style={{ ...LN, background: "transparent" }} />
                  )}
                  <td
                    style={{
                      ...MONO,
                      width: 20,
                      textAlign: "center",
                      color: C.metaText,
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    {" "}
                  </td>
                  <td
                    style={{
                      ...MONO,
                      padding: "0 16px",
                      color: C.metaText,
                      whiteSpace: "pre",
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    {meta || " "}
                  </td>
                </tr>
              ))}

              {file.isBinary ? (
                <tr style={{ background: C.metaBg }}>
                  <td
                    colSpan={colspan}
                    style={{
                      ...MONO,
                      color: C.metaText,
                      padding: "8px 14px",
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    Binary diff: content is not displayable.
                  </td>
                </tr>
              ) : sideUnavailable ? (
                <tr style={{ background: C.metaBg }}>
                  <td
                    colSpan={colspan}
                    style={{
                      ...MONO,
                      color: C.metaText,
                      padding: "8px 14px",
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    {sideUnavailable}
                  </td>
                </tr>
              ) : !hasRenderableLines ? (
                <tr style={{ background: C.metaBg }}>
                  <td
                    colSpan={colspan}
                    style={{
                      ...MONO,
                      color: C.metaText,
                      padding: "8px 14px",
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                hunks.map((hunk, hunkIndex) => (
                  <Fragment key={`${file.path}:hunk:${hunkIndex}`}>
                    <tr style={{ background: C.hunkBg }}>
                      {renderUnified ? (
                        <>
                          <td style={{ ...LN, background: "transparent", borderRight: "none" }} />
                          <td style={{ ...LN, background: "transparent" }} />
                        </>
                      ) : (
                        <td style={{ ...LN, background: "transparent" }} />
                      )}
                      <td style={{ width: 20 }} />
                      <td
                        style={{
                          ...MONO,
                          padding: "2px 16px",
                          color: C.hunkText,
                          whiteSpace: "pre",
                          borderBottom: `1px solid ${C.border}`,
                        }}
                      >
                        {hunk.header}
                      </td>
                    </tr>
                    {hunk.lines.map((line, lineIndex) => {
                      const tone = lineTone(line.kind);
                      const isAdd = tone === "add";
                      const isRemove = tone === "remove";
                      const accent = isAdd
                        ? "var(--diff-add-border, #1a7f37)"
                        : isRemove
                          ? "var(--diff-remove-border, #cf222e)"
                          : "transparent";
                      const lineBackground = isAdd
                        ? C.addBg
                        : isRemove
                          ? C.remBg
                          : "transparent";
                      const lineText = isAdd ? C.addText : isRemove ? C.remText : C.text;
                      const lineNumberBackground = isAdd
                        ? C.addLnBg
                        : isRemove
                          ? C.remLnBg
                          : C.lnBg;

                      return (
                        <tr
                          key={`${file.path}:hunk:${hunkIndex}:line:${lineIndex}`}
                          style={{ background: lineBackground }}
                        >
                          {renderUnified ? (
                            <>
                              <td
                                style={{
                                  ...LN,
                                  background: lineNumberBackground,
                                  borderBottom: `1px solid ${C.border}`,
                                }}
                              >
                                {line.oldLine ?? ""}
                              </td>
                              <td
                                style={{
                                  ...LN,
                                  background: lineNumberBackground,
                                  borderBottom: `1px solid ${C.border}`,
                                }}
                              >
                                {line.newLine ?? ""}
                              </td>
                            </>
                          ) : (
                            <td
                              style={{
                                ...LN,
                                background: lineNumberBackground,
                                borderBottom: `1px solid ${C.border}`,
                              }}
                            >
                              {lineNumberForMode(line, mode) ?? ""}
                            </td>
                          )}
                          <td
                            style={{
                              ...MONO,
                              width: 20,
                              textAlign: "center",
                              userSelect: "none",
                              fontWeight: isAdd || isRemove ? 700 : 500,
                              color: isAdd
                                ? "var(--diff-add-text, #49d05e)"
                                : isRemove
                                  ? "var(--diff-remove-text, #ff7f7f)"
                                  : "transparent",
                              borderBottom: `1px solid ${C.border}`,
                            }}
                          >
                            {lineSymbol(line.kind)}
                          </td>
                          <td
                            style={{
                              ...MONO,
                              padding: "0 16px",
                              color: lineText,
                              whiteSpace: "pre",
                              borderBottom: `1px solid ${C.border}`,
                              boxShadow: isAdd || isRemove ? `inset 4px 0 0 ${accent}` : "none",
                              fontWeight: isAdd || isRemove ? 600 : 400,
                            }}
                          >
                            {renderLineText(line)}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
