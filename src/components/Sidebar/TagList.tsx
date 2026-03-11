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
    return <div className="px-2 py-4 text-xs text-(--text-secondary)">Loading tags...</div>;
  }

  if (error) {
    return <div className="px-2 py-4 text-xs text-(--danger)">Error: {error}</div>;
  }

  return (
    <div className="space-y-2 px-2 pb-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-(--text-secondary)">
          Tags ({tags.length})
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-(--border-primary) bg-(--bg-tertiary) text-(--text-primary) transition-colors hover:bg-(--bg-secondary)"
            onClick={loadTags}
            title="Refresh Tags"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {tags.length === 0 ? (
        <div className="rounded border border-dashed border-(--border-primary) px-3 py-4 text-xs text-(--text-secondary)">
          No tags found
        </div>
      ) : (
        <ul className="space-y-1">
          {tags.map((tag) => (
            <li
              key={tag.name}
              className="space-y-0.5 rounded border border-(--border-primary) bg-(--bg-secondary) px-2 py-1"
            >
              <div className="flex items-center gap-1.5">
                <span className="inline-flex h-3 w-3 items-center justify-center text-(--accent-primary)">
                  <TagIcon size={12} />
                </span>
                <span className="truncate text-xs font-medium text-(--text-primary)">{tag.name}</span>
              </div>
              <div className="font-mono text-[10px] text-(--text-muted)">
                {tag.commit_id.substring(0, 8)}
              </div>
              {tag.message && (
                <div className="line-clamp-2 text-[11px] text-(--text-secondary)">{tag.message}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

