import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CommitNode, GraphEdge, Branch } from "../types/git";
import { computeGitKLayout, NodePosition } from "../utils/layout/gitkLayout";
import { assignBranchColors } from "../utils/graph/branchColors";
import { HEADER_HEIGHT, ROW_HEIGHT } from "../components/CommitGraphList/constants";

interface UseCommitGraphListViewModelProps {
  nodes: CommitNode[];
  edges: GraphEdge[];
  selectedCommit?: string;
  searchQuery?: string;
}

export function useCommitGraphListViewModel({
  nodes,
  edges,
  selectedCommit,
  searchQuery = "",
}: UseCommitGraphListViewModelProps) {
  const [layout, setLayout] = useState<{
    positions: Map<string, NodePosition>;
    sortedNodes: CommitNode[];
    width: number;
    height: number;
  } | null>(null);
  const [branchColors, setBranchColors] = useState<Map<string, string>>(
    new Map()
  );
  const [branches, setBranches] = useState<Array<{ name: string; commit_id: string }>>([]);
  const [commitBranches, setCommitBranches] = useState<Map<string, string[]>>(
    new Map()
  );
  const [commitTags, setCommitTags] = useState<Map<string, string[]>>(new Map());
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadBranches = async () => {
      const isTauri =
        typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

      if (nodes.length === 0) return;

      if (!isTauri) {
        setBranches([]);
        return;
      }

      try {
        const branchList = await invoke<Branch[]>("get_branches");
        setBranches(branchList.map((b) => ({ name: b.name, commit_id: b.commit_id })));
      } catch (error) {
        console.error("Failed to load branches:", error);
      }
    };

    if (nodes.length > 0) {
      loadBranches();
    }
  }, [nodes.length]);

  useEffect(() => {
    const loadTags = async () => {
      const isTauri =
        typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
      if (!isTauri || nodes.length === 0) return;

      try {
        const tagList = await invoke<Array<{ name: string; commit_id: string }>>(
          "get_tags"
        );

        const tagsMap = new Map<string, string[]>();
        tagList.forEach((tag) => {
          if (!tagsMap.has(tag.commit_id)) {
            tagsMap.set(tag.commit_id, []);
          }
          tagsMap.get(tag.commit_id)!.push(tag.name);
        });
        setCommitTags(tagsMap);
      } catch (error) {
        console.error("Failed to load tags:", error);
      }
    };

    loadTags();
  }, [nodes.length]);

  useEffect(() => {
    if (nodes.length === 0) {
      setCommitBranches(new Map());
      return;
    }

    const nodeIds = new Set(nodes.map((node) => node.id));
    const parentsByChild = new Map<string, string[]>();

    // Edges are stored as parent -> child; build child -> parents adjacency.
    for (const edge of edges) {
      const parents = parentsByChild.get(edge.to);
      if (parents) {
        parents.push(edge.from);
      } else {
        parentsByChild.set(edge.to, [edge.from]);
      }
    }

    const branchSetsByCommit = new Map<string, Set<string>>();
    for (const node of nodes) {
      branchSetsByCommit.set(node.id, new Set());
    }

    // Walk each branch tip back through parents within the currently loaded graph.
    for (const branch of branches) {
      if (!nodeIds.has(branch.commit_id)) {
        continue;
      }

      const stack = [branch.commit_id];
      const visited = new Set<string>();

      while (stack.length > 0) {
        const commitId = stack.pop()!;
        if (visited.has(commitId)) {
          continue;
        }
        visited.add(commitId);

        branchSetsByCommit.get(commitId)?.add(branch.name);

        const parents = parentsByChild.get(commitId);
        if (parents) {
          stack.push(...parents);
        }
      }
    }

    const branchesMap = new Map<string, string[]>();
    for (const [commitId, names] of branchSetsByCommit) {
      branchesMap.set(commitId, Array.from(names));
    }

    setCommitBranches(branchesMap);
  }, [nodes, edges, branches]);

  useEffect(() => {
    if (nodes.length === 0) {
      setLayout(null);
      setBranchColors(new Map());
      return;
    }

    const graphLayout = computeGitKLayout(nodes, edges);
    setLayout(graphLayout);
    setBranchColors(assignBranchColors(nodes, edges, branches));
  }, [nodes, edges, branches]);

  const filteredNodes = useMemo(() => {
    if (!layout) return [];
    return layout.sortedNodes.filter((node) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        node.id.toLowerCase().includes(query) ||
        node.message.toLowerCase().includes(query) ||
        node.author.toLowerCase().includes(query)
      );
    });
  }, [layout, searchQuery]);

  const totalHeight = useMemo(
    () => Math.round(filteredNodes.length * ROW_HEIGHT),
    [filteredNodes.length]
  );

  const rowIndexByCommitId = useMemo(() => {
    const map = new Map<string, number>();
    filteredNodes.forEach((node, index) => {
      map.set(node.id, index);
    });
    return map;
  }, [filteredNodes]);

  const scrollToCommit = (commitId: string, behavior: ScrollBehavior = "smooth") => {
    const rowIndex = rowIndexByCommitId.get(commitId);
    const container = containerRef.current;
    if (rowIndex === undefined || !container) {
      return;
    }

    const rowTop = HEADER_HEIGHT + rowIndex * ROW_HEIGHT;
    const rowCenter = rowTop + ROW_HEIGHT / 2;
    const targetTop = Math.max(0, rowCenter - container.clientHeight / 2);

    container.scrollTo({ top: targetTop, behavior });
  };

  useEffect(() => {
    if (selectedCommit) {
      scrollToCommit(selectedCommit);
    }
  }, [selectedCommit, rowIndexByCommitId]);

  return {
    layout,
    branchColors,
    branches,
    commitBranches,
    commitTags,
    hoveredNode,
    containerRef,
    filteredNodes,
    totalHeight,
    rowIndexByCommitId,
    scrollToCommit,
    setHoveredNode,
  };
}
