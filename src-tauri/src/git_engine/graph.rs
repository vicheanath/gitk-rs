use crate::git_engine::commit::CommitNode;
use git2::{Oid, Repository};
use petgraph::{graph::NodeIndex, Graph};
use std::collections::{HashMap, HashSet};
use std::process::Command;

pub struct CommitGraph {
    pub graph: Graph<CommitNode, ()>,
}

#[derive(Debug, Clone)]
pub struct CommitGraphPage {
    pub nodes: Vec<CommitNode>,
    pub has_more: bool,
    pub next_skip: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ParsedGraphRow {
    hash: String,
    row: usize,
    column: usize,
}

fn is_full_hash(token: &str) -> bool {
    token.len() == 40 && token.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn parse_git_log_graph_output(output: &str) -> anyhow::Result<Vec<ParsedGraphRow>> {
    let mut rows = Vec::new();
    let mut seen = HashSet::new();

    for line in output.lines() {
        let Some(hash) = line.split_whitespace().last() else {
            continue;
        };

        if !is_full_hash(hash) {
            continue;
        }

        if !seen.insert(hash.to_string()) {
            continue;
        }

        let hash_start = line
            .rfind(hash)
            .ok_or_else(|| anyhow::anyhow!("failed to find hash in graph line"))?;
        let prefix = &line[..hash_start];
        let star_index = prefix
            .find('*')
            .ok_or_else(|| anyhow::anyhow!("failed to find '*' in graph commit line"))?;

        rows.push(ParsedGraphRow {
            hash: hash.to_string(),
            row: rows.len(),
            column: star_index / 2,
        });
    }

    if rows.is_empty() {
        return Err(anyhow::anyhow!(
            "no commit rows found in `git log --graph` output"
        ));
    }

    Ok(rows)
}

fn run_git_log_graph_with_skip(
    repo: &Repository,
    skip: usize,
    max_commits: usize,
) -> anyhow::Result<String> {
    let repo_root = repo
        .workdir()
        .ok_or_else(|| anyhow::anyhow!("repository has no workdir"))?;

    let output = Command::new("git")
        .arg("--no-pager")
        .arg("log")
        .arg("--graph")
        .arg("--no-color")
        .arg(format!("--skip={skip}"))
        .arg("-n")
        .arg(max_commits.to_string())
        .arg("--pretty=format:%H")
        .current_dir(repo_root)
        .output()
        .map_err(|err| anyhow::anyhow!("failed to execute `git log --graph`: {err}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!(
            "`git log --graph` exited with status {}: {}",
            output.status,
            stderr.trim()
        ));
    }

    String::from_utf8(output.stdout)
        .map_err(|err| anyhow::anyhow!("invalid UTF-8 from `git log --graph`: {err}"))
}

fn run_git_log_graph(repo: &Repository, max_commits: usize) -> anyhow::Result<String> {
    run_git_log_graph_with_skip(repo, 0, max_commits)
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
                .filter_map(|parent_id| {
                    node_map
                        .get(parent_id)
                        .copied()
                        .map(|parent_idx| (parent_idx, child_idx))
                })
                .collect::<Vec<(NodeIndex, NodeIndex)>>()
        })
        .collect();

    for (parent_idx, child_idx) in parent_connections {
        graph.add_edge(parent_idx, child_idx, ());
    }
}

fn build_commit_graph_legacy(
    repo: &Repository,
    max_commits: Option<usize>,
) -> anyhow::Result<CommitGraph> {
    let mut graph = Graph::<CommitNode, ()>::new();
    let head_oid = resolve_head_oid(repo)?;
    let node_map = collect_commit_nodes(repo, head_oid, max_commits.unwrap_or(1000), &mut graph)?;
    connect_parent_edges(&mut graph, &node_map);

    Ok(CommitGraph { graph })
}

fn build_commit_graph_from_rows(
    repo: &Repository,
    rows: Vec<ParsedGraphRow>,
) -> anyhow::Result<CommitGraph> {
    let mut graph = Graph::<CommitNode, ()>::new();
    let mut node_map = HashMap::new();

    for commit_node in collect_nodes_from_rows(repo, rows)? {
        let node_id = commit_node.id.clone();
        let node_idx = graph.add_node(commit_node);
        node_map.insert(node_id, node_idx);
    }

    connect_parent_edges(&mut graph, &node_map);
    Ok(CommitGraph { graph })
}

fn collect_nodes_from_rows(
    repo: &Repository,
    rows: Vec<ParsedGraphRow>,
) -> anyhow::Result<Vec<CommitNode>> {
    let mut nodes = Vec::with_capacity(rows.len());
    for row in rows {
        let oid = Oid::from_str(&row.hash)?;
        let commit = repo.find_commit(oid)?;
        let mut commit_node = CommitNode::from_commit(&commit);
        commit_node.graph_row = Some(row.row);
        commit_node.graph_col = Some(row.column);
        nodes.push(commit_node);
    }

    Ok(nodes)
}

fn build_commit_graph_with_runner<F>(
    repo: &Repository,
    max_commits: Option<usize>,
    runner: &F,
) -> anyhow::Result<CommitGraph>
where
    F: Fn(&Repository, usize) -> anyhow::Result<String>,
{
    let limit = max_commits.unwrap_or(1000);

    if limit == 0 {
        return build_commit_graph_legacy(repo, Some(limit));
    }

    let graph_result = runner(repo, limit)
        .and_then(|output| parse_git_log_graph_output(&output))
        .and_then(|rows| build_commit_graph_from_rows(repo, rows));

    match graph_result {
        Ok(graph) => Ok(graph),
        Err(err) => {
            eprintln!(
                "[graph] warning: failed to build graph from `git log --graph`, falling back to legacy layout: {err}"
            );
            build_commit_graph_legacy(repo, Some(limit))
        }
    }
}

pub fn build_commit_graph(
    repo: &Repository,
    max_commits: Option<usize>,
) -> anyhow::Result<CommitGraph> {
    build_commit_graph_with_runner(repo, max_commits, &run_git_log_graph)
}

fn load_commit_graph_page_with_runner<F>(
    repo: &Repository,
    skip: usize,
    max_commits: usize,
    runner: &F,
) -> anyhow::Result<CommitGraphPage>
where
    F: Fn(&Repository, usize, usize) -> anyhow::Result<String>,
{
    if max_commits == 0 {
        return Ok(CommitGraphPage {
            nodes: Vec::new(),
            has_more: false,
            next_skip: skip,
        });
    }

    let output = runner(repo, skip, max_commits.saturating_add(1))?;
    if output.trim().is_empty() {
        return Ok(CommitGraphPage {
            nodes: Vec::new(),
            has_more: false,
            next_skip: skip,
        });
    }

    let mut rows = parse_git_log_graph_output(&output)?;
    for row in &mut rows {
        row.row = row.row.saturating_add(skip);
    }

    let has_more = rows.len() > max_commits;
    if has_more {
        rows.truncate(max_commits);
    }

    let nodes = collect_nodes_from_rows(repo, rows)?;
    let next_skip = skip.saturating_add(nodes.len());

    Ok(CommitGraphPage {
        nodes,
        has_more,
        next_skip,
    })
}

pub fn load_commit_graph_page(
    repo: &Repository,
    skip: usize,
    max_commits: usize,
) -> anyhow::Result<CommitGraphPage> {
    load_commit_graph_page_with_runner(repo, skip, max_commits, &run_git_log_graph_with_skip)
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
        index
            .add_path(std::path::Path::new(file_name))
            .expect("add path");
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

    fn checkout_branch(repo: &Repository, branch_ref: &str) {
        let (object, reference) = repo.revparse_ext(branch_ref).expect("revparse");
        repo.checkout_tree(&object, None).expect("checkout tree");
        if let Some(reference) = reference {
            repo.set_head(reference.name().expect("reference name"))
                .expect("set head");
        } else {
            repo.set_head_detached(object.id()).expect("detach head");
        }
    }

    fn commit_merge(
        repo: &Repository,
        file_name: &str,
        content: &str,
        message: &str,
        first_parent: Oid,
        second_parent: Oid,
    ) -> Oid {
        let workdir = repo.workdir().expect("workdir");
        fs::write(workdir.join(file_name), content).expect("write file");

        let mut index = repo.index().expect("index");
        index
            .add_path(std::path::Path::new(file_name))
            .expect("add path");
        index.write().expect("write index");

        let tree_id = index.write_tree().expect("write tree");
        let tree = repo.find_tree(tree_id).expect("find tree");
        let sig = Signature::now("Test", "test@example.com").expect("signature");
        let p1 = repo.find_commit(first_parent).expect("first parent");
        let p2 = repo.find_commit(second_parent).expect("second parent");

        repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[&p1, &p2])
            .expect("create merge commit")
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
        assert!(
            has_expected_edge,
            "expected parent->child edge from c1 to c2"
        );
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

        let ids: HashSet<String> = graph
            .node_indices()
            .map(|idx| graph[idx].id.clone())
            .collect();
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

    #[test]
    fn parses_git_log_graph_rows_for_merge_output() {
        let h1 = "1111111111111111111111111111111111111111";
        let h2 = "2222222222222222222222222222222222222222";
        let h3 = "3333333333333333333333333333333333333333";
        let h4 = "4444444444444444444444444444444444444444";
        let output = format!("*   {h1}\n|\\  \n| * {h2}\n| * {h3}\n|/  \n* {h4}\n");

        let parsed = parse_git_log_graph_output(&output).expect("parse graph output");
        let actual: Vec<(String, usize, usize)> = parsed
            .into_iter()
            .map(|row| (row.hash, row.row, row.column))
            .collect();

        let expected = vec![
            (h1.to_string(), 0, 0),
            (h2.to_string(), 1, 1),
            (h3.to_string(), 2, 1),
            (h4.to_string(), 3, 0),
        ];

        assert_eq!(actual, expected);
    }

    #[test]
    fn build_graph_assigns_cli_row_and_column_hints() {
        let repo = init_repo("graph-hints");
        let base = commit_file(&repo, "a.txt", "base", "base");

        let default_branch = repo
            .head()
            .expect("head")
            .shorthand()
            .expect("branch name")
            .to_string();

        let base_commit = repo.find_commit(base).expect("base commit");
        repo.branch("feature", &base_commit, false)
            .expect("create feature branch");

        checkout_branch(&repo, "refs/heads/feature");
        let feature_commit = commit_file(&repo, "feature.txt", "feature", "feature");

        checkout_branch(&repo, &format!("refs/heads/{default_branch}"));
        let main_commit = commit_file(&repo, "main.txt", "main", "main");
        let _merge_commit = commit_merge(
            &repo,
            "merge.txt",
            "merged",
            "merge",
            main_commit,
            feature_commit,
        );

        let expected_rows = run_git_log_graph(&repo, 50)
            .and_then(|output| parse_git_log_graph_output(&output))
            .expect("expected rows from git log");

        let commit_graph = build_commit_graph(&repo, Some(50)).expect("build graph");
        let graph = commit_graph.graph;
        let actual: HashMap<String, (Option<usize>, Option<usize>)> = graph
            .node_indices()
            .map(|idx| {
                (
                    graph[idx].id.clone(),
                    (graph[idx].graph_row, graph[idx].graph_col),
                )
            })
            .collect();

        assert_eq!(actual.len(), expected_rows.len());
        for row in expected_rows {
            let got = actual.get(&row.hash).expect("commit present in graph");
            assert_eq!(got.0, Some(row.row));
            assert_eq!(got.1, Some(row.column));
        }
    }

    #[test]
    fn falls_back_to_legacy_graph_when_cli_runner_fails() {
        let repo = init_repo("cli-fallback");
        let c1 = commit_file(&repo, "a.txt", "one", "first");
        let c2 = commit_file(&repo, "a.txt", "two", "second");

        let failing_runner = |_repo: &Repository, _max_commits: usize| -> anyhow::Result<String> {
            Err(anyhow::anyhow!("forced runner failure"))
        };

        let commit_graph =
            build_commit_graph_with_runner(&repo, Some(100), &failing_runner).expect("build graph");
        let graph = commit_graph.graph;

        assert_eq!(graph.node_count(), 2);
        assert_eq!(graph.edge_count(), 1);

        let latest = graph
            .node_indices()
            .map(|idx| &graph[idx])
            .find(|node| node.id == c2.to_string())
            .expect("latest node");
        let first = graph
            .node_indices()
            .map(|idx| &graph[idx])
            .find(|node| node.id == c1.to_string())
            .expect("first node");

        assert!(latest.graph_row.is_none());
        assert!(latest.graph_col.is_none());
        assert!(first.graph_row.is_none());
        assert!(first.graph_col.is_none());
    }

    #[test]
    fn paged_graph_skip_zero_reports_has_more_and_next_skip() {
        let repo = init_repo("paged-first");
        let _c1 = commit_file(&repo, "a.txt", "one", "first");
        let _c2 = commit_file(&repo, "a.txt", "two", "second");
        let c3 = commit_file(&repo, "a.txt", "three", "third");

        let page = load_commit_graph_page(&repo, 0, 2).expect("load first page");
        assert_eq!(page.nodes.len(), 2);
        assert!(page.has_more);
        assert_eq!(page.next_skip, 2);
        assert_eq!(page.nodes[0].id, c3.to_string());
        assert_eq!(page.nodes[0].graph_row, Some(0));
    }

    #[test]
    fn paged_graph_skip_progresses_rows_and_exhausts_history() {
        let repo = init_repo("paged-next");
        let c1 = commit_file(&repo, "a.txt", "one", "first");
        let _c2 = commit_file(&repo, "a.txt", "two", "second");
        let _c3 = commit_file(&repo, "a.txt", "three", "third");

        let first = load_commit_graph_page(&repo, 0, 2).expect("first page");
        let second = load_commit_graph_page(&repo, first.next_skip, 2).expect("second page");

        assert_eq!(second.nodes.len(), 1);
        assert!(!second.has_more);
        assert_eq!(second.next_skip, 3);
        assert_eq!(second.nodes[0].id, c1.to_string());
        assert_eq!(second.nodes[0].graph_row, Some(2));
    }
}
