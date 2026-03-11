import { CommitNode, GraphEdge } from "../../types/git";
import { NodePosition } from "../../utils/layout/gitkLayout";
import { getNodeColor } from "../../utils/graph/branchColors";
import { getBranchColor } from "./branchColor";
import { ROW_HEIGHT } from "./constants";

const NODE_RADIUS = 5;
const MERGE_NODE_RADIUS = 7;
const EDGE_STROKE_WIDTH = 2;
type BranchHead = { name: string; commit_id: string };

interface GraphPaneProps {
  filteredNodes: CommitNode[];
  positions: Map<string, NodePosition>;
  edges: GraphEdge[];
  branchColors: Map<string, string>;
  branches: BranchHead[];
  commitBranches: Map<string, string[]>;
  commitTags: Map<string, string[]>;
  selectedCommit?: string;
  hoveredNode: string | null;
  onHoverNode: (id: string | null) => void;
  onCommitSelect: (commitId: string) => void;
  graphWidth: number;
  totalHeight: number;
}

export default function GraphPane({
  filteredNodes,
  positions,
  edges,
  branchColors,
  branches,
  commitBranches,
  commitTags,
  selectedCommit,
  hoveredNode,
  onHoverNode,
  onCommitSelect,
  graphWidth,
  totalHeight,
}: GraphPaneProps) {
  const MESSAGE_COLUMN_PADDING = 18;
  const MESSAGE_TRIM = 96;

  const trimSummary = (message: string) => {
    const summary = message.split("\n")[0];
    if (summary.length <= MESSAGE_TRIM) {
      return summary;
    }
    return `${summary.slice(0, MESSAGE_TRIM - 1)}...`;
  };

  const maxX = filteredNodes.reduce((acc, node) => {
    const pos = positions.get(node.id);
    return pos ? Math.max(acc, pos.x) : acc;
  }, 0);
  const graphColumnWidth = Math.max(graphWidth, Math.ceil(maxX + 24));
  const svgWidth = graphColumnWidth + 1400;

  const nodeToRowIndex = new Map<string, number>();
  filteredNodes.forEach((node, idx) => nodeToRowIndex.set(node.id, idx));

  const laneRows = new Map<number, { x: number; color: string; rows: number[] }>();
  filteredNodes.forEach((node, rowIndex) => {
    const pos = positions.get(node.id);
    if (!pos) return;

    const laneData = laneRows.get(pos.lane);
    if (!laneData) {
      laneRows.set(pos.lane, {
        x: pos.x,
        color: getNodeColor(node.id, branchColors),
        rows: [rowIndex],
      });
      return;
    }

    laneData.rows.push(rowIndex);
  });

  const horizontalConnections = edges
    .map((edge) => {
      const fromPos = positions.get(edge.from);
      const toPos = positions.get(edge.to);
      const fromRow = nodeToRowIndex.get(edge.from);
      const toRow = nodeToRowIndex.get(edge.to);
      if (!fromPos || !toPos || fromRow === undefined || toRow === undefined) {
        return null;
      }
      if (fromPos.lane === toPos.lane) {
        return null;
      }

      return {
        key: `${edge.from}-${edge.to}`,
        fromX: fromPos.x,
        toX: toPos.x,
        fromY: Math.round(fromRow * ROW_HEIGHT + ROW_HEIGHT / 2),
        toY: Math.round(toRow * ROW_HEIGHT + ROW_HEIGHT / 2),
        color: getNodeColor(edge.from, branchColors),
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <div className="graph-svg-wrapper" style={{ width: `${graphWidth}px` }}>
      <svg className="graph-svg" width={svgWidth} height={totalHeight}>
        {filteredNodes.map((node, rowIndex) => {
          const rowY = Math.round(rowIndex * ROW_HEIGHT);
          const isSelected = node.id === selectedCommit;
          return (
            <rect
              key={`row-bg-${node.id}`}
              x={0}
              y={rowY}
              width={svgWidth}
              height={ROW_HEIGHT}
              fill={isSelected ? "rgba(126, 231, 135, 0.09)" : "transparent"}
              onClick={() => onCommitSelect(node.id)}
              style={{ cursor: "pointer" }}
            />
          );
        })}

        {Array.from(laneRows.entries())
          .sort(([a], [b]) => a - b)
          .map(([lane, laneData]) => {
            const rows = laneData.rows.sort((a, b) => a - b);
            if (rows.length === 0) return null;

            const firstRow = rows[0];
            const lastRow = rows[rows.length - 1];
            const y1 = Math.round(firstRow * ROW_HEIGHT + ROW_HEIGHT / 2);
            const y2 = Math.round(lastRow * ROW_HEIGHT + ROW_HEIGHT / 2);

            return (
              <line
                key={`lane-${lane}`}
                x1={laneData.x}
                y1={y1}
                x2={laneData.x}
                y2={y2}
                stroke={laneData.color}
                strokeWidth={EDGE_STROKE_WIDTH}
                opacity={0.85}
                style={{ pointerEvents: "none", strokeLinecap: "round" }}
              />
            );
          })}

        {horizontalConnections.map((conn) => {
          const controlY = (conn.fromY + conn.toY) / 2;
          const path = `M ${conn.fromX} ${conn.fromY} C ${conn.fromX} ${controlY}, ${conn.toX} ${controlY}, ${conn.toX} ${conn.toY}`;
          return (
            <path
              key={conn.key}
              d={path}
              stroke={conn.color}
              strokeWidth={EDGE_STROKE_WIDTH}
              fill="none"
              opacity={0.75}
              style={{ pointerEvents: "none", strokeLinecap: "round", strokeLinejoin: "round" }}
            />
          );
        })}

        {filteredNodes.map((node, rowIndex) => {
          const pos = positions.get(node.id);
          if (!pos) return null;

          const rowY = Math.round(rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2);
          const isSelected = node.id === selectedCommit;
          const isHovered = node.id === hoveredNode;
          const isMerge = node.parents.length > 1;

          const radius = isMerge ? MERGE_NODE_RADIUS : NODE_RADIUS;
          let displayRadius = radius;
          let fillColor = getNodeColor(node.id, branchColors);
          let strokeColor = "#1e293b";
          let strokeWidth = 1.5;

          if (isSelected) {
            displayRadius = radius * 1.3;
            fillColor = "#fbbf24";
            strokeColor = "#f59e0b";
            strokeWidth = 3;
          } else if (isHovered) {
            displayRadius = radius * 1.5;
            strokeColor = "#ffffff";
            strokeWidth = 2.5;
          }

          const tags = commitTags.get(node.id) || [];
          const branchHeads = branches.filter((b) => b.commit_id === node.id);
          const rowBranches = commitBranches.get(node.id) || [];
          const messageX = graphColumnWidth + MESSAGE_COLUMN_PADDING;
          const infoX = graphColumnWidth + 860;
          const hash = node.id.slice(0, 7);
          const summary = trimSummary(node.message);

          return (
            <g
              key={node.id}
              transform={`translate(${pos.x}, ${rowY})`}
              style={{ cursor: "pointer" }}
              onClick={() => onCommitSelect(node.id)}
              onMouseEnter={() => onHoverNode(node.id)}
              onMouseLeave={() => onHoverNode(null)}
            >
              <circle
                r={displayRadius + 0.5}
                fill="rgba(0, 0, 0, 0.1)"
                transform="translate(0.5, 0.5)"
                style={{ pointerEvents: "none" }}
              />
              <circle
                r={displayRadius}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                opacity={0.95}
              />
              {isMerge && (
                <circle
                  r={displayRadius * 0.55}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={1.5}
                  opacity={0.9}
                />
              )}

              {tags.map((tagName, tagIdx) => (
                <g key={`tag-${node.id}-${tagName}`} transform={`translate(${NODE_RADIUS + 4}, ${-6 + tagIdx * 10})`}>
                  <polygon
                    points={`0,0 ${NODE_RADIUS + 2},${NODE_RADIUS + 2} 0,${(NODE_RADIUS + 2) * 2}`}
                    fill="#fbbf24"
                    stroke="#f59e0b"
                    strokeWidth={1}
                    opacity={0.9}
                  />
                  <text x={NODE_RADIUS + 4} y={NODE_RADIUS + 2} fontSize="8" fill="#f59e0b" fontWeight="600">
                    {tagName}
                  </text>
                </g>
              ))}

              {branchHeads.map((branch, branchIdx) => (
                <text
                  key={`branch-${node.id}-${branch.name}`}
                  x={NODE_RADIUS + 6}
                  y={-4 - branchIdx * 12}
                  fontSize="9"
                  fill={getBranchColor(branch.name)}
                  fontWeight="600"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {branch.name}
                </text>
              ))}

              <text
                x={messageX - pos.x}
                y={4}
                fontSize="10"
                fill="var(--terminal-green-dim, #6b7f95)"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {hash}
              </text>
              <text
                x={messageX - pos.x + 70}
                y={4}
                fontSize="12"
                fill="var(--text-primary)"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {summary}
              </text>
              <text
                x={infoX - pos.x}
                y={4}
                fontSize="11"
                fill="var(--text-secondary)"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {`${node.author}  ${new Date(node.time * 1000).toLocaleString()}`}
              </text>
              {rowBranches.length > 0 && (
                <text
                  x={infoX - pos.x + 290}
                  y={4}
                  fontSize="10"
                  fill={getBranchColor(rowBranches[0])}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  [{rowBranches.join(", ")}]
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
