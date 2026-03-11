use rusqlite::{params, Connection, Result as SqlResult};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct SqliteCache {
    conn: Mutex<Connection>,
}

fn cache_db_path() -> PathBuf {
    let base = dirs::data_dir()
        .unwrap_or_else(|| std::env::temp_dir());
    base.join("gitk-rs").join("cache.db")
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn init_schema(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS commit_graph_cache (
            repo_path   TEXT NOT NULL,
            head_oid    TEXT NOT NULL,
            max_commits INTEGER NOT NULL,
            data        TEXT NOT NULL,
            cached_at   INTEGER NOT NULL,
            PRIMARY KEY (repo_path, head_oid, max_commits)
        );
        CREATE TABLE IF NOT EXISTS commit_details_cache (
            commit_oid  TEXT PRIMARY KEY,
            data        TEXT NOT NULL,
            cached_at   INTEGER NOT NULL
        );",
    )
}

impl SqliteCache {
    pub fn open() -> Result<Self, String> {
        let path = cache_db_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create cache directory: {e}"))?;
        }
        let conn = Connection::open(&path)
            .map_err(|e| format!("Failed to open cache DB: {e}"))?;
        // Enable WAL mode for better concurrent read performance
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")
            .map_err(|e| format!("Failed to set WAL mode: {e}"))?;
        init_schema(&conn)
            .map_err(|e| format!("Failed to init cache schema: {e}"))?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    // --- Commit graph cache ---

    pub fn get_commit_graph(
        &self,
        repo_path: &str,
        head_oid: &str,
        max_commits: usize,
    ) -> Option<String> {
        let conn = self.conn.lock().ok()?;
        conn.query_row(
            "SELECT data FROM commit_graph_cache
             WHERE repo_path = ?1 AND head_oid = ?2 AND max_commits = ?3",
            params![repo_path, head_oid, max_commits as i64],
            |row| row.get::<_, String>(0),
        )
        .ok()
    }

    pub fn put_commit_graph(
        &self,
        repo_path: &str,
        head_oid: &str,
        max_commits: usize,
        data: &str,
    ) {
        let Ok(conn) = self.conn.lock() else { return };
        let _ = conn.execute(
            "INSERT OR REPLACE INTO commit_graph_cache
             (repo_path, head_oid, max_commits, data, cached_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![repo_path, head_oid, max_commits as i64, data, now_secs()],
        );
        // Prune stale entries for the same (repo, max_commits) with a different head
        let _ = conn.execute(
            "DELETE FROM commit_graph_cache
             WHERE repo_path = ?1 AND max_commits = ?2 AND head_oid != ?3",
            params![repo_path, max_commits as i64, head_oid],
        );
    }

    pub fn invalidate_graph_for_repo(&self, repo_path: &str) {
        let Ok(conn) = self.conn.lock() else { return };
        let _ = conn.execute(
            "DELETE FROM commit_graph_cache WHERE repo_path = ?1",
            params![repo_path],
        );
    }

    // --- Commit details cache ---

    pub fn get_commit_details(&self, commit_oid: &str) -> Option<String> {
        let conn = self.conn.lock().ok()?;
        conn.query_row(
            "SELECT data FROM commit_details_cache WHERE commit_oid = ?1",
            params![commit_oid],
            |row| row.get::<_, String>(0),
        )
        .ok()
    }

    pub fn put_commit_details(&self, commit_oid: &str, data: &str) {
        let Ok(conn) = self.conn.lock() else { return };
        let _ = conn.execute(
            "INSERT OR IGNORE INTO commit_details_cache
             (commit_oid, data, cached_at) VALUES (?1, ?2, ?3)",
            params![commit_oid, data, now_secs()],
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn in_memory_cache() -> SqliteCache {
        let conn = Connection::open_in_memory().expect("in-memory db");
        init_schema(&conn).expect("schema");
        SqliteCache {
            conn: Mutex::new(conn),
        }
    }

    #[test]
    fn put_and_get_commit_graph_returns_cached_data() {
        let cache = in_memory_cache();
        cache.put_commit_graph("/repo/a", "abc123", 1000, r#"{"nodes":[],"edges":[]}"#);
        let data = cache.get_commit_graph("/repo/a", "abc123", 1000);
        assert_eq!(data.as_deref(), Some(r#"{"nodes":[],"edges":[]}"#));
    }

    #[test]
    fn cache_miss_on_different_head_oid() {
        let cache = in_memory_cache();
        cache.put_commit_graph("/repo/a", "abc123", 1000, "data");
        let miss = cache.get_commit_graph("/repo/a", "def456", 1000);
        assert!(miss.is_none());
    }

    #[test]
    fn put_graph_prunes_old_head_entries() {
        let cache = in_memory_cache();
        cache.put_commit_graph("/repo/a", "old000", 1000, "old data");
        // inserting a new head for the same repo/max_commits should evict the old one
        cache.put_commit_graph("/repo/a", "new111", 1000, "new data");
        assert!(cache.get_commit_graph("/repo/a", "old000", 1000).is_none());
        assert!(cache.get_commit_graph("/repo/a", "new111", 1000).is_some());
    }

    #[test]
    fn put_and_get_commit_details() {
        let cache = in_memory_cache();
        cache.put_commit_details("deadbeef", r#"{"id":"deadbeef"}"#);
        let data = cache.get_commit_details("deadbeef");
        assert_eq!(data.as_deref(), Some(r#"{"id":"deadbeef"}"#));
    }

    #[test]
    fn commit_details_not_overwritten_on_second_put() {
        let cache = in_memory_cache();
        // Commits are immutable; INSERT OR IGNORE means later puts are no-ops
        cache.put_commit_details("abc", "original");
        cache.put_commit_details("abc", "changed");
        assert_eq!(cache.get_commit_details("abc").as_deref(), Some("original"));
    }

    #[test]
    fn invalidate_graph_removes_all_entries_for_repo() {
        let cache = in_memory_cache();
        cache.put_commit_graph("/repo/a", "h1", 100, "d");
        cache.put_commit_graph("/repo/a", "h2", 500, "d");
        cache.invalidate_graph_for_repo("/repo/a");
        assert!(cache.get_commit_graph("/repo/a", "h1", 100).is_none());
        assert!(cache.get_commit_graph("/repo/a", "h2", 500).is_none());
    }
}
