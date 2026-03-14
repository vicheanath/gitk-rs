import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Tag } from "../../types/git";
import { RefreshCw, Tag as TagIcon } from "lucide-react";

export default function TagList() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toolbarBtnClass =
    "inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50";
  const rowClass =
    "space-y-0.5 rounded px-1.5 py-1 text-[11px] transition-colors hover:bg-[var(--bg-secondary)]";

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
    return (
      <div className="space-y-2 px-1.5 pb-2">
        <div className="rounded bg-[var(--bg-secondary)] px-3 py-4 text-xs text-[var(--text-secondary)]">
          Loading tags...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2 px-1.5 pb-2">
        <div className="rounded bg-[var(--danger)]/10 px-2 py-1 text-xs text-[var(--danger)]">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-1.5 pb-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Tags
          </h3>
          <span className="text-[9px] text-[var(--text-muted)]">
            {tags.length} total
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={toolbarBtnClass}
            onClick={loadTags}
            title="Refresh Tags"
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      <section className="space-y-1.5 rounded bg-[var(--bg-secondary)] p-1.5">
        {tags.length === 0 ? (
          <div className="px-1.5 py-0.5 text-[11px] text-[var(--text-muted)]">
            No tags found
          </div>
        ) : (
          <ul className="space-y-0.5">
            {tags.map((tag) => (
              <li key={tag.name} className={rowClass}>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-3 w-3 items-center justify-center text-[var(--accent-primary)]">
                    <TagIcon size={11} />
                  </span>
                  <span className="truncate text-[11px] font-medium text-[var(--text-primary)]">
                    {tag.name}
                  </span>
                </div>
                <div className="font-mono text-[10px] text-[var(--text-muted)]">
                  {tag.commit_id.substring(0, 8)}
                </div>
                {tag.message ? (
                  <div className="line-clamp-2 text-[11px] text-[var(--text-secondary)]">
                    {tag.message}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
