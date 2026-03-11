use crate::git_engine::graph::CommitGraph;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

pub struct GraphCache {
    cache: Arc<Mutex<HashMap<PathBuf, Arc<CommitGraph>>>>,
}

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

