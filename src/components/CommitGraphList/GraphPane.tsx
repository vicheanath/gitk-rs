import { CommitNode, GraphEdge } from "../../types/git";
import { NodePosition } from "../../utils/layout/gitkLayout";
import { getNodeColor } from "../../utils/graph/branchColors";
import { ROW_HEIGHT } from "./constants";

const NODE_RADIUS = 5;
const MERGE_NODE_RADIUS = 7;
const EDGE_STROKE_WIDTH = 1.5;

function buildConnectionPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
) {
  const deltaY = toY - fromY;
  const directionY = deltaY >= 0 ? 1 : -1;
  const absDeltaY = Math.abs(deltaY);

  if (absDeltaY <= ROW_HEIGHT * 1.25) {
    const controlY = fromY + deltaY * 0.5;
    return `M ${fromX} ${fromY} C ${fromX} ${controlY}, ${toX} ${controlY}, ${toX} ${toY}`;
  }

  const stem = Math.min(Math.max(absDeltaY * 0.22, 8), ROW_HEIGHT * 1.35);
  const startCurveY = fromY + stem * directionY;
  const endCurveY = toY - stem * directionY;
  const curveSpan = endCurveY - startCurveY;
  const controlY1 = startCurveY + curveSpan * 0.35;
  const controlY2 = startCurveY + curveSpan * 0.65;

  return [
    `M ${fromX} ${fromY}`,
    `L ${fromX} ${startCurveY}`,
    `C ${fromX} ${controlY1}, ${toX} ${controlY2}, ${toX} ${endCurveY}`,
    `L ${toX} ${toY}`,
  ].join(" ");
}

interface GraphPaneProps {
  filteredNodes: CommitNode[];
  positions: Map<string, NodePosition>;
  edges: GraphEdge[];
  branchColors: Map<string, string>;
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
  selectedCommit,
  hoveredNode,
  onHoverNode,
  onCommitSelect,
  graphWidth,
  totalHeight,
}: GraphPaneProps) {
  const maxX = filteredNodes.reduce((acc, node) => {
    const pos = positions.get(node.id);
    return pos ? Math.max(acc, pos.x) : acc;
  }, 0);
  const graphColumnWidth = Math.max(graphWidth, Math.ceil(maxX + 24));
  const svgWidth = graphColumnWidth + 8;

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
      if (fromPos.lane === toPos.lane) return null;

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

  // Center the SVG horizontally if it's smaller than the available width
  const svgOffset = Math.max(0, (graphWidth - svgWidth) / 2);

  return (
    <div className="graph-svg-wrapper" style={{ width: `${graphWidth}px` }}>
      <svg className="graph-svg" width={svgWidth} height={totalHeight} style={{ marginLeft: `${svgOffset}px` }}>
        {/* Row highlight backgrounds (selected/hover) — drawn first, below everything */}
        {filteredNodes.map((node, rowIndex) => {
          const isSelected = node.id === selectedCommit;
          const isHovered = node.id === hoveredNode;
          if (!isSelected && !isHovered) return null;
          const rowY = Math.round(rowIndex * ROW_HEIGHT);
          return (
            <rect
              key={`row-bg-${node.id}`}
              x={0}
              y={rowY}
              width={svgWidth}
              height={ROW_HEIGHT}
              fill={
                isSelected
                  ? "var(--row-selected-bg)"
                  : "var(--row-hover-bg)"
              }
              style={{ pointerEvents: "none" }}
            />
          );
        })}

        {/* Vertical lane lines */}
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
                opacity={0.8}
                style={{ pointerEvents: "none", strokeLinecap: "round" } as React.CSSProperties}
              />
            );
          })}

        {/* Bezier cross-lane edges */}
        {horizontalConnections.map((conn) => {
          const path = buildConnectionPath(conn.fromX, conn.fromY, conn.toX, conn.toY);
          return (
            <path
              key={conn.key}
              d={path}
              stroke={conn.color}
              strokeWidth={EDGE_STROKE_WIDTH}
              fill="none"
              opacity={0.7}
              style={{ pointerEvents: "none", strokeLinecap: "round", strokeLinejoin: "round" } as React.CSSProperties}
            />
          );
        })}

        {/* Commit node circles */}
        {filteredNodes.map((node, rowIndex) => {
          const pos = positions.get(node.id);
          if (!pos) return null;

          const rowY = Math.round(rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2);
          const isSelected = node.id === selectedCommit;
          const isHovered = node.id === hoveredNode;
          const isMerge = node.parents.length > 1;

          const baseRadius = isMerge ? MERGE_NODE_RADIUS : NODE_RADIUS;
          let displayRadius = baseRadius;
          let fillColor = getNodeColor(node.id, branchColors);
          let strokeColor = "var(--bg-primary)";
          let strokeWidth = 1.5;

          if (isSelected) {
            displayRadius = baseRadius * 1.25;
            fillColor = "var(--accent)";
            strokeColor = "var(--accent)";
            strokeWidth = 2;
          } else if (isHovered) {
            displayRadius = baseRadius * 1.35;
            strokeColor = "#ffffff";
            strokeWidth = 2;
          }

          return (
            <g
              key={node.id}
              transform={`translate(${pos.x}, ${rowY})`}
              style={{ pointerEvents: "none" }}
            >
              {/* Drop shadow */}
              <circle
                r={displayRadius + 0.5}
                fill="rgba(0,0,0,0.2)"
                transform="translate(0.5,0.8)"
              />
              {/* Main node */}
              <circle
                r={displayRadius}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
              {/* Inner ring for merge commits */}
              {isMerge && (
                <circle
                  r={displayRadius * 0.46}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={1}
                  opacity={0.75}
                />
              )}
            </g>
          );
        })}

        {/* Transparent click/hover capture rects — rendered last so they sit on top */}
        {filteredNodes.map((node, rowIndex) => {
          const rowY = Math.round(rowIndex * ROW_HEIGHT);
          return (
            <rect
              key={`row-click-${node.id}`}
              x={0}
              y={rowY}
              width={svgWidth}
              height={ROW_HEIGHT}
              fill="transparent"
              onClick={() => onCommitSelect(node.id)}
              onMouseEnter={() => onHoverNode(node.id)}
              onMouseLeave={() => onHoverNode(null)}
              style={{ cursor: "pointer" }}
            />
          );
        })}
      </svg>
    </div>
  );
}
