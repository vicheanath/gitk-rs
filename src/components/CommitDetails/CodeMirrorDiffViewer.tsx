import { useEffect, useRef, useMemo } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { loadLanguageExtensionForPath } from "../../utils/codemirror/languageSupport";
import { ChangedFile } from "../../types/git";
import { useDiffViewerViewModel } from "../../viewmodels/useDiffViewerViewModel";

interface CodeMirrorDiffViewerProps {
  commitId: string;
  files: ChangedFile[];
  selectedFile?: string | null;
  viewMode?: "diff" | "old" | "new";
  contextLines?: number;
  ignoreWhitespace?: boolean;
  showAllFilesInDiff?: boolean;
}

export default function CodeMirrorDiffViewer({
  commitId,
  files,
  selectedFile,
  viewMode = "diff",
  contextLines = 3,
  ignoreWhitespace = false,
}: CodeMirrorDiffViewerProps) {
  const {
    content,
    loading,
    totalAdditions,
    totalDeletions,
  } = useDiffViewerViewModel({
    commitId,
    files,
    selectedFile,
    viewMode,
    contextLines,
    ignoreWhitespace,
    showAllFilesInDiff: false,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const languageExtRef = useRef<any>(null);

  // Parse unified diff format to extract old and new content with proper styling
  const processedContent = useMemo(() => {
    if (!content) return "";

    // For old/new views, content is raw file text — no diff headers to strip
    if (viewMode === "old" || viewMode === "new") {
      return content;
    }

    const lines = content.split("\n");
    let processed = "";
    let inDiff = false;

    for (const line of lines) {
      if (line.startsWith("---") || line.startsWith("+++")) {
        inDiff = true;
        continue;
      }

      if (!inDiff) continue;

      processed += line + "\n";
    }

    return processed;
  }, [content, viewMode]);

  // Load language extension asynchronously
  useEffect(() => {
    const loadLanguage = async () => {
      const fileName = selectedFile || "file";
      const ext = await loadLanguageExtensionForPath(fileName);
      languageExtRef.current = ext;
    };
    loadLanguage();
  }, [selectedFile]);

  useEffect(() => {
    if (!containerRef.current || loading || !content) {
      if (!loading && containerRef.current) {
        containerRef.current.innerHTML = "";
        editorRef.current?.destroy();
        editorRef.current = null;
      }
      return;
    }

    // Clean up previous editor
    if (editorRef.current) {
      editorRef.current.destroy();
    }

    // Create state with various extensions
    const extensions: any[] = [
      lineNumbers(),
      highlightActiveLine(),
      syntaxHighlighting(defaultHighlightStyle),
      oneDark,
      EditorView.editable.of(false),
    ];

    if (languageExtRef.current) {
      extensions.push(languageExtRef.current);
    }

    const state = EditorState.create({
      doc: processedContent,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    editorRef.current = view;

    return () => {
      view.destroy();
      editorRef.current = null;
    };
  }, [processedContent, loading, content]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[var(--border-color)] px-3 py-2">
        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <div>
            {loading
              ? "Loading diff..."
              : `${files.length} file${files.length !== 1 ? "s" : ""} changed • +${totalAdditions} -${totalDeletions}`}
          </div>
          {selectedFile && (
            <div className="text-[var(--text-muted)]">
              {selectedFile}
            </div>
          )}
        </div>
      </div>

      {/* Content Container */}
      {loading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <p className="text-xs text-[var(--text-secondary)]">Loading...</p>
        </div>
      ) : !processedContent ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <p className="text-xs text-[var(--text-secondary)]">No changes</p>
        </div>
      ) : (
        <div ref={containerRef} className="min-h-0 flex-1 overflow-auto" />
      )}
    </div>
  );
}
