import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Tag } from "../../types/git";

export default function TagList() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

  if (loading) {
    return <div className="tag-list">Loading tags...</div>;
  }

  if (error) {
    return <div className="tag-list error">Error: {error}</div>;
  }

  return (
    <div className="tag-list">
      <h3>Tags ({tags.length})</h3>
      <ul className="tag-items">
        {tags.map((tag) => (
          <li key={tag.name} className="tag-item">
            <div className="tag-name">{tag.name}</div>
            <div className="tag-commit">{tag.commit_id.substring(0, 8)}</div>
            {tag.message && <div className="tag-message">{tag.message}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

