interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function AboutDialog({ open, onClose }: AboutDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/55" onClick={onClose}>
      <div className="w-[min(520px,92vw)] rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <h2 className="mb-3 text-base font-semibold text-[var(--text-primary)]">About GitK-RS</h2>
        <div className="mb-4 flex flex-col gap-3 text-sm leading-relaxed text-[var(--text-primary)]">
          <p>GitK-RS is a modern Git history viewer built with Tauri, Rust, and React.</p>
          <p>It focuses on commit graph exploration, diffs, branches, and fast desktop-native repository navigation.</p>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="rounded border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-1.5 text-sm text-[var(--text-primary)] transition hover:border-[color-mix(in_srgb,var(--accent)_50%,var(--border-color))]">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
