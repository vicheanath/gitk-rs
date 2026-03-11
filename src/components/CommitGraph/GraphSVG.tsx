import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CommitNode, GraphEdge, Branch } from "../../types/git";
import {
  computeGitKLayout,
  NodePosition,
} from "../../utils/layout/gitkLayout";
import {
  assignBranchColors,
  getNodeColor,
} from "../../utils/graph/branchColors";

interface GraphSVGProps {
  nodes: CommitNode[];
  edges: GraphEdge[];
  selectedCommit?: string;
  onCommitSelect: (commitId: string) => void;
  searchQuery?: string;
  onSortedNodesChange?: (sortedNodes: CommitNode[]) => void;
}

const NODE_RADIUS = 5;
const MERGE_NODE_RADIUS = 7;
const EDGE_STROKE_WIDTH = 2;
const HOVER_RADIUS_MULTIPLIER = 1.5;

export default function GraphSVG({
  nodes,
  edges,
  selectedCommit,
  onCommitSelect,
  searchQuery = "",
  onSortedNodesChange,
}: GraphSVGProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [layout, setLayout] = useState<{
    positions: Map<string, NodePosition>;
    sortedNodes: CommitNode[];
    width: number;
    height: number;
  } | null>(null);
  const [branchColors, setBranchColors] = useState<Map<string, string>>(
    new Map()
  );
  const [branches, setBranches] = useState<
    Array<{ name: string; commit_id: string }>
  >([]);

  // Load branches when component mounts or nodes change
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const isTauri =
          typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
        if (!isTauri) return;

        const branchList = await invoke<Branch[]>("get_branches");
        setBranches(
          branchList.map((b) => ({ name: b.name, commit_id: b.commit_id }))
        );
      } catch (error) {
        console.error("Failed to load branches:", error);
      }
    };

    if (nodes.length > 0) {
      loadBranches();
    }
  }, [nodes.length]);

  // Compute layout and assign branch colors when nodes or branches change
  useEffect(() => {
    if (nodes.length === 0) {
      setLayout(null);
      setBranchColors(new Map());
      return;
    }

    const graphLayout = computeGitKLayout(nodes, edges);
    setLayout(graphLayout);

    // Notify parent of sorted nodes for commit list alignment
    if (onSortedNodesChange) {
      onSortedNodesChange(graphLayout.sortedNodes);
    }

    // Assign branch colors based on actual branch information
    const colorMap = assignBranchColors(nodes, edges, branches);
    setBranchColors(colorMap);
  }, [nodes, edges, branches, onSortedNodesChange]);

  const handleNodeClick = (nodeId: string) => {
    onCommitSelect(nodeId);
  };

  const handleNodeMouseEnter = (nodeId: string) => {
    setHoveredNode(nodeId);
  };

  const handleNodeMouseLeave = () => {
    setHoveredNode(null);
  };

  if (!layout || nodes.length === 0) {
    return (
      <div ref={containerRef} className="graph-svg-container">
        <div className="graph-empty-state">
          {nodes.length === 0 ? (
            <div>
              <p>No commits to display</p>
              <p className="empty-hint">
                Open a Git repository to see the commit graph
              </p>
            </div>
          ) : (
            <p>Computing graph layout...</p>
          )}
        </div>
      </div>
    );
  }

  const { positions, width, height } = layout;

  // Calculate viewBox with padding for scrollable area
  const padding = 50;
  const viewBoxX = -padding;
  const viewBoxY = -padding;
  const viewBoxWidth = width + padding * 2;
  const viewBoxHeight = height + padding * 2;

  // Render edges
  const edgeElements = edges.map((edge, index) => {
    const fromPos = positions.get(edge.from);
    const toPos = positions.get(edge.to);
    if (!fromPos || !toPos) return null;

    // Use the color of the source node (parent) for the edge
    const edgeColor = getNodeColor(edge.from, branchColors);

    // GitK-style edges: vertical lines with horizontal segments
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    
    // For GitK style: vertical line down, then horizontal, then vertical
    // If same lane, just vertical line
    if (Math.abs(dx) < 1) {
      // Same lane - straight vertical line
      return (
        <line
          key={`edge-${index}`}
          x1={fromPos.x}
          y1={fromPos.y}
          x2={toPos.x}
          y2={toPos.y}
          stroke={edgeColor}
          strokeWidth={EDGE_STROKE_WIDTH}
          fill="none"
          opacity={0.8}
          style={{ pointerEvents: "none" }}
          className="commit-edge"
        />
      );
    } else {
      // Different lanes - L-shaped path (vertical, then horizontal, then vertical)
      const midY = fromPos.y + dy * 0.5; // Midpoint between rows
      return (
        <path
          key={`edge-${index}`}
          d={`M ${fromPos.x} ${fromPos.y} L ${fromPos.x} ${midY} L ${toPos.x} ${midY} L ${toPos.x} ${toPos.y}`}
          stroke={edgeColor}
          strokeWidth={EDGE_STROKE_WIDTH}
          fill="none"
          opacity={0.8}
          style={{ pointerEvents: "none" }}
          className="commit-edge"
        />
      );
    }
  });

  // Render nodes - use sorted nodes from layout if available
  const nodesToRender = layout?.sortedNodes || nodes;
  const nodeElements = nodesToRender.map((node, rowIndex) => {
    const pos = positions.get(node.id);
    if (!pos) return null;

    const isSelected = node.id === selectedCommit;
    const isHovered = hoveredNode === node.id;
    const isSearchMatch =
      searchQuery &&
      node.message.toLowerCase().includes(searchQuery.toLowerCase());
    const isMerge = node.parents.length > 1;

    const color = getNodeColor(node.id, branchColors);
    const radius = isMerge ? MERGE_NODE_RADIUS : NODE_RADIUS;

    let fillColor = color;
    let strokeColor = "#1e293b";
    let strokeWidth = 1.5;
    let nodeOpacity = 0.95;
    let displayRadius = radius;

    if (isSelected) {
      fillColor = "#fbbf24"; // Yellow for selected
      strokeColor = "#f59e0b";
      strokeWidth = 3;
      nodeOpacity = 1;
      displayRadius = radius * 1.3;
    } else if (isSearchMatch) {
      fillColor = "#34d399"; // Green for search match
      strokeColor = "#10b981";
      strokeWidth = 2.5;
      nodeOpacity = 1;
      displayRadius = radius * 1.2;
    } else if (isHovered) {
      strokeColor = "#fff";
      strokeWidth = 2.5;
      nodeOpacity = 1;
      displayRadius = radius * HOVER_RADIUS_MULTIPLIER;
    }

    const summary = node.summary || node.message.split("\n")[0];

    return (
      <g
        key={node.id}
        data-commit-id={node.id}
        data-row-index={rowIndex}
        transform={`translate(${pos.x}, ${pos.y})`}
        style={{ cursor: "pointer" }}
        onClick={() => handleNodeClick(node.id)}
        onMouseEnter={() => handleNodeMouseEnter(node.id)}
        onMouseLeave={handleNodeMouseLeave}
        className="commit-node-group"
      >
        {/* Shadow for depth */}
        <circle
          r={displayRadius + 1}
          fill="rgba(0, 0, 0, 0.1)"
          transform="translate(1, 1)"
          style={{ pointerEvents: "none" }}
        />
        {/* Main node circle */}
        <circle
          r={displayRadius}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          opacity={nodeOpacity}
          className="commit-node"
          style={{
            transition: "all 0.2s ease",
            filter:
              isSelected || isHovered
                ? "drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
                : "none",
          }}
        />
        {/* Merge commit indicator */}
        {isMerge && (
          <circle
            r={displayRadius * 0.55}
            fill="none"
            stroke={isSelected ? "#f59e0b" : strokeColor}
            strokeWidth={1.5}
            opacity={0.9}
            className="merge-indicator"
          />
        )}
        {/* Hover text label */}
        {isHovered && (
          <g className="node-label" style={{ pointerEvents: "none" }}>
            <rect
              x={-Math.max(40, summary.length * 3)}
              y={-radius * HOVER_RADIUS_MULTIPLIER - 25}
              width={Math.max(80, summary.length * 6)}
              height={20}
              fill="var(--bg-tertiary)"
              stroke="var(--border-color)"
              strokeWidth={1}
              rx={4}
              opacity={0.95}
            />
            <text
              x={0}
              y={-radius * HOVER_RADIUS_MULTIPLIER - 12}
              textAnchor="middle"
              fontSize="9"
              fill="var(--text-primary)"
              fontWeight="600"
            >
              {summary.length > 25 ? summary.substring(0, 22) + "..." : summary}
            </text>
          </g>
        )}
      </g>
    );
  });

  // Calculate tooltip position based on scroll
  const getTooltipPosition = () => {
    if (!hoveredNode || !containerRef.current || !svgRef.current) return null;
    const pos = positions.get(hoveredNode);
    if (!pos) return null;

    const containerRect = containerRef.current.getBoundingClientRect();

    // Get the scroll position of the container
    const scrollLeft = containerRef.current.scrollLeft || 0;
    const scrollTop = containerRef.current.scrollTop || 0;

    // Calculate position relative to the SVG viewBox
    const svgPoint = svgRef.current.createSVGPoint();
    svgPoint.x = pos.x;
    svgPoint.y = pos.y;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return null;

    const screenPoint = svgPoint.matrixTransform(ctm);

    // Position relative to container, accounting for scroll
    const left = screenPoint.x - containerRect.left + scrollLeft + 15;
    const top = screenPoint.y - containerRect.top + scrollTop + 15;

    return { left, top };
  };

  const tooltipPos = getTooltipPosition();

  return (
    <div ref={containerRef} className="graph-svg-container scrollable">
      <svg
        ref={svgRef}
        className="graph-svg"
        width={viewBoxWidth}
        height={viewBoxHeight}
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="none"
        style={{
          display: "block",
        }}
      >
        {edgeElements}
        {nodeElements}
      </svg>
      {hoveredNode &&
        tooltipPos &&
        (() => {
          const node = nodes.find((n) => n.id === hoveredNode);
          if (!node) return null;
          const date = new Date(node.time * 1000).toLocaleDateString();
          return (
            <div
              className="commit-tooltip"
              style={{
                position: "absolute",
                left: `${tooltipPos.left}px`,
                top: `${tooltipPos.top}px`,
              }}
            >
              <div className="tooltip-header">
                <code className="tooltip-hash">{node.id.substring(0, 8)}</code>
                {node.parents.length > 1 && (
                  <span className="tooltip-merge">Merge</span>
                )}
              </div>
              <div className="tooltip-message">
                {node.summary || node.message.split("\n")[0]}
              </div>
              <div className="tooltip-meta">
                <span>{node.author}</span>
                <span>{date}</span>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
