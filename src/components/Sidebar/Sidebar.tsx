import { useState } from "react";
import BranchList from "./BranchList";
import TagList from "./TagList";

type TabType = "branches" | "tags";

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<TabType>("branches");

  return (
    <div className="sidebar">
      <div className="sidebar-tabs">
        <button
          className={activeTab === "branches" ? "active" : ""}
          onClick={() => setActiveTab("branches")}
        >
          Branches
        </button>
        <button
          className={activeTab === "tags" ? "active" : ""}
          onClick={() => setActiveTab("tags")}
        >
          Tags
        </button>
      </div>
      <div className="sidebar-content">
        {activeTab === "branches" && <BranchList />}
        {activeTab === "tags" && <TagList />}
      </div>
    </div>
  );
}

