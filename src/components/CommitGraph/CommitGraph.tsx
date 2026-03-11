import GraphSVG from "./GraphSVG";
import { CommitNode, GraphEdge } from "../../types/git";

interface CommitGraphProps {
  nodes: CommitNode[];
  edges: GraphEdge[];
  selectedCommit?: string;
  onCommitSelect: (commitId: string) => void;
  searchQuery?: string;
  onSortedNodesChange?: (sortedNodes: CommitNode[]) => void;
}

export default function CommitGraph({
  nodes,
  edges,
  selectedCommit,
  onCommitSelect,
  searchQuery = "",
  onSortedNodesChange,
}: CommitGraphProps) {
  return (
    <div className="commit-graph-container">
      <div className="graph-wrapper">
        <GraphSVG
          nodes={nodes}
          edges={edges}
          selectedCommit={selectedCommit}
          onCommitSelect={onCommitSelect}
          searchQuery={searchQuery}
          onSortedNodesChange={onSortedNodesChange}
        />
      </div>
    </div>
  );
}
