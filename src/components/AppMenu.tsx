import { useEffect, useRef, useState } from "react";
import {
  FolderOpen,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Settings2,
} from "lucide-react";

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
        <Menu size={16} />
      </button>
      {open && (
        <div className="app-menu-popover">
          <button className="app-menu-item" onClick={() => run(onOpenRepository)}>
            <span className="app-menu-label"><FolderOpen size={14} />Open Repository...</span>
          </button>
          <button
            className="app-menu-item"
            onClick={() => run(onReloadGraph)}
            disabled={!hasRepository}
          >
            <span className="app-menu-label"><RefreshCw size={14} />Reload Graph</span>
          </button>
          <button
            className="app-menu-item"
            onClick={() => run(onToggleSidebar)}
            disabled={!hasRepository}
          >
            <span className="app-menu-label">
              {sidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
              {sidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
            </span>
            <span className="app-menu-shortcut">B</span>
          </button>
          <div className="app-menu-divider" />
          <button className="app-menu-item" onClick={() => run(onOpenSettings)}>
            <span className="app-menu-label"><Settings2 size={14} />Settings</span>
          </button>
        </div>
      )}
    </div>
  );
}