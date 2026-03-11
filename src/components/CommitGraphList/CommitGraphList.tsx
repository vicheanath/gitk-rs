import { CommitNode, GraphEdge } from "../../types/git";
import GraphPane from "./GraphPane";
import { useCommitGraphListViewModel } from "../../viewmodels/useCommitGraphListViewModel";
import { HEADER_HEIGHT, ROW_HEIGHT } from "./constants";
import { getBranchColor } from "./branchColor";

function formatDate(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${day} ${h}:${min}`;
}

function trimSummary(message: string): string {
  const summary = message.split("\n")[0];
  return summary.length > 72 ? `${summary.slice(0, 71)}\u2026` : summary;
}

interface CommitGraphListProps {
  nodes: CommitNode[];
  edges: GraphEdge[];
  selectedCommit?: string;
  onCommitSelect: (commitId: string) => void;
  searchQuery?: string;
  graphWidth: number;
}

export default function CommitGraphList({
  nodes,
  edges,
  selectedCommit,
  onCommitSelect,
  searchQuery = "",
  graphWidth,
}: CommitGraphListProps) {
  const {
    layout,
    branchColors,
    branches,
    commitTags,
    hoveredNode,
    containerRef,
    filteredNodes,
    totalHeight,
    scrollToCommit,
    setHoveredNode,
  } = useCommitGraphListViewModel({
    nodes,
    edges,
    selectedCommit,
    searchQuery,
  });

  const handleCommitSelect = (commitId: string) => {
    onCommitSelect(commitId);
    scrollToCommit(commitId);
  };

  if (!layout || nodes.length === 0) {
    return (
      <div className="commit-graph-list-container">
        <div className="graph-loading">
          <p>Loading commits...</p>
        </div>
      </div>
    );
  }

  const { positions } = layout;

  return (
    <div
      ref={containerRef}
      className="commit-graph-list-container"
      style={{ ["--row-height" as string]: `${ROW_HEIGHT}px` }}
    >
      {/* Sticky column header */}
      <div
        className="commit-graph-header"
        style={{ paddingLeft: `${graphWidth}px`, height: `${HEADER_HEIGHT}px` }}
      >
        <span className="col-h-message">Message</span>
        <span className="col-h-author">Author</span>
        <span className="col-h-date">Date</span>
      </div>

      {/* Virtual scroll canvas */}
      <div
        className="commit-graph-list-content"
        style={{ height: `${totalHeight}px` }}
      >
        {/* Graph lane + node SVG (left column) */}
        <GraphPane
          filteredNodes={filteredNodes}
          positions={positions}
          edges={edges}
          branchColors={branchColors}
          selectedCommit={selectedCommit}
          hoveredNode={hoveredNode}
          onHoverNode={setHoveredNode}
          onCommitSelect={handleCommitSelect}
          graphWidth={graphWidth}
          totalHeight={totalHeight}
        />

        {/* HTML commit rows (right of graph column) */}
        <div
          className="commit-rows-overlay"
          style={{ left: `${graphWidth}px` }}
        >
          {filteredNodes.map((node) => {
            const isSelected = node.id === selectedCommit;
            const isHovered = node.id === hoveredNode;
            const isMerge = node.parents.length > 1;
            const branchHeads = branches.filter((b) => b.commit_id === node.id);
            const tags = commitTags.get(node.id) ?? [];
            const summary = trimSummary(node.message);

            return (
              <div
                key={node.id}
                className={`commit-row-html${isSelected ? " selected" : ""}${isHovered ? " hovered" : ""}`}
                style={{ height: `${ROW_HEIGHT}px` }}
                onClick={() => handleCommitSelect(node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                data-commit-id={node.id}
              >
                {/* Ref pills: tags and branch heads */}
                {(tags.length > 0 || branchHeads.length > 0) && (
                  <div className="commit-ref-labels">
                    {tags.slice(0, 2).map((t) => (
                      <span key={t} className="ref-tag-pill" title={t}>
                        {t}
                      </span>
                    ))}
                    {branchHeads.slice(0, 3).map((b) => (
                      <span
                        key={b.name}
                        className="ref-branch-pill"
                        style={
                          { "--pill-color": getBranchColor(b.name) } as React.CSSProperties
                        }
                        title={b.name}
                      >
                        {b.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Commit message */}
                <div className="commit-row-message">
                  {isMerge && <span className="merge-badge">M</span>}
                  <span className="commit-hash-chip">{node.id.slice(0, 7)}</span>
                  <span
                    className="commit-message-text"
                    title={node.message.split("\n")[0]}
                  >
                    {summary}
                  </span>
                </div>

                {/* Author */}
                <span className="commit-row-author" title={node.author}>
                  {node.author}
                </span>

                {/* Date */}
                <span className="commit-row-date">{formatDate(node.time)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
