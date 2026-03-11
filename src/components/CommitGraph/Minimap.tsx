import { useRef } from "react";
import { CommitNode } from "../../types/git";
import { NodePosition } from "../../utils/layout/sugiyama";

interface MinimapProps {
  nodes: CommitNode[];
  positions: Map<string, NodePosition>;
  selectedCommit?: string;
  viewBox: { x: number; y: number; width: number; height: number };
  onViewChange: (x: number, y: number) => void;
}

const MINIMAP_SIZE = 200;

export default function Minimap({
  nodes,
  positions,
  selectedCommit,
  viewBox,
  onViewChange,
}: MinimapProps) {
  const minimapRef = useRef<SVGSVGElement>(null);

  if (positions.size === 0) return null;

  // Calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  positions.forEach((pos) => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x);
    maxY = Math.max(maxY, pos.y);
  });

  const graphWidth = maxX - minX;
  const graphHeight = maxY - minY;
  const scaleX = MINIMAP_SIZE / graphWidth;
  const scaleY = MINIMAP_SIZE / graphHeight;
  const scale = Math.min(scaleX, scaleY);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = minimapRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const svgPoint = svg.createSVGPoint();
    svgPoint.x = e.clientX - rect.left;
    svgPoint.y = e.clientY - rect.top;
    const ctm = svg.getScreenCTM();
    if (ctm) {
      svgPoint.x = (svgPoint.x - ctm.e) / ctm.a;
      svgPoint.y = (svgPoint.y - ctm.f) / ctm.d;
    }

    onViewChange(svgPoint.x, svgPoint.y);
  };

  const viewRect = {
    x: (viewBox.x - minX) * scale,
    y: (viewBox.y - minY) * scale,
    width: viewBox.width * scale,
    height: viewBox.height * scale,
  };

  return (
    <div className="minimap">
      <svg
        ref={minimapRef}
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        viewBox={`${minX} ${minY} ${graphWidth} ${graphHeight}`}
        onClick={handleClick}
        style={{ cursor: "pointer" }}
      >
        {/* Render edges in minimap */}
        {nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          
          // Draw simple lines to parents
          return node.parents.map((parentId) => {
            const parentPos = positions.get(parentId);
            if (!parentPos) return null;
            return (
              <line
                key={`${node.id}-${parentId}`}
                x1={pos.x}
                y1={pos.y}
                x2={parentPos.x}
                y2={parentPos.y}
                stroke="#888"
                strokeWidth={0.5}
                opacity={0.3}
              />
            );
          });
        })}

        {/* Render nodes */}
        {nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;

          const isSelected = node.id === selectedCommit;
          const isMerge = node.parents.length > 1;
          return (
            <circle
              key={node.id}
              cx={pos.x}
              cy={pos.y}
              r={isSelected ? 3 : isMerge ? 2 : 1.5}
              fill={isSelected ? "#fbbf24" : isMerge ? "#ff8000" : "#888"}
              opacity={isSelected ? 1 : 0.7}
              stroke={isSelected ? "#f59e0b" : "none"}
              strokeWidth={isSelected ? 1 : 0}
            />
          );
        })}

        {/* View rectangle */}
        <rect
          x={viewRect.x}
          y={viewRect.y}
          width={viewRect.width}
          height={viewRect.height}
          fill="rgba(59, 130, 246, 0.1)"
          stroke="#3b82f6"
          strokeWidth={2}
          opacity={0.9}
          rx={2}
        />
      </svg>
    </div>
  );
}

