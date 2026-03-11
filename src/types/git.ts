// TypeScript types matching Rust structs

export interface CommitNode {
  id: string;
  parents: string[];
  author: string;
  email: string;
  message: string;
  time: number;
  summary: string;
}

export interface Branch {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  commit_id: string;
}

export interface Tag {
  name: string;
  commit_id: string;
  message?: string;
}

export interface CommitDetails {
  id: string;
  parents: string[];
  author: string;
  email: string;
  committer: string;
  committer_email: string;
  message: string;
  time: number;
  files: ChangedFile[];
  branches: string[];
  follows_tags: string[];
  precedes_tags: string[];
}

export interface ChangedFile {
  path: string;
  status: "added" | "deleted" | "modified" | "renamed";
  additions: number;
  deletions: number;
}

export type WorkingTreeStatus =
  | "added"
  | "deleted"
  | "modified"
  | "renamed"
  | "typechange"
  | "untracked";

export interface WorkingTreeFile {
  path: string;
  staged: boolean;
  unstaged: boolean;
  conflicted: boolean;
  staged_status: WorkingTreeStatus | null;
  unstaged_status: WorkingTreeStatus | null;
}

export interface TreeNode {
  name: string;
  path: string;
  type: string;
  size?: number;
  children?: TreeNode[];
}

export interface Diff {
  file: string;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  old_lineno: number | null;
  new_lineno: number | null;
  content: string;
  origin: " " | "+" | "-" | "\\";
}

export type DiffLineKind =
  | "diff-add"
  | "diff-remove"
  | "diff-hunk"
  | "diff-context"
  | "diff-file-header"
  | "diff-index"
  | "diff-file-old"
  | "diff-file-new"
  | "diff-meta";

export interface DiffLinePresentation {
  kind: DiffLineKind;
  gutterLabel: string;
  filePath?: string;
}

export interface DiffFileAnchor {
  path: string;
  startLine: number;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface CommitGraph {
  nodes: CommitNode[];
  edges: GraphEdge[];
}

