import { useState } from "react";
import BranchList from "./BranchList";
import TagList from "./TagList";
import ChangesPanel from "./ChangesPanel";
import { GitBranch, GitCommitHorizontal, Tag } from "lucide-react";

type TabType = "sourceControl" | "branches" | "tags";

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<TabType>("sourceControl");

  const tabClass = (isActive: boolean) =>
    [
      "inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium transition",
      isActive
        ? "border-[color-mix(in_srgb,var(--accent)_45%,var(--border-color))] bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
        : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
    ].join(" ");

  return (
    <div className="flex h-full flex-col bg-[var(--bg-secondary)]">
      <div className="flex items-center gap-1 border-b border-[var(--border-color)] p-2" role="tablist" aria-label="Sidebar Sections">
        <button
          type="button"
          className={tabClass(activeTab === "sourceControl")}
          onClick={() => setActiveTab("sourceControl")}
          role="tab"
          aria-selected={activeTab === "sourceControl"}
        >
          <GitCommitHorizontal size={13} />
          Changes
        </button>
        <button
          type="button"
          className={tabClass(activeTab === "branches")}
          onClick={() => setActiveTab("branches")}
          role="tab"
          aria-selected={activeTab === "branches"}
        >
          <GitBranch size={13} />
          Branches
        </button>
        <button
          type="button"
          className={tabClass(activeTab === "tags")}
          onClick={() => setActiveTab("tags")}
          role="tab"
          aria-selected={activeTab === "tags"}
        >
          <Tag size={13} />
          Tags
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {activeTab === "sourceControl" && <ChangesPanel />}
        {activeTab === "branches" && <BranchList />}
        {activeTab === "tags" && <TagList />}
      </div>
    </div>
  );
}

