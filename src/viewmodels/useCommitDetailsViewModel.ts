import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CommitDetails, CommitNode } from "../types/git";
import { useResizable } from "../hooks/useResizable";
import { useSettings } from "../context/SettingsContext";

interface UseCommitDetailsViewModelProps {
  commitId?: string;
  nodes: CommitNode[];
}

export function useCommitDetailsViewModel({
  commitId,
  nodes,
}: UseCommitDetailsViewModelProps) {
  const { settings, updateSettings } = useSettings();
  const [details, setDetails] = useState<CommitDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [navigatorMode, setNavigatorMode] = useState<"tree" | "files">("tree");
  const [diffDisplayMode, setDiffDisplayMode] = useState<"unified" | "split">(
    "unified"
  );
  const [contextLines, setContextLines] = useState<number>(
    settings.diffContextLines
  );
  const [ignoreWhitespace, setIgnoreWhitespace] = useState<boolean>(
    settings.diffIgnoreWhitespace
  );

  const [sidebarWidth, handleSidebarResize] = useResizable({
    initialSize: 28,
    minSize: 18,
    maxSize: 45,
  });

  useEffect(() => {
    if (!commitId) {
      setDetails(null);
      setSelectedFile(null);
      return;
    }

    setLoading(true);
    invoke<CommitDetails>("get_commit_details", { oid: commitId })
      .then((data) => {
        setDetails(data);
        if (data.files.length > 0) {
          const shouldAutoSelect =
            !selectedFile || !data.files.some((f) => f.path === selectedFile);
          if (shouldAutoSelect) {
            setSelectedFile(data.files[0].path);
          }
        } else {
          setSelectedFile(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load commit details:", err);
        setDetails(null);
        setSelectedFile(null);
        setLoading(false);
      });
  }, [commitId]);

  useEffect(() => {
    if (!details) return;
    const fileExists = details.files.some((f) => f.path === selectedFile);
    if (selectedFile && !fileExists) {
      setSelectedFile(details.files.length > 0 ? details.files[0].path : null);
    }
  }, [details, selectedFile]);

  // Sync diff settings from global settings whenever they change.
  // The user can still override them locally in the UI, but settings
  // provide the initial + reset-on-settings-change value.
  useEffect(() => {
    setContextLines(settings.diffContextLines);
  }, [settings.diffContextLines]);

  useEffect(() => {
    setIgnoreWhitespace(settings.diffIgnoreWhitespace);
  }, [settings.diffIgnoreWhitespace]);

  const currentIndex = useMemo(
    () => (commitId ? nodes.findIndex((n) => n.id === commitId) : -1),
    [commitId, nodes]
  );

  const totalCommits = nodes.length;
  const rowNumber = currentIndex >= 0 ? currentIndex + 1 : 0;

  const formattedDate = useMemo(() => {
    if (!details) return "";
    const date = new Date(details.time * 1000);
    if (settings.dateFormat === "relative") {
      const now = Date.now();
      const diffMs = now - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);
      if (diffSec < 60) return "just now";
      if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
      if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? "s" : ""} ago`;
      if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
      const diffMonth = Math.floor(diffDay / 30);
      if (diffMonth < 12) return `${diffMonth} month${diffMonth !== 1 ? "s" : ""} ago`;
      const diffYear = Math.floor(diffDay / 365);
      return `${diffYear} year${diffYear !== 1 ? "s" : ""} ago`;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }, [details, settings.dateFormat]);

  const getParentMessage = (parentId: string): string => {
    const parentNode = nodes.find((n) => n.id === parentId);
    return parentNode ? parentNode.message.split("\n")[0] : "";
  };

  const parentRows = useMemo(() => {
    if (!details) {
      return [];
    }

    return details.parents.map((parentId) => ({
      id: parentId,
      shortId: parentId.substring(0, 8),
      message: getParentMessage(parentId),
    }));
  }, [details, nodes]);

  const fileStats = useMemo(() => {
    if (!details) {
      return {
        totalChanges: 0,
        additions: 0,
        deletions: 0,
      };
    }

    const additions = details.files.reduce((sum, file) => sum + file.additions, 0);
    const deletions = details.files.reduce((sum, file) => sum + file.deletions, 0);

    return {
      totalChanges: additions + deletions,
      additions,
      deletions,
    };
  }, [details]);

  const handleSetContextLines = (value: number) => {
    setContextLines(value);
    if (value !== settings.diffContextLines) {
      updateSettings({ diffContextLines: value });
    }
  };

  const handleSetIgnoreWhitespace = (value: boolean) => {
    setIgnoreWhitespace(value);
    if (value !== settings.diffIgnoreWhitespace) {
      updateSettings({ diffIgnoreWhitespace: value });
    }
  };

  return {
    details,
    loading,
    selectedFile,
    navigatorMode,
    diffDisplayMode,
    contextLines,
    ignoreWhitespace,
    sidebarWidth,
    rowNumber,
    totalCommits,
    formattedDate,
    parentRows,
    fileStats,
    setSelectedFile,
    setNavigatorMode,
    setDiffDisplayMode,
    setContextLines: handleSetContextLines,
    setIgnoreWhitespace: handleSetIgnoreWhitespace,
    handleSidebarResize,
    getParentMessage,
  };
}
