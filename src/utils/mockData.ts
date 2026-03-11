import { CommitNode, GraphEdge } from "../types/git";

/**
 * Generate mock commit graph data for web debugging
 * This creates a realistic Git history with:
 * - Multiple branches (main, feature, develop, hotfix)
 * - Divergences (branches splitting)
 * - Merges (branches coming together)
 * - Enough commits to visualize the graph clearly
 */
export function generateMockData(): {
  nodes: CommitNode[];
  edges: GraphEdge[];
} {
  const now = Math.floor(Date.now() / 1000);
  const dayInSeconds = 24 * 60 * 60;

  // Create commits with realistic structure
  // Timeline: newest first (like Git)
  const commits: CommitNode[] = [
    // Main branch - most recent
    {
      id: "a1b2c3d4e5f6",
      parents: ["b2c3d4e5f6a7"],
      author: "Alice Developer",
      email: "alice@example.com",
      message: "Merge feature/new-ui into main\n\nAdd new UI components and improve styling",
      time: now - dayInSeconds * 0,
      summary: "Merge feature/new-ui into main",
    },
    {
      id: "b2c3d4e5f6a7",
      parents: ["c3d4e5f6a7b8"],
      author: "Bob Maintainer",
      email: "bob@example.com",
      message: "Update dependencies",
      time: now - dayInSeconds * 1,
      summary: "Update dependencies",
    },
    {
      id: "c3d4e5f6a7b8",
      parents: ["d4e5f6a7b8c9", "e5f6a7b8c9d0"], // Merge commit
      author: "Alice Developer",
      email: "alice@example.com",
      message: "Merge branch 'develop' into main",
      time: now - dayInSeconds * 2,
      summary: "Merge branch 'develop' into main",
    },
    {
      id: "d4e5f6a7b8c9",
      parents: ["f6a7b8c9d0e1"],
      author: "Charlie Contributor",
      email: "charlie@example.com",
      message: "Fix critical bug in authentication",
      time: now - dayInSeconds * 3,
      summary: "Fix critical bug in authentication",
    },
    {
      id: "e5f6a7b8c9d0",
      parents: ["f6a7b8c9d0e1"], // Divergence point
      author: "David Designer",
      email: "david@example.com",
      message: "Add new feature: dark mode",
      time: now - dayInSeconds * 3,
      summary: "Add new feature: dark mode",
    },
    {
      id: "f6a7b8c9d0e1",
      parents: ["g7a8b9c0d1e2"],
      author: "Eve Engineer",
      email: "eve@example.com",
      message: "Refactor API layer",
      time: now - dayInSeconds * 4,
      summary: "Refactor API layer",
    },
    {
      id: "g7a8b9c0d1e2",
      parents: ["h8b9c0d1e2f3"],
      author: "Frank Frontend",
      email: "frank@example.com",
      message: "Improve performance",
      time: now - dayInSeconds * 5,
      summary: "Improve performance",
    },
    {
      id: "h8b9c0d1e2f3",
      parents: ["i9c0d1e2f3g4", "j0d1e2f3g4h5"], // Another merge
      author: "Grace Git",
      email: "grace@example.com",
      message: "Merge hotfix/security-patch",
      time: now - dayInSeconds * 6,
      summary: "Merge hotfix/security-patch",
    },
    {
      id: "i9c0d1e2f3g4",
      parents: ["k1e2f3g4h5i6"],
      author: "Henry Hacker",
      email: "henry@example.com",
      message: "Add new API endpoint",
      time: now - dayInSeconds * 7,
      summary: "Add new API endpoint",
    },
    {
      id: "j0d1e2f3g4h5",
      parents: ["k1e2f3g4h5i6"], // Divergence point
      author: "Ivy Infosec",
      email: "ivy@example.com",
      message: "Fix security vulnerability",
      time: now - dayInSeconds * 7,
      summary: "Fix security vulnerability",
    },
    {
      id: "k1e2f3g4h5i6",
      parents: ["l2f3g4h5i6j7"],
      author: "Jack Junior",
      email: "jack@example.com",
      message: "Update documentation",
      time: now - dayInSeconds * 8,
      summary: "Update documentation",
    },
    {
      id: "l2f3g4h5i6j7",
      parents: ["m3g4h5i6j7k8"],
      author: "Karen Keeper",
      email: "karen@example.com",
      message: "Add unit tests",
      time: now - dayInSeconds * 9,
      summary: "Add unit tests",
    },
    {
      id: "m3g4h5i6j7k8",
      parents: ["n4h5i6j7k8l9"],
      author: "Larry Lead",
      email: "larry@example.com",
      message: "Initial project setup",
      time: now - dayInSeconds * 10,
      summary: "Initial project setup",
    },
    {
      id: "n4h5i6j7k8l9",
      parents: ["o5i6j7k8l9m0"], // Another branch point
      author: "Mia Manager",
      email: "mia@example.com",
      message: "Setup CI/CD pipeline",
      time: now - dayInSeconds * 11,
      summary: "Setup CI/CD pipeline",
    },
    {
      id: "o5i6j7k8l9m0",
      parents: ["p6j7k8l9m0n1"],
      author: "Noah Newbie",
      email: "noah@example.com",
      message: "Add README",
      time: now - dayInSeconds * 12,
      summary: "Add README",
    },
    {
      id: "p6j7k8l9m0n1",
      parents: ["q7k8l9m0n1o2"],
      author: "Olivia Owner",
      email: "olivia@example.com",
      message: "Initial commit",
      time: now - dayInSeconds * 13,
      summary: "Initial commit",
    },
    {
      id: "q7k8l9m0n1o2",
      parents: [], // Root commit
      author: "Olivia Owner",
      email: "olivia@example.com",
      message: "Project initialization",
      time: now - dayInSeconds * 14,
      summary: "Project initialization",
    },
  ];

  // Create edges (parent -> child relationships)
  // Note: edges go from parent to child (from older to newer)
  const edges: GraphEdge[] = [
    // Main branch line
    { from: "q7k8l9m0n1o2", to: "p6j7k8l9m0n1" },
    { from: "p6j7k8l9m0n1", to: "o5i6j7k8l9m0" },
    { from: "o5i6j7k8l9m0", to: "n4h5i6j7k8l9" },
    { from: "n4h5i6j7k8l9", to: "m3g4h5i6j7k8" },
    { from: "m3g4h5i6j7k8", to: "l2f3g4h5i6j7" },
    { from: "l2f3g4h5i6j7", to: "k1e2f3g4h5i6" },
    { from: "k1e2f3g4h5i6", to: "i9c0d1e2f3g4" },
    { from: "k1e2f3g4h5i6", to: "j0d1e2f3g4h5" }, // Divergence
    { from: "i9c0d1e2f3g4", to: "h8b9c0d1e2f3" }, // Merge point
    { from: "j0d1e2f3g4h5", to: "h8b9c0d1e2f3" }, // Merge point
    { from: "h8b9c0d1e2f3", to: "g7a8b9c0d1e2" },
    { from: "g7a8b9c0d1e2", to: "f6a7b8c9d0e1" },
    { from: "f6a7b8c9d0e1", to: "d4e5f6a7b8c9" }, // Main continues
    { from: "f6a7b8c9d0e1", to: "e5f6a7b8c9d0" }, // Divergence to develop
    { from: "d4e5f6a7b8c9", to: "c3d4e5f6a7b8" }, // Merge point
    { from: "e5f6a7b8c9d0", to: "c3d4e5f6a7b8" }, // Merge point
    { from: "c3d4e5f6a7b8", to: "b2c3d4e5f6a7" },
    { from: "b2c3d4e5f6a7", to: "a1b2c3d4e5f6" },
  ];

  return { nodes: commits, edges };
}

/**
 * Mock branch data matching the commit graph
 */
export function getMockBranches(): Array<{ name: string; commit_id: string }> {
  return [
    { name: "main", commit_id: "a1b2c3d4e5f6" },
    { name: "develop", commit_id: "e5f6a7b8c9d0" },
    { name: "feature/new-ui", commit_id: "a1b2c3d4e5f6" },
    { name: "hotfix/security-patch", commit_id: "j0d1e2f3g4h5" },
  ];
}

