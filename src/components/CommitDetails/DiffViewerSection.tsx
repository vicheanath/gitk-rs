import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import CodeMirrorDiffViewer from "./CodeMirrorDiffViewer";
import { ChangedFile, DiffFileView, DiffViewResponse } from "../../types/git";

interface DiffViewerSectionProps {
  commitId: string;
  files: ChangedFile[];
  selectedFile?: string | null;
  onActiveFileChange?: (filePath: string) => void;
  diffDisplayMode: "unified" | "split";
  contextLines: number;
  ignoreWhitespace: boolean;
}

const INITIAL_BATCH = 20;
const APPEND_BATCH = 20;

function fileMatchesSelection(file: DiffFileView, selectedFile: string): boolean {
  return (
    file.path === selectedFile ||
    file.oldPath === selectedFile ||
    file.newPath === selectedFile
  );
}

function StackHeader({
  collapsed,
  showing,
  total,
  onToggle,
}: {
  collapsed: boolean;
  showing: number;
  total: number;
  onToggle: () => void;
}) {
  const summary =
    total === 0
      ? "No changed files"
      : showing >= total
        ? `Showing all ${total} files`
        : `Showing ${showing} / ${total} files`;

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
      <span
        style={{
          fontSize: 12,
          color: "var(--text-primary)",
          fontWeight: 600,
          flex: 1,
        }}
      >
        Continuous Diff
      </span>
      <span
        style={{
          fontFamily: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
          fontSize: 11,
          color: "var(--text-secondary)",
        }}
      >
        {summary}
      </span>
    </div>
  );
}

function SplitView({
  diffFiles,
  loading,
  error,
  leftRef,
  rightRef,
  sentinelRef,
}: {
  diffFiles: DiffFileView[];
  loading: boolean;
  error: string | null;
  leftRef: RefObject<HTMLDivElement>;
  rightRef: RefObject<HTMLDivElement>;
  sentinelRef: RefObject<HTMLDivElement>;
}) {
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
    [leftRef, rightRef]
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
  }, [leftRef, rightRef, sync]);

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
          diffFiles={diffFiles}
          loading={loading}
          error={error}
          viewMode="old"
          alwaysShowFileHeaders
          sentinelRef={sentinelRef}
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
          diffFiles={diffFiles}
          loading={loading}
          error={error}
          viewMode="new"
          alwaysShowFileHeaders
        />
      </div>
    </div>
  );
}

function findFileHeaderElement(
  container: HTMLDivElement,
  filePath: string
): HTMLTableRowElement | null {
  const headers = Array.from(
    container.querySelectorAll<HTMLTableRowElement>("[data-diff-file-header='true']")
  );

  return (
    headers.find((header) => header.dataset.diffFilePath === filePath) ?? null
  );
}

export default function DiffViewerSection({
  commitId,
  files,
  selectedFile,
  onActiveFileChange,
  diffDisplayMode,
  contextLines,
  ignoreWhitespace,
}: DiffViewerSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [allFiles, setAllFiles] = useState<DiffFileView[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [pendingScrollFile, setPendingScrollFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unifiedRef = useRef<HTMLDivElement>(null);
  const splitLeftRef = useRef<HTMLDivElement>(null);
  const splitRightRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const suppressActiveSyncRef = useRef(false);
  const autoSyncReleaseTimerRef = useRef<number | null>(null);
  const lastAutoSyncedFileRef = useRef<string | null>(null);
  const lastReportedActiveFileRef = useRef<string | null>(null);

  const visibleFiles = useMemo(
    () => allFiles.slice(0, visibleCount),
    [allFiles, visibleCount]
  );

  const getPrimaryScrollContainer = useCallback((): HTMLDivElement | null => {
    return diffDisplayMode === "unified" ? unifiedRef.current : splitLeftRef.current;
  }, [diffDisplayMode]);

  useEffect(() => {
    return () => {
      if (autoSyncReleaseTimerRef.current !== null) {
        window.clearTimeout(autoSyncReleaseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDiff = async () => {
      setLoading(true);
      setError(null);
      setAllFiles([]);
      setVisibleCount(0);
      setPendingScrollFile(null);

      try {
        const response = await invoke<DiffViewResponse>("get_commit_diff_view", {
          oid: commitId,
          contextLines,
          ignoreWhitespace,
        });

        if (cancelled) {
          return;
        }

        setAllFiles(response.files);
        setVisibleCount(Math.min(INITIAL_BATCH, response.files.length));
      } catch (err) {
        if (!cancelled) {
          setAllFiles([]);
          setVisibleCount(0);
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
  }, [commitId, contextLines, ignoreWhitespace]);

  useEffect(() => {
    if (!selectedFile || allFiles.length === 0) {
      return;
    }

    if (selectedFile === lastAutoSyncedFileRef.current) {
      return;
    }

    const targetIndex = allFiles.findIndex((file) =>
      fileMatchesSelection(file, selectedFile)
    );

    if (targetIndex < 0) {
      return;
    }

    const requiredCount = Math.min(
      allFiles.length,
      Math.max(visibleCount, targetIndex + 1)
    );
    if (requiredCount !== visibleCount) {
      setVisibleCount(requiredCount);
    }

    setPendingScrollFile(allFiles[targetIndex].path);
  }, [allFiles, selectedFile, visibleCount]);

  useEffect(() => {
    if (!pendingScrollFile) {
      return;
    }

    const container = getPrimaryScrollContainer();
    if (!container) {
      return;
    }

    const targetHeader = findFileHeaderElement(container, pendingScrollFile);
    if (!targetHeader) {
      return;
    }

    suppressActiveSyncRef.current = true;
    targetHeader.scrollIntoView({ behavior: "smooth", block: "start" });

    if (autoSyncReleaseTimerRef.current !== null) {
      window.clearTimeout(autoSyncReleaseTimerRef.current);
    }
    autoSyncReleaseTimerRef.current = window.setTimeout(() => {
      suppressActiveSyncRef.current = false;
    }, 450);

    setPendingScrollFile(null);
  }, [pendingScrollFile, getPrimaryScrollContainer, visibleFiles]);

  useEffect(() => {
    const container = getPrimaryScrollContainer();
    const sentinel = sentinelRef.current;
    if (!container || !sentinel) {
      return;
    }

    if (visibleCount >= allFiles.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          setVisibleCount((current) =>
            Math.min(allFiles.length, current + APPEND_BATCH)
          );
          break;
        }
      },
      {
        root: container,
        rootMargin: "200px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [allFiles.length, getPrimaryScrollContainer, visibleCount]);

  useEffect(() => {
    const container = getPrimaryScrollContainer();
    if (!container || !onActiveFileChange) {
      return;
    }

    const detectActiveFile = () => {
      if (suppressActiveSyncRef.current) {
        return;
      }

      const headers = Array.from(
        container.querySelectorAll<HTMLTableRowElement>(
          "[data-diff-file-header='true']"
        )
      );
      if (headers.length === 0) {
        return;
      }

      const containerTop = container.getBoundingClientRect().top;
      const activationTop = containerTop + 88;
      let activePath: string | null = null;

      for (const header of headers) {
        const top = header.getBoundingClientRect().top;
        if (top <= activationTop) {
          activePath = header.dataset.diffFilePath ?? null;
        } else {
          break;
        }
      }

      if (!activePath) {
        activePath = headers[0].dataset.diffFilePath ?? null;
      }

      if (!activePath || activePath === lastReportedActiveFileRef.current) {
        return;
      }

      lastReportedActiveFileRef.current = activePath;
      lastAutoSyncedFileRef.current = activePath;
      onActiveFileChange(activePath);
    };

    container.addEventListener("scroll", detectActiveFile, { passive: true });
    const frameId = window.requestAnimationFrame(detectActiveFile);

    return () => {
      window.cancelAnimationFrame(frameId);
      container.removeEventListener("scroll", detectActiveFile);
    };
  }, [getPrimaryScrollContainer, onActiveFileChange, visibleFiles]);

  const totalFiles = allFiles.length > 0 ? allFiles.length : files.length;
  const shownFiles = visibleFiles.length;

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
      <StackHeader
        collapsed={collapsed}
        showing={shownFiles}
        total={totalFiles}
        onToggle={() => setCollapsed((value) => !value)}
      />

      {!collapsed ? (
        diffDisplayMode === "unified" ? (
          <CodeMirrorDiffViewer
            ref={unifiedRef}
            diffFiles={visibleFiles}
            loading={loading}
            error={error}
            viewMode="diff"
            alwaysShowFileHeaders
            sentinelRef={sentinelRef}
          />
        ) : (
          <SplitView
            diffFiles={visibleFiles}
            loading={loading}
            error={error}
            leftRef={splitLeftRef}
            rightRef={splitRightRef}
            sentinelRef={sentinelRef}
          />
        )
      ) : null}
    </div>
  );
}
