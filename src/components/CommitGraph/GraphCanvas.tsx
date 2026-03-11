import { useEffect, useRef, useState } from "react";
import { CommitNode, GraphEdge } from "../../types/git";

interface GraphCanvasProps {
  nodes: CommitNode[];
  edges: GraphEdge[];
  selectedCommit?: string;
  onCommitSelect: (commitId: string) => void;
  zoom: number;
  pan: { x: number; y: number };
  onZoom: (delta: number) => void;
  onPan: (dx: number, dy: number) => void;
  searchQuery?: string;
}

const NODE_RADIUS = 8;
const NODE_SPACING_X = 120;
const NODE_SPACING_Y = 60;
const BRANCH_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

export default function GraphCanvas({
  nodes,
  edges,
  selectedCommit,
  onCommitSelect,
  zoom,
  pan,
  onZoom,
  onPan,
  searchQuery = "",
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [layout, setLayout] = useState<Map<string, { x: number; y: number }>>(new Map());

  // Calculate layout using topological sort
  useEffect(() => {
    if (nodes.length === 0) return;

    const nodeMap = new Map<string, CommitNode>();
    nodes.forEach((node) => nodeMap.set(node.id, node));

    // Build adjacency list
    const children = new Map<string, string[]>();
    nodes.forEach((node) => {
      node.parents.forEach((parentId) => {
        if (!children.has(parentId)) {
          children.set(parentId, []);
        }
        children.get(parentId)!.push(node.id);
      });
    });

    // Topological sort (BFS from roots)
    const inDegree = new Map<string, number>();
    nodes.forEach((node) => {
      inDegree.set(node.id, node.parents.length);
    });

    const queue: string[] = [];
    inDegree.forEach((degree, id) => {
      if (degree === 0) queue.push(id);
    });

    const layers: string[][] = [];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const layer: string[] = [];
      const layerSize = queue.length;

      for (let i = 0; i < layerSize; i++) {
        const nodeId = queue.shift()!;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);
        layer.push(nodeId);

        const nodeChildren = children.get(nodeId) || [];
        nodeChildren.forEach((childId) => {
          const degree = inDegree.get(childId)! - 1;
          inDegree.set(childId, degree);
          if (degree === 0 && !visited.has(childId)) {
            queue.push(childId);
          }
        });
      }

      if (layer.length > 0) {
        layers.push(layer);
      }
    }

    // Assign positions
    const positions = new Map<string, { x: number; y: number }>();
    layers.forEach((layer, layerIndex) => {
      layer.forEach((nodeId, indexInLayer) => {
        const x = indexInLayer * NODE_SPACING_X + 100;
        const y = layerIndex * NODE_SPACING_Y + 100;
        positions.set(nodeId, { x, y });
      });
    });

    setLayout(positions);
  }, [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transform
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw edges
    edges.forEach((edge) => {
      const from = layout.get(edge.from);
      const to = layout.get(edge.to);
      if (!from || !to) return;

      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });

    // Draw nodes
    nodes.forEach((node) => {
      const pos = layout.get(node.id);
      if (!pos) return;

      const isSelected = node.id === selectedCommit;
      const isSearchMatch = searchQuery && node.message.toLowerCase().includes(searchQuery.toLowerCase());

      // Node color based on branch (simplified - use first parent branch)
      const branchIndex = node.parents.length > 0 ? 0 : 0;
      const color = BRANCH_COLORS[branchIndex % BRANCH_COLORS.length];

      ctx.fillStyle = isSelected ? "#fbbf24" : isSearchMatch ? "#34d399" : color;
      ctx.strokeStyle = isSelected ? "#f59e0b" : "#1e293b";
      ctx.lineWidth = isSelected ? 3 : 2;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    ctx.restore();
  }, [nodes, edges, layout, selectedCommit, zoom, pan, searchQuery]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      onPan(e.clientX - dragStart.x, e.clientY - dragStart.y);
    } else {
      // Check for node hover/click
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;

      for (const [, pos] of layout.entries()) {
        const dx = x - pos.x;
        const dy = y - pos.y;
        if (dx * dx + dy * dy < NODE_RADIUS * NODE_RADIUS) {
          canvas.style.cursor = "pointer";
          return;
        }
      }
      canvas.style.cursor = "default";
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging) {
      setIsDragging(false);
    } else {
      // Handle click
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;

      for (const [nodeId, pos] of layout.entries()) {
        const dx = x - pos.x;
        const dy = y - pos.y;
        if (dx * dx + dy * dy < NODE_RADIUS * NODE_RADIUS) {
          onCommitSelect(nodeId);
          return;
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    onZoom(delta);
  };

  return (
    <canvas
      ref={canvasRef}
      className="graph-canvas"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setIsDragging(false)}
      onWheel={handleWheel}
      style={{ width: "100%", height: "100%", cursor: isDragging ? "grabbing" : "default" }}
    />
  );
}

