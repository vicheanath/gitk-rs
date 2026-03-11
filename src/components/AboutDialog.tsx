interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function AboutDialog({ open, onClose }: AboutDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog info-dialog" onClick={(event) => event.stopPropagation()}>
        <h2>About GitK-RS</h2>
        <div className="info-dialog-body">
          <p>GitK-RS is a modern Git history viewer built with Tauri, Rust, and React.</p>
          <p>It focuses on commit graph exploration, diffs, branches, and fast desktop-native repository navigation.</p>
        </div>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
