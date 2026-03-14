use crate::app_core::{AppState, SqliteCache};
use crate::auth::{self, AuthConnection, AuthConnectionInput};
use crate::git_engine::operations::{open_repo, BranchInfo, TagInfo, WorkingTreeFile};
use crate::git_engine::{build_commit_graph, CommitNode};
use git2::Repository;
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

static APP_STATE: Mutex<Option<Arc<Mutex<AppState>>>> = Mutex::new(None);
static CACHE: OnceLock<SqliteCache> = OnceLock::new();

fn get_cache() -> &'static SqliteCache {
    CACHE.get_or_init(|| {
        SqliteCache::open().unwrap_or_else(|e| {
            eprintln!("[cache] failed to open SQLite cache: {e}");
            panic!("unable to open SQLite cache")
        })
    })
}

fn get_repo() -> Result<Repository, String> {
    let state = APP_STATE.lock().unwrap();
    let state = state
        .as_ref()
        .ok_or_else(|| "No repository open".to_string())?;
    let state = state.lock().unwrap();
    let path = state
        .repo_path
        .as_ref()
        .ok_or_else(|| "No repository path".to_string())?;
    open_repo(path).map_err(|e| e.to_string())
}

fn diff_status_to_string(status: git2::Delta) -> String {
    match status {
        git2::Delta::Added => "added",
        git2::Delta::Deleted => "deleted",
        git2::Delta::Modified => "modified",
        git2::Delta::Renamed => "renamed",
        git2::Delta::Copied => "copied",
        git2::Delta::Typechange => "typechange",
        git2::Delta::Untracked => "untracked",
        git2::Delta::Unreadable => "unreadable",
        git2::Delta::Ignored => "ignored",
        git2::Delta::Unmodified => "unmodified",
        git2::Delta::Conflicted => "conflicted",
    }
    .to_string()
}

fn normalize_diff_text(content: &[u8]) -> String {
    let mut text = String::from_utf8_lossy(content).to_string();

    if text.ends_with('\n') {
        text.pop();
        if text.ends_with('\r') {
            text.pop();
        }
    }

    text
}

fn map_diff_line_kind(origin: char) -> Option<DiffLineKind> {
    match origin {
        ' ' | '=' => Some(DiffLineKind::Context),
        '+' => Some(DiffLineKind::Add),
        '-' => Some(DiffLineKind::Remove),
        '>' => Some(DiffLineKind::Add),
        '<' => Some(DiffLineKind::Remove),
        '\\' => Some(DiffLineKind::NoNewline),
        _ => None,
    }
}

fn ensure_current_hunk<'a>(
    file: &'a mut DiffFileView,
    hunk: Option<&git2::DiffHunk<'_>>,
) -> &'a mut DiffHunkView {
    if file.hunks.is_empty() {
        let header = hunk
            .map(|value| normalize_diff_text(value.header()))
            .unwrap_or_default();
        file.hunks.push(DiffHunkView {
            header,
            lines: Vec::new(),
        });
    }

    file.hunks.last_mut().expect("hunk must exist")
}

fn build_diff_view_response(diff: &git2::Diff<'_>) -> Result<DiffViewResponse, String> {
    let files: RefCell<Vec<DiffFileView>> = RefCell::new(Vec::new());
    let current_file_index: Cell<Option<usize>> = Cell::new(None);

    diff.foreach(
        &mut |delta, _| {
            let old_path = delta
                .old_file()
                .path()
                .map(|p| p.to_string_lossy().to_string());
            let new_path = delta
                .new_file()
                .path()
                .map(|p| p.to_string_lossy().to_string());
            let canonical_path = new_path
                .as_ref()
                .or(old_path.as_ref())
                .cloned()
                .unwrap_or_default();
            let same_paths = old_path == new_path;

            let mut files_ref = files.borrow_mut();
            files_ref.push(DiffFileView {
                path: canonical_path,
                old_path: if same_paths { None } else { old_path },
                new_path: if same_paths { None } else { new_path },
                status: diff_status_to_string(delta.status()),
                is_binary: delta.flags().contains(git2::DiffFlags::BINARY),
                hunks: Vec::new(),
                meta: Vec::new(),
            });
            current_file_index.set(Some(files_ref.len().saturating_sub(1)));
            true
        },
        None,
        Some(&mut |_delta, hunk| {
            if let Some(file_index) = current_file_index.get() {
                let mut files_ref = files.borrow_mut();
                let Some(file) = files_ref.get_mut(file_index) else {
                    return true;
                };
                file.hunks.push(DiffHunkView {
                    header: normalize_diff_text(hunk.header()),
                    lines: Vec::new(),
                });
            }
            true
        }),
        Some(&mut |_delta, hunk, line| {
            let Some(file_index) = current_file_index.get() else {
                return true;
            };
            let mut files_ref = files.borrow_mut();
            let Some(file) = files_ref.get_mut(file_index) else {
                return true;
            };

            let origin = line.origin();
            if let Some(kind) = map_diff_line_kind(origin) {
                let mut text = normalize_diff_text(line.content());
                if kind == DiffLineKind::NoNewline && text.starts_with("\\ ") {
                    text = text.replacen("\\ ", "", 1);
                }

                let target_hunk = ensure_current_hunk(file, hunk.as_ref());
                target_hunk.lines.push(DiffLineView {
                    kind,
                    old_line: line.old_lineno(),
                    new_line: line.new_lineno(),
                    text,
                });

                if origin == '>' || origin == '<' {
                    target_hunk.lines.push(DiffLineView {
                        kind: DiffLineKind::NoNewline,
                        old_line: line.old_lineno(),
                        new_line: line.new_lineno(),
                        text: "No newline at end of file".to_string(),
                    });
                }
                return true;
            }

            // Ignore hunk header lines here; they are handled by the hunk callback.
            if origin == 'H' {
                return true;
            }

            let text = normalize_diff_text(line.content());
            if !text.is_empty() {
                file.meta.push(text);
            }

            true
        }),
    )
    .map_err(|e| e.to_string())?;

    Ok(DiffViewResponse {
        files: files.into_inner(),
    })
}

fn get_commit_diff_view_for_repo(
    repo: &Repository,
    oid: &str,
    context_lines: Option<usize>,
    ignore_whitespace: Option<bool>,
    file_path: Option<&str>,
) -> Result<DiffViewResponse, String> {
    let commit_oid = git2::Oid::from_str(oid).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(commit_oid).map_err(|e| e.to_string())?;
    let tree = commit.tree().map_err(|e| e.to_string())?;

    let mut diff_opts = git2::DiffOptions::new();
    if let Some(context) = context_lines {
        diff_opts.context_lines(context as u32);
    }
    if ignore_whitespace.unwrap_or(false) {
        diff_opts.ignore_whitespace(true);
    }
    if let Some(path) = file_path {
        diff_opts.pathspec(path);
    }

    let diff = if let Ok(parent) = commit.parent(0) {
        let parent_tree = parent.tree().map_err(|e| e.to_string())?;
        repo.diff_tree_to_tree(Some(&parent_tree), Some(&tree), Some(&mut diff_opts))
    } else {
        repo.diff_tree_to_tree(None, Some(&tree), Some(&mut diff_opts))
    }
    .map_err(|e| e.to_string())?;

    build_diff_view_response(&diff)
}

fn get_working_tree_diff_view_for_repo(
    repo: &Repository,
    path: Option<&str>,
    staged: bool,
    context_lines: Option<usize>,
    ignore_whitespace: Option<bool>,
) -> Result<DiffViewResponse, String> {
    let mut diff_opts = git2::DiffOptions::new();
    if let Some(path) = path {
        diff_opts.pathspec(path);
    }
    if let Some(context) = context_lines {
        diff_opts.context_lines(context as u32);
    }
    if ignore_whitespace.unwrap_or(false) {
        diff_opts.ignore_whitespace(true);
    }

    let diff = if staged {
        let index = repo.index().map_err(|e| e.to_string())?;
        match repo.head() {
            Ok(head) => {
                let tree = head.peel_to_tree().map_err(|e| e.to_string())?;
                repo.diff_tree_to_index(Some(&tree), Some(&index), Some(&mut diff_opts))
            }
            Err(_) => repo.diff_tree_to_index(None, Some(&index), Some(&mut diff_opts)),
        }
    } else {
        let index = repo.index().map_err(|e| e.to_string())?;
        repo.diff_index_to_workdir(Some(&index), Some(&mut diff_opts))
    }
    .map_err(|e| e.to_string())?;

    build_diff_view_response(&diff)
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
        format!(
            "Failed to open Git repository at '{}': {}. Make sure this is a valid Git repository.",
            path, e
        )
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
        active_branch: repo
            .head()
            .ok()
            .and_then(|h| h.shorthand().map(|s| s.to_string())),
    }));

    *APP_STATE.lock().unwrap() = Some(state);

    Ok(())
}

#[tauri::command]
pub fn get_commit_graph(max_commits: Option<usize>) -> Result<CommitGraphResponse, String> {
    let repo = get_repo()?;
    let limit = max_commits.unwrap_or(1000);
    const COMMIT_GRAPH_CACHE_VERSION: &str = "graph-v2";

    // Resolve HEAD so we can use it as a cache key.
    let head_oid = repo
        .head()
        .ok()
        .and_then(|h| h.target())
        .map(|oid| oid.to_string())
        .unwrap_or_default();
    let cache_head_key = format!("{head_oid}:{COMMIT_GRAPH_CACHE_VERSION}");

    let repo_path = repo
        .workdir()
        .or_else(|| Some(repo.path()))
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let cache = get_cache();

    // Cache hit: deserialise and return immediately.
    if let Some(json) = cache.get_commit_graph(&repo_path, &cache_head_key, limit) {
        if let Ok(response) = serde_json::from_str::<CommitGraphResponse>(&json) {
            return Ok(response);
        }
    }

    // Cache miss: build graph from git history.
    let graph = build_commit_graph(&repo, Some(limit)).map_err(|e| e.to_string())?;

    let nodes: Vec<CommitNode> = graph
        .graph
        .node_indices()
        .map(|idx| graph.graph[idx].clone())
        .collect();

    let edges: Vec<GraphEdge> = graph
        .graph
        .edge_indices()
        .filter_map(|edge| {
            graph
                .graph
                .edge_endpoints(edge)
                .map(|(from, to)| GraphEdge {
                    from: graph.graph[from].id.clone(),
                    to: graph.graph[to].id.clone(),
                })
        })
        .collect();

    let response = CommitGraphResponse { nodes, edges };

    // Persist to cache (fire-and-forget; serialisation failure is non-fatal).
    if let Ok(json) = serde_json::to_string(&response) {
        cache.put_commit_graph(&repo_path, &cache_head_key, limit, &json);
    }

    Ok(response)
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
    let cache = get_cache();

    // Commits are content-addressed and immutable — cache indefinitely.
    if let Some(json) = cache.get_commit_details(&oid) {
        if let Ok(details) = serde_json::from_str::<CommitDetails>(&json) {
            return Ok(details);
        }
    }

    let repo = get_repo()?;
    let commit_oid = git2::Oid::from_str(&oid).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(commit_oid).map_err(|e| e.to_string())?;

    let author = commit.author();
    let committer = commit.committer();

    // Get branches containing this commit
    let branches = crate::git_engine::operations::get_branches_containing_commit(&repo, &oid)
        .map_err(|e| e.to_string())?;

    // Get tags that precede and follow this commit in one pass.
    let related_tags = crate::git_engine::operations::get_related_tags_for_commit(&repo, &oid)
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

    let details = CommitDetails {
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
        follows_tags: related_tags.preceding,
        precedes_tags: related_tags.following,
    };

    // Store in cache for future calls.
    if let Ok(json) = serde_json::to_string(&details) {
        cache.put_commit_details(&oid, &json);
    }

    Ok(details)
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
    file_path: Option<String>,
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
    if let Some(path) = file_path.as_deref() {
        diff_opts.pathspec(path);
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
pub fn get_commit_diff_view(
    oid: String,
    context_lines: Option<usize>,
    ignore_whitespace: Option<bool>,
    file_path: Option<String>,
) -> Result<DiffViewResponse, String> {
    let repo = get_repo()?;
    get_commit_diff_view_for_repo(
        &repo,
        &oid,
        context_lines,
        ignore_whitespace,
        file_path.as_deref(),
    )
}

#[tauri::command]
pub fn get_file_content(
    oid: String,
    file_path: String,
    is_old: bool,
) -> Result<FileContentResponse, String> {
    let repo = get_repo()?;
    let commit_oid = git2::Oid::from_str(&oid).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(commit_oid).map_err(|e| e.to_string())?;

    let tree = if is_old {
        // Get parent tree for old version
        if let Ok(parent) = commit.parent(0) {
            parent.tree().map_err(|e| e.to_string())?
        } else {
            // No parent: the "old" side of an initial commit has no file.
            return Ok(FileContentResponse {
                content: String::new(),
                exists: false,
                is_binary: false,
            });
        }
    } else {
        // Get current tree for new version
        commit.tree().map_err(|e| e.to_string())?
    };

    // Distinguish "missing file" from an existing-but-empty file.
    match tree.get_path(Path::new(&file_path)) {
        Ok(entry) => {
            let blob = repo.find_blob(entry.id()).map_err(|e| e.to_string())?;
            let is_binary = blob.is_binary();
            let content = if is_binary {
                String::new()
            } else {
                String::from_utf8_lossy(blob.content()).to_string()
            };

            Ok(FileContentResponse {
                content,
                exists: true,
                is_binary,
            })
        }
        Err(_) => Ok(FileContentResponse {
            content: String::new(),
            exists: false,
            is_binary: false,
        }),
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
                let subtree = entry
                    .to_object(repo)
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
                let blob = entry
                    .to_object(repo)
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
    nodes.sort_by(|a, b| match (a.node_type.as_str(), b.node_type.as_str()) {
        ("tree", "blob") => std::cmp::Ordering::Less,
        ("blob", "tree") => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
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

    let repo_path = repo
        .workdir()
        .or_else(|| Some(repo.path()))
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    crate::git_engine::operations::checkout_branch(&repo, &name).map_err(|e| e.to_string())?;

    // Invalidate the graph cache so the next load reflects the new HEAD.
    get_cache().invalidate_graph_for_repo(&repo_path);

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
    crate::git_engine::operations::create_branch(&repo, &name, from.as_deref())
        .map_err(|e| e.to_string())?;
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

    let repo_path = repo
        .workdir()
        .or_else(|| Some(repo.path()))
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let new_oid =
        crate::git_engine::operations::commit_staged(&repo, &message).map_err(|e| e.to_string())?;

    // Invalidate the graph cache — a new commit has moved HEAD.
    get_cache().invalidate_graph_for_repo(&repo_path);

    Ok(new_oid)
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
pub fn get_working_tree_diff_view(
    path: Option<String>,
    staged: bool,
    context_lines: Option<usize>,
    ignore_whitespace: Option<bool>,
) -> Result<DiffViewResponse, String> {
    let repo = get_repo()?;
    get_working_tree_diff_view_for_repo(
        &repo,
        path.as_deref(),
        staged,
        context_lines,
        ignore_whitespace,
    )
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

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))
}

#[tauri::command]
pub fn request_app_restart(app_handle: tauri::AppHandle) -> Result<(), String> {
    app_handle.request_restart();
    Ok(())
}

#[tauri::command]
pub fn list_provider_repositories(
    connection_id: String,
    query: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<ProviderRepository>, String> {
    let (connection, token) =
        auth::get_connection_with_token(&connection_id).map_err(|e| e.to_string())?;

    let max_items = limit.unwrap_or(50).clamp(1, 100);
    let q = query.unwrap_or_default().trim().to_string();

    match connection.provider {
        crate::auth::GitProvider::Github => {
            fetch_github_repositories(&connection.host, &token, &q, max_items)
        }
        crate::auth::GitProvider::Gitlab => {
            fetch_gitlab_repositories(&connection.host, &token, &q, max_items)
        }
        crate::auth::GitProvider::Bitbucket => Err(
            "Bitbucket repository listing is not implemented yet. You can still clone by URL."
                .to_string(),
        ),
        crate::auth::GitProvider::AzureDevops => Err(
            "Azure DevOps repository listing is not implemented yet. You can still clone by URL."
                .to_string(),
        ),
    }
}

#[tauri::command]
pub fn clone_repository(
    repo_url: String,
    destination_parent: String,
    connection_id: Option<String>,
) -> Result<String, String> {
    let trimmed = repo_url.trim();
    if trimmed.is_empty() {
        return Err("Repository URL is required".to_string());
    }

    let parent_path = PathBuf::from(destination_parent.trim());
    if !parent_path.exists() {
        return Err("Destination folder does not exist".to_string());
    }
    if !parent_path.is_dir() {
        return Err("Destination path must be a folder".to_string());
    }

    let repo_dir_name = infer_repo_dir_name(trimmed)?;
    let destination = parent_path.join(repo_dir_name);
    if destination.exists() {
        return Err(format!(
            "Destination already exists: {}",
            destination.to_string_lossy()
        ));
    }

    let mut builder = git2::build::RepoBuilder::new();

    if let Some(connection_id) = connection_id {
        let (connection, token) =
            auth::get_connection_with_token(&connection_id).map_err(|e| e.to_string())?;
        let mut fetch = git2::FetchOptions::new();
        let mut callbacks = git2::RemoteCallbacks::new();
        callbacks.credentials(move |_url, username_from_url, _allowed| {
            let username = username_from_url.unwrap_or(match connection.provider {
                crate::auth::GitProvider::Github => "x-access-token",
                crate::auth::GitProvider::Gitlab => "oauth2",
                crate::auth::GitProvider::Bitbucket => "x-token-auth",
                crate::auth::GitProvider::AzureDevops => "git",
            });
            git2::Cred::userpass_plaintext(username, &token)
        });
        fetch.remote_callbacks(callbacks);
        builder.fetch_options(fetch);
    }

    builder
        .clone(trimmed, &destination)
        .map_err(|e| format!("Failed to clone repository: {}", e.message()))?;

    Ok(destination.to_string_lossy().to_string())
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

#[derive(Debug, Serialize, Deserialize)]
pub struct FileContentResponse {
    pub content: String,
    pub exists: bool,
    pub is_binary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffViewResponse {
    pub files: Vec<DiffFileView>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffFileView {
    pub path: String,
    pub old_path: Option<String>,
    pub new_path: Option<String>,
    pub status: String,
    pub is_binary: bool,
    pub hunks: Vec<DiffHunkView>,
    pub meta: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunkView {
    pub header: String,
    pub lines: Vec<DiffLineView>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DiffLineKind {
    Context,
    Add,
    Remove,
    NoNewline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLineView {
    pub kind: DiffLineKind,
    pub old_line: Option<u32>,
    pub new_line: Option<u32>,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProviderRepository {
    pub id: String,
    pub name: String,
    pub full_name: String,
    pub clone_url: String,
    pub web_url: String,
    pub private: bool,
    pub provider: String,
    pub host: String,
}

fn infer_repo_dir_name(url: &str) -> Result<String, String> {
    let cleaned = url.trim_end_matches('/');
    let last = cleaned
        .rsplit('/')
        .next()
        .ok_or_else(|| "Invalid repository URL".to_string())?;
    let candidate = last.strip_suffix(".git").unwrap_or(last).trim();
    if candidate.is_empty() {
        return Err("Could not infer repository folder name from URL".to_string());
    }
    Ok(candidate.to_string())
}

#[derive(Debug, Deserialize)]
struct GithubRepo {
    id: i64,
    name: String,
    full_name: String,
    clone_url: String,
    html_url: String,
    private: bool,
}

fn fetch_github_repositories(
    host: &str,
    token: &str,
    query: &str,
    limit: usize,
) -> Result<Vec<ProviderRepository>, String> {
    let client = Client::builder()
        .user_agent("gitk-rs")
        .build()
        .map_err(|e| e.to_string())?;

    let api_candidates = github_api_bases_for_host(host);
    let endpoint_for = |api_base: &str| {
        if query.is_empty() {
            format!("{}/user/repos?per_page={}&sort=updated", api_base, limit)
        } else {
            format!(
                "{}/search/repositories?q={}&per_page={}",
                api_base,
                urlencoding::encode(query),
                limit
            )
        }
    };

    let mut last_error = String::new();
    let mut successful_response = None;

    for api_base in &api_candidates {
        let endpoint = endpoint_for(api_base);
        let response = client
            .get(&endpoint)
            .bearer_auth(token)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .map_err(|e| e.to_string())?;

        if response.status().is_success() {
            successful_response = Some(response);
            break;
        }

        last_error = format!(
            "GitHub API error on {}: HTTP {}",
            endpoint,
            response.status()
        );

        if response.status().as_u16() == 401 || response.status().as_u16() == 403 {
            return Err(last_error);
        }
    }

    let response = successful_response.ok_or_else(|| {
        if last_error.is_empty() {
            "Failed to call GitHub API".to_string()
        } else {
            last_error
        }
    })?;

    if query.is_empty() {
        let repos: Vec<GithubRepo> = response.json().map_err(|e| e.to_string())?;
        return Ok(repos
            .into_iter()
            .map(|repo| ProviderRepository {
                id: repo.id.to_string(),
                name: repo.name,
                full_name: repo.full_name,
                clone_url: repo.clone_url,
                web_url: repo.html_url,
                private: repo.private,
                provider: "github".to_string(),
                host: host.to_string(),
            })
            .collect());
    }

    #[derive(Debug, Deserialize)]
    struct GithubSearch {
        items: Vec<GithubRepo>,
    }

    let result: GithubSearch = response.json().map_err(|e| e.to_string())?;
    Ok(result
        .items
        .into_iter()
        .map(|repo| ProviderRepository {
            id: repo.id.to_string(),
            name: repo.name,
            full_name: repo.full_name,
            clone_url: repo.clone_url,
            web_url: repo.html_url,
            private: repo.private,
            provider: "github".to_string(),
            host: host.to_string(),
        })
        .collect())
}

fn github_api_bases_for_host(host: &str) -> Vec<String> {
    let normalized = host
        .trim()
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_end_matches('/');

    if normalized.eq_ignore_ascii_case("github.com") {
        return vec!["https://api.github.com".to_string()];
    }

    if normalized.starts_with("api.") {
        return vec![format!("https://{}", normalized)];
    }

    vec![
        format!("https://api.{}", normalized),
        format!("https://{}/api/v3", normalized),
    ]
}

#[derive(Debug, Deserialize)]
struct GitlabRepo {
    id: i64,
    name: String,
    path_with_namespace: String,
    http_url_to_repo: String,
    web_url: String,
    visibility: Option<String>,
}

fn fetch_gitlab_repositories(
    host: &str,
    token: &str,
    query: &str,
    limit: usize,
) -> Result<Vec<ProviderRepository>, String> {
    let client = Client::builder()
        .user_agent("gitk-rs")
        .build()
        .map_err(|e| e.to_string())?;

    let mut endpoint = format!(
        "https://{}/api/v4/projects?membership=true&per_page={}&order_by=last_activity_at",
        host, limit
    );
    if !query.is_empty() {
        endpoint.push_str("&search=");
        endpoint.push_str(&urlencoding::encode(query));
    }

    let response = client
        .get(endpoint)
        .header("PRIVATE-TOKEN", token)
        .send()
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("GitLab API error: HTTP {}", response.status()));
    }

    let repos: Vec<GitlabRepo> = response.json().map_err(|e| e.to_string())?;
    Ok(repos
        .into_iter()
        .map(|repo| ProviderRepository {
            id: repo.id.to_string(),
            name: repo.name,
            full_name: repo.path_with_namespace,
            clone_url: repo.http_url_to_repo,
            web_url: repo.web_url,
            private: repo.visibility.as_deref().unwrap_or("private") != "public",
            provider: "gitlab".to_string(),
            host: host.to_string(),
        })
        .collect())
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
        std::env::temp_dir().join(format!("gitk-rs-commands-{test_name}-{nanos}"))
    }

    fn init_repo(test_name: &str) -> Repository {
        let path = make_temp_repo_path(test_name);
        fs::create_dir_all(&path).expect("create temp repo dir");
        Repository::init(&path).expect("init repository")
    }

    fn commit_all(repo: &Repository, message: &str) {
        let mut index = repo.index().expect("index");
        index
            .add_all(["*"], git2::IndexAddOption::DEFAULT, None)
            .expect("add all");
        index.write().expect("write index");

        let tree_id = index.write_tree().expect("write tree");
        let tree = repo.find_tree(tree_id).expect("find tree");
        let sig = Signature::now("Test", "test@example.com").expect("signature");

        match repo.head() {
            Ok(head) => {
                let parent = head
                    .target()
                    .and_then(|oid| repo.find_commit(oid).ok())
                    .expect("parent commit");
                repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[&parent])
                    .expect("commit");
            }
            Err(_) => {
                repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[])
                    .expect("initial commit");
            }
        }
    }

    fn head_oid(repo: &Repository) -> String {
        repo.head()
            .expect("head")
            .target()
            .expect("head target")
            .to_string()
    }

    #[test]
    fn commit_diff_view_builds_expected_line_kinds() {
        let repo = init_repo("diff-view-kinds");
        let workdir = repo.workdir().expect("workdir");

        fs::write(
            workdir.join("sample.txt"),
            "line one\nline two\nline three\n",
        )
        .expect("write initial");
        commit_all(&repo, "initial");

        fs::write(
            workdir.join("sample.txt"),
            "line one\nline two changed\nline three",
        )
        .expect("write updated");
        commit_all(&repo, "update");

        let response = get_commit_diff_view_for_repo(
            &repo,
            &head_oid(&repo),
            Some(3),
            Some(false),
            Some("sample.txt"),
        )
        .expect("commit diff view");

        assert_eq!(response.files.len(), 1);
        let lines: Vec<&DiffLineView> = response.files[0]
            .hunks
            .iter()
            .flat_map(|hunk| hunk.lines.iter())
            .collect();

        assert!(lines.iter().any(|line| line.kind == DiffLineKind::Add));
        assert!(lines.iter().any(|line| line.kind == DiffLineKind::Remove));
        assert!(lines.iter().any(|line| line.kind == DiffLineKind::Context));
        assert!(
            lines
                .iter()
                .any(|line| line.kind == DiffLineKind::NoNewline),
            "expected \\ No newline marker to be surfaced as no-newline"
        );
    }

    #[test]
    fn commit_diff_view_keeps_hunk_lines_with_diff_like_prefixes() {
        let repo = init_repo("diff-view-prefixes");
        let workdir = repo.workdir().expect("workdir");

        fs::write(
            workdir.join("code.txt"),
            "keep this\n--- old sentinel\nindex same sentinel\ndiff --git old sentinel\n",
        )
        .expect("write initial");
        commit_all(&repo, "initial");

        fs::write(
            workdir.join("code.txt"),
            "keep this\n+++ new sentinel\nindex same sentinel\ndiff --git new sentinel\n",
        )
        .expect("write updated");
        commit_all(&repo, "update");

        let response = get_commit_diff_view_for_repo(
            &repo,
            &head_oid(&repo),
            Some(3),
            Some(false),
            Some("code.txt"),
        )
        .expect("commit diff view");

        let lines: Vec<&DiffLineView> = response.files[0]
            .hunks
            .iter()
            .flat_map(|hunk| hunk.lines.iter())
            .collect();

        let removed_header_like = lines
            .iter()
            .find(|line| line.text.contains("--- old sentinel"))
            .expect("removed line with --- prefix");
        assert_eq!(removed_header_like.kind, DiffLineKind::Remove);

        let added_header_like = lines
            .iter()
            .find(|line| line.text.contains("+++ new sentinel"))
            .expect("added line with +++ prefix");
        assert_eq!(added_header_like.kind, DiffLineKind::Add);

        let context_header_like = lines
            .iter()
            .find(|line| line.text.contains("index same sentinel"))
            .expect("context line with index prefix");
        assert_eq!(context_header_like.kind, DiffLineKind::Context);

        let removed_diff_like = lines
            .iter()
            .find(|line| line.text.contains("diff --git old sentinel"))
            .expect("removed line with diff --git prefix");
        assert_eq!(removed_diff_like.kind, DiffLineKind::Remove);

        let added_diff_like = lines
            .iter()
            .find(|line| line.text.contains("diff --git new sentinel"))
            .expect("added line with diff --git prefix");
        assert_eq!(added_diff_like.kind, DiffLineKind::Add);
    }

    #[test]
    fn commit_diff_view_path_filter_handles_nested_special_paths() {
        let repo = init_repo("diff-view-path-filter");
        let workdir = repo.workdir().expect("workdir");

        fs::create_dir_all(workdir.join("src/nested")).expect("create dirs");
        let target_path = "src/nested/special file 'one'.ts";
        fs::write(workdir.join(target_path), "const one = 1;\n").expect("write target");
        fs::write(workdir.join("src/other.ts"), "export const other = 1;\n").expect("write other");
        commit_all(&repo, "initial");

        fs::write(workdir.join(target_path), "const one = 2;\n").expect("update target");
        fs::write(workdir.join("src/other.ts"), "export const other = 2;\n").expect("update other");
        commit_all(&repo, "update");

        let response = get_commit_diff_view_for_repo(
            &repo,
            &head_oid(&repo),
            Some(3),
            Some(false),
            Some(target_path),
        )
        .expect("commit diff view");

        assert_eq!(response.files.len(), 1);
        assert_eq!(response.files[0].path, target_path);
    }

    #[test]
    fn commit_diff_view_respects_context_lines() {
        let repo = init_repo("diff-view-context-lines");
        let workdir = repo.workdir().expect("workdir");

        fs::write(
            workdir.join("context.txt"),
            "line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\n",
        )
        .expect("write initial");
        commit_all(&repo, "initial");

        fs::write(
            workdir.join("context.txt"),
            "line 1\nline 2\nline 3\nline FOUR\nline 5\nline 6\nline 7\n",
        )
        .expect("write updated");
        commit_all(&repo, "update");

        let base_args = (&repo, head_oid(&repo), Some(false), Some("context.txt"));

        let context_zero = get_commit_diff_view_for_repo(
            base_args.0,
            &base_args.1,
            Some(0),
            base_args.2,
            base_args.3,
        )
        .expect("context 0");
        let context_three = get_commit_diff_view_for_repo(
            base_args.0,
            &base_args.1,
            Some(3),
            base_args.2,
            base_args.3,
        )
        .expect("context 3");

        let count_context = |response: &DiffViewResponse| {
            response.files[0]
                .hunks
                .iter()
                .flat_map(|hunk| hunk.lines.iter())
                .filter(|line| line.kind == DiffLineKind::Context)
                .count()
        };

        let context_zero_count = count_context(&context_zero);
        let context_three_count = count_context(&context_three);

        assert_eq!(context_zero_count, 0);
        assert!(context_three_count > context_zero_count);
    }

    #[test]
    fn infer_repo_dir_name_handles_git_suffix_and_trailing_slash() {
        assert_eq!(
            infer_repo_dir_name("https://github.com/vicheanath/gitk-rs.git/").expect("name"),
            "gitk-rs"
        );
    }

    #[test]
    fn infer_repo_dir_name_rejects_invalid_url() {
        let err = infer_repo_dir_name("/").expect_err("should fail");
        assert!(err.contains("Could not infer") || err.contains("Invalid repository URL"));
    }

    #[test]
    fn github_api_bases_for_host_covers_public_and_enterprise() {
        let public = github_api_bases_for_host("github.com");
        assert_eq!(public, vec!["https://api.github.com".to_string()]);

        let enterprise = github_api_bases_for_host("git.example.com");
        assert_eq!(enterprise.len(), 2);
        assert!(enterprise[0].contains("api.git.example.com"));
        assert!(enterprise[1].contains("git.example.com/api/v3"));
    }

    #[test]
    fn build_tree_node_sorts_directories_before_files() {
        let repo = init_repo("tree-sort");
        let workdir = repo.workdir().expect("workdir");

        fs::create_dir_all(workdir.join("src/nested")).expect("create dirs");
        fs::write(workdir.join("src/lib.rs"), "pub fn a() {}\n").expect("write src file");
        fs::write(workdir.join("README.md"), "# readme\n").expect("write readme");

        commit_all(&repo, "initial");

        let head = repo.head().expect("head");
        let commit = repo
            .find_commit(head.target().expect("head target"))
            .expect("commit");
        let tree = commit.tree().expect("tree");

        let nodes = build_tree_node(&repo, &tree, "").expect("tree nodes");
        assert!(nodes.len() >= 2);

        assert_eq!(nodes[0].node_type, "tree");
        assert_eq!(nodes[0].name, "src");
        assert_eq!(nodes[1].node_type, "blob");
        assert_eq!(nodes[1].name, "README.md");
    }

    #[test]
    fn build_tree_node_populates_blob_size_and_path() {
        let repo = init_repo("tree-size");
        let workdir = repo.workdir().expect("workdir");

        fs::create_dir_all(workdir.join("docs")).expect("create docs dir");
        let content = "hello world\n";
        fs::write(workdir.join("docs/guide.txt"), content).expect("write file");

        commit_all(&repo, "docs");

        let head = repo.head().expect("head");
        let commit = repo
            .find_commit(head.target().expect("head target"))
            .expect("commit");
        let tree = commit.tree().expect("tree");

        let root = build_tree_node(&repo, &tree, "").expect("root nodes");
        let docs = root
            .iter()
            .find(|n| n.node_type == "tree" && n.name == "docs")
            .expect("docs tree");
        let children = docs.children.as_ref().expect("docs children");
        let guide = children
            .iter()
            .find(|n| n.node_type == "blob" && n.name == "guide.txt")
            .expect("guide blob");

        assert_eq!(guide.path, "docs/guide.txt");
        assert_eq!(guide.size, Some(content.len() as u64));
    }
}
