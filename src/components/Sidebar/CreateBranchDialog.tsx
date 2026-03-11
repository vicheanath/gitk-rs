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
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Create Branch</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="branch-name">Branch Name</label>
            <input
              id="branch-name"
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="feature/new-feature"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="from-commit">From (optional)</label>
            <input
              id="from-commit"
              type="text"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="commit hash, branch, or tag"
            />
            <small>Leave empty to create from current HEAD</small>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="dialog-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" disabled={loading || !branchName.trim()}>
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

