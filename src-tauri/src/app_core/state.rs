use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone)]
pub struct AppState {
    pub repo_path: Option<PathBuf>,
    pub selected_commit: Option<String>,
    pub active_branch: Option<String>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            repo_path: None,
            selected_commit: None,
            active_branch: None,
        }
    }
}

pub type SharedAppState = Arc<Mutex<AppState>>;

