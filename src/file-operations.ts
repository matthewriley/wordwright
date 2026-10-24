import { open, save, message } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { schema } from "./editor/schema";
import { markdownParser } from "./editor/markdown-parser";
import { markdownSerializer } from "./editor/markdown-serializer";
import { tabManager, type Document } from "./editor/store";
import { confirmDiscardChanges } from "./editor/ConfirmDiscardModal";

const MARKDOWN_FILTERS = [{ name: "Markdown", extensions: ["md", "markdown"] }];

function ensureMarkdownExtension(path: string): string {
  return /\.(md|markdown)$/i.test(path) ? path : `${path}.md`;
}

export function basename(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

async function reportError(action: string, error: unknown): Promise<void> {
  console.error(`${action} failed:`, error);
  await message(`${action} failed: ${error instanceof Error ? error.message : String(error)}`, {
    title: "Wordwright",
    kind: "error",
  });
}

// Always prompts for a location, per the File menu's distinct Save As
// item (the toolbar only has a single quick-save Save button). Takes an
// explicit tab rather than assuming "the active one" — closing a
// background tab needs to be able to save it without switching to it
// first.
export async function saveFileAs(doc: Document): Promise<boolean> {
  const view = doc.view;
  if (!view) return false;
  doc.flushSourceDraft();
  try {
    const path = await save({
      title: "Save As",
      filters: MARKDOWN_FILTERS,
      defaultPath: doc.filePath ?? doc.untitledName ?? "untitled.md",
    });
    if (!path) return false;
    const finalPath = ensureMarkdownExtension(path);
    await writeTextFile(finalPath, markdownSerializer.serialize(view.state.doc));
    doc.markSaved(finalPath, view.state.doc);
    return true;
  } catch (error) {
    await reportError("Save", error);
    return false;
  }
}

// Falls through to Save As when there's no tracked file path yet
// (an untitled document being saved for the first time).
export async function saveFile(doc: Document): Promise<boolean> {
  const view = doc.view;
  if (!view) return false;
  if (!doc.filePath) return saveFileAs(doc);
  doc.flushSourceDraft();
  try {
    await writeTextFile(doc.filePath, markdownSerializer.serialize(view.state.doc));
    doc.markSaved(doc.filePath, view.state.doc);
    return true;
  } catch (error) {
    await reportError("Save", error);
    return false;
  }
}

// Shared by the dialog-driven openFile() below and os-file-open.ts (a path
// the OS handed us directly — double-clicked, "Open With", or a second
// launch's argv redirected into this instance). Opening a file always adds
// a new tab rather than replacing anything, so unlike the pre-tabs version
// of this function, there's no other tab's unsaved changes to protect here
// — nothing to dirty-check first.
export async function openFileByPath(path: string): Promise<void> {
  try {
    const content = await readTextFile(path);
    const doc = markdownParser.parse(content);
    if (!doc) return;

    const tab = tabManager.createTab(doc, path);
    tab.view?.focus();
  } catch (error) {
    await reportError("Open", error);
  }
}

export async function openFile(): Promise<void> {
  try {
    const path = await open({ filters: MARKDOWN_FILTERS, multiple: false });
    if (!path) return;
    await openFileByPath(path);
  } catch (error) {
    await reportError("Open", error);
  }
}

// What File > New and the tab strip's "+" button both call.
export function newTab(): void {
  tabManager.createTab(schema.topNodeType.createAndFill()!, null);
}

// Switches to the tab first (so any confirm prompt is visually clear about
// which document it's asking about), then runs the same dirty-check flow
// used for whole-window close, scoped to just this one tab. If closing it
// empties the tab list, closes the window too — per the last-tab-closes-
// the-window decision, which needs no extra logic here: it just flows
// into the already-multi-tab-aware onCloseRequested handler in App.tsx,
// which finds nothing left to prompt about.
export async function requestCloseTab(id: string): Promise<boolean> {
  const doc = tabManager.getDocument(id);
  if (!doc) return false;
  tabManager.switchTab(id);

  if (doc.isDirty()) {
    const choice = await confirmDiscardChanges();
    if (choice === "cancel") return false;
    if (choice === "save" && !(await saveFile(doc))) return false;
  }

  tabManager.closeTab(id);
  if (tabManager.documents.length === 0) {
    await getCurrentWindow().close();
  }
  return true;
}
