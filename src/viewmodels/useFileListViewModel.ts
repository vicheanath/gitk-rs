import { useMemo } from "react";
import { ChangedFile } from "../types/git";

interface UseFileListViewModelProps {
  files: ChangedFile[];
  selectedFile: string | null;
}

const STATUS_META: Record<ChangedFile["status"], { icon: string; color: string }> = {
  added: { icon: "+", color: "#10b981" },
  deleted: { icon: "-", color: "#ef4444" },
  modified: { icon: "M", color: "#3b82f6" },
  renamed: { icon: "R", color: "#f59e0b" },
};

export function useFileListViewModel({
  files,
  selectedFile,
}: UseFileListViewModelProps) {
  const rows = useMemo(
    () =>
      files.map((file) => ({
        file,
        selected: selectedFile === file.path,
        icon: STATUS_META[file.status]?.icon ?? "?",
        color: STATUS_META[file.status]?.color ?? "#6b7280",
      })),
    [files, selectedFile]
  );

  return {
    rows,
    isEmpty: files.length === 0,
  };
}
