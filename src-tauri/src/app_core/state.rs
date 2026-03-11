use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct AppState {
    pub repo_path: Option<PathBuf>,
    pub active_branch: Option<String>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            repo_path: None,
            active_branch: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_state_is_empty() {
        let state = AppState::default();
        assert!(state.repo_path.is_none());
        assert!(state.active_branch.is_none());
    }

    #[test]
    fn state_is_cloneable() {
        let state = AppState {
            repo_path: Some(PathBuf::from("/tmp/repo")),
            active_branch: Some("main".to_string()),
        };

        let cloned = state.clone();
        assert_eq!(cloned.repo_path, state.repo_path);
        assert_eq!(cloned.active_branch, state.active_branch);
    }
}

