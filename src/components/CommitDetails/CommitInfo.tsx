import { useMemo, useState } from "react";
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
  const [messageExpanded, setMessageExpanded] = useState(false);

  const messageStats = useMemo(() => {
    const lines = message.split("\n");
    const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
    return {
      lineCount: lines.length,
      charCount: message.length,
      isLong: lines.length > 10 || message.length > 800 || longestLine > 180,
    };
  }, [message]);

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
    <div className="flex shrink-0 flex-col gap-2 bg-[var(--bg-primary)] px-1.5 py-1">
      {/* Header */}
      <div className="px-1 py-1.5">
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
            <span className="rounded-sm bg-[color-mix(in_srgb,var(--success)_16%,transparent)] px-1 text-[var(--success)]">+{additions}</span>
            <span className="rounded-sm bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] px-1 text-[var(--danger)]">-{deletions}</span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="px-1 pb-1">
        <div className="space-y-2">
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
            <div className="min-w-0" style={{ marginLeft: `${graphWidth}px` }}>
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                <span className="rounded bg-[var(--bg-primary)] px-1.5 py-0.5">{messageStats.lineCount} lines</span>
                <span className="rounded bg-[var(--bg-primary)] px-1.5 py-0.5">{messageStats.charCount} chars</span>
                {messageStats.isLong && (
                  <span className="rounded bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] px-1.5 py-0.5 text-[var(--accent)]">
                    long message
                  </span>
                )}
              </div>
              <pre
                className="whitespace-pre-wrap break-words rounded bg-[var(--bg-primary)] px-2 py-1.5 text-[var(--text-primary)]"
                style={{
                  maxHeight: messageStats.isLong && !messageExpanded ? "8.5rem" : "20rem",
                  overflowY: "auto",
                }}
              >
                {message}
              </pre>
              {messageStats.isLong && (
                <div className="mt-1.5 flex items-center justify-end">
                  <Button
                    type="button"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => setMessageExpanded(expanded => !expanded)}
                    title={messageExpanded ? "Collapse commit message" : "Expand commit message"}
                  >
                    {messageExpanded ? "Show less" : "Show full message"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
