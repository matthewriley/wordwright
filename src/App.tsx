import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Editor } from "./editor/Editor";
import { SourceView } from "./editor/SourceView";
import { StatusBar } from "./editor/StatusBar";
import { TabStrip } from "./editor/TabStrip";
import { Toolbar } from "./editor/Toolbar";
import { LinkModal } from "./editor/LinkModal";
import { ConfirmDiscardModal, confirmDiscardChanges } from "./editor/ConfirmDiscardModal";
import { FindBar, closeFindBar } from "./editor/FindBar";
import { PreferencesModal } from "./editor/PreferencesModal";
import { UpdateDialog } from "./editor/UpdateDialog";
import { checkForUpdates } from "./updater";
import { schema } from "./editor/schema";
import { tabManager, useActiveTabId, useDocumentMeta, useTabs } from "./editor/store";
import { basename, saveFile } from "./file-operations";
import { installKeyboardShortcuts } from "./keyboard-shortcuts";
import { checkLaunchFiles, installOsFileOpenListener } from "./os-file-open";
import { buildAppMenu } from "./menu";
import "./App.css";

function App() {
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const { filePath, isDirty } = useDocumentMeta();
  useTabs(); // subscribes App.tsx to tab add/remove/switch so the <Editor> list below re-renders
  const activeTabId = useActiveTabId();

  useEffect(() => {
    void buildAppMenu();
  }, []);

  useEffect(() => installKeyboardShortcuts(), []);

  useEffect(() => installOsFileOpenListener(), []);

  // Silent startup update check — the manual entry point is the "Check
  // for Updates…" menu item. Failures (offline, no release published
  // yet, dev build) stay silent by design; see updater.ts.
  useEffect(() => {
    void checkForUpdates(false);
  }, []);

  // Checks for a file the OS launched us with before deciding whether to
  // seed a blank tab — checkLaunchFiles() drains state Rust queued during
  // its own startup (this instance's launch argv, or macOS's first
  // RunEvent::Opened), which can only have already happened by the time
  // this async call resolves, so a real launch file always wins the race
  // against seeding a blank one. Guarded on an empty tab list (rather
  // than a ref) so it's a no-op if this ever re-runs.
  useEffect(() => {
    void (async () => {
      const hadLaunchFile = await checkLaunchFiles();
      if (!hadLaunchFile && tabManager.documents.length === 0) {
        tabManager.createTab(schema.topNodeType.createAndFill()!, null);
      }
    })();
  }, []);

  useEffect(() => {
    const title = `${isDirty ? "*" : ""}${filePath ? basename(filePath) : "untitled.md"} — Wordwright`;
    void getCurrentWindow().setTitle(title);
  }, [filePath, isDirty]);

  // The find bar's query is session/UI state, not part of Document (unlike
  // source-mode, which does persist per tab) — simplest to just close it
  // on every tab switch rather than propagate matches across a different
  // tab's independent plugin instance.
  useEffect(() => {
    closeFindBar();
  }, [activeTabId]);

  useEffect(() => {
    const unlistenPromise = getCurrentWindow().onCloseRequested(async (event) => {
      // Iterates fresh each time rather than closing over one captured
      // flag — with multiple tabs there's no single "isDirty" to depend
      // on. Switches to each dirty tab before prompting, so it's visually
      // clear which document the prompt refers to; the first cancel or
      // failed save aborts the whole close, leaving every tab untouched.
      for (const doc of tabManager.documents) {
        if (!doc.isDirty()) continue;
        tabManager.switchTab(doc.id);
        const choice = await confirmDiscardChanges();
        if (choice === "cancel") {
          event.preventDefault();
          return;
        }
        if (choice === "save" && !(await saveFile(doc))) {
          event.preventDefault();
          return;
        }
      }
    });
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  return (
    <div className="app">
      <Toolbar onRequestLink={() => setLinkModalOpen(true)} />
      <TabStrip />
      <div className="app-scroll">
        <div className="app-page">
          {tabManager.documents.map((tab) => (
            <Editor
              key={tab.id}
              tab={tab}
              initialDoc={tab.initialDoc}
              active={tab.id === activeTabId}
              onRequestLink={() => setLinkModalOpen(true)}
            />
          ))}
          <SourceView />
        </div>
        <FindBar />
      </div>
      <StatusBar />
      <LinkModal open={linkModalOpen} onClose={() => setLinkModalOpen(false)} />
      <ConfirmDiscardModal />
      <PreferencesModal />
      <UpdateDialog />
    </div>
  );
}

export default App;
