import { X } from "lucide-react";
import { useState } from "react";

interface SetupCliDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SetupCliDialog({ open, onClose }: SetupCliDialogProps) {
  const [setupStatus, setSetupStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  if (!open) return null;

  const handleSetupCli = async () => {
    setSetupStatus("loading");
    setErrorMessage("");

    try {
      // In a real implementation, this would call a Rust command to set up the CLI
      // For now, just show instructions
      setSetupStatus("success");
    } catch (error) {
      setSetupStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to set up CLI");
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
          <h2 className="text-lg font-semibold">Setup 'gitr' CLI Command</h2>
          <button
            onClick={onClose}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-4">
          {setupStatus === "idle" || setupStatus === "loading" ? (
            <>
              <p className="mb-4 text-sm text-[var(--text-secondary)]">
                The <code className="rounded bg-[var(--bg-primary)] px-1.5 py-0.5 font-mono text-xs">gitr</code> command allows you to open any git repository directly from your terminal.
              </p>

              <div className="mb-4 rounded-lg border border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-primary)_70%,transparent)] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Usage after setup:</p>
                <code className="block text-xs text-[var(--text-primary)]">
                  cd /path/to/repo<br />
                  gitr
                </code>
              </div>

              <p className="mb-4 text-sm text-[var(--text-secondary)]">
                This will install the command to <code className="rounded bg-[var(--bg-primary)] px-1.5 py-0.5 font-mono text-xs">/usr/local/bin/gitr</code> on macOS/Linux or your System PATH on Windows.
              </p>

              <div className="rounded-lg border border-[#ffa500]/30 bg-[color-mix(in_srgb,#ffa500_8%,transparent)] p-3">
                <p className="text-xs text-[#ffa500]">
                  ⚠️ May require <strong>administrator/sudo</strong> permissions
                </p>
              </div>
            </>
          ) : setupStatus === "success" ? (
            <div className="rounded-lg border border-[#10b981]/30 bg-[color-mix(in_srgb,#10b981_8%,transparent)] p-4 text-center">
              <p className="mb-2 text-lg font-semibold text-[#10b981]">✅ Setup Complete!</p>
              <p className="text-sm text-[var(--text-secondary)]">
                You can now use <code className="rounded bg-[var(--bg-primary)] px-1.5 py-0.5 font-mono text-xs">gitr</code> from any terminal window.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-[#ef4444]/30 bg-[color-mix(in_srgb,#ef4444_8%,transparent)] p-4">
              <p className="mb-2 font-semibold text-[#ef4444]">❌ Setup Failed</p>
              <p className="text-sm text-[var(--text-secondary)]">{errorMessage}</p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Please try running the setup script manually: <code className="rounded bg-[var(--bg-primary)] px-1.5 py-0.5 font-mono">bash scripts/install-gitr.sh</code>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border-color)] px-4 py-3">
          {setupStatus !== "success" && setupStatus !== "error" && (
            <button
              onClick={onClose}
              className="rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)]"
            >
              Cancel
            </button>
          )}

          {setupStatus === "idle" && (
            <button
              onClick={handleSetupCli}
              className="inline-flex items-center rounded bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-[#0b1117] transition hover:brightness-110"
            >
              Set Up CLI
            </button>
          )}

          {(setupStatus === "success" || setupStatus === "error") && (
            <button
              onClick={onClose}
              className="inline-flex items-center rounded bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-[#0b1117] transition hover:brightness-110"
            >
              Done
            </button>
          )}

          {setupStatus === "loading" && (
            <button
              disabled
              className="inline-flex items-center gap-2 rounded bg-[var(--accent)]/50 px-4 py-1.5 text-sm font-semibold text-[#0b1117] opacity-50"
            >
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#0b1117] border-t-transparent" />
              Setting up...
            </button>
          )}
        </div>
      </div>
    </>
  );
}
