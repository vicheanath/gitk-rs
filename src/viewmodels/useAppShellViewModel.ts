import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useResizable } from "../hooks/useResizable";

interface UseAppShellViewModelProps {
  openRepository: (path: string) => Promise<void>;
}

export function useAppShellViewModel({
  openRepository,
}: UseAppShellViewModelProps) {
  const isTauri =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  const getWindowHeight = () =>
    typeof window !== "undefined" ? window.innerHeight : 900;

  const clampDetailsHeight = useCallback((value: number) => {
    const min = 180;
    const max = Math.max(min + 40, Math.floor(getWindowHeight() * 0.7));
    return Math.max(min, Math.min(max, Math.round(value)));
  }, []);

  const [graphWidth, handleGraphResize] = useResizable({
    initialSize: 200,
    minSize: 120,
    maxSize: 400,
  });

  const [sidebarWidth, handleSidebarResize] = useResizable({
    initialSize: 220,
    minSize: 180,
    maxSize: 360,
  });

  const [detailsHeight, setDetailsHeight] = useState<number>(() =>
    clampDetailsHeight(getWindowHeight() * 0.35)
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleDetailsResize = (delta: number) => {
    setDetailsHeight((prev) => clampDetailsHeight(prev - delta));
  };

  useEffect(() => {
    const handleResize = () => {
      setDetailsHeight((prev) => clampDetailsHeight(prev));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampDetailsHeight]);

  const handleOpenRepo = async () => {
    if (!isTauri) {
      alert("Open Repository is only available in the Tauri desktop app.");
      return;
    }

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Git Repository",
      });

      if (!selected) {
        return;
      }

      const path =
        typeof selected === "string"
          ? selected
          : (selected as { path?: string }).path || selected;

      if (path && typeof path === "string") {
        await openRepository(path);
      } else {
        alert("Invalid repository path selected");
      }
    } catch (error) {
      alert(`Failed to open repository dialog: ${error}`);
      const path = prompt("Enter repository path:");
      if (path) {
        await openRepository(path);
      }
    }
  };

  return {
    sidebarWidth,
    graphWidth,
    detailsHeight,
    scrollContainerRef,
    handleSidebarResize,
    handleGraphResize,
    handleDetailsResize,
    handleOpenRepo,
  };
}
