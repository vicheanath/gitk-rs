use crate::git_engine::commit::CommitNode;
use git2::Repository;
use petgraph::{graph::NodeIndex, Graph};
use std::collections::{HashMap, HashSet};

pub struct CommitGraph {
    pub graph: Graph<CommitNode, ()>,
    pub node_map: HashMap<String, NodeIndex>,
}

pub fn build_commit_graph(repo: &Repository, max_commits: Option<usize>) -> anyhow::Result<CommitGraph> {
    let mut graph = Graph::<CommitNode, ()>::new();
    let mut node_map = HashMap::new();
    let mut visited = HashSet::new();
    let mut to_process = Vec::new();

    // Start from HEAD
    let head = repo.head()?;
    let head_oid = head.target().ok_or_else(|| anyhow::anyhow!("HEAD has no target"))?;
    to_process.push(head_oid);

    let mut commit_count = 0;
    let max = max_commits.unwrap_or(1000);

    while !to_process.is_empty() && commit_count < max {
        let oid = to_process.pop().unwrap();
        
        if visited.contains(&oid) {
            continue;
        }
        visited.insert(oid);

        let commit = repo.find_commit(oid)?;
        let commit_node = CommitNode::from_commit(&commit);
        
        let node_idx = graph.add_node(commit_node.clone());
        node_map.insert(commit_node.id.clone(), node_idx);
        commit_count += 1;

        // Add parent commits to processing queue
        for parent_id in commit.parent_ids() {
            if !visited.contains(&parent_id) {
                to_process.push(parent_id);
            }
        }
    }

    // Build edges
    let parent_connections: Vec<(String, String)> = node_map
        .iter()
        .flat_map(|(oid_str, &node_idx)| {
            let node = &graph[node_idx];
            node.parents
                .iter()
                .filter_map(|parent_id| {
                    if node_map.contains_key(parent_id) {
                        Some((parent_id.clone(), oid_str.clone()))
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
        })
        .collect();
    
    for (parent_id, child_id) in parent_connections {
        if let (Some(&parent_idx), Some(&child_idx)) = (node_map.get(&parent_id), node_map.get(&child_id)) {
            graph.add_edge(parent_idx, child_idx, ());
        }
    }

    Ok(CommitGraph { graph, node_map })
}

