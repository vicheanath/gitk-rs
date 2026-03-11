import { useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useResizable } from "../hooks/useResizable";

interface UseAppShellViewModelProps {
  isRepoOpen: boolean;
  openRepository: (path: string) => Promise<void>;
}

export function useAppShellViewModel({
  isRepoOpen,
  openRepository,
}: UseAppShellViewModelProps) {
  const [graphWidth, handleGraphResize] = useResizable({
    initialSize: 200,
    minSize: 120,
    maxSize: 400,
  });

  const [detailsHeight, handleDetailsResizeRaw] = useResizable({
    initialSize: 300,
    minSize: 200,
    maxSize: window.innerHeight * 0.7,
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleDetailsResize = (delta: number) => {
    handleDetailsResizeRaw(-delta);
  };

  const handleOpenRepo = async () => {
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

  useEffect(() => {
    const initRepo = async () => {
      const isTauri =
        typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

      if (!isTauri) {
        if (!isRepoOpen) {
          await openRepository("mock-repo");
        }
        return;
      }

      setTimeout(async () => {
        if (!isRepoOpen) {
          await handleOpenRepo();
        }
      }, 100);
    };

    initRepo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    graphWidth,
    detailsHeight,
    scrollContainerRef,
    handleGraphResize,
    handleDetailsResize,
    handleOpenRepo,
  };
}
