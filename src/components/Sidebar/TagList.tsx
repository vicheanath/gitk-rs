import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Tag } from "../../types/git";
import { RefreshCw, Tag as TagIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

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
    return <div className="px-2 py-4 text-xs text-[var(--text-secondary)]">Loading tags...</div>;
  }

  if (error) {
    return <div className="px-2 py-4 text-xs text-[var(--danger)]">Error: {error}</div>;
  }

  return (
    <Card className="space-y-2 p-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Tags ({tags.length})
        </h3>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            onClick={loadTags}
            title="Refresh Tags"
          >
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {tags.length === 0 ? (
        <div className="rounded border border-dashed border-[var(--border-primary)] px-3 py-4 text-xs text-[var(--text-secondary)]">
          No tags found
        </div>
      ) : (
        <ul className="space-y-1">
          {tags.map((tag) => (
            <li
              key={tag.name}
              className="space-y-0.5 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2 py-1"
            >
              <div className="flex items-center gap-1.5">
                <span className="inline-flex h-3 w-3 items-center justify-center text-[var(--accent-primary)]">
                  <TagIcon size={12} />
                </span>
                <span className="truncate text-xs font-medium text-[var(--text-primary)]">{tag.name}</span>
              </div>
              <div className="font-mono text-[10px] text-[var(--text-muted)]">
                {tag.commit_id.substring(0, 8)}
              </div>
              {tag.message && (
                <div className="line-clamp-2 text-[11px] text-[var(--text-secondary)]">{tag.message}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

