import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ChangedFile,
  DiffFileAnchor,
  DiffLinePresentation,
} from "../types/git";

interface UseDiffViewerViewModelProps {
  commitId: string;
  files: ChangedFile[];
  selectedFile?: string | null;
  viewMode: "diff" | "old" | "new";
  contextLines: number;
  ignoreWhitespace: boolean;
  showAllFilesInDiff?: boolean;
}

interface FileContentResponse {
  content: string;
  exists: boolean;
  is_binary: boolean;
}

export function useDiffViewerViewModel({
  commitId,
  files,
  selectedFile,
  viewMode,
  contextLines,
  ignoreWhitespace,
  showAllFilesInDiff = false,
}: UseDiffViewerViewModelProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [oldChangedLines, setOldChangedLines] = useState<number[]>([]);
  const [newChangedLines, setNewChangedLines] = useState<number[]>([]);
  const [diffLineInfo, setDiffLineInfo] = useState<
    ReadonlyMap<number, DiffLinePresentation>
  >(new Map());
  const [diffFileAnchors, setDiffFileAnchors] = useState<DiffFileAnchor[]>([]);

  useEffect(() => {
    let cancelled = false;

    if (files.length === 0) {
      setContent("");
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      setLoading(true);
      setOldChangedLines([]);
      setNewChangedLines([]);
      setDiffLineInfo(new Map());
      setDiffFileAnchors([]);

      try {
        if (viewMode === "diff") {
          let diffText = "";

          if (selectedFile && !showAllFilesInDiff) {
            diffText = await invoke<string>("get_diff", {
              oid: commitId,
              contextLines,
              ignoreWhitespace,
              filePath: selectedFile,
            });
          } else {
            diffText = await invoke<string>("get_diff", {
              oid: commitId,
              contextLines,
              ignoreWhitespace,
            });
          }

          if (cancelled) {
            return;
          }

          let nextContent = diffText;
          if (selectedFile && !showAllFilesInDiff && (!diffText || diffText.trim().length === 0)) {
            // Fallback path for edge cases where pathspec diff returns empty.
            const fullDiffText = await invoke<string>("get_diff", {
              oid: commitId,
              contextLines,
              ignoreWhitespace,
            });

            if (cancelled) {
              return;
            }

            const sections = splitDiffSections(fullDiffText);
            const matched = sections.filter((section) =>
              sectionMatchesFile(section, selectedFile)
            );
            if (matched.length > 0) {
              nextContent = matched.join("\n\n");
            } else {
              nextContent = fullDiffText;
            }
          }

          if (!nextContent || nextContent.trim().length === 0) {
            setContent("No changes in this commit (empty diff)");
            return;
          }

          setContent(nextContent);
          setDiffLineInfo(buildDiffLineInfo(nextContent));
          setDiffFileAnchors(buildDiffFileAnchors(nextContent));
          return;
        }

        const isOld = viewMode === "old";
        const targetFiles = selectedFile
          ? files.filter((file) => file.path === selectedFile)
          : files;

        if (selectedFile && targetFiles.length === 1) {
          const selectedTargetFile = targetFiles[0];
          const diffTextForSelectedFile = await invoke<string>("get_diff", {
            oid: commitId,
            contextLines,
            ignoreWhitespace,
            filePath: selectedFile,
          });

          if (cancelled) {
            return;
          }

          if (!diffTextForSelectedFile || diffTextForSelectedFile.trim().length === 0) {
            setContent(
              getNoDiffMessageForSideView(
                selectedTargetFile.status,
                viewMode,
                diffTextForSelectedFile
              )
            );
            return;
          }

          const sideView = buildSideContentFromDiff(diffTextForSelectedFile, viewMode);
          if (sideView.hasRenderableLines) {
            setContent(sideView.content);
            if (isOld) {
              setOldChangedLines(sideView.changedDisplayLines);
            } else {
              setNewChangedLines(sideView.changedDisplayLines);
            }
            return;
          }

          setContent(
            getNoDiffMessageForSideView(
              selectedTargetFile.status,
              viewMode,
              diffTextForSelectedFile
            )
          );
          return;
        }

        const fileContents: string[] = [];

        for (const file of targetFiles) {
          try {
            const fileResponse = await invoke<FileContentResponse>("get_file_content", {
              oid: commitId,
              filePath: file.path,
              isOld,
            });

            if (cancelled) {
              return;
            }

            const fallbackMissingMessage = isOld
              ? file.status === "added"
                ? "(File does not exist in old version)"
                : "(File not present in old version)"
              : file.status === "deleted"
                ? "(File was deleted)"
                : "(File not present in new version)";

            const contentToRender = !fileResponse.exists
              ? fallbackMissingMessage
              : fileResponse.is_binary
                ? "(Binary file content is not displayable)"
                : fileResponse.content;

            if (targetFiles.length === 1) {
              fileContents.push(contentToRender);
            } else {
              fileContents.push(`\n=== ${file.path} ===\n`);
              fileContents.push(contentToRender);
            }
          } catch (error) {
            if (cancelled) {
              return;
            }

            if (targetFiles.length === 1) {
              if (isOld && file.status === "added") {
                fileContents.push("(File does not exist in old version)");
              } else if (!isOld && file.status === "deleted") {
                fileContents.push("(File was deleted)");
              } else {
                fileContents.push(`(Error loading file: ${String(error)})`);
              }
            } else {
              fileContents.push(`\n=== ${file.path} ===\n`);
              if (isOld && file.status === "added") {
                fileContents.push("(File does not exist in old version)");
              } else if (!isOld && file.status === "deleted") {
                fileContents.push("(File was deleted)");
              } else {
                fileContents.push(`(Error loading file: ${String(error)})`);
              }
            }
          }
        }

        if (fileContents.length === 0) {
          setContent("No content available for selected file");
        } else {
          setContent(fileContents.join("\n"));
        }
      } catch (error) {
        if (!cancelled) {
          setContent(
            `Error loading ${viewMode} version:\n${String(error)}`
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [
    commitId,
    files,
    selectedFile,
    viewMode,
    contextLines,
    ignoreWhitespace,
    showAllFilesInDiff,
  ]);

  const totalAdditions = useMemo(
    () => files.reduce((sum, file) => sum + file.additions, 0),
    [files]
  );

  const totalDeletions = useMemo(
    () => files.reduce((sum, file) => sum + file.deletions, 0),
    [files]
  );

  return {
    content,
    loading,
    totalAdditions,
    totalDeletions,
    oldChangedLines,
    newChangedLines,
    diffLineInfo,
    diffFileAnchors,
  };
}

function buildDiffFileAnchors(diffText: string): DiffFileAnchor[] {
  const lines = diffText.split("\n");
  const anchors: DiffFileAnchor[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith("diff --git ")) {
      continue;
    }

    const match = line.match(/^diff --git\s+a\/(.+?)\s+b\/(.+)$/);
    if (!match) {
      continue;
    }

    anchors.push({
      path: match[2],
      startLine: index + 1,
    });
  }

  return anchors;
}

function buildDiffLineInfo(
  diffText: string
): ReadonlyMap<number, DiffLinePresentation> {
  const lines = diffText.split("\n");
  const info = new Map<number, DiffLinePresentation>();

  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;
  let currentFilePath: string | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const lineNo = index + 1;
    const line = lines[index];

    if (line.startsWith("diff --git ")) {
      inHunk = false;
      const match = line.match(/^diff --git\s+a\/(.+?)\s+b\/(.+)$/);
      currentFilePath = match?.[2];
      info.set(lineNo, {
        kind: "diff-file-header",
        gutterLabel: "",
        filePath: currentFilePath,
      });
      continue;
    }

    if (!inHunk && line.startsWith("index ")) {
      info.set(lineNo, {
        kind: "diff-index",
        gutterLabel: "",
        filePath: currentFilePath,
      });
      continue;
    }

    if (!inHunk && isOldFileHeaderLine(line)) {
      info.set(lineNo, {
        kind: "diff-file-old",
        gutterLabel: "",
        filePath: currentFilePath,
      });
      continue;
    }

    if (!inHunk && isNewFileHeaderLine(line)) {
      info.set(lineNo, {
        kind: "diff-file-new",
        gutterLabel: "",
        filePath: currentFilePath,
      });
      continue;
    }

    if (line.startsWith("\\ No newline at end of file")) {
      info.set(lineNo, {
        kind: "diff-meta",
        gutterLabel: "",
        filePath: currentFilePath,
      });
      continue;
    }

    if (!inHunk && isDiffMetadataLine(line)) {
      info.set(lineNo, {
        kind: "diff-meta",
        gutterLabel: "",
        filePath: currentFilePath,
      });
      continue;
    }

    if (line.startsWith("@@")) {
      const match = line.match(
        /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/
      );

      if (!match) {
        inHunk = false;
        info.set(lineNo, {
          kind: "diff-hunk",
          gutterLabel: "",
          filePath: currentFilePath,
        });
        continue;
      }

      oldLine = Number.parseInt(match[1], 10);
      newLine = Number.parseInt(match[3], 10);
      inHunk = true;
      info.set(lineNo, {
        kind: "diff-hunk",
        gutterLabel: formatDiffGutterLabel(oldLine, newLine),
        filePath: currentFilePath,
      });
      continue;
    }

    if (!inHunk) {
      continue;
    }

    if (line.startsWith("+")) {
      info.set(lineNo, {
        kind: "diff-add",
        gutterLabel: formatDiffGutterLabel(undefined, newLine),
        filePath: currentFilePath,
      });
      newLine += 1;
      continue;
    }

    if (line.startsWith("-")) {
      info.set(lineNo, {
        kind: "diff-remove",
        gutterLabel: formatDiffGutterLabel(oldLine, undefined),
        filePath: currentFilePath,
      });
      oldLine += 1;
      continue;
    }

    if (line.startsWith("\\")) {
      info.set(lineNo, {
        kind: "diff-meta",
        gutterLabel: "",
        filePath: currentFilePath,
      });
      continue;
    }

    info.set(lineNo, {
      kind: "diff-context",
      gutterLabel: formatDiffGutterLabel(oldLine, newLine),
      filePath: currentFilePath,
    });
    oldLine += 1;
    newLine += 1;
  }

  return info;
}

function isOldFileHeaderLine(line: string): boolean {
  return /^--- (?:a\/|\/dev\/null|"a\/|"\/dev\/null)/.test(line);
}

function isNewFileHeaderLine(line: string): boolean {
  return /^\+\+\+ (?:b\/|\/dev\/null|"b\/|"\/dev\/null)/.test(line);
}

function isDiffMetadataLine(line: string): boolean {
  return (
    line.startsWith("new file mode") ||
    line.startsWith("deleted file mode") ||
    line.startsWith("similarity index") ||
    line.startsWith("rename from") ||
    line.startsWith("rename to") ||
    line.startsWith("old mode") ||
    line.startsWith("new mode") ||
    line.startsWith("Binary files ") ||
    line.startsWith("GIT binary patch")
  );
}

function isDiffFileBoundaryLine(line: string): boolean {
  return (
    line.startsWith("diff --git ") ||
    line.startsWith("index ") ||
    isOldFileHeaderLine(line) ||
    isNewFileHeaderLine(line)
  );
}

function formatDiffGutterLabel(oldLine?: number, newLine?: number): string {
  const oldLabel = oldLine === undefined ? "" : String(oldLine);
  const newLabel = newLine === undefined ? "" : String(newLine);

  return `${oldLabel.padStart(4, " ")} ${newLabel.padStart(4, " ")}`;
}

function buildSideContentFromDiff(
  diffText: string,
  viewMode: "old" | "new"
): {
  content: string;
  changedDisplayLines: number[];
  hasRenderableLines: boolean;
} {
  const lines = diffText.split("\n");
  const renderedLines: string[] = [];
  const changedDisplayLines: number[] = [];

  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;
  let seenHunk = false;

  const pushRenderedLine = (line: string, changed: boolean) => {
    renderedLines.push(line);
    if (changed) {
      changedDisplayLines.push(renderedLines.length);
    }
  };

  for (const line of lines) {
    if (!inHunk && (isDiffFileBoundaryLine(line) || isDiffMetadataLine(line))) {
      inHunk = false;
      continue;
    }

    if (line.startsWith("@@")) {
      const match = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
      if (!match) {
        inHunk = false;
        continue;
      }

      if (seenHunk && renderedLines.length > 0) {
        pushRenderedLine("", false);
      }

      oldLine = Number.parseInt(match[1], 10);
      newLine = Number.parseInt(match[3], 10);
      inHunk = true;
      seenHunk = true;
      continue;
    }

    if (!inHunk) {
      continue;
    }

    if (line.startsWith("+")) {
      if (viewMode === "new") {
        pushRenderedLine(line.slice(1), true);
      }
      newLine += 1;
      continue;
    }

    if (line.startsWith("-")) {
      if (viewMode === "old") {
        pushRenderedLine(line.slice(1), true);
      }
      oldLine += 1;
      continue;
    }

    if (line.startsWith("\\")) {
      continue;
    }

    if (line.startsWith(" ")) {
      pushRenderedLine(line.slice(1), false);
      oldLine += 1;
      newLine += 1;
    }
  }

  return {
    content: renderedLines.join("\n"),
    changedDisplayLines,
    hasRenderableLines: renderedLines.length > 0,
  };
}

function getNoDiffMessageForSideView(
  fileStatus: ChangedFile["status"],
  viewMode: "old" | "new",
  diffText: string
): string {
  if (viewMode === "old" && fileStatus === "added") {
    return "(File does not exist in old version)";
  }

  if (viewMode === "new" && fileStatus === "deleted") {
    return "(File was deleted)";
  }

  if (
    diffText.includes("Binary files ") ||
    diffText.includes("GIT binary patch")
  ) {
    return "(Binary file content is not displayable in patch view)";
  }

  return "No changed lines to display for this file with current context";
}

function splitDiffSections(diffText: string): string[] {
  const lines = diffText.split("\n");
  const sections: string[] = [];
  let current: string[] = [];
  let inFile = false;

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      if (inFile && current.length > 0) {
        sections.push(current.join("\n"));
        current = [];
      }
      inFile = true;
      current.push(line);
      continue;
    }

    if (inFile) {
      current.push(line);
      continue;
    }

    if (line.trim().length > 0 && sections.length === 0) {
      inFile = true;
      current.push(line);
    }
  }

  if (current.length > 0) {
    sections.push(current.join("\n"));
  }

  if (sections.length === 0 && diffText.trim().length > 0) {
    sections.push(diffText);
  }

  return sections;
}

function sectionMatchesFile(section: string, filePath: string): boolean {
  const escapedPath = filePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`^diff --git\\s+a/${escapedPath}\\s+b/${escapedPath}`, "m"),
    new RegExp(`^diff --git\\s+.*(?:a|b)/${escapedPath}(?:\\s|$)`, "m"),
    new RegExp(`^[+-]{3} [ab]/${escapedPath}`, "m"),
    new RegExp(`^[+-]{3} "[ab]/${escapedPath}"`, "m"),
    new RegExp(`^=== ${escapedPath} ===$`, "m"),
  ];

  return patterns.some((pattern) => pattern.test(section));
}
