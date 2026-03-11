import { useState } from "react";
import BranchList from "./BranchList";
import TagList from "./TagList";
import ChangesPanel from "./ChangesPanel";
import { GitBranch, GitCommitHorizontal, Tag } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

type TabType = "sourceControl" | "branches" | "tags";

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<TabType>("sourceControl");

  const tabClass = (isActive: boolean) =>
    cn(
      "h-[26px] gap-1.5 px-1.5 text-[11px] font-medium",
      isActive &&
        "border-[color-mix(in_srgb,var(--accent)_45%,var(--border-color))] bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--accent)_35%,transparent)]"
    );

  return (
    <div className="flex h-full flex-col bg-[var(--bg-secondary)]">
      <div className="flex items-center gap-1 border-b border-[color-mix(in_srgb,var(--border-color)_46%,transparent)] p-1.5" role="tablist" aria-label="Sidebar Sections">
        <Button
          variant="tab"
          className={tabClass(activeTab === "sourceControl")}
          onClick={() => setActiveTab("sourceControl")}
          role="tab"
          aria-selected={activeTab === "sourceControl"}
        >
          <GitCommitHorizontal size={13} />
          Changes
        </Button>
        <Button
          variant="tab"
          className={tabClass(activeTab === "branches")}
          onClick={() => setActiveTab("branches")}
          role="tab"
          aria-selected={activeTab === "branches"}
        >
          <GitBranch size={13} />
          Branches
        </Button>
        <Button
          variant="tab"
          className={tabClass(activeTab === "tags")}
          onClick={() => setActiveTab("tags")}
          role="tab"
          aria-selected={activeTab === "tags"}
        >
          <Tag size={13} />
          Tags
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-1.5">
        {activeTab === "sourceControl" && <ChangesPanel />}
        {activeTab === "branches" && <BranchList />}
        {activeTab === "tags" && <TagList />}
      </div>
    </div>
  );
}

