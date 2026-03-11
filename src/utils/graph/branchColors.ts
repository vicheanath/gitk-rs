// Modern git log branch colors — readable on both dark and light backgrounds
export const CLASSIC_GITK_COLORS = [
  "#4f9cf9", // blue
  "#30b155", // green
  "#e67e22", // orange
  "#9b59b6", // purple
  "#e84393", // pink
  "#2ecc71", // emerald
  "#e74c3c", // red
  "#1abc9c", // teal
  "#f39c12", // amber
  "#3498db", // sky blue
];

export interface BranchInfo {
  name: string;
  commit_id: string;
}

/**
 * Hash a string to a number for consistent color assignment
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Assigns consistent colors to branches based on branch names
 * Each branch gets a color that persists across the timeline
 * Traces each branch from its head backwards through the commit history
 */
export function assignBranchColors(
  nodes: Array<{ id: string; parents: string[] }>,
  _edges: Array<{ from: string; to: string }>,
  branches?: BranchInfo[]
): Map<string, string> {
  const nodeToColor = new Map<string, string>();
  const nodeToBranch = new Map<string, string>(); // Track which branch each commit belongs to

  // Build parent map for efficient lookup
  const parents = new Map<string, string[]>();
  const nodeMap = new Map<string, { id: string; parents: string[] }>();

  nodes.forEach((node) => {
    parents.set(node.id, node.parents);
    nodeMap.set(node.id, node);
  });

  // If we have branch information, trace from branch heads
  if (branches && branches.length > 0) {
    // Assign colors to branches based on branch name (consistent hash)
    const branchColorMap = new Map<string, string>();
    branches.forEach((branch) => {
      const colorIndex = hashString(branch.name) % CLASSIC_GITK_COLORS.length;
      branchColorMap.set(branch.name, CLASSIC_GITK_COLORS[colorIndex]);
    });

    // Sort branches: current branch first, then by name for consistency
    const sortedBranches = [...branches].sort((a, b) => {
      // Put current branch first if we can identify it
      return a.name.localeCompare(b.name);
    });

    // Trace each branch from its head backwards through the timeline
    sortedBranches.forEach((branch) => {
      const branchColor = branchColorMap.get(branch.name)!;
      const visited = new Set<string>();
      const queue: string[] = [branch.commit_id];

      // BFS from branch head backwards through parents
      while (queue.length > 0) {
        const commitId = queue.shift()!;
        if (visited.has(commitId) || !nodeMap.has(commitId)) continue;
        visited.add(commitId);

        // Assign color to this commit
        // If already assigned, keep the first one (earlier branches have priority)
        if (!nodeToColor.has(commitId)) {
          nodeToColor.set(commitId, branchColor);
          nodeToBranch.set(commitId, branch.name);
        }

        // Add parents to queue to continue tracing backwards
        const commitParents = parents.get(commitId) || [];
        commitParents.forEach((parentId) => {
          if (!visited.has(parentId) && nodeMap.has(parentId)) {
            queue.push(parentId);
          }
        });
      }
    });
  }

  // For commits not assigned to any branch, inherit from first parent or use default
  nodes.forEach((node) => {
    if (!nodeToColor.has(node.id)) {
      // Try to inherit from first parent (main branch line)
      if (node.parents.length > 0 && nodeToColor.has(node.parents[0])) {
        nodeToColor.set(node.id, nodeToColor.get(node.parents[0])!);
      } else {
        // Root commit or orphan - assign default color
        nodeToColor.set(node.id, CLASSIC_GITK_COLORS[0]);
      }
    }
  });

  return nodeToColor;
}

/**
 * Get color for a specific node
 */
export function getNodeColor(
  nodeId: string,
  colorMap: Map<string, string>
): string {
  return colorMap.get(nodeId) || CLASSIC_GITK_COLORS[0];
}
