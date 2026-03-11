import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Tag } from "../../types/git";
import { RefreshCw, Tag as TagIcon } from "lucide-react";

export default function TagList() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTags = () => {
    setLoading(true);
    setError(null);
    invoke<Tag[]>("get_tags")
      .then((data) => {
        setTags(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.toString());
        setLoading(false);
      });
  };

  useEffect(() => {
    loadTags();
  }, []);

  if (loading) {
    return <div className="sidebar-state">Loading tags...</div>;
  }

  if (error) {
    return <div className="sidebar-state error">Error: {error}</div>;
  }

  return (
    <div className="tag-list classic-gitk">
      <div className="tag-list-header">
        <h3>Tags ({tags.length})</h3>
        <div className="tag-list-actions">
          <button type="button" onClick={loadTags} title="Refresh Tags">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {tags.length === 0 ? (
        <div className="sidebar-state">No tags found</div>
      ) : (
        <ul className="tag-items">
          {tags.map((tag) => (
            <li key={tag.name} className="tag-item">
              <div className="tag-name-row">
                <span className="tag-name-icon">
                  <TagIcon size={12} />
                </span>
                <span className="tag-name">{tag.name}</span>
              </div>
              <div className="tag-commit">{tag.commit_id.substring(0, 8)}</div>
              {tag.message && <div className="tag-message">{tag.message}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

