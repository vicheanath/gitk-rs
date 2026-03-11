import { CommitNode, GraphEdge } from "../../types/git";

export interface NodePosition {
  x: number;
  y: number;
  lane: number; // Horizontal lane (branch) position
  row: number; // Vertical row (time) position
}

export interface GraphLayout {
  positions: Map<string, NodePosition>;
  sortedNodes: CommitNode[]; // Sorted nodes in the same order as graph rows
  width: number;
  height: number;
}

const ROW_HEIGHT = 24; // Height of each commit row (matches table row height)
const LANE_WIDTH = 18; // Width between branch lanes (GitK style - compact)
const GRAPH_LEFT_PADDING = 8;
const GRAPH_RIGHT_PADDING = 8;

/**
 * GitK-style layout algorithm
 * - Commits are arranged vertically in chronological order (newest first)
 * - Each commit gets one row
 * - Branches are positioned horizontally in lanes
 * - Similar to GitK's simple, clean layout
 */
export function computeGitKLayout(
  nodes: CommitNode[],
  edges: GraphEdge[],
  maxCommits: number = 1000
): GraphLayout {
  if (nodes.length === 0) {
    return {
      positions: new Map(),
      sortedNodes: [],
      width: 0,
      height: 0,
    };
  }

  // Limit nodes for performance
  const limitedNodes = nodes.slice(0, maxCommits);

  // Sort commits by time (newest first for display, but we'll process oldest first for lane assignment)
  const sortedNodes = [...limitedNodes].sort((a, b) => b.time - a.time);

  // Build node map and parent/child relationships
  const nodeMap = new Map<string, CommitNode>();
  sortedNodes.forEach((node) => nodeMap.set(node.id, node));

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

  // Assign lanes (horizontal positions) to minimize crossings
  const laneAssignment = assignLanes(sortedNodes, parents, children);

  // Calculate positions
  const positions = new Map<string, NodePosition>();
  let maxLane = 0;

  sortedNodes.forEach((node, rowIndex) => {
    const lane = laneAssignment.get(node.id) || 0;
    maxLane = Math.max(maxLane, lane);

    positions.set(node.id, {
      x: GRAPH_LEFT_PADDING + lane * LANE_WIDTH,
      y: rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2, // Center in row
      lane,
      row: rowIndex,
    });
  });

  return {
    positions,
    sortedNodes, // Return sorted nodes for use in commit list
    width:
      GRAPH_LEFT_PADDING + (maxLane + 1) * LANE_WIDTH + GRAPH_RIGHT_PADDING,
    height: sortedNodes.length * ROW_HEIGHT,
  };
}

/**
 * Assign horizontal lanes to commits based on branch structure (GitK style)
 * REFACTORED: More aggressive lane assignment to create many lanes for branch paths
 * - Each branch path gets its own lane
 * - When branches diverge, ALL children get distinct lanes (not just non-first)
 * - When branches merge, keep both parent lanes visible up to merge point
 * - Track active branch paths to ensure continuity
 */
function assignLanes(
  sortedNodes: CommitNode[],
  parents: Map<string, string[]>,
  children: Map<string, string[]>
): Map<string, number> {
  const laneMap = new Map<string, number>();

  // Track which lanes are occupied at each row
  const rowLanes = new Map<number, Set<number>>();

  // Track next available lane
  let nextLane = 0;

  // Track divergence points - when a commit has multiple children, assign different lanes
  // Maps: commitId -> childId -> lane
  const divergenceLanes = new Map<string, Map<string, number>>();

  // Track active branch paths - each unique path gets its own lane
  // Maps: commitId -> pathId (unique identifier for the branch path)
  const commitToPath = new Map<string, string>();

  // Track path to lane mapping - each path gets a consistent lane
  const pathToLane = new Map<string, number>();

  // Process commits from OLDEST to NEWEST (reverse order)
  // This is critical: we need to process parents before children to correctly assign lanes
  // When we encounter a divergence, the children haven't been processed yet, so we can assign them lanes
  const reversedNodes = [...sortedNodes].reverse();
  for (const node of reversedNodes) {
    const row = sortedNodes.indexOf(node); // Use original index for row position
    const nodeParents = parents.get(node.id) || [];
    const nodeChildren = children.get(node.id) || [];

    let assignedLane = 0;
    let pathId: string | undefined;

    if (nodeParents.length === 0) {
      // Root commit - use lane 0, create new path
      assignedLane = 0;
      pathId = node.id; // Root commit starts its own path
      commitToPath.set(node.id, pathId);
      if (!pathToLane.has(pathId)) {
        pathToLane.set(pathId, assignedLane);
      }
    } else if (nodeParents.length === 1) {
      // Single parent - check if we have a divergence lane assigned
      const parentId = nodeParents[0];
      const divergenceMap = divergenceLanes.get(parentId);

      if (divergenceMap && divergenceMap.has(node.id)) {
        // This child was assigned a specific lane at divergence point
        assignedLane = divergenceMap.get(node.id)!;
        pathId = node.id; // New branch path starts here
        commitToPath.set(node.id, pathId);
        if (!pathToLane.has(pathId)) {
          pathToLane.set(pathId, assignedLane);
        }
      } else {
        // Normal commit - continue parent's path
        const parentLane = laneMap.get(parentId);
        const parentPath = commitToPath.get(parentId);

        if (parentLane !== undefined) {
          assignedLane = parentLane;
          // Inherit path from parent
          if (parentPath) {
            pathId = parentPath;
            commitToPath.set(node.id, pathId);
          } else {
            // Create new path if parent doesn't have one
            pathId = node.id;
            commitToPath.set(node.id, pathId);
            if (!pathToLane.has(pathId)) {
              pathToLane.set(pathId, assignedLane);
            }
          }
        } else {
          assignedLane = 0;
          pathId = node.id;
          commitToPath.set(node.id, pathId);
        }
      }
    } else {
      // Merge commit - use first parent's lane, but keep other parents' lanes visible
      const firstParent = nodeParents[0];
      const parentLane = laneMap.get(firstParent);
      const parentPath = commitToPath.get(firstParent);

      if (parentLane !== undefined) {
        assignedLane = parentLane;
        // Inherit path from first parent
        if (parentPath) {
          pathId = parentPath;
          commitToPath.set(node.id, pathId);
        } else {
          pathId = node.id;
          commitToPath.set(node.id, pathId);
        }
      } else {
        assignedLane = 0;
        pathId = node.id;
        commitToPath.set(node.id, pathId);
      }

      // Keep other parent lanes visible up to this merge point
      for (let i = 1; i < nodeParents.length; i++) {
        const otherParentId = nodeParents[i];
        const otherParentLane = laneMap.get(otherParentId);
        if (otherParentLane !== undefined && otherParentLane !== assignedLane) {
          // Mark this lane as occupied at this row to keep it visible
          if (!rowLanes.has(row)) {
            rowLanes.set(row, new Set());
          }
          rowLanes.get(row)!.add(otherParentLane);
        }
      }
    }

    // Handle divergence: if this commit has multiple children, assign different lanes
    // REFACTORED: Be more aggressive - ensure ALL children get distinct lanes when possible
    // Since we're processing oldest to newest, children haven't been processed yet, so we can assign lanes now
    if (nodeChildren.length > 1) {
      const divergenceMap = new Map<string, number>();

      // First child continues the current path (same lane) - this is the "main" branch
      const firstChild = nodeChildren[0];
      divergenceMap.set(firstChild, assignedLane);
      if (pathId) {
        commitToPath.set(firstChild, pathId);
      }

      // ALL other children get NEW lanes (new branch paths)
      // These are diverged branches that split off
      for (let i = 1; i < nodeChildren.length; i++) {
        const childId = nodeChildren[i];
        // Find a free lane for this child (prefer right side for visual clarity)
        // Use the child's future row (which will be earlier in sortedNodes since it's newer)
        const childRow = sortedNodes.findIndex((n) => n.id === childId);
        const childLane = findFreeLaneForChild(
          assignedLane,
          childRow >= 0 ? childRow : row, // Use child's row if found, else parent's row
          rowLanes,
          nextLane
        );
        divergenceMap.set(childId, childLane);

        // Each diverged child gets its own unique path
        const childPathId = childId; // Unique path for each diverged branch
        commitToPath.set(childId, childPathId);
        if (!pathToLane.has(childPathId)) {
          pathToLane.set(childPathId, childLane);
        }

        nextLane = Math.max(nextLane, childLane + 1);
      }

      divergenceLanes.set(node.id, divergenceMap);
      console.log(
        `[Layout] Divergence at ${node.id.substring(0, 8)}: assigned lanes`,
        Array.from(divergenceMap.entries()).map(
          ([id, lane]) => `${id.substring(0, 8)}->lane${lane}`
        )
      );
    } else if (nodeChildren.length === 1) {
      // Single child - pass on current path
      const childId = nodeChildren[0];
      if (pathId) {
        commitToPath.set(childId, pathId);
      }
    }

    // Check if lane is free at this row
    const rowOccupied = rowLanes.get(row);
    if (rowOccupied && rowOccupied.has(assignedLane)) {
      // Lane conflict - find nearest free lane
      assignedLane = findNearestFreeLane(assignedLane, row, rowLanes);
      nextLane = Math.max(nextLane, assignedLane + 1);

      // Update path to lane mapping if needed
      if (pathId && pathToLane.has(pathId)) {
        pathToLane.set(pathId, assignedLane);
      }
    }

    laneMap.set(node.id, assignedLane);

    // Mark this lane as occupied at this row
    if (!rowLanes.has(row)) {
      rowLanes.set(row, new Set());
    }
    rowLanes.get(row)!.add(assignedLane);
  }

  // Debug: Log lane distribution
  const laneCounts = new Map<number, number>();
  laneMap.forEach((lane) => {
    laneCounts.set(lane, (laneCounts.get(lane) || 0) + 1);
  });
  console.log(`[Layout] Lane assignment complete:`, {
    totalLanes: Array.from(laneCounts.keys()).length,
    laneDistribution: Object.fromEntries(laneCounts),
    maxLane: Math.max(...Array.from(laneCounts.keys()), 0),
  });

  return laneMap;
}

/**
 * Find a free lane for a child commit at a divergence point
 */
function findFreeLaneForChild(
  parentLane: number,
  parentRow: number,
  rowLanes: Map<number, Set<number>>,
  nextAvailableLane: number
): number {
  // Try lanes near the parent first, then use next available
  const occupied = rowLanes.get(parentRow) || new Set();

  // Try lanes to the right of parent
  for (let offset = 1; offset < 20; offset++) {
    const lane = parentLane + offset;
    if (!occupied.has(lane)) {
      return lane;
    }
  }

  // Use next available lane
  return nextAvailableLane;
}

/**
 * Find the nearest free lane to the preferred lane at a given row
 */
function findNearestFreeLane(
  preferredLane: number,
  row: number,
  rowLanes: Map<number, Set<number>>
): number {
  const occupied = rowLanes.get(row) || new Set();

  // Try preferred lane first
  if (!occupied.has(preferredLane)) {
    return preferredLane;
  }

  // Search outward from preferred lane
  for (let offset = 1; offset < 100; offset++) {
    // Try left
    const leftLane = preferredLane - offset;
    if (leftLane >= 0 && !occupied.has(leftLane)) {
      return leftLane;
    }

    // Try right
    const rightLane = preferredLane + offset;
    if (!occupied.has(rightLane)) {
      return rightLane;
    }
  }

  // Fallback: find any free lane
  let lane = 0;
  while (occupied.has(lane)) {
    lane++;
  }
  return lane;
}
