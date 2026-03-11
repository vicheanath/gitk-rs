import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface CreateBranchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  fromCommit?: string;
}

export default function CreateBranchDialog({
  isOpen,
  onClose,
  onCreated,
  fromCommit,
}: CreateBranchDialogProps) {
  const [branchName, setBranchName] = useState("");
  const [from, setFrom] = useState(fromCommit || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) {
      setError("Branch name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await invoke("create_branch", {
        name: branchName.trim(),
        from: from.trim() || null,
      });
      setBranchName("");
      setFrom(fromCommit || "");
      onCreated();
      onClose();
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/55" onClick={onClose}>
      <div className="w-[min(520px,92vw)] rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-base font-semibold text-[var(--text-primary)]">Create Branch</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3 flex flex-col gap-1.5">
            <label htmlFor="branch-name" className="text-sm text-[var(--text-primary)]">Branch Name</label>
            <input
              id="branch-name"
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="feature/new-feature"
              autoFocus
              className="rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="mb-3 flex flex-col gap-1.5">
            <label htmlFor="from-commit" className="text-sm text-[var(--text-primary)]">From (optional)</label>
            <input
              id="from-commit"
              type="text"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="commit hash, branch, or tag"
              className="rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
            <small className="text-xs text-[var(--text-secondary)]">Leave empty to create from current HEAD</small>
          </div>
          {error && <div className="mb-2 text-sm text-[var(--danger)]">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={loading} className="rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-sm text-[var(--text-primary)] disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={loading || !branchName.trim()} className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[#0c1117] disabled:opacity-50">
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

