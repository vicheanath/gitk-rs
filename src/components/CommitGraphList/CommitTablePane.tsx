import { CommitNode } from "../../types/git";
import { COMMIT_SUMMARY_MAX, ROW_HEIGHT } from "./constants";

interface CommitTablePaneProps {
  filteredNodes: CommitNode[];
  selectedCommit?: string;
  commitBranches: Map<string, string[]>;
  onCommitSelect: (commitId: string) => void;
  getBranchColor: (branchName: string) => string;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function getSummary(message: string): string {
  return message.split("\n")[0];
}

function trimSummary(summary: string): string {
  if (summary.length <= COMMIT_SUMMARY_MAX) {
    return summary;
  }
  return `${summary.slice(0, COMMIT_SUMMARY_MAX - 1)}...`;
}

export default function CommitTablePane({
  filteredNodes,
  selectedCommit,
  commitBranches,
  onCommitSelect,
  getBranchColor,
}: CommitTablePaneProps) {
  return (
    <div className="commit-table-section">
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
            const trimmedSummary = trimSummary(summary);

            return (
              <tr
                key={node.id}
                className={`commit-row ${isSelected ? "selected" : ""}`}
                onClick={() => onCommitSelect(node.id)}
                data-commit-id={node.id}
                data-row-index={rowIndex}
                style={{
                  height: `${ROW_HEIGHT}px`,
                  lineHeight: `${ROW_HEIGHT}px`,
                  boxSizing: "border-box",
                }}
              >
                <td className="col-message">
                  <div className="commit-message-cell">
                    {isMerge && <span className="merge-badge">M</span>}
                    <span className="commit-hash-chip" title={node.id}>
                      {node.id.slice(0, 7)}
                    </span>
                    <span className="commit-message-text" title={summary}>
                      {trimmedSummary}
                    </span>
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
                        style={{ backgroundColor: getBranchColor(branchName), color: "#000" }}
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
  );
}
