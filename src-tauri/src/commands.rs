use crate::app_core::AppState;
use crate::auth::{self, AuthConnection, AuthConnectionInput};
use crate::git_engine::operations::{open_repo, BranchInfo, TagInfo, WorkingTreeFile};
use crate::git_engine::{build_commit_graph, CommitNode};
use git2::Repository;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

static APP_STATE: Mutex<Option<Arc<Mutex<AppState>>>> = Mutex::new(None);

fn get_repo() -> Result<Repository, String> {
    let state = APP_STATE.lock().unwrap();
    let state = state.as_ref().ok_or_else(|| "No repository open".to_string())?;
    let state = state.lock().unwrap();
    let path = state.repo_path.as_ref().ok_or_else(|| "No repository path".to_string())?;
    open_repo(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_repository(path: String) -> Result<(), String> {
    let repo_path = PathBuf::from(&path);
    
    // Validate path exists
    if !repo_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    
    // Try to open the repository
    let repo = open_repo(&repo_path).map_err(|e| {
        format!("Failed to open Git repository at '{}': {}. Make sure this is a valid Git repository.", path, e)
    })?;
    
    // Bare repositories do not have a worktree and are not supported by this UI.
    if repo.is_bare() {
        return Err(format!(
            "Path '{}' is a bare Git repository and is not supported",
            path
        ));
    }
    
    let state = Arc::new(Mutex::new(AppState {
        repo_path: Some(repo_path.clone()),
        selected_commit: None,
        active_branch: repo.head().ok().and_then(|h| h.shorthand().map(|s| s.to_string())),
    }));
    
    *APP_STATE.lock().unwrap() = Some(state);

    Ok(())
}

#[tauri::command]
pub fn get_commit_graph(max_commits: Option<usize>) -> Result<CommitGraphResponse, String> {
    let repo = get_repo()?;
    let graph = build_commit_graph(&repo, max_commits.or(Some(1000))).map_err(|e| e.to_string())?;
    
    let nodes: Vec<CommitNode> = graph.graph.node_indices()
        .map(|idx| graph.graph[idx].clone())
        .collect();
    
    let edges: Vec<GraphEdge> = graph.graph.edge_indices()
        .filter_map(|edge| {
            graph.graph.edge_endpoints(edge).map(|(from, to)| GraphEdge {
                from: graph.graph[from].id.clone(),
                to: graph.graph[to].id.clone(),
            })
        })
        .collect();
    
    Ok(CommitGraphResponse { nodes, edges })
}

#[tauri::command]
pub fn get_branches() -> Result<Vec<BranchInfo>, String> {
    let repo = get_repo()?;
    crate::git_engine::operations::get_branches(&repo).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_tags() -> Result<Vec<TagInfo>, String> {
    let repo = get_repo()?;
    crate::git_engine::operations::get_tags(&repo).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_commit_details(oid: String) -> Result<CommitDetails, String> {
    let repo = get_repo()?;
    let commit_oid = git2::Oid::from_str(&oid).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(commit_oid).map_err(|e| e.to_string())?;
    
    let author = commit.author();
    let committer = commit.committer();
    
    // Get branches containing this commit
    let branches = crate::git_engine::operations::get_branches_containing_commit(&repo, &oid)
        .map_err(|e| e.to_string())?;
    
    // Get tags that precede and follow this commit
    let follows_tags = crate::git_engine::operations::get_tags_preceding_commit(&repo, &oid)
        .map_err(|e| e.to_string())?;
    let precedes_tags = crate::git_engine::operations::get_tags_following_commit(&repo, &oid)
        .map_err(|e| e.to_string())?;
    
    let mut files = Vec::new();
    let mut file_stats: HashMap<String, (i32, i32)> = HashMap::new();
    let tree = commit.tree().map_err(|e| e.to_string())?;
    let diff = if let Ok(parent) = commit.parent(0) {
        let parent_tree = parent.tree().map_err(|e| e.to_string())?;
        repo.diff_tree_to_tree(Some(&parent_tree), Some(&tree), None)
    } else {
        // Initial commit: compare against an empty tree.
        repo.diff_tree_to_tree(None, Some(&tree), None)
    }
    .map_err(|e| e.to_string())?;

    diff.foreach(
        &mut |delta, _| {
            let path = delta.new_file().path().or_else(|| delta.old_file().path());
            if let Some(path) = path {
                let status = match delta.status() {
                    git2::Delta::Added => "added",
                    git2::Delta::Deleted => "deleted",
                    git2::Delta::Modified => "modified",
                    git2::Delta::Renamed => "renamed",
                    _ => "modified",
                };

                files.push(ChangedFile {
                    path: path.to_string_lossy().to_string(),
                    status: status.to_string(),
                    additions: 0,
                    deletions: 0,
                });
            }
            true
        },
        None,
        None,
        Some(&mut |delta, _hunk, line| {
            let path = delta.new_file().path().or_else(|| delta.old_file().path());
            if let Some(path) = path {
                let key = path.to_string_lossy().to_string();
                let stats = file_stats.entry(key).or_insert((0, 0));

                match line.origin() {
                    '+' => stats.0 += 1,
                    '-' => stats.1 += 1,
                    _ => {}
                }
            }
            true
        }),
    )
    .map_err(|e| e.to_string())?;

    for file in &mut files {
        if let Some((additions, deletions)) = file_stats.get(&file.path) {
            file.additions = *additions;
            file.deletions = *deletions;
        }
    }
    
    Ok(CommitDetails {
        id: commit.id().to_string(),
        parents: commit.parent_ids().map(|id| id.to_string()).collect(),
        author: author.name().unwrap_or("").to_string(),
        email: author.email().unwrap_or("").to_string(),
        committer: committer.name().unwrap_or("").to_string(),
        committer_email: committer.email().unwrap_or("").to_string(),
        message: commit.message().unwrap_or("").to_string(),
        time: author.when().seconds(),
        files,
        branches,
        follows_tags,
        precedes_tags,
    })
}

#[tauri::command]
pub fn get_commit_branches(oid: String) -> Result<Vec<String>, String> {
    let repo = get_repo()?;
    crate::git_engine::operations::get_branches_containing_commit(&repo, &oid)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_diff(
    oid: String,
    context_lines: Option<usize>,
    ignore_whitespace: Option<bool>,
) -> Result<String, String> {
    let repo = get_repo()?;
    let commit_oid = git2::Oid::from_str(&oid).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(commit_oid).map_err(|e| e.to_string())?;
    
    let tree = commit.tree().map_err(|e| e.to_string())?;

    // Configure diff options
    let mut diff_opts = git2::DiffOptions::new();
    if let Some(context) = context_lines {
        diff_opts.context_lines(context as u32);
    }
    if ignore_whitespace.unwrap_or(false) {
        diff_opts.ignore_whitespace(true);
    }

    let diff = if let Ok(parent) = commit.parent(0) {
        let parent_tree = parent.tree().map_err(|e| e.to_string())?;
        repo.diff_tree_to_tree(Some(&parent_tree), Some(&tree), Some(&mut diff_opts))
    } else {
        // Initial commit: compare against an empty tree.
        repo.diff_tree_to_tree(None, Some(&tree), Some(&mut diff_opts))
    }
    .map_err(|e| e.to_string())?;

    let mut diff_text = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        if let Ok(content) = std::str::from_utf8(line.content()) {
            diff_text.push_str(content);
        }
        true
    })
    .map_err(|e| e.to_string())?;

    Ok(diff_text)
}

#[tauri::command]
pub fn get_file_content(oid: String, file_path: String, is_old: bool) -> Result<String, String> {
    let repo = get_repo()?;
    let commit_oid = git2::Oid::from_str(&oid).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(commit_oid).map_err(|e| e.to_string())?;
    
    let tree = if is_old {
        // Get parent tree for old version
        if let Ok(parent) = commit.parent(0) {
            parent.tree().map_err(|e| e.to_string())?
        } else {
            // No parent - return empty for initial commit
            return Ok(String::new());
        }
    } else {
        // Get current tree for new version
        commit.tree().map_err(|e| e.to_string())?
    };
    
    // Check if file exists in the tree
    match tree.get_path(Path::new(&file_path)) {
        Ok(entry) => {
            let blob = repo.find_blob(entry.id()).map_err(|e| e.to_string())?;
            let content = blob.content();
            Ok(String::from_utf8_lossy(content).to_string())
        }
        Err(_) => {
            // File doesn't exist in this version
            Ok(String::new())
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<TreeNode>>,
}

fn build_tree_node(
    repo: &Repository,
    tree: &git2::Tree,
    path: &str,
) -> Result<Vec<TreeNode>, String> {
    let mut nodes = Vec::new();
    
    for entry in tree.iter() {
        let name = entry.name().unwrap_or("").to_string();
        let full_path = if path.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", path, name)
        };
        
        match entry.kind() {
            Some(git2::ObjectType::Tree) => {
                let subtree = entry.to_object(repo)
                    .and_then(|obj| obj.peel_to_tree())
                    .map_err(|e| e.to_string())?;
                
                let children = build_tree_node(repo, &subtree, &full_path)?;
                
                nodes.push(TreeNode {
                    name,
                    path: full_path,
                    node_type: "tree".to_string(),
                    size: None,
                    children: Some(children),
                });
            }
            Some(git2::ObjectType::Blob) => {
                let blob = entry.to_object(repo)
                    .and_then(|obj| obj.peel_to_blob())
                    .map_err(|e| e.to_string())?;
                
                nodes.push(TreeNode {
                    name,
                    path: full_path,
                    node_type: "blob".to_string(),
                    size: Some(blob.size() as u64),
                    children: None,
                });
            }
            _ => {}
        }
    }
    
    // Sort: directories first, then files, both alphabetically
    nodes.sort_by(|a, b| {
        match (a.node_type.as_str(), b.node_type.as_str()) {
            ("tree", "blob") => std::cmp::Ordering::Less,
            ("blob", "tree") => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });
    
    Ok(nodes)
}

#[tauri::command]
pub fn get_commit_tree(oid: String) -> Result<Vec<TreeNode>, String> {
    let repo = get_repo()?;
    let commit_oid = git2::Oid::from_str(&oid).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(commit_oid).map_err(|e| e.to_string())?;
    let tree = commit.tree().map_err(|e| e.to_string())?;
    
    build_tree_node(&repo, &tree, "")
}

#[tauri::command]
pub fn checkout_branch(name: String) -> Result<(), String> {
    let repo = get_repo()?;
    crate::git_engine::operations::checkout_branch(&repo, &name).map_err(|e| e.to_string())?;
    
    // Update state
    let state = APP_STATE.lock().unwrap();
    if let Some(state) = state.as_ref() {
        let mut state = state.lock().unwrap();
        state.active_branch = Some(name);
    }
    
    Ok(())
}

#[tauri::command]
pub fn create_branch(name: String, from: Option<String>) -> Result<(), String> {
    let repo = get_repo()?;
    crate::git_engine::operations::create_branch(&repo, &name, from.as_deref()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_branch(name: String) -> Result<(), String> {
    let repo = get_repo()?;
    crate::git_engine::operations::delete_branch(&repo, &name).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_working_tree_status() -> Result<Vec<WorkingTreeFile>, String> {
    let repo = get_repo()?;
    crate::git_engine::operations::get_working_tree_status(&repo).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn stage_all() -> Result<(), String> {
    let repo = get_repo()?;
    crate::git_engine::operations::stage_all(&repo).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn unstage_all() -> Result<(), String> {
    let repo = get_repo()?;
    crate::git_engine::operations::unstage_all(&repo).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn stage_paths(paths: Vec<String>) -> Result<(), String> {
    let repo = get_repo()?;
    crate::git_engine::operations::stage_paths(&repo, &paths).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn unstage_paths(paths: Vec<String>) -> Result<(), String> {
    let repo = get_repo()?;
    crate::git_engine::operations::unstage_paths(&repo, &paths).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn discard_paths(paths: Vec<String>) -> Result<(), String> {
    let repo = get_repo()?;
    crate::git_engine::operations::discard_paths(&repo, &paths).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn discard_all() -> Result<(), String> {
    let repo = get_repo()?;
    crate::git_engine::operations::discard_all(&repo).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn commit_staged(message: String) -> Result<String, String> {
    let repo = get_repo()?;
    crate::git_engine::operations::commit_staged(&repo, &message).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_working_tree_diff(
    path: Option<String>,
    staged: bool,
    context_lines: Option<usize>,
    ignore_whitespace: Option<bool>,
) -> Result<String, String> {
    let repo = get_repo()?;
    crate::git_engine::operations::get_working_tree_diff(
        &repo,
        path.as_deref(),
        staged,
        context_lines,
        ignore_whitespace,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_commits(query: String) -> Result<Vec<CommitNode>, String> {
    let repo = get_repo()?;
    crate::git_engine::operations::search_commits(&repo, &query, 100).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_git_auth_connections() -> Result<Vec<AuthConnection>, String> {
    auth::list_connections().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn upsert_git_auth_connection(input: AuthConnectionInput) -> Result<AuthConnection, String> {
    auth::upsert_connection(input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_git_auth_connection(connection_id: String) -> Result<(), String> {
    auth::remove_connection(&connection_id).map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommitGraphResponse {
    pub nodes: Vec<CommitNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphEdge {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommitDetails {
    pub id: String,
    pub parents: Vec<String>,
    pub author: String,
    pub email: String,
    pub committer: String,
    pub committer_email: String,
    pub message: String,
    pub time: i64,
    pub files: Vec<ChangedFile>,
    pub branches: Vec<String>,
    pub follows_tags: Vec<String>,
    pub precedes_tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChangedFile {
    pub path: String,
    pub status: String,
    pub additions: i32,
    pub deletions: i32,
}

