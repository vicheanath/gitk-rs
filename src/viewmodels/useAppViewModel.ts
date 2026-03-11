import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CommitNode, GraphEdge } from "../types/git";
import { useSettings } from "../context/SettingsContext";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface AppViewModel {
  repoPath: string | null;
  isRepoOpen: boolean;
  nodes: CommitNode[];
  edges: GraphEdge[];
  loadingGraph: boolean;
  graphError: string | null;
  selectedCommit: string | null;
  searchQuery: string;
  openRepository: (path: string) => Promise<void>;
  loadCommitGraph: () => Promise<void>;
  setSelectedCommit: (commitId: string | null) => void;
  setSearchQuery: (query: string) => void;
  selectPrevCommit: () => void;
  selectNextCommit: () => void;
}

export function useAppViewModel(): AppViewModel {
  const { settings } = useSettings();
  const [repoPath, setRepoPath] = useState<string | null>(null);
  const [isRepoOpen, setIsRepoOpen] = useState(false);

  const [nodes, setNodes] = useState<CommitNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);

  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const selectPrevCommit = useCallback(() => {
    setSelectedCommit((current) => {
      if (nodes.length === 0) return current;
      if (!current) return nodes[0].id;
      const idx = nodes.findIndex((n) => n.id === current);
      return idx > 0 ? nodes[idx - 1].id : current;
    });
  }, [nodes]);

  const selectNextCommit = useCallback(() => {
    setSelectedCommit((current) => {
      if (nodes.length === 0) return current;
      if (!current) return nodes[0].id;
      const idx = nodes.findIndex((n) => n.id === current);
      return idx < nodes.length - 1 ? nodes[idx + 1].id : current;
    });
  }, [nodes]);

  const loadCommitGraph = useCallback(async () => {
    if (!isTauri) {
      setLoadingGraph(false);
      setGraphError(
        "Repository access is only available in the Tauri desktop app."
      );
      setNodes([]);
      setEdges([]);
      return;
    }

    setLoadingGraph(true);
    setGraphError(null);
    try {
      const graph = await invoke<{ nodes: CommitNode[]; edges: GraphEdge[] }>(
        "get_commit_graph",
        { maxCommits: settings.maxCommits }
      );
      setNodes(graph.nodes);
      setEdges(graph.edges);
      setLoadingGraph(false);
      setGraphError(null);
    } catch (error) {
      setLoadingGraph(false);
      setGraphError(error instanceof Error ? error.message : String(error));
      setNodes([]);
      setEdges([]);
    }
  }, [settings.maxCommits]);

  useEffect(() => {
    if (!isRepoOpen) {
      return;
    }

    void loadCommitGraph();
  }, [isRepoOpen, loadCommitGraph]);

  const openRepository = useCallback(
    async (path: string) => {
      if (!isTauri) {
        alert("Open Repository is only available in the Tauri desktop app.");
        return;
      }

      try {
        await invoke("open_repository", { path });
        setRepoPath(path);
        setIsRepoOpen(true);
        setSelectedCommit(null);
        setSearchQuery("");
        await loadCommitGraph();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        alert(`Failed to open repository: ${errorMessage}\n\nPath: ${path}`);
      }
    },
    [loadCommitGraph]
  );

  return useMemo(
    () => ({
      repoPath,
      isRepoOpen,
      nodes,
      edges,
      loadingGraph,
      graphError,
      selectedCommit,
      searchQuery,
      openRepository,
      loadCommitGraph,
      setSelectedCommit,
      setSearchQuery,
      selectPrevCommit,
      selectNextCommit,
    }),
    [
      repoPath,
      isRepoOpen,
      nodes,
      edges,
      loadingGraph,
      graphError,
      selectedCommit,
      searchQuery,
      openRepository,
      loadCommitGraph,
      selectPrevCommit,
      selectNextCommit,
    ]
  );
}
