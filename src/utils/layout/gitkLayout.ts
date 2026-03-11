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
 * TOPOLOGICAL SORT ALGORITHM
 *
 * Produces a display-order list of commits matching `git log --graph`:
 *   - Topological order: every child appears before its parents
 *   - First-parent preference: main line stays on the left
 *
 * Algorithm (Kahn's algorithm with first-parent priority):
 * 1. Count in-degree for each commit (how many children it has)
 * 2. Seed queue with commits that have no children (branch tips, HEAD)
 * 3. While queue is not empty:
 *    - Pop a commit and add to result
 *    - For each parent, decrement in-degree
 *    - If first-parent reaches zero in-degree, push to front of queue (keeps main line contiguous)
 *    - Otherwise push to back of queue (other parents processed after)
 *
 * This ensures the first-parent chain (main branch) stays on the left.
 */
function topoSort(nodes: CommitNode[], nodeSet: Set<string>): CommitNode[] {
  const inDegree = new Map<string, number>();
  const nodeById = new Map<string, CommitNode>(nodes.map((n) => [n.id, n]));

  // Count in-degree for each commit
  for (const node of nodes) {
    if (!inDegree.has(node.id)) inDegree.set(node.id, 0);
    for (const pid of node.parents) {
      if (!nodeSet.has(pid)) continue;
      inDegree.set(pid, (inDegree.get(pid) ?? 0) + 1);
    }
  }

  // Seed queue with tips (commits with no children)
  const queue: CommitNode[] = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0);
  const result: CommitNode[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    // Process parents in order to maintain first-parent preference
    for (const pid of node.parents) {
      if (!nodeSet.has(pid)) continue;
      const deg = (inDegree.get(pid) ?? 1) - 1;
      inDegree.set(pid, deg);
      if (deg === 0) {
        const parent = nodeById.get(pid)!;
        // First parent goes to front (keeps main line contiguous)
        // Other parents go to back (processed later)
        if (node.parents[0] === pid) {
          queue.unshift(parent);
        } else {
          queue.push(parent);
        }
      }
    }
  }

  // Add any disconnected commits (shouldn't happen in normal git history)
  if (result.length < nodes.length) {
    const seen = new Set(result.map((n) => n.id));
    for (const node of nodes) {
      if (!seen.has(node.id)) result.push(node);
    }
  }

  return result;
}

/**
 * GITHUB-STYLE GRAPH COLUMN ASSIGNMENT ALGORITHM
 *
 * This implements the exact algorithm used by git log --graph:
 *
 * Maintain an array of "active columns" where:
 *   active[i] = commit ID this column is "waiting for" next, or null if free
 *
 * For each commit in topological order:
 *
 *   STEP 1: Find column for this commit
 *     - Check if commit is in active[] (another commit pointed to it as parent)
 *     - If yes: use that column (commit becomes visible on that column)
 *     - If no: create new column at tip (new branch or HEAD)
 *
 *   STEP 2: Update active[] for this commit's children
 *     - Set active[column] to first parent (main line stays in same column)
 *     - For each additional parent: create new column if not already tracked
 *     - If first parent already tracked elsewhere: free this column (converging branches)
 *
 *   STEP 3: Compact
 *     - Remove trailing empty slots from active[]
 *
 * EXAMPLE TRACE:
 *
 *   Commits (topological):  [D(C,F), C(B), F(E), E(B), B(A), A]
 *
 *   Row 0, Commit D (parents: C, F)
 *     active = []
 *     → no column found, create new: col=0, active=[D]
 *     → D has 2 parents: first=C, second=F
 *     → set active[0]=C (main), add F to new column
 *     → active=[C, F]
 *
 *   Row 1, Commit C (parents: B)
 *     active = [C, F]
 *     → found C at col=0
 *     → C has 1 parent: B
 *     → set active[0]=B
 *     → active=[B, F]
 *
 *   Row 2, Commit F (parents: E)
 *     active = [B, F]
 *     → found F at col=1
 *     → F has 1 parent: E
 *     → set active[1]=E
 *     → active=[B, E]
 *
 *   Row 3, Commit E (parents: B)
 *     active = [B, E]
 *     → found E at col=1
 *     → E has 1 parent: B
 *     → B already at col=0, so this merges back → free col=1
 *     → active=[B, null]
 *     → compact: active=[B]
 *
 *   Row 4, Commit B (parents: A)
 *     active = [B]
 *     → found B at col=0
 *     → B has 1 parent: A
 *     → set active[0]=A
 *     → active=[A]
 *
 *   Row 5, Commit A (parents: none)
 *     active = [A]
 *     → found A at col=0
 *     → A is root: free col=0
 *     → active=[null]
 *     → compact: active=[]
 *
 * RESULT LANES:
 *   D=0, C=0, F=1, E=1, B=0, A=0
 */
function assignLanes(sortedNodes: CommitNode[], nodeSet: Set<string>): Map<string, number> {
  const laneMap = new Map<string, number>();
  const active: (string | null)[] = [];

  for (const node of sortedNodes) {
    const nodeParents = node.parents.filter((p) => nodeSet.has(p));

    // ─────────────────────────────────────────────────────────────────
    // STEP 1: FIND OR CREATE COLUMN FOR THIS COMMIT
    // ─────────────────────────────────────────────────────────────────
    let col = active.indexOf(node.id);
    if (col === -1) {
      // Commit not waiting in any column → new branch tip
      // Find first free slot or extend
      const free = active.indexOf(null);
      col = free !== -1 ? free : active.length;
      active[col] = node.id;
    }

    laneMap.set(node.id, col);

    // ─────────────────────────────────────────────────────────────────
    // STEP 2: UPDATE ACTIVE COLUMNS FOR PARENTS
    // ─────────────────────────────────────────────────────────────────
    if (nodeParents.length === 0) {
      // Root commit: free the column
      active[col] = null;
    } else {
      const firstParent = nodeParents[0];

      // Check if first parent is already waiting in another column
      const alreadyTracked = active.findIndex((a, i) => a === firstParent && i !== col);

      if (alreadyTracked !== -1) {
        // First parent already tracked elsewhere (branches converging)
        // Free this column since the merge point has it covered
        active[col] = null;
      } else {
        // First parent not tracked: assign to current column (main line continues)
        active[col] = firstParent;
      }

      // For merge commits: add columns for additional parents
      for (let i = 1; i < nodeParents.length; i++) {
        const parent = nodeParents[i];
        if (active.includes(parent)) continue; // Already tracked elsewhere

        // Find free slot after current column (branches extend to the right)
        const free = active.indexOf(null, col + 1);
        if (free !== -1) {
          active[free] = parent;
        } else {
          active.push(parent);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // STEP 3: COMPACT TRAILING NULLS
    // ─────────────────────────────────────────────────────────────────
    while (active.length > 0 && active[active.length - 1] === null) {
      active.pop();
    }
  }

  return laneMap;
}

export function computeGitKLayout(
  nodes: CommitNode[],
  _edges: GraphEdge[],
  maxCommits: number = 1000
): GraphLayout {
  if (nodes.length === 0) {
    return { positions: new Map(), sortedNodes: [], width: 0, height: 0 };
  }

  // 1. Pre-sort by time (newest first) for stable topological sort
  const limitedNodes = [...nodes]
    .sort((a, b) => b.time - a.time)
    .slice(0, maxCommits);

  const nodeSet = new Set(limitedNodes.map((n) => n.id));

  // 2. Topological sort: children before parents, first-parent preference
  const sortedNodes = topoSort(limitedNodes, nodeSet);

  // 3. Lane assignment using git log --graph algorithm
  const laneAssignment = assignLanes(sortedNodes, nodeSet);

  // 4. Convert lanes to pixel positions
  const positions = new Map<string, NodePosition>();
  let maxLane = 0;

  sortedNodes.forEach((node, rowIndex) => {
    const lane = laneAssignment.get(node.id) ?? 0;
    maxLane = Math.max(maxLane, lane);
    positions.set(node.id, {
      x: GRAPH_LEFT_PADDING + lane * LANE_WIDTH,
      y: rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2,
      lane,
      row: rowIndex,
    });
  });

  return {
    positions,
    sortedNodes,
    width: GRAPH_LEFT_PADDING + (maxLane + 1) * LANE_WIDTH + GRAPH_RIGHT_PADDING,
    height: sortedNodes.length * ROW_HEIGHT,
  };
}
