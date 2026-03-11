import { useState } from "react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

interface CommitInfoProps {
  id: string;
  author: string;
  email: string;
  committer: string;
  committer_email: string;
  message: string;
  rowNumber: number;
  totalCommits: number;
  formattedDate: string;
  additions: number;
  deletions: number;
  graphWidth?: number;
}

export default function CommitInfo({
  id,
  author,
  email,
  committer,
  committer_email,
  message,
  rowNumber,
  totalCommits,
  formattedDate,
  additions,
  deletions,
  graphWidth = 0,
}: CommitInfoProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const handleCopySha = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = id;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1400);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 1800);
    }
  };

  return (
    <div className="flex shrink-0 flex-col gap-1.5 bg-[var(--bg-primary)] p-1.5">
      {/* Header */}
      <div className="rounded-md bg-[color-mix(in_srgb,var(--bg-secondary)_80%,transparent)] px-2 py-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Commit</span>
            <span className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-primary)]">
              {id.substring(0, 8)}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">{rowNumber}/{totalCommits}</span>
            <Button
              type="button"
              size="sm"
              className={cn(
                "h-6 text-[10px]",
                copyState === "copied" && "text-[var(--success)]",
                copyState === "failed" && "text-[var(--danger)]"
              )}
              onClick={handleCopySha}
              title="Copy full commit SHA"
            >
              {copyState === "copied"
                ? "Copied"
                : copyState === "failed"
                  ? "Copy failed"
                  : "Copy SHA"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1 text-xs text-[var(--text-secondary)]">
            <span>{author}</span>
            <span>•</span>
            <span>{formattedDate}</span>
            <span>•</span>
            <span className="text-[var(--success)]">+{additions}</span>
            <span className="text-[var(--danger)]">-{deletions}</span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-md bg-[color-mix(in_srgb,var(--bg-secondary)_72%,transparent)] p-2">
        <div className="space-y-1.5">
          <div className="grid grid-cols-[78px_1fr] gap-1.5 text-xs">
            <span className="uppercase tracking-wide text-[var(--text-muted)]">SHA</span>
            <code className="overflow-x-auto rounded bg-[var(--bg-primary)] px-1.5 py-1 font-mono text-[var(--text-primary)]">
              {id}
            </code>
          </div>
          <div className="grid grid-cols-[78px_1fr] gap-1.5 text-xs">
            <span className="uppercase tracking-wide text-[var(--text-muted)]">Author</span>
            <span className="text-[var(--text-primary)]">
              {author} &lt;{email}&gt;
            </span>
          </div>
          <div className="grid grid-cols-[78px_1fr] gap-1.5 text-xs">
            <span className="uppercase tracking-wide text-[var(--text-muted)]">Committer</span>
            <span className="text-[var(--text-primary)]">
              {committer} &lt;{committer_email}&gt;
            </span>
          </div>
          <div className="grid grid-cols-[78px_1fr] gap-1.5 text-xs">
            <span className="uppercase tracking-wide text-[var(--text-muted)]">Message</span>
            <pre
              className="whitespace-pre-wrap rounded bg-[var(--bg-primary)] px-2 py-1.5 text-[var(--text-primary)]"
              style={{ marginLeft: `${graphWidth}px` }}
            >
              {message}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
