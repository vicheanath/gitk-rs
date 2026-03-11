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
      "h-7 gap-1.5 rounded-none border-0 px-2 text-[11px] font-medium",
      isActive &&
        "bg-[color-mix(in_srgb,var(--bg-tertiary)_88%,transparent)] text-[var(--text-primary)]"
    );

  return (
    <div className="flex h-full flex-col bg-[var(--bg-secondary)]">
      <div className="flex items-center gap-0.5 px-1 py-1" role="tablist" aria-label="Sidebar Sections">
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
      <div className="min-h-0 flex-1 overflow-auto px-1 pb-1">
        {activeTab === "sourceControl" && <ChangesPanel />}
        {activeTab === "branches" && <BranchList />}
        {activeTab === "tags" && <TagList />}
      </div>
    </div>
  );
}

