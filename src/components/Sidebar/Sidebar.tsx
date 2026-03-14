import { useState, type ComponentType } from "react";
import BranchList from "./BranchList";
import TagList from "./TagList";
import ChangesPanel from "./ChangesPanel";
import { GitBranch, GitCommitHorizontal, Tag } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

type TabType = "sourceControl" | "branches" | "tags";

const SIDEBAR_TABS: Array<{
  id: TabType;
  label: string;
  icon: ComponentType<{ size?: number | string }>;
}> = [
  { id: "sourceControl", label: "Changes", icon: GitCommitHorizontal },
  { id: "branches", label: "Branches", icon: GitBranch },
  { id: "tags", label: "Tags", icon: Tag },
];

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<TabType>("sourceControl");

  const tabClass = (isActive: boolean) =>
    cn(
      "h-7 w-full justify-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors",
      isActive
        ? "border-[color-mix(in_srgb,var(--border-primary)_65%,transparent)] bg-[color-mix(in_srgb,var(--bg-tertiary)_92%,transparent)] text-[var(--text-primary)]"
        : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[color-mix(in_srgb,var(--border-primary)_55%,transparent)] hover:bg-[color-mix(in_srgb,var(--bg-tertiary)_78%,transparent)] hover:text-[var(--text-primary)]"
    );

  return (
    <div className="flex h-full flex-col bg-[var(--bg-secondary)]">
      <div
        className="grid grid-cols-3 gap-1 border-b border-[color-mix(in_srgb,var(--border-primary)_50%,transparent)] px-1 py-1"
        role="tablist"
        aria-label="Sidebar Sections"
      >
        {SIDEBAR_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <Button
              key={tab.id}
              variant="tab"
              className={tabClass(isActive)}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={isActive}
            >
              <Icon size={13} />
              <span className="truncate">{tab.label}</span>
            </Button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-1 pt-1.5 pb-1.5">
        {activeTab === "sourceControl" && <ChangesPanel />}
        {activeTab === "branches" && <BranchList />}
        {activeTab === "tags" && <TagList />}
      </div>
    </div>
  );
}
