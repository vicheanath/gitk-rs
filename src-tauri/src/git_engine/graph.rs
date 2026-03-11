use crate::git_engine::commit::CommitNode;
use git2::{Oid, Repository};
use petgraph::{graph::NodeIndex, Graph};
use std::collections::{HashMap, HashSet};

pub struct CommitGraph {
    pub graph: Graph<CommitNode, ()>,
}

fn resolve_head_oid(repo: &Repository) -> anyhow::Result<Oid> {
    let head = repo.head()?;
    head.target()
        .ok_or_else(|| anyhow::anyhow!("HEAD has no target"))
}

fn collect_commit_nodes(
    repo: &Repository,
    start_oid: Oid,
    max_commits: usize,
    graph: &mut Graph<CommitNode, ()>,
) -> anyhow::Result<HashMap<String, NodeIndex>> {
    let mut node_map = HashMap::new();
    let mut visited = HashSet::new();
    let mut to_process = vec![start_oid];
    let mut commit_count = 0usize;

    while let Some(oid) = to_process.pop() {
        if commit_count >= max_commits {
            break;
        }

        if !visited.insert(oid) {
            continue;
        }

        let commit = repo.find_commit(oid)?;
        let commit_node = CommitNode::from_commit(&commit);
        let node_id = commit_node.id.clone();
        let node_idx = graph.add_node(commit_node);
        node_map.insert(node_id, node_idx);
        commit_count += 1;

        for parent_id in commit.parent_ids() {
            if !visited.contains(&parent_id) {
                to_process.push(parent_id);
            }
        }
    }

    Ok(node_map)
}

fn connect_parent_edges(graph: &mut Graph<CommitNode, ()>, node_map: &HashMap<String, NodeIndex>) {
    let parent_connections: Vec<(NodeIndex, NodeIndex)> = node_map
        .values()
        .copied()
        .flat_map(|child_idx| {
            graph[child_idx]
                .parents
                .iter()
                .filter_map(|parent_id| node_map.get(parent_id).copied().map(|parent_idx| (parent_idx, child_idx)))
                .collect::<Vec<(NodeIndex, NodeIndex)>>()
        })
        .collect();

    for (parent_idx, child_idx) in parent_connections {
        graph.add_edge(parent_idx, child_idx, ());
    }
}

pub fn build_commit_graph(repo: &Repository, max_commits: Option<usize>) -> anyhow::Result<CommitGraph> {
    let mut graph = Graph::<CommitNode, ()>::new();
    let head_oid = resolve_head_oid(repo)?;
    let node_map = collect_commit_nodes(repo, head_oid, max_commits.unwrap_or(1000), &mut graph)?;
    connect_parent_edges(&mut graph, &node_map);

    Ok(CommitGraph { graph })
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::{Repository, Signature};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn make_temp_repo_path(test_name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time went backwards")
            .as_nanos();
        std::env::temp_dir().join(format!("gitk-rs-{test_name}-{nanos}"))
    }

    fn init_repo(test_name: &str) -> Repository {
        let path = make_temp_repo_path(test_name);
        fs::create_dir_all(&path).expect("create temp repo dir");
        Repository::init(&path).expect("init repository")
    }

    fn commit_file(repo: &Repository, file_name: &str, content: &str, message: &str) -> Oid {
        let workdir = repo.workdir().expect("workdir");
        fs::write(workdir.join(file_name), content).expect("write file");

        let mut index = repo.index().expect("index");
        index.add_path(std::path::Path::new(file_name)).expect("add path");
        index.write().expect("write index");

        let tree_id = index.write_tree().expect("write tree");
        let tree = repo.find_tree(tree_id).expect("find tree");
        let sig = Signature::now("Test", "test@example.com").expect("signature");

        let oid = match repo.head() {
            Ok(head) => {
                let parent = head
                    .target()
                    .and_then(|oid| repo.find_commit(oid).ok())
                    .expect("parent commit");
                repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[&parent])
            }
            Err(_) => repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[]),
        }
        .expect("create commit");

        oid
    }

    #[test]
    fn builds_linear_graph_with_parent_edge() {
        let repo = init_repo("linear");
        let c1 = commit_file(&repo, "a.txt", "one", "first");
        let c2 = commit_file(&repo, "a.txt", "two", "second");

        let commit_graph = build_commit_graph(&repo, None).expect("build graph");
        let graph = commit_graph.graph;

        assert_eq!(graph.node_count(), 2);
        assert_eq!(graph.edge_count(), 1);

        let mut has_expected_edge = false;
        for edge in graph.edge_indices() {
            let (from, to) = graph.edge_endpoints(edge).expect("edge endpoints");
            if graph[from].id == c1.to_string() && graph[to].id == c2.to_string() {
                has_expected_edge = true;
            }
        }
        assert!(has_expected_edge, "expected parent->child edge from c1 to c2");
    }

    #[test]
    fn respects_max_commit_limit() {
        let repo = init_repo("limit");
        let c1 = commit_file(&repo, "a.txt", "one", "first");
        let c2 = commit_file(&repo, "a.txt", "two", "second");
        let c3 = commit_file(&repo, "a.txt", "three", "third");

        let commit_graph = build_commit_graph(&repo, Some(2)).expect("build graph");
        let graph = commit_graph.graph;

        assert_eq!(graph.node_count(), 2);
        assert_eq!(graph.edge_count(), 1);

        let ids: HashSet<String> = graph.node_indices().map(|idx| graph[idx].id.clone()).collect();
        assert!(ids.contains(&c2.to_string()));
        assert!(ids.contains(&c3.to_string()));
        assert!(!ids.contains(&c1.to_string()));
    }

    #[test]
    fn returns_error_for_repository_without_head_target() {
        let repo = init_repo("empty");
        let result = build_commit_graph(&repo, None);
        assert!(result.is_err());
    }

    #[test]
    fn max_zero_returns_empty_graph() {
        let repo = init_repo("max-zero");
        commit_file(&repo, "a.txt", "one", "first");

        let commit_graph = build_commit_graph(&repo, Some(0)).expect("build graph");
        let graph = commit_graph.graph;

        assert_eq!(graph.node_count(), 0);
        assert_eq!(graph.edge_count(), 0);
    }

    #[test]
    fn max_one_keeps_only_head_without_edges() {
        let repo = init_repo("max-one");
        let _c1 = commit_file(&repo, "a.txt", "one", "first");
        let _c2 = commit_file(&repo, "a.txt", "two", "second");
        let c3 = commit_file(&repo, "a.txt", "three", "third");

        let commit_graph = build_commit_graph(&repo, Some(1)).expect("build graph");
        let graph = commit_graph.graph;

        assert_eq!(graph.node_count(), 1);
        assert_eq!(graph.edge_count(), 0);

        let only_node = graph
            .node_indices()
            .next()
            .map(|idx| &graph[idx])
            .expect("single node");
        assert_eq!(only_node.id, c3.to_string());
        assert_eq!(only_node.summary, "third");
    }

    #[test]
    fn latest_node_contains_expected_parent_and_summary() {
        let repo = init_repo("node-metadata");
        let c1 = commit_file(&repo, "a.txt", "one", "first");
        let c2 = commit_file(&repo, "a.txt", "two", "second line\nmore details");

        let commit_graph = build_commit_graph(&repo, None).expect("build graph");
        let graph = commit_graph.graph;

        let latest = graph
            .node_indices()
            .map(|idx| &graph[idx])
            .find(|node| node.id == c2.to_string())
            .expect("latest node exists");

        assert_eq!(latest.summary, "second line");
        assert_eq!(latest.parents, vec![c1.to_string()]);
        assert_eq!(latest.message, "second line\nmore details");
    }
}

