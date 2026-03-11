use crate::git_engine::graph::CommitGraph;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[allow(dead_code)]
pub struct GraphCache {
    cache: Arc<Mutex<HashMap<PathBuf, Arc<CommitGraph>>>>,
}

#[allow(dead_code)]
impl GraphCache {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn get(&self, path: &PathBuf) -> Option<Arc<CommitGraph>> {
        let cache = self.cache.lock().unwrap();
        cache.get(path).cloned()
    }

    pub fn insert(&self, path: PathBuf, graph: CommitGraph) {
        let mut cache = self.cache.lock().unwrap();
        cache.insert(path, Arc::new(graph));
    }

    pub fn invalidate(&self, path: &PathBuf) {
        let mut cache = self.cache.lock().unwrap();
        cache.remove(path);
    }

    pub fn clear(&self) {
        let mut cache = self.cache.lock().unwrap();
        cache.clear();
    }
}

impl Default for GraphCache {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use petgraph::Graph;
    use std::path::PathBuf;

    fn empty_graph() -> CommitGraph {
        CommitGraph {
            graph: Graph::new(),
        }
    }

    #[test]
    fn insert_and_get_returns_cached_graph() {
        let cache = GraphCache::new();
        let key = PathBuf::from("/tmp/repo-a");

        cache.insert(key.clone(), empty_graph());

        let hit = cache.get(&key);
        assert!(hit.is_some());
    }

    #[test]
    fn invalidate_removes_only_target_entry() {
        let cache = GraphCache::new();
        let key_a = PathBuf::from("/tmp/repo-a");
        let key_b = PathBuf::from("/tmp/repo-b");

        cache.insert(key_a.clone(), empty_graph());
        cache.insert(key_b.clone(), empty_graph());
        cache.invalidate(&key_a);

        assert!(cache.get(&key_a).is_none());
        assert!(cache.get(&key_b).is_some());
    }

    #[test]
    fn clear_removes_all_entries() {
        let cache = GraphCache::default();
        cache.insert(PathBuf::from("/tmp/repo-a"), empty_graph());
        cache.insert(PathBuf::from("/tmp/repo-b"), empty_graph());

        cache.clear();

        assert!(cache.get(&PathBuf::from("/tmp/repo-a")).is_none());
        assert!(cache.get(&PathBuf::from("/tmp/repo-b")).is_none());
    }
}

