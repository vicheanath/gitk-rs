import { CommitNode, GraphEdge } from "../../types/git";

export interface NodePosition {
  x: number;
  y: number;
  layer: number;
  order: number;
}

export interface GraphLayout {
  positions: Map<string, NodePosition>;
  layers: string[][];
  width: number;
  height: number;
}

const NODE_SPACING_X = 80;
const NODE_SPACING_Y = 50;
const LAYER_PADDING = 50;

/**
 * Sugiyama-style layout algorithm for DAGs
 * 1. Layer assignment (topological sort)
 * 2. Crossing minimization (barycenter heuristic)
 * 3. Node positioning
 */
export function computeSugiyamaLayout(
  nodes: CommitNode[],
  edges: GraphEdge[],
  maxCommits: number = 1000
): GraphLayout {
  if (nodes.length === 0) {
    return {
      positions: new Map(),
      layers: [],
      width: 0,
      height: 0,
    };
  }

  // Limit nodes for performance
  const limitedNodes = nodes.slice(0, maxCommits);
  const nodeMap = new Map<string, CommitNode>();
  limitedNodes.forEach((node) => nodeMap.set(node.id, node));

  // Build adjacency lists
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();

  edges.forEach((edge) => {
    if (nodeMap.has(edge.from) && nodeMap.has(edge.to)) {
      if (!children.has(edge.from)) {
        children.set(edge.from, []);
      }
      children.get(edge.from)!.push(edge.to);

      if (!parents.has(edge.to)) {
        parents.set(edge.to, []);
      }
      parents.get(edge.to)!.push(edge.from);
    }
  });

  // Step 1: Layer assignment using topological sort
  const layers = assignLayers(limitedNodes, parents, children);

  // Step 2: Crossing minimization (simplified - order by commit time)
  const orderedLayers = minimizeCrossings(layers, limitedNodes, children, parents);

  // Step 3: Position nodes
  const positions = new Map<string, NodePosition>();
  let maxWidth = 0;

  orderedLayers.forEach((layer, layerIndex) => {
    maxWidth = Math.max(maxWidth, layer.length);
    layer.forEach((nodeId, order) => {
      positions.set(nodeId, {
        x: order * NODE_SPACING_X + LAYER_PADDING,
        y: layerIndex * NODE_SPACING_Y + LAYER_PADDING,
        layer: layerIndex,
        order,
      });
    });
  });

  return {
    positions,
    layers: orderedLayers,
    width: maxWidth * NODE_SPACING_X + LAYER_PADDING * 2,
    height: orderedLayers.length * NODE_SPACING_Y + LAYER_PADDING * 2,
  };
}

/**
 * Assign nodes to layers using topological sort
 */
function assignLayers(
  nodes: CommitNode[],
  parents: Map<string, string[]>,
  children: Map<string, string[]>
): string[][] {
  const inDegree = new Map<string, number>();
  nodes.forEach((node) => {
    const parentCount = (parents.get(node.id) || []).length;
    inDegree.set(node.id, parentCount);
  });

  const layers: string[][] = [];
  const visited = new Set<string>();
  let currentLayer: string[] = [];

  // Find root nodes
  const roots: string[] = [];
  inDegree.forEach((degree, id) => {
    if (degree === 0) {
      roots.push(id);
    }
  });

  if (roots.length === 0 && nodes.length > 0) {
    // No roots found, use first node
    roots.push(nodes[0].id);
  }

  const queue = [...roots];
  let layerSize = queue.length;

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    currentLayer.push(nodeId);

    const nodeChildren = (children.get(nodeId) || []).filter((id) => !visited.has(id));
    nodeChildren.forEach((childId) => {
      const degree = inDegree.get(childId)! - 1;
      inDegree.set(childId, degree);
      if (degree === 0) {
        queue.push(childId);
      }
    });

    layerSize--;
    if (layerSize === 0 && queue.length > 0) {
      layers.push([...currentLayer]);
      currentLayer = [];
      layerSize = queue.length;
    }
  }

  if (currentLayer.length > 0) {
    layers.push(currentLayer);
  }

  return layers;
}

/**
 * Minimize edge crossings by ordering nodes within layers
 * Uses barycenter heuristic: order nodes by average position of their parents
 */
function minimizeCrossings(
  layers: string[][],
  nodes: CommitNode[],
  _children: Map<string, string[]>,
  parents: Map<string, string[]>
): string[][] {
  const nodeMap = new Map<string, CommitNode>();
  nodes.forEach((node) => nodeMap.set(node.id, node));

  // Sort each layer by barycenter (average parent position) or commit time
  return layers.map((layer) => {
    return [...layer].sort((a, b) => {
      const nodeA = nodeMap.get(a);
      const nodeB = nodeMap.get(b);
      
      if (!nodeA || !nodeB) return 0;

      // For nodes with parents, use barycenter
      const parentsA = parents.get(a) || [];
      const parentsB = parents.get(b) || [];

      if (parentsA.length > 0 && parentsB.length > 0) {
        // Calculate average parent position in previous layer
        const layerIndex = layers.findIndex((l) => l.includes(a));
        if (layerIndex > 0) {
          const prevLayer = layers[layerIndex - 1];
          const avgPosA = parentsA.reduce((sum, p) => {
            const pos = prevLayer.indexOf(p);
            return sum + (pos >= 0 ? pos : 0);
          }, 0) / parentsA.length;
          const avgPosB = parentsB.reduce((sum, p) => {
            const pos = prevLayer.indexOf(p);
            return sum + (pos >= 0 ? pos : 0);
          }, 0) / parentsB.length;
          return avgPosA - avgPosB;
        }
      }

      // Fallback to commit time
      return nodeB.time - nodeA.time; // Newer commits first
    });
  });
}


