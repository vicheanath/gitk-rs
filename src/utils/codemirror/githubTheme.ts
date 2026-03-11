import { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/**
 * Compact gitk-style CodeMirror theme aligned with App.css tokens.
 */
export const githubTheme: Extension = EditorView.theme({
  "&": {
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    fontSize: "var(--editor-font-size, 12px)",
    fontFamily:
      "'JetBrains Mono', 'Cascadia Code', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    lineHeight: "1.45",
  },
  ".cm-content": {
    padding: "0",
    minHeight: "0",
  },
  ".cm-scroller": {
    fontFamily:
      "'JetBrains Mono', 'Cascadia Code', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
  ".cm-line": {
    padding: "0 10px",
  },
  ".cm-gutters": {
    backgroundColor: "var(--bg-secondary)",
    borderRight: "1px solid var(--border-color)",
    color: "var(--text-secondary)",
    fontFamily:
      "'JetBrains Mono', 'Cascadia Code', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px",
    minWidth: "82px",
    textAlign: "right",
    color: "var(--text-secondary)",
    whiteSpace: "pre",
    fontVariantNumeric: "tabular-nums",
  },

  // Keep cursor/selection aligned with app accents.
  ".cm-cursor": {
    borderLeftColor: "var(--accent)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "rgba(126, 231, 135, 0.14)",
  },

});

/**
 * Same palette as app dark mode with slightly stronger emphasis.
 */
export const githubDarkTheme: Extension = EditorView.theme({
  "&": {
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    fontSize: "var(--editor-font-size, 12px)",
    fontFamily:
      "'JetBrains Mono', 'Cascadia Code', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    lineHeight: "1.45",
  },
  ".cm-content": {
    padding: "0",
    minHeight: "0",
  },
  ".cm-scroller": {
    fontFamily:
      "'JetBrains Mono', 'Cascadia Code', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
  ".cm-line": {
    padding: "0 10px",
  },
  ".cm-gutters": {
    backgroundColor: "var(--bg-secondary)",
    borderRight: "1px solid var(--border-color)",
    color: "var(--text-secondary)",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px",
    minWidth: "82px",
    textAlign: "right",
    color: "var(--text-secondary)",
    whiteSpace: "pre",
    fontVariantNumeric: "tabular-nums",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--accent)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "rgba(126, 231, 135, 0.18)",
  },
});
