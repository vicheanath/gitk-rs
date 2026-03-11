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
        }
    }
}

