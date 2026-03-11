import { useState } from "react";
import BranchList from "./BranchList";
import TagList from "./TagList";
import ChangesPanel from "./ChangesPanel";
import { GitBranch, GitCommitHorizontal, Tag } from "lucide-react";

type TabType = "sourceControl" | "branches" | "tags";

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<TabType>("sourceControl");

  return (
    <div className="sidebar">
      <div className="sidebar-tabs" role="tablist" aria-label="Sidebar Sections">
        <button
          type="button"
          className={activeTab === "sourceControl" ? "active" : ""}
          onClick={() => setActiveTab("sourceControl")}
          role="tab"
          aria-selected={activeTab === "sourceControl"}
        >
          <GitCommitHorizontal size={13} />
          Changes
        </button>
        <button
          type="button"
          className={activeTab === "branches" ? "active" : ""}
          onClick={() => setActiveTab("branches")}
          role="tab"
          aria-selected={activeTab === "branches"}
        >
          <GitBranch size={13} />
          Branches
        </button>
        <button
          type="button"
          className={activeTab === "tags" ? "active" : ""}
          onClick={() => setActiveTab("tags")}
          role="tab"
          aria-selected={activeTab === "tags"}
        >
          <Tag size={13} />
          Tags
        </button>
      </div>
      <div className="sidebar-content">
        {activeTab === "sourceControl" && <ChangesPanel />}
        {activeTab === "branches" && <BranchList />}
        {activeTab === "tags" && <TagList />}
      </div>
    </div>
  );
}

