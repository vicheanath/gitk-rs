import { CommitNode, GraphEdge } from "../../types/git";

export interface Commit {
  hash: string;
  parents: string[];
  date: string;
  message?: string;
}

export interface LayoutCommit {
  hash: string;
  row: number;
  column: number;
  parents: string[];
  parentColumns: number[];
}

export interface NodePosition {
  x: number;
  y: number;
  lane: number; // Horizontal lane (branch) position
  row: number; // Vertical row (time) position
}

export interface GraphLayout {
  positions: Map<string, NodePosition>;
  sortedNodes: CommitNode[]; // Sorted nodes in the same order as graph rows
  layoutCommits: LayoutCommit[];
  width: number;
  height: number;
}

const ROW_HEIGHT = 40;
const COLUMN_WIDTH = 24;
const GRAPH_LEFT_PADDING = 8;
const GRAPH_RIGHT_PADDING = 8;

interface InternalCommit {
  hash: string;
  parents: string[];
  time: number;
  node?: CommitNode;
}

class MaxHeap<T> {
  private data: T[] = [];
  private readonly compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  get size(): number {
    return this.data.length;
  }

  push(value: T) {
    this.data.push(value);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  private bubbleUp(index: number) {
    let i = index;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.compare(this.data[i], this.data[parent]) <= 0) break;
      [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
      i = parent;
    }
  }

  private bubbleDown(index: number) {
    let i = index;
    const n = this.data.length;
    while (true) {
      const left = 2 * i + 1;
      const right = left + 1;
      let best = i;

      if (left < n && this.compare(this.data[left], this.data[best]) > 0) {
        best = left;
      }
      if (right < n && this.compare(this.data[right], this.data[best]) > 0) {
        best = right;
      }
      if (best === i) break;

      [this.data[i], this.data[best]] = [this.data[best], this.data[i]];
      i = best;
    }
  }
}

/**
 * Topological sort with git-log-like tie breaking.
 *
 * Guarantees child-before-parent ordering and prefers continuing through
 * the first parent when possible, while otherwise selecting the newest
 * available tip to keep the output close to `git log --graph --oneline`.
 */
function topoSort(commits: InternalCommit[], nodeSet: Set<string>): InternalCommit[] {
  const commitByHash = new Map<string, InternalCommit>(commits.map((c) => [c.hash, c]));
  const childCount = new Map<string, number>();
  const inputOrder = new Map<string, number>(commits.map((c, i) => [c.hash, i]));

  for (const commit of commits) {
    if (!childCount.has(commit.hash)) childCount.set(commit.hash, 0);
    for (const pid of commit.parents) {
      if (!nodeSet.has(pid)) continue;
      childCount.set(pid, (childCount.get(pid) ?? 0) + 1);
    }
  }

  const ready = new MaxHeap<string>((a, b) => {
    const ca = commitByHash.get(a)!;
    const cb = commitByHash.get(b)!;
    if (ca.time !== cb.time) return ca.time - cb.time;
    return (inputOrder.get(b) ?? 0) - (inputOrder.get(a) ?? 0);
  });

  commits.forEach((c) => {
    if ((childCount.get(c.hash) ?? 0) === 0) {
      ready.push(c.hash);
    }
  });

  const result: InternalCommit[] = [];
  const emitted = new Set<string>();

  while (ready.size > 0) {
    const nextHash = ready.pop()!;
    if (emitted.has(nextHash)) continue;

    const commit = commitByHash.get(nextHash);
    if (!commit) continue;

    emitted.add(nextHash);
    result.push(commit);

    for (const pid of commit.parents) {
      if (!nodeSet.has(pid)) continue;

      const nextCount = (childCount.get(pid) ?? 1) - 1;
      childCount.set(pid, nextCount);
      if (nextCount === 0) {
        ready.push(pid);
      }
    }
  }

  if (result.length < commits.length) {
    const leftovers = commits
      .filter((c) => !emitted.has(c.hash))
      .sort((a, b) => {
        if (a.time !== b.time) return b.time - a.time;
        return (inputOrder.get(a.hash) ?? 0) - (inputOrder.get(b.hash) ?? 0);
      });
    result.push(...leftovers);
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
function layoutInternal(sortedCommits: InternalCommit[]): LayoutCommit[] {
  const allHashes = new Set(sortedCommits.map((c) => c.hash));
  const remaining = new Set(allHashes);
  let activeColumns: (string | null)[] = [];

  const rebuildColumnIndex = (columns: (string | null)[]) => {
    const map = new Map<string, number>();
    for (let i = 0; i < columns.length; i++) {
      const hash = columns[i];
      if (hash && !map.has(hash)) map.set(hash, i);
    }
    return map;
  };

  const layout: LayoutCommit[] = [];

  for (let row = 0; row < sortedCommits.length; row++) {
    const commit = sortedCommits[row];
    remaining.delete(commit.hash);

    let columnIndexByHash = rebuildColumnIndex(activeColumns);
    let column = columnIndexByHash.get(commit.hash);

    // STEP 1: Find existing column for this commit or create a new active column.
    if (column === undefined) {
      column = activeColumns.length;
      activeColumns.push(commit.hash);
      columnIndexByHash.set(commit.hash, column);
    }

    const parents = commit.parents.filter((p) => allHashes.has(p));

    // STEP 3: Update active columns according to parent relationship rules.
    if (parents.length === 0) {
      activeColumns[column] = null;
    } else {
      const firstParent = parents[0];
      const firstParentCol = columnIndexByHash.get(firstParent);

      if (firstParentCol !== undefined && firstParentCol !== column) {
        activeColumns[column] = null;
      } else {
        activeColumns[column] = firstParent;
      }

      let insertOffset = 1;
      for (let i = 1; i < parents.length; i++) {
        const parent = parents[i];
        columnIndexByHash = rebuildColumnIndex(activeColumns);
        if (columnIndexByHash.has(parent)) continue;

        const insertAt = Math.min(column + insertOffset, activeColumns.length);
        activeColumns.splice(insertAt, 0, parent);
        insertOffset += 1;
      }
    }

    // STEP 4: Remove dead branch columns that will not appear later.
    for (let i = 0; i < activeColumns.length; i++) {
      const hash = activeColumns[i];
      if (hash && !remaining.has(hash)) {
        activeColumns[i] = null;
      }
    }

    // Compact interior and trailing holes so columns are aggressively reused.
    activeColumns = activeColumns.filter((value) => value !== null);

    layout.push({
      hash: commit.hash,
      row,
      column,
      parents,
      parentColumns: [],
    });
  }

  const rowByHash = new Map(layout.map((l) => [l.hash, l]));
  for (const entry of layout) {
    entry.parentColumns = entry.parents.map((parentHash) => {
      const parent = rowByHash.get(parentHash);
      return parent ? parent.column : -1;
    });
  }

  return layout;
}

/**
 * Public layout API for graph rendering.
 *
 * Commits are first topologically ordered with date-priority tie-breaking,
 * then assigned active columns with merge-aware collapse/reuse.
 */
export function layoutCommits(commits: Commit[]): LayoutCommit[] {
  const internal: InternalCommit[] = commits.map((c, index) => ({
    hash: c.hash,
    parents: [...c.parents],
    time: Number.isNaN(Date.parse(c.date)) ? -index : Date.parse(c.date),
  }));

  const nodeSet = new Set(internal.map((c) => c.hash));
  const sorted = topoSort(internal, nodeSet);
  return layoutInternal(sorted);
}

export function computeGitKLayout(
  nodes: CommitNode[],
  _edges: GraphEdge[],
  maxCommits: number = 1000
): GraphLayout {
  if (nodes.length === 0) {
    return { positions: new Map(), sortedNodes: [], layoutCommits: [], width: 0, height: 0 };
  }

  const hasGraphHints = nodes.every(
    (node) => node.graph_row !== undefined && node.graph_col !== undefined
  );

  if (hasGraphHints) {
    const sortedByGraphRow = [...nodes].sort((a, b) => {
      const rowDiff = (a.graph_row ?? 0) - (b.graph_row ?? 0);
      if (rowDiff !== 0) return rowDiff;
      return b.time - a.time;
    });
    const limitedNodes = sortedByGraphRow.slice(0, maxCommits);
    const limitedNodeIds = new Set(limitedNodes.map((node) => node.id));
    const layoutCommits = limitedNodes.map((node, row) => ({
      hash: node.id,
      row,
      column: node.graph_col ?? 0,
      parents: node.parents.filter((parent) => limitedNodeIds.has(parent)),
      parentColumns: [] as number[],
    }));

    const layoutByHash = new Map(layoutCommits.map((entry) => [entry.hash, entry]));
    for (const entry of layoutCommits) {
      entry.parentColumns = entry.parents.map((parentHash) => {
        const parent = layoutByHash.get(parentHash);
        return parent ? parent.column : -1;
      });
    }

    const positions = new Map<string, NodePosition>();
    let maxLane = 0;
    for (const entry of layoutCommits) {
      maxLane = Math.max(maxLane, entry.column);
      positions.set(entry.hash, {
        x: GRAPH_LEFT_PADDING + entry.column * COLUMN_WIDTH,
        y: entry.row * ROW_HEIGHT + ROW_HEIGHT / 2,
        lane: entry.column,
        row: entry.row,
      });
    }

    const width =
      layoutCommits.length === 0
        ? 0
        : GRAPH_LEFT_PADDING + (maxLane + 1) * COLUMN_WIDTH + GRAPH_RIGHT_PADDING;

    return {
      positions,
      sortedNodes: limitedNodes,
      layoutCommits,
      width,
      height: limitedNodes.length * ROW_HEIGHT,
    };
  }

  const internal: InternalCommit[] = nodes
    .map((node, index) => ({
      hash: node.id,
      parents: node.parents,
      time: node.time,
      node,
      // Keep consistent fallback ordering for equal timestamps.
      _index: index,
    }))
    // Stable order for tie-breaking before topological sorting.
    .sort((a, b) => b.time - a.time)
    .map(({ hash, parents, time, node }) => ({ hash, parents, time, node }));

  const nodeSet = new Set(internal.map((c) => c.hash));
  const topo = topoSort(internal, nodeSet);
  const limited = topo.slice(0, maxCommits);
  const sortedNodes = limited.map((c) => c.node!).filter((n): n is CommitNode => Boolean(n));
  const layoutCommits = layoutInternal(limited);

  // 4. Convert lanes to pixel positions
  const positions = new Map<string, NodePosition>();
  let maxLane = 0;

  layoutCommits.forEach((entry) => {
    maxLane = Math.max(maxLane, entry.column);
    positions.set(entry.hash, {
      x: GRAPH_LEFT_PADDING + entry.column * COLUMN_WIDTH,
      y: entry.row * ROW_HEIGHT + ROW_HEIGHT / 2,
      lane: entry.column,
      row: entry.row,
    });
  });

  return {
    positions,
    sortedNodes,
    layoutCommits,
    width: GRAPH_LEFT_PADDING + (maxLane + 1) * COLUMN_WIDTH + GRAPH_RIGHT_PADDING,
    height: sortedNodes.length * ROW_HEIGHT,
  };
}
