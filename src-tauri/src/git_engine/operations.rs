use crate::git_engine::commit::CommitNode;
use git2::{build::CheckoutBuilder, BranchType, IndexAddOption, Repository, Signature, Status, StatusOptions};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

pub fn open_repo(path: &Path) -> anyhow::Result<Repository> {
    Repository::open(path).map_err(|e| anyhow::anyhow!("Failed to open repository: {}", e))
}

pub fn get_branches(repo: &Repository) -> anyhow::Result<Vec<BranchInfo>> {
    let mut branches = Vec::new();
    let head = repo.head()?;
    let head_name = head.shorthand().unwrap_or("").to_string();

    for branch_result in repo.branches(Some(BranchType::Local))? {
        let (branch, _branch_type) = branch_result?;
        let name = branch.name()?.unwrap_or("").to_string();
        let is_current = name == head_name;
        
        let commit = branch.get().peel_to_commit()?;
        
        branches.push(BranchInfo {
            name,
            is_current,
            is_remote: false,
            commit_id: commit.id().to_string(),
        });
    }

    for branch_result in repo.branches(Some(BranchType::Remote))? {
        let (branch, _) = branch_result?;
        let name = branch.name()?.unwrap_or("").to_string();
        
        let commit = branch.get().peel_to_commit()?;
        
        branches.push(BranchInfo {
            name,
            is_current: false,
            is_remote: true,
            commit_id: commit.id().to_string(),
        });
    }

    Ok(branches)
}

pub fn get_tags(repo: &Repository) -> anyhow::Result<Vec<TagInfo>> {
    let mut tags = Vec::new();
    
    repo.tag_foreach(|id, name| {
        let name_str = String::from_utf8_lossy(name);
        let tag_name = name_str.strip_prefix("refs/tags/").unwrap_or(&name_str).to_string();
        
        if let Ok(tag) = repo.find_tag(id) {
            let commit_id = tag.target_id().to_string();
            let message = tag.message().map(|s| s.to_string());
            tags.push(TagInfo {
                name: tag_name,
                commit_id,
                message,
            });
        } else if let Ok(commit) = repo.find_commit(id) {
            tags.push(TagInfo {
                name: tag_name,
                commit_id: commit.id().to_string(),
                message: None,
            });
        }
        
        true
    })?;

    Ok(tags)
}

pub fn checkout_branch(repo: &Repository, branch_name: &str) -> anyhow::Result<()> {
    let (object, reference) = repo.revparse_ext(branch_name)?;
    
    repo.checkout_tree(&object, None)?;
    
    if let Some(reference) = reference {
        repo.set_head(reference.name().unwrap())?;
    } else {
        repo.set_head_detached(object.id())?;
    }
    
    Ok(())
}

pub fn create_branch(repo: &Repository, branch_name: &str, from: Option<&str>) -> anyhow::Result<()> {
    let commit = if let Some(from_ref) = from {
        let (object, _) = repo.revparse_ext(from_ref)?;
        repo.find_commit(object.id())?
    } else {
        let head = repo.head()?;
        head.peel_to_commit()?
    };
    
    repo.branch(branch_name, &commit, false)?;
    Ok(())
}

pub fn delete_branch(repo: &Repository, branch_name: &str) -> anyhow::Result<()> {
    let mut branch = repo.find_branch(branch_name, BranchType::Local)?;
    branch.delete()?;
    Ok(())
}

fn map_status(status: Status, staged: bool) -> Option<String> {
    let mapped = if staged {
        if status.contains(Status::INDEX_NEW) {
            Some("added")
        } else if status.contains(Status::INDEX_MODIFIED) {
            Some("modified")
        } else if status.contains(Status::INDEX_DELETED) {
            Some("deleted")
        } else if status.contains(Status::INDEX_RENAMED) {
            Some("renamed")
        } else if status.contains(Status::INDEX_TYPECHANGE) {
            Some("typechange")
        } else {
            None
        }
    } else if status.contains(Status::WT_NEW) {
        Some("untracked")
    } else if status.contains(Status::WT_MODIFIED) {
        Some("modified")
    } else if status.contains(Status::WT_DELETED) {
        Some("deleted")
    } else if status.contains(Status::WT_RENAMED) {
        Some("renamed")
    } else if status.contains(Status::WT_TYPECHANGE) {
        Some("typechange")
    } else {
        None
    };

    mapped.map(str::to_string)
}

fn commit_signature(repo: &Repository) -> anyhow::Result<Signature<'_>> {
    match repo.signature() {
        Ok(signature) => Ok(signature),
        Err(_) => Signature::now("gitk-rs", "gitk-rs@example.com")
            .map_err(|e| anyhow::anyhow!("Failed to create commit signature: {}", e)),
    }
}

pub fn get_working_tree_status(repo: &Repository) -> anyhow::Result<Vec<WorkingTreeFile>> {
    let mut options = StatusOptions::new();
    options
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .renames_head_to_index(true)
        .renames_index_to_workdir(true)
        .include_ignored(false);

    let statuses = repo.statuses(Some(&mut options))?;
    let mut files = Vec::new();

    for entry in statuses.iter() {
        let status = entry.status();
        let path = entry
            .head_to_index()
            .and_then(|delta| delta.new_file().path().or_else(|| delta.old_file().path()))
            .or_else(|| {
                entry.index_to_workdir()
                    .and_then(|delta| delta.new_file().path().or_else(|| delta.old_file().path()))
            })
            .map(|path| path.to_string_lossy().to_string());

        let Some(path) = path else {
            continue;
        };

        files.push(WorkingTreeFile {
            path,
            staged: status.intersects(
                Status::INDEX_NEW
                    | Status::INDEX_MODIFIED
                    | Status::INDEX_DELETED
                    | Status::INDEX_RENAMED
                    | Status::INDEX_TYPECHANGE,
            ),
            unstaged: status.intersects(
                Status::WT_NEW
                    | Status::WT_MODIFIED
                    | Status::WT_DELETED
                    | Status::WT_RENAMED
                    | Status::WT_TYPECHANGE,
            ),
            conflicted: status.contains(Status::CONFLICTED),
            staged_status: map_status(status, true),
            unstaged_status: map_status(status, false),
        });
    }

    files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(files)
}

pub fn stage_paths(repo: &Repository, paths: &[String]) -> anyhow::Result<()> {
    let mut index = repo.index()?;

    for path in paths {
        let repo_path = Path::new(path);
        let status = repo.status_file(repo_path).unwrap_or(Status::empty());

        if status.contains(Status::WT_DELETED) {
            index.remove_path(repo_path)?;
        } else {
            index.add_path(repo_path)?;
        }
    }

    index.write()?;
    Ok(())
}

pub fn stage_all(repo: &Repository) -> anyhow::Result<()> {
    let mut index = repo.index()?;
    index.add_all(["*"], IndexAddOption::DEFAULT, None)?;
    index.write()?;
    Ok(())
}

pub fn unstage_paths(repo: &Repository, paths: &[String]) -> anyhow::Result<()> {
    if paths.is_empty() {
        return Ok(());
    }

    if let Ok(head) = repo.head() {
        let target = head.peel_to_commit()?.into_object();
        let pathspecs: Vec<&Path> = paths.iter().map(Path::new).collect();
        repo.reset_default(Some(&target), pathspecs)?;
        return Ok(());
    }

    let mut index = repo.index()?;
    for path in paths {
        let _ = index.remove_path(Path::new(path));
    }
    index.write()?;

    Ok(())
}

pub fn unstage_all(repo: &Repository) -> anyhow::Result<()> {
    let status = get_working_tree_status(repo)?;
    let paths: Vec<String> = status
        .into_iter()
        .filter(|file| file.staged)
        .map(|file| file.path)
        .collect();

    unstage_paths(repo, &paths)
}

fn remove_workdir_path(repo: &Repository, path: &str) -> anyhow::Result<()> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| anyhow::anyhow!("Repository does not have a working directory"))?;
    let absolute = workdir.join(path);

    if !absolute.exists() {
      return Ok(());
    }

    if absolute.is_dir() {
        fs::remove_dir_all(&absolute)?;
    } else {
        fs::remove_file(&absolute)?;
    }

    Ok(())
}

pub fn discard_paths(repo: &Repository, paths: &[String]) -> anyhow::Result<()> {
    for path in paths {
        let repo_path = Path::new(path);
        let status = repo.status_file(repo_path).unwrap_or(Status::empty());

        if status.contains(Status::WT_NEW) && !status.intersects(
            Status::INDEX_NEW
                | Status::INDEX_MODIFIED
                | Status::INDEX_DELETED
                | Status::INDEX_RENAMED
                | Status::INDEX_TYPECHANGE,
        ) {
            remove_workdir_path(repo, path)?;
            continue;
        }

        let mut checkout = CheckoutBuilder::new();
        checkout.force().path(repo_path);

        if status.intersects(
            Status::INDEX_NEW
                | Status::INDEX_MODIFIED
                | Status::INDEX_DELETED
                | Status::INDEX_RENAMED
                | Status::INDEX_TYPECHANGE,
        ) {
            let mut index = repo.index()?;
            repo.checkout_index(Some(&mut index), Some(&mut checkout))?;
        } else {
            repo.checkout_head(Some(&mut checkout))?;
        }
    }

    Ok(())
}

pub fn discard_all(repo: &Repository) -> anyhow::Result<()> {
    let status = get_working_tree_status(repo)?;
    let paths: Vec<String> = status
        .into_iter()
        .filter(|file| file.unstaged && !file.staged)
        .map(|file| file.path)
        .collect();

    discard_paths(repo, &paths)
}

pub fn commit_staged(repo: &Repository, message: &str) -> anyhow::Result<String> {
    let message = message.trim();
    if message.is_empty() {
        anyhow::bail!("Commit message is required");
    }

    let status = get_working_tree_status(repo)?;
    if !status.iter().any(|file| file.staged) {
        anyhow::bail!("No staged changes to commit");
    }

    let mut index = repo.index()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;
    let signature = commit_signature(repo)?;

    let commit_oid = match repo.head() {
        Ok(head) => {
            let parent = head.peel_to_commit()?;
            repo.commit(Some("HEAD"), &signature, &signature, message, &tree, &[&parent])?
        }
        Err(_) => repo.commit(Some("HEAD"), &signature, &signature, message, &tree, &[])?
    };

    index.write()?;
    Ok(commit_oid.to_string())
}

pub fn get_working_tree_diff(
    repo: &Repository,
    path: Option<&str>,
    staged: bool,
    context_lines: Option<usize>,
    ignore_whitespace: Option<bool>,
) -> anyhow::Result<String> {
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
        let index = repo.index()?;
        match repo.head() {
            Ok(head) => {
                let tree = head.peel_to_tree()?;
                repo.diff_tree_to_index(Some(&tree), Some(&index), Some(&mut diff_opts))?
            }
            Err(_) => repo.diff_tree_to_index(None, Some(&index), Some(&mut diff_opts))?,
        }
    } else {
        let index = repo.index()?;
        repo.diff_index_to_workdir(Some(&index), Some(&mut diff_opts))?
    };

    let mut diff_text = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        if let Ok(content) = std::str::from_utf8(line.content()) {
            diff_text.push_str(content);
        }
        true
    })?;

    Ok(diff_text)
}

pub fn search_commits(repo: &Repository, query: &str, max_results: usize) -> anyhow::Result<Vec<CommitNode>> {
    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;
    
    let query_lower = query.to_lowercase();
    let mut results = Vec::new();
    
    for oid in revwalk {
        if results.len() >= max_results {
            break;
        }
        let oid = oid?;
        let commit = repo.find_commit(oid)?;
        let message = commit.message().unwrap_or("").to_lowercase();
        
        if message.contains(&query_lower) {
            results.push(CommitNode::from_commit(&commit));
        }
    }
    
    Ok(results)
}

/// Get all branches that contain the given commit
pub fn get_branches_containing_commit(repo: &Repository, commit_id: &str) -> anyhow::Result<Vec<String>> {
    let commit_oid = git2::Oid::from_str(commit_id)?;
    let mut branches = Vec::new();
    
    // Check local branches
    for branch_result in repo.branches(Some(BranchType::Local))? {
        let (branch, _) = branch_result?;
        let branch_name = branch.name()?.unwrap_or("").to_string();
        
        if let Ok(branch_commit) = branch.get().peel_to_commit() {
            // Check if the commit is reachable from this branch
            if let Ok(_) = repo.merge_base(branch_commit.id(), commit_oid) {
                // If merge_base succeeds, check if commit is actually in the branch history
                let mut revwalk = repo.revwalk()?;
                revwalk.push(branch_commit.id())?;
                
                for oid in revwalk {
                    if let Ok(oid) = oid {
                        if oid == commit_oid {
                            branches.push(branch_name);
                            break;
                        }
                    }
                }
            }
        }
    }
    
    // Check remote branches
    for branch_result in repo.branches(Some(BranchType::Remote))? {
        let (branch, _) = branch_result?;
        let branch_name = branch.name()?.unwrap_or("").to_string();
        
        if let Ok(branch_commit) = branch.get().peel_to_commit() {
            if let Ok(_) = repo.merge_base(branch_commit.id(), commit_oid) {
                let mut revwalk = repo.revwalk()?;
                revwalk.push(branch_commit.id())?;
                
                for oid in revwalk {
                    if let Ok(oid) = oid {
                        if oid == commit_oid {
                            branches.push(branch_name);
                            break;
                        }
                    }
                }
            }
        }
    }
    
    Ok(branches)
}

/// Get tags that precede (come before) the given commit
pub fn get_tags_preceding_commit(repo: &Repository, commit_id: &str) -> anyhow::Result<Vec<String>> {
    let commit_oid = git2::Oid::from_str(commit_id)?;
    let commit = repo.find_commit(commit_oid)?;
    let commit_time = commit.time().seconds();
    let mut preceding_tags = Vec::new();
    
    repo.tag_foreach(|tag_id, name| {
        let name_str = String::from_utf8_lossy(name);
        let tag_name = name_str.strip_prefix("refs/tags/").unwrap_or(&name_str).to_string();
        
        if let Ok(tag) = repo.find_tag(tag_id) {
            if let Ok(tag_commit) = repo.find_commit(tag.target_id()) {
                // Tag is before commit if its time is earlier
                if tag_commit.time().seconds() < commit_time {
                    // Check if tag is actually in the commit's history
                    if let Ok(_) = repo.merge_base(commit_oid, tag.target_id()) {
                        preceding_tags.push(tag_name);
                    }
                }
            }
        } else if let Ok(tag_commit) = repo.find_commit(tag_id) {
            if tag_commit.time().seconds() < commit_time {
                if let Ok(_) = repo.merge_base(commit_oid, tag_id) {
                    preceding_tags.push(tag_name);
                }
            }
        }
        
        true
    })?;
    
    Ok(preceding_tags)
}

/// Get tags that follow (come after) the given commit
pub fn get_tags_following_commit(repo: &Repository, commit_id: &str) -> anyhow::Result<Vec<String>> {
    let commit_oid = git2::Oid::from_str(commit_id)?;
    let commit = repo.find_commit(commit_oid)?;
    let commit_time = commit.time().seconds();
    let mut following_tags = Vec::new();
    
    repo.tag_foreach(|tag_id, name| {
        let name_str = String::from_utf8_lossy(name);
        let tag_name = name_str.strip_prefix("refs/tags/").unwrap_or(&name_str).to_string();
        
        if let Ok(tag) = repo.find_tag(tag_id) {
            if let Ok(tag_commit) = repo.find_commit(tag.target_id()) {
                // Tag is after commit if its time is later
                if tag_commit.time().seconds() > commit_time {
                    // Check if commit is in the tag's history
                    if let Ok(_) = repo.merge_base(tag.target_id(), commit_oid) {
                        following_tags.push(tag_name);
                    }
                }
            }
        } else if let Ok(tag_commit) = repo.find_commit(tag_id) {
            if tag_commit.time().seconds() > commit_time {
                if let Ok(_) = repo.merge_base(tag_id, commit_oid) {
                    following_tags.push(tag_name);
                }
            }
        }
        
        true
    })?;
    
    Ok(following_tags)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub commit_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TagInfo {
    pub name: String,
    pub commit_id: String,
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkingTreeFile {
    pub path: String,
    pub staged: bool,
    pub unstaged: bool,
    pub conflicted: bool,
    pub staged_status: Option<String>,
    pub unstaged_status: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::Oid;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn make_temp_repo_path(test_name: &str) -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time went backwards")
            .as_nanos();
        std::env::temp_dir().join(format!("gitk-rs-ops-{test_name}-{nanos}"))
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
        index.add_path(Path::new(file_name)).expect("add path");
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
                    .expect("create commit")
            }
            Err(_) => repo
                .commit(Some("HEAD"), &sig, &sig, message, &tree, &[])
                .expect("create initial commit"),
        }
    }

    #[test]
    fn map_status_returns_expected_labels() {
        assert_eq!(map_status(Status::INDEX_NEW, true), Some("added".to_string()));
        assert_eq!(
            map_status(Status::INDEX_MODIFIED, true),
            Some("modified".to_string())
        );
        assert_eq!(
            map_status(Status::WT_NEW, false),
            Some("untracked".to_string())
        );
        assert_eq!(
            map_status(Status::WT_DELETED, false),
            Some("deleted".to_string())
        );
        assert_eq!(map_status(Status::empty(), true), None);
    }

    #[test]
    fn open_repo_errors_for_missing_path() {
        let bad_path = Path::new("/definitely/not/a/repo/path");
        let result = open_repo(bad_path);
        assert!(result.is_err());
    }

    #[test]
    fn working_tree_status_is_sorted_by_path() {
        let repo = init_repo("status-sorted");
        let workdir = repo.workdir().expect("workdir");
        fs::write(workdir.join("z_file.txt"), "z").expect("write z");
        fs::write(workdir.join("a_file.txt"), "a").expect("write a");

        let status = get_working_tree_status(&repo).expect("status");
        let paths: Vec<String> = status.into_iter().map(|f| f.path).collect();

        assert_eq!(paths, vec!["a_file.txt".to_string(), "z_file.txt".to_string()]);
    }

    #[test]
    fn search_commits_respects_query_and_limit() {
        let repo = init_repo("search");
        commit_file(&repo, "a.txt", "one", "initial setup");
        commit_file(&repo, "a.txt", "two", "fix search behavior");
        commit_file(&repo, "a.txt", "three", "fix another bug");

        let results = search_commits(&repo, "fix", 1).expect("search commits");
        assert_eq!(results.len(), 1);
        assert!(results[0].message.to_lowercase().contains("fix"));
    }

    #[test]
    fn commit_staged_rejects_empty_message() {
        let repo = init_repo("commit-empty-message");
        let err = commit_staged(&repo, "   ").expect_err("expected message validation error");
        assert!(err.to_string().contains("Commit message is required"));
    }

    #[test]
    fn commit_staged_requires_staged_changes() {
        let repo = init_repo("commit-no-staged");
        commit_file(&repo, "a.txt", "one", "initial commit");

        let err = commit_staged(&repo, "new commit").expect_err("expected staged changes validation");
        assert!(err.to_string().contains("No staged changes to commit"));
    }

    #[test]
    fn stage_then_unstage_path_updates_status_flags() {
        let repo = init_repo("stage-unstage");
        commit_file(&repo, "a.txt", "one", "initial commit");

        let workdir = repo.workdir().expect("workdir");
        fs::write(workdir.join("a.txt"), "two").expect("modify file");

        stage_paths(&repo, &["a.txt".to_string()]).expect("stage path");
        let staged_status = get_working_tree_status(&repo).expect("status after stage");
        let staged = staged_status
            .iter()
            .find(|f| f.path == "a.txt")
            .expect("status entry");
        assert!(staged.staged);

        unstage_paths(&repo, &["a.txt".to_string()]).expect("unstage path");
        let unstaged_status = get_working_tree_status(&repo).expect("status after unstage");
        let unstaged = unstaged_status
            .iter()
            .find(|f| f.path == "a.txt")
            .expect("status entry");
        assert!(!unstaged.staged);
        assert!(unstaged.unstaged);
    }

    #[test]
    fn unstaged_diff_contains_patch_content() {
        let repo = init_repo("unstaged-diff");
        commit_file(&repo, "a.txt", "one", "initial commit");

        let workdir = repo.workdir().expect("workdir");
        fs::write(workdir.join("a.txt"), "two").expect("modify file");

        let diff = get_working_tree_diff(&repo, Some("a.txt"), false, Some(3), Some(false))
            .expect("generate unstaged diff");

        assert!(diff.contains("diff --git"));
        assert!(diff.contains("a.txt"));
    }
}

