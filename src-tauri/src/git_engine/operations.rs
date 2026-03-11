use crate::git_engine::commit::CommitNode;
use git2::{BranchType, Repository};
use serde::{Deserialize, Serialize};
use std::path::Path;

pub fn open_repo(path: &Path) -> anyhow::Result<Repository> {
    Repository::open(path).map_err(|e| anyhow::anyhow!("Failed to open repository: {}", e))
}

pub fn get_commits(repo: &Repository, max_count: usize) -> anyhow::Result<Vec<CommitNode>> {
    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;
    
    let mut commits = Vec::new();
    for (i, oid) in revwalk.enumerate() {
        if i >= max_count {
            break;
        }
        let oid = oid?;
        let commit = repo.find_commit(oid)?;
        commits.push(CommitNode::from_commit(&commit));
    }
    
    Ok(commits)
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

