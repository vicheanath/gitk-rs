use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitNode {
    pub id: String,
    pub parents: Vec<String>,
    pub author: String,
    pub email: String,
    pub message: String,
    pub time: i64,
    pub summary: String,
    pub graph_row: Option<usize>,
    pub graph_col: Option<usize>,
}

impl CommitNode {
    pub fn from_commit(commit: &git2::Commit) -> Self {
        let author = commit.author();
        let message = commit.message().unwrap_or("");
        let summary = message.lines().next().unwrap_or("").to_string();

        Self {
            id: commit.id().to_string(),
            parents: commit.parent_ids().map(|id| id.to_string()).collect(),
            author: author.name().unwrap_or("").to_string(),
            email: author.email().unwrap_or("").to_string(),
            message: message.to_string(),
            time: author.when().seconds(),
            summary,
            graph_row: None,
            graph_col: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::{Oid, Repository, Signature};
    use std::fs;
    use std::path::Path;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn make_temp_repo_path(test_name: &str) -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time went backwards")
            .as_nanos();
        std::env::temp_dir().join(format!("gitk-rs-commit-{test_name}-{nanos}"))
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
    fn from_commit_uses_first_line_as_summary() {
        let repo = init_repo("summary");
        let oid = commit_file(&repo, "a.txt", "one", "title line\nbody line");
        let commit = repo.find_commit(oid).expect("find commit");

        let node = CommitNode::from_commit(&commit);
        assert_eq!(node.summary, "title line");
        assert_eq!(node.message, "title line\nbody line");
    }

    #[test]
    fn from_commit_collects_parent_ids() {
        let repo = init_repo("parents");
        let p1 = commit_file(&repo, "a.txt", "one", "first");
        let p2 = commit_file(&repo, "a.txt", "two", "second");
        let commit = repo.find_commit(p2).expect("find commit");

        let node = CommitNode::from_commit(&commit);
        assert_eq!(node.parents, vec![p1.to_string()]);
    }
}
