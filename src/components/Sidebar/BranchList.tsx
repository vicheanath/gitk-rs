import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Branch } from "../../types/git";
import CreateBranchDialog from "./CreateBranchDialog";
import { Check, CircleDot, Plus, RefreshCw, Trash2 } from "lucide-react";

export default function BranchList() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const loadBranches = () => {
    setLoading(true);
    setError(null);
    invoke<Branch[]>("get_branches")
      .then((data) => {
        setBranches(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.toString());
        setLoading(false);
      });
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const handleCheckout = async (branchName: string) => {
    try {
      await invoke("checkout_branch", { name: branchName });
      loadBranches();
    } catch (err) {
      alert(`Failed to checkout branch: ${err}`);
    }
  };

  const handleDelete = async (branchName: string) => {
    if (!confirm(`Delete branch "${branchName}"?`)) {
      return;
    }
    try {
      await invoke("delete_branch", { name: branchName });
      loadBranches();
    } catch (err) {
      alert(`Failed to delete branch: ${err}`);
    }
  };

  if (loading) {
    return <div className="branch-list">Loading branches...</div>;
  }

  if (error) {
    return <div className="branch-list error">Error: {error}</div>;
  }

  return (
    <div className="branch-list classic-gitk">
      <div className="branch-list-header">
        <h3>Branches ({branches.length})</h3>
        <div className="branch-list-actions">
          <button onClick={() => setShowCreateDialog(true)} title="Create Branch">
            <Plus size={14} />
          </button>
          <button onClick={loadBranches} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
      <CreateBranchDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={loadBranches}
      />
      <ul className="branch-items">
        {branches.map((branch) => (
          <li
            key={branch.name}
            className={`branch-item ${branch.is_current ? "current" : ""} ${branch.is_remote ? "remote" : ""}`}
            title={branch.commit_id.substring(0, 8)}
          >
            <div className="branch-info">
              {branch.is_current && (
                <span className="branch-indicator">
                  <CircleDot size={12} />
                </span>
              )}
              <span className="branch-name">{branch.name}</span>
              {branch.is_remote && <span className="branch-remote-indicator">[remote]</span>}
            </div>
            <div className="branch-actions">
              {!branch.is_current && !branch.is_remote && (
                <>
                  <button onClick={() => handleCheckout(branch.name)} title="Checkout">
                    <Check size={14} />
                  </button>
                  <button onClick={() => handleDelete(branch.name)} className="danger" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
              {!branch.is_current && branch.is_remote && (
                <button onClick={() => handleCheckout(branch.name)} title="Checkout">
                  <Check size={14} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

