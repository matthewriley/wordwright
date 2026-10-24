import type { MouseEvent } from "react";
import { Plus, X } from "lucide-react";
import { tabManager, useActiveTabId, useTabs } from "./store";
import { newTab, requestCloseTab } from "../file-operations";
import "../styles/tab-strip.css";

export function TabStrip() {
  const tabs = useTabs();
  const activeTabId = useActiveTabId();

  function handleClose(event: MouseEvent, id: string) {
    event.stopPropagation();
    void requestCloseTab(id);
  }

  return (
    <div className="tab-strip">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className="tab"
          data-tab={tab.id === activeTabId ? "true" : undefined}
          onClick={() => tabManager.switchTab(tab.id)}
        >
          <span className="tab-name">{tab.title}</span>
          {tab.dirty && <span className="tab-dirty-dot">•</span>}
          <span className="tab-close" onClick={(event) => handleClose(event, tab.id)}>
            <X size={12} strokeWidth={2} />
          </span>
        </button>
      ))}
      <button type="button" className="tab-new" title="New" onClick={() => newTab()}>
        <Plus size={15} strokeWidth={1.75} />
      </button>
    </div>
  );
}
