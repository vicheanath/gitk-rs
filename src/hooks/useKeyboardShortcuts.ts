import { useEffect } from "react";

interface KeyboardShortcuts {
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onSearch?: () => void;
  onToggleSidebar?: () => void;
  onQuit?: () => void;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "ArrowUp":
          shortcuts.onArrowUp?.();
          break;
        case "ArrowDown":
          shortcuts.onArrowDown?.();
          break;
        case "ArrowLeft":
          shortcuts.onArrowLeft?.();
          break;
        case "ArrowRight":
          shortcuts.onArrowRight?.();
          break;
        case "/":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            shortcuts.onSearch?.();
          }
          break;
        case "b":
          if (!e.ctrlKey && !e.metaKey) {
            shortcuts.onToggleSidebar?.();
          }
          break;
        case "q":
          if (!e.ctrlKey && !e.metaKey) {
            shortcuts.onQuit?.();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shortcuts]);
}

