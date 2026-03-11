import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CommitNode, Branch, Tag } from "../types/git";

export function useCommits() {
  const [commits, setCommits] = useState<CommitNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCommits = async () => {
    setLoading(true);
    setError(null);
    try {
      const graph = await invoke<{ nodes: CommitNode[]; edges: { from: string; to: string }[] }>("get_commit_graph");
      setCommits(graph.nodes);
      setLoading(false);
    } catch (err) {
      setError(err as string);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommits();
  }, []);

  return { commits, loading, error, reload: loadCommits };
}

export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBranches = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<Branch[]>("get_branches");
      setBranches(data);
      setLoading(false);
    } catch (err) {
      setError(err as string);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  return { branches, loading, error, reload: loadBranches };
}

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTags = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<Tag[]>("get_tags");
      setTags(data);
      setLoading(false);
    } catch (err) {
      setError(err as string);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  return { tags, loading, error, reload: loadTags };
}

