import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CommitNode } from "../../types/git";
import { CLASSIC_GITK_COLORS } from "../../utils/graph/branchColors";
import { useSettings } from "../../context/SettingsContext";

interface CommitListProps {
  nodes: CommitNode[];
  selectedCommit?: string;
  onCommitSelect: (commitId: string) => void;
  searchQuery?: string;
}

// Hash function to get consistent color for branch name
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getBranchColor(branchName: string): string {
  const colorIndex = hashString(branchName) % CLASSIC_GITK_COLORS.length;
  return CLASSIC_GITK_COLORS[colorIndex];
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
      <div className="commit-list">
        <div className="commit-list-empty">
          <p>No commits to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="commit-list classic-gitk">
      <div className="commit-table-wrapper">
        <table className="commit-table">
          <thead>
            <tr>
              <th className="col-message">Message</th>
              <th className="col-author">Author</th>
              <th className="col-date">Date</th>
              <th className="col-branches">Branches</th>
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
                  className={`commit-row ${isSelected ? "selected" : ""}`}
                  onClick={() => onCommitSelect(node.id)}
                  data-commit-id={node.id}
                  data-row-index={rowIndex}
                >
                  <td className="col-message">
                    <div className="commit-message-cell">
                      {isMerge && <span className="merge-badge">M</span>}
                      <span className="commit-message-text">{summary}</span>
                    </div>
                  </td>
                  <td className="col-author">{node.author}</td>
                  <td className="col-date">{formatDate(node.time)}</td>
                  <td className="col-branches">
                    <div className="commit-branch-labels">
                      {branches.map((branchName) => (
                        <span
                          key={branchName}
                          className="branch-label"
                          style={{
                            backgroundColor: getBranchColor(branchName),
                            color: "#000",
                          }}
                          title={branchName}
                        >
                          {branchName}
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
