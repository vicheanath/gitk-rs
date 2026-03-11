use crate::app_core::AppState;
use crate::auth::{self, AuthConnection, AuthConnectionInput};
use crate::git_engine::operations::{open_repo, BranchInfo, TagInfo, WorkingTreeFile};
use crate::git_engine::{build_commit_graph, CommitNode};
use git2::Repository;
use reqwest::blocking::Client;
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

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))
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
    let normalized = host.trim().trim_start_matches("https://").trim_start_matches("http://").trim_end_matches('/');

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

