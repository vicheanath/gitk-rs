import { CommitNode, GraphEdge } from "../../types/git";
import GraphPane from "./GraphPane";
import { useCommitGraphListViewModel } from "../../viewmodels/useCommitGraphListViewModel";
import { ROW_HEIGHT } from "./constants";

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
    commitBranches,
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
      <div
        className="commit-graph-list-content"
        style={{
          height: `${totalHeight}px`,
          // Ensure both graph and table start at same position
          alignItems: "flex-start",
        }}
      >
        <GraphPane
          filteredNodes={filteredNodes}
          positions={positions}
          edges={edges}
          branchColors={branchColors}
          branches={branches}
          commitBranches={commitBranches}
          commitTags={commitTags}
          selectedCommit={selectedCommit}
          hoveredNode={hoveredNode}
          onHoverNode={setHoveredNode}
          onCommitSelect={handleCommitSelect}
          graphWidth={graphWidth}
          totalHeight={totalHeight}
        />
      </div>
    </div>
  );
}
