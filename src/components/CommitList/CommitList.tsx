import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CommitNode } from "../../types/git";
import {
  getBranchBadgeTextColor,
  getBranchColor,
} from "../../utils/graph/branchColors";
import { useSettings } from "../../context/SettingsContext";

interface CommitListProps {
  nodes: CommitNode[];
  selectedCommit?: string;
  onCommitSelect: (commitId: string) => void;
  searchQuery?: string;
}

export default function CommitList({
  nodes,
  selectedCommit,
  onCommitSelect,
  searchQuery = "",
}: CommitListProps) {
  const { settings } = useSettings();
  const [commitBranches, setCommitBranches] = useState<Map<string, string[]>>(
    new Map()
  );
  const selectedItemRef = useRef<HTMLTableRowElement>(null);

  // Load branches for each commit
  useEffect(() => {
    const loadCommitBranches = async () => {
      const isTauri =
        typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
      if (!isTauri || nodes.length === 0) return;

      const branchesMap = new Map<string, string[]>();
      const loadPromises = nodes.map(async (node) => {
        try {
          const branches = await invoke<string[]>("get_commit_branches", {
            oid: node.id,
          });
          branchesMap.set(node.id, branches);
        } catch (error) {
          console.error(
            `Failed to load branches for commit ${node.id}:`,
            error
          );
          branchesMap.set(node.id, []);
        }
      });

      await Promise.all(loadPromises);
      setCommitBranches(branchesMap);
    };

    loadCommitBranches();
  }, [nodes]);

  // Scroll to selected commit when it changes
  useEffect(() => {
    if (selectedCommit && selectedItemRef.current) {
      // Find the parent scroll container (app-graph-list-container)
      const scrollContainer = selectedItemRef.current.closest(
        ".app-graph-list-container"
      );
      const item = selectedItemRef.current;

      if (scrollContainer && item) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();

        // Check if item is visible, if not scroll to it
        if (
          itemRect.top < containerRect.top ||
          itemRect.bottom > containerRect.bottom
        ) {
          item.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }
    }
  }, [selectedCommit]);

  // Filter nodes by search query
  const filteredNodes = nodes.filter((node) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      node.id.toLowerCase().includes(query) ||
      node.message.toLowerCase().includes(query) ||
      node.author.toLowerCase().includes(query)
    );
  });

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    if (settings.dateFormat === "relative") {
      const diffMs = Date.now() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);
      if (diffSec < 60) return "just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHour < 24) return `${diffHour}h ago`;
      if (diffDay < 30) return `${diffDay}d ago`;
      const diffMonth = Math.floor(diffDay / 30);
      if (diffMonth < 12) return `${diffMonth}mo ago`;
      return `${Math.floor(diffDay / 365)}y ago`;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const getSummary = (message: string) => {
    return message.split("\n")[0];
  };

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="rounded border border-dashed border-[var(--border-primary)] px-3 py-4 text-xs text-[var(--text-secondary)]">
          <p>No commits to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div>
        <table className="w-full table-fixed border-collapse text-xs">
          <thead>
            <tr className="sticky top-0 z-10 bg-[var(--bg-secondary)]">
              <th className="w-[42%] border-b border-[var(--border-primary)] px-2 py-1.5 text-left font-semibold text-[var(--text-secondary)]">Message</th>
              <th className="w-[18%] border-b border-[var(--border-primary)] px-2 py-1.5 text-left font-semibold text-[var(--text-secondary)]">Author</th>
              <th className="w-[20%] border-b border-[var(--border-primary)] px-2 py-1.5 text-left font-semibold text-[var(--text-secondary)]">Date</th>
              <th className="w-[20%] border-b border-[var(--border-primary)] px-2 py-1.5 text-left font-semibold text-[var(--text-secondary)]">Branches</th>
            </tr>
          </thead>
          <tbody>
            {filteredNodes.map((node, rowIndex) => {
              const isSelected = node.id === selectedCommit;
              const isMerge = node.parents.length > 1;
              const branches = commitBranches.get(node.id) || [];
              const summary = getSummary(node.message);

              return (
                <tr
                  key={node.id}
                  ref={isSelected ? selectedItemRef : null}
                  className={`cursor-pointer border-b border-[var(--border-primary)]/60 transition-colors hover:bg-[var(--bg-secondary)] ${
                    isSelected ? "bg-[var(--bg-secondary)]" : ""
                  }`}
                  onClick={() => onCommitSelect(node.id)}
                  data-commit-id={node.id}
                  data-row-index={rowIndex}
                >
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {isMerge && <span className="rounded border border-[var(--warning)] px-1 text-[10px] text-[var(--warning)]">M</span>}
                      <span className="truncate text-[var(--text-primary)]">{summary}</span>
                    </div>
                  </td>
                  <td className="truncate px-2 py-1.5 text-[var(--text-secondary)]">{node.author}</td>
                  <td className="px-2 py-1.5 text-[var(--text-secondary)]">{formatDate(node.time)}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {branches.map((branchName) => (
                        <span
                          key={branchName}
                          className="inline-flex max-w-full items-center rounded border border-[var(--border-primary)] px-1.5 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: getBranchColor(branchName),
                            color: getBranchBadgeTextColor(branchName),
                          }}
                          title={branchName}
                        >
                          <span className="truncate">{branchName}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
