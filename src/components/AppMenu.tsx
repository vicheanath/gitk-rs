import { useEffect, useRef, useState } from "react";

interface AppMenuProps {
  sidebarOpen: boolean;
  hasRepository: boolean;
  onOpenRepository: () => void;
  onReloadGraph: () => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
}

export default function AppMenu({
  sidebarOpen,
  hasRepository,
  onOpenRepository,
  onReloadGraph,
  onOpenSettings,
  onToggleSidebar,
}: AppMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="app-menu" ref={containerRef}>
      <button
        className="app-menu-trigger"
        onClick={() => setOpen((value) => !value)}
        title="Menu"
      >
        Menu
      </button>
      {open && (
        <div className="app-menu-popover">
          <button className="app-menu-item" onClick={() => run(onOpenRepository)}>
            <span>Open Repository...</span>
          </button>
          <button
            className="app-menu-item"
            onClick={() => run(onReloadGraph)}
            disabled={!hasRepository}
          >
            <span>Reload Graph</span>
          </button>
          <button
            className="app-menu-item"
            onClick={() => run(onToggleSidebar)}
            disabled={!hasRepository}
          >
            <span>{sidebarOpen ? "Hide Sidebar" : "Show Sidebar"}</span>
            <span className="app-menu-shortcut">B</span>
          </button>
          <div className="app-menu-divider" />
          <button className="app-menu-item" onClick={() => run(onOpenSettings)}>
            <span>Settings</span>
          </button>
        </div>
      )}
    </div>
  );
}