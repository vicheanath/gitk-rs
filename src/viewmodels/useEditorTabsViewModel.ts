import { useEffect, useMemo, useState } from "react";
import { CommitNode } from "../types/git";

export type EditorTab =
  | { id: "graph"; type: "graph"; title: "Graph" }
  | { id: `commit:${string}`; type: "commit"; commitId: string; title: string };

interface UseEditorTabsViewModelProps {
  isRepoOpen: boolean;
  nodes: CommitNode[];
  setSelectedCommit: (commitId: string | null) => void;
}

export function useEditorTabsViewModel({
  isRepoOpen,
  nodes,
  setSelectedCommit,
}: UseEditorTabsViewModelProps) {
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([
    { id: "graph", type: "graph", title: "Graph" },
  ]);
  const [activeTabId, setActiveTabId] = useState<EditorTab["id"]>("graph");

  const commitTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) {
      map.set(
        node.id,
        node.summary || node.message.split("\n")[0] || node.id.slice(0, 7)
      );
    }
    return map;
  }, [nodes]);

  const activeTab = useMemo(
    () => openTabs.find((tab) => tab.id === activeTabId) ?? openTabs[0],
    [activeTabId, openTabs]
  );

  useEffect(() => {
    if (!isRepoOpen) {
      setOpenTabs([{ id: "graph", type: "graph", title: "Graph" }]);
      setActiveTabId("graph");
    }
  }, [isRepoOpen]);

  useEffect(() => {
    setOpenTabs((current) =>
      current.map((tab) => {
        if (tab.type !== "commit") {
          return tab;
        }

        const nextTitle =
          commitTitleMap.get(tab.commitId) ?? tab.commitId.slice(0, 7);
        return nextTitle === tab.title ? tab : { ...tab, title: nextTitle };
      })
    );
  }, [commitTitleMap]);

  const openCommitTab = (commitId: string) => {
    const tabId = `commit:${commitId}` as const;
    const title = commitTitleMap.get(commitId) ?? commitId.slice(0, 7);

    setOpenTabs((current) => {
      if (current.some((tab) => tab.id === tabId)) {
        return current;
      }

      return [...current, { id: tabId, type: "commit", commitId, title }];
    });
    setActiveTabId(tabId);
  };

  const selectCommitFromGraph = (commitId: string | null) => {
    setSelectedCommit(commitId);
    if (commitId) {
      openCommitTab(commitId);
    }
  };

  const activateTab = (tab: EditorTab) => {
    setActiveTabId(tab.id);
    setSelectedCommit(tab.type === "commit" ? tab.commitId : null);
  };

  const closeTab = (tabId: EditorTab["id"]) => {
    if (tabId === "graph") {
      return;
    }

    setOpenTabs((current) => {
      const index = current.findIndex((tab) => tab.id === tabId);
      if (index === -1) {
        return current;
      }

      const nextTabs = current.filter((tab) => tab.id !== tabId);

      if (activeTabId === tabId) {
        const fallback = nextTabs[index] ?? nextTabs[index - 1] ?? nextTabs[0];
        if (fallback) {
          setActiveTabId(fallback.id);
          setSelectedCommit(fallback.type === "commit" ? fallback.commitId : null);
        }
      }

      return nextTabs;
    });
  };

  return {
    openTabs,
    activeTab,
    selectCommitFromGraph,
    activateTab,
    closeTab,
  };
}