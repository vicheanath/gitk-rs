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
          const diffText = await invoke<string>("get_diff", {
            oid: commitId,
            contextLines,
            ignoreWhitespace,
          });

          if (cancelled) {
            return;
          }

          if (!diffText || diffText.trim().length === 0) {
            setContent("No changes in this commit (empty diff)");
            return;
          }

          const sections = splitDiffSections(diffText);

          let nextContent = sections.join("\n\n") || "No diff content available";
          if (selectedFile && !showAllFilesInDiff) {
            const matched = sections.filter((section) =>
              sectionMatchesFile(section, selectedFile)
            );
            if (matched.length > 0) {
              nextContent = matched.join("\n\n");
            }
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

        const fileContents: string[] = [];
        let selectedFileContentLoaded = false;

        for (const file of targetFiles) {
          try {
            const fileContent = await invoke<string>("get_file_content", {
              oid: commitId,
              filePath: file.path,
              isOld,
            });

            if (cancelled) {
              return;
            }

            if (targetFiles.length === 1) {
              fileContents.push(fileContent);
              selectedFileContentLoaded = true;
            } else {
              fileContents.push(`\n=== ${file.path} ===\n`);
              fileContents.push(fileContent);
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

        // For selected-file old/new views, derive changed line numbers to apply diff colors in code view.
        if (selectedFile && targetFiles.length === 1 && selectedFileContentLoaded) {
          const diffText = await invoke<string>("get_diff", {
            oid: commitId,
            contextLines,
            ignoreWhitespace,
          });
          if (!cancelled) {
            const lineInfo = getChangedLineNumbersForFile(diffText, selectedFile);
            setOldChangedLines(lineInfo.oldChangedLines);
            setNewChangedLines(lineInfo.newChangedLines);
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

    if (line.startsWith("index ")) {
      info.set(lineNo, {
        kind: "diff-index",
        gutterLabel: "",
        filePath: currentFilePath,
      });
      continue;
    }

    if (line.startsWith("--- ")) {
      info.set(lineNo, {
        kind: "diff-file-old",
        gutterLabel: "",
        filePath: currentFilePath,
      });
      continue;
    }

    if (line.startsWith("+++ ")) {
      info.set(lineNo, {
        kind: "diff-file-new",
        gutterLabel: "",
        filePath: currentFilePath,
      });
      continue;
    }

    if (
      line.startsWith("new file mode") ||
      line.startsWith("deleted file mode") ||
      line.startsWith("similarity index") ||
      line.startsWith("rename from") ||
      line.startsWith("rename to") ||
      line.startsWith("old mode") ||
      line.startsWith("new mode") ||
      line.startsWith("Binary files ") ||
      line.startsWith("\\ No newline at end of file")
    ) {
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

    if (line.startsWith("+") && !line.startsWith("+++")) {
      info.set(lineNo, {
        kind: "diff-add",
        gutterLabel: formatDiffGutterLabel(undefined, newLine),
        filePath: currentFilePath,
      });
      newLine += 1;
      continue;
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
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

function formatDiffGutterLabel(oldLine?: number, newLine?: number): string {
  const oldLabel = oldLine === undefined ? "" : String(oldLine);
  const newLabel = newLine === undefined ? "" : String(newLine);

  return `${oldLabel.padStart(4, " ")} ${newLabel.padStart(4, " ")}`;
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
    new RegExp(`^diff --git.*\\b${escapedPath}\\b`, "m"),
    new RegExp(`^[+-]{3} [ab]/${escapedPath}`, "m"),
    new RegExp(`^=== ${escapedPath} ===$`, "m"),
  ];

  return patterns.some((pattern) => pattern.test(section));
}

function getChangedLineNumbersForFile(diffText: string, filePath: string): {
  oldChangedLines: number[];
  newChangedLines: number[];
} {
  const sections = splitDiffSections(diffText);
  const targetSection = sections.find((section) => sectionMatchesFile(section, filePath));

  if (!targetSection) {
    return { oldChangedLines: [], newChangedLines: [] };
  }

  const oldChangedLines = new Set<number>();
  const newChangedLines = new Set<number>();
  const lines = targetSection.split("\n");

  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      const match = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
      if (!match) {
        inHunk = false;
        continue;
      }

      oldLine = Number.parseInt(match[1], 10);
      newLine = Number.parseInt(match[3], 10);
      inHunk = true;
      continue;
    }

    if (!inHunk || line.startsWith("diff --git")) {
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      newChangedLines.add(newLine);
      newLine += 1;
      continue;
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      oldChangedLines.add(oldLine);
      oldLine += 1;
      continue;
    }

    if (line.startsWith("\\")) {
      continue;
    }

    oldLine += 1;
    newLine += 1;
  }

  return {
    oldChangedLines: [...oldChangedLines],
    newChangedLines: [...newChangedLines],
  };
}
