import { useSyncExternalStore } from "react";
import { TextSelection, type Command, type EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";
import { schema } from "./schema";
import { markdownParser } from "./markdown-parser";
import { markdownSerializer } from "./markdown-serializer";

// One open tab. Everything here is per-document — confirmed during
// Milestone 7 planning that nothing in the pre-tabs single-document store
// was legitimately app-wide. Notifications go up to the owning TabManager
// rather than firing local listener sets directly, since a document's
// changes only matter to subscribers while it's the *active* tab.
export class Document {
  readonly id: string;
  // The content this tab was created with — read once by Editor.tsx's
  // mount-once effect to seed its EditorView. Never mutated afterward;
  // the live doc lives in view.state from that point on.
  readonly initialDoc: PMNode;
  view: EditorView | null = null;
  filePath: string | null;
  sourceMode = false;
  untitledName: string | null;
  private savedDoc: PMNode | null = null;
  private sourceDraft = "";
  private sourceDraftBaseline = "";

  constructor(
    private readonly manager: TabManager,
    id: string,
    initialDoc: PMNode,
    filePath: string | null,
    untitledName: string | null,
  ) {
    this.id = id;
    this.initialDoc = initialDoc;
    this.filePath = filePath;
    this.untitledName = untitledName;
  }

  get title(): string {
    if (this.filePath) return this.filePath.split(/[\\/]/).pop() || this.filePath;
    return this.untitledName ?? "untitled.md";
  }

  setView(view: EditorView | null): void {
    this.view = view;
    if (view) this.savedDoc = view.state.doc;
    this.notify();
  }

  // Called after a successful open/save so dirty-tracking has a fresh
  // baseline to compare against.
  markSaved(filePath: string, doc: PMNode): void {
    this.filePath = filePath;
    this.savedDoc = doc;
    this.notifyMeta();
  }

  isDirty(): boolean {
    if (!this.view || !this.savedDoc) return false;
    // An in-progress source-mode edit never touches view.state.doc until
    // the user toggles back out, so it has to be checked separately —
    // otherwise editing only in source mode and then quitting would
    // silently discard those edits.
    if (this.sourceMode && this.sourceDraft !== this.sourceDraftBaseline) return true;
    // Structural equality, not a docChanged flag — undoing back past the
    // save point correctly reads as clean again.
    return !this.savedDoc.eq(this.view.state.doc);
  }

  // Serializes the doc into sourceDraft (entering) or parses sourceDraft
  // back into the doc via a normal transaction (leaving/flushing) — a
  // transaction, not a fresh EditorState, so undo history survives the
  // round trip, and so switching away to another tab and back leaves this
  // tab's source-mode edit exactly where it was left (unlike the design
  // export, which resets its page-global source flag on every switch).
  toggleSourceMode(): void {
    if (!this.view) return;
    if (this.sourceMode) {
      this.commitDraftToDoc();
      this.sourceMode = false;
    } else {
      this.sourceDraft = markdownSerializer.serialize(this.view.state.doc);
      this.sourceDraftBaseline = this.sourceDraft;
      this.sourceMode = true;
    }
    this.notifySource();
  }

  setSourceDraft(text: string): void {
    this.sourceDraft = text;
    this.notifySource();
  }

  getSourceDraft(): string {
    return this.sourceDraft;
  }

  // Called before any operation that reads view.state.doc from outside the
  // component tree (save, closing this tab) so an in-progress source-mode
  // edit is never silently left out.
  flushSourceDraft(): void {
    if (!this.sourceMode) return;
    this.commitDraftToDoc();
  }

  private commitDraftToDoc(): void {
    if (!this.view) return;
    const doc = markdownParser.parse(this.sourceDraft) ?? schema.topNodeType.createAndFill()!;
    const { state } = this.view;
    this.view.dispatch(state.tr.replaceWith(0, state.doc.content.size, doc.content));
    this.sourceDraftBaseline = this.sourceDraft;
  }

  notify(): void {
    this.manager.onDocumentNotify(this.id);
  }

  notifyMeta(): void {
    this.manager.onDocumentNotifyMeta(this.id);
  }

  notifySource(): void {
    this.manager.onDocumentNotifySource(this.id);
  }
}

// Owns the ordered list of open tabs and which one is active. A plain
// singleton, not React Context — lets Toolbar/menu/StatusBar/etc. read the
// active tab's live state without prop-drilling through whatever owns the
// per-tab Editor components. Forwards a document's own notifications to
// subscribers only while that document is the active tab; a tab switch
// itself fires all four channels, since state/meta/source/tabs all
// legitimately change together when the active tab changes identity.
class TabManager {
  documents: Document[] = [];
  activeId: string | null = null;
  private nextUntitledIndex = 1;
  private tabsListeners = new Set<() => void>();
  private stateListeners = new Set<() => void>();
  private metaListeners = new Set<() => void>();
  private sourceListeners = new Set<() => void>();

  activeDocument(): Document | null {
    return this.documents.find((doc) => doc.id === this.activeId) ?? null;
  }

  getDocument(id: string): Document | undefined {
    return this.documents.find((doc) => doc.id === id);
  }

  createTab(doc: PMNode, filePath: string | null): Document {
    const untitledName = filePath ? null : `untitled-${this.nextUntitledIndex++}.md`;
    const tab = new Document(this, crypto.randomUUID(), doc, filePath, untitledName);
    this.documents.push(tab);
    this.activeId = tab.id;
    this.notifyAll();
    return tab;
  }

  switchTab(id: string): void {
    if (id === this.activeId || !this.getDocument(id)) return;
    this.activeId = id;
    this.notifyAll();
  }

  // Synchronous — the dirty-check/confirm/save flow around closing a tab
  // lives in file-operations.ts, matching the existing separation between
  // this store's synchronous state and file-operations.ts's async I/O and
  // prompts.
  closeTab(id: string): void {
    const index = this.documents.findIndex((doc) => doc.id === id);
    if (index === -1) return;
    this.documents.splice(index, 1);
    if (this.activeId === id) {
      const next = this.documents[index] ?? this.documents[index - 1] ?? null;
      this.activeId = next?.id ?? null;
    }
    this.notifyAll();
  }

  onDocumentNotify(id: string): void {
    if (id !== this.activeId) return;
    this.stateListeners.forEach((listener) => listener());
    this.onDocumentNotifyMeta(id);
  }

  onDocumentNotifyMeta(id: string): void {
    if (id !== this.activeId) return;
    this.metaListeners.forEach((listener) => listener());
  }

  onDocumentNotifySource(id: string): void {
    if (id !== this.activeId) return;
    this.sourceListeners.forEach((listener) => listener());
  }

  private notifyAll(): void {
    this.tabsListeners.forEach((listener) => listener());
    this.stateListeners.forEach((listener) => listener());
    this.metaListeners.forEach((listener) => listener());
    this.sourceListeners.forEach((listener) => listener());
  }

  subscribeTabs = (listener: () => void): (() => void) => {
    this.tabsListeners.add(listener);
    return () => this.tabsListeners.delete(listener);
  };

  subscribeState = (listener: () => void): (() => void) => {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  };

  subscribeMeta = (listener: () => void): (() => void) => {
    this.metaListeners.add(listener);
    return () => this.metaListeners.delete(listener);
  };

  subscribeSource = (listener: () => void): (() => void) => {
    this.sourceListeners.add(listener);
    return () => this.sourceListeners.delete(listener);
  };

  getStateSnapshot = (): EditorState | null => this.activeDocument()?.view?.state ?? null;

  // A cheap string snapshot: useSyncExternalStore needs a value that's
  // reference-stable when nothing meaningful changed, so components don't
  // re-render on every keystroke just because isDirty() was recomputed.
  getMetaSnapshot = (): string => {
    const doc = this.activeDocument();
    return doc ? `${doc.filePath ?? ""}:${doc.isDirty()}` : "";
  };

  // Two separate primitive snapshots, not one object — an object literal
  // would break useSyncExternalStore's referential-stability requirement.
  getSourceModeSnapshot = (): boolean => this.activeDocument()?.sourceMode ?? false;
  getSourceDraftSnapshot = (): string => this.activeDocument()?.getSourceDraft() ?? "";

  // Same "cheap stable string sentinel" trick as getMetaSnapshot — the
  // real tab list returned by useTabs() is re-derived fresh each render,
  // this snapshot's only job is telling useSyncExternalStore when to
  // bother re-rendering at all.
  getTabsSnapshot = (): string =>
    this.documents.map((doc) => `${doc.id}:${doc.title}:${doc.isDirty()}`).join("|") + "#" + (this.activeId ?? "");
}

export const tabManager = new TabManager();

export function useEditorState(): EditorState | null {
  return useSyncExternalStore(tabManager.subscribeState, tabManager.getStateSnapshot);
}

export interface DocumentMeta {
  filePath: string | null;
  isDirty: boolean;
}

export function useDocumentMeta(): DocumentMeta {
  useSyncExternalStore(tabManager.subscribeMeta, tabManager.getMetaSnapshot);
  const doc = tabManager.activeDocument();
  return { filePath: doc?.filePath ?? null, isDirty: doc?.isDirty() ?? false };
}

export function useSourceMode(): boolean {
  return useSyncExternalStore(tabManager.subscribeSource, tabManager.getSourceModeSnapshot);
}

export function useSourceDraft(): string {
  return useSyncExternalStore(tabManager.subscribeSource, tabManager.getSourceDraftSnapshot);
}

export interface TabSummary {
  id: string;
  title: string;
  dirty: boolean;
}

export function useTabs(): TabSummary[] {
  useSyncExternalStore(tabManager.subscribeTabs, tabManager.getTabsSnapshot);
  return tabManager.documents.map((doc) => ({ id: doc.id, title: doc.title, dirty: doc.isDirty() }));
}

export function useActiveTabId(): string | null {
  useSyncExternalStore(tabManager.subscribeTabs, tabManager.getTabsSnapshot);
  return tabManager.activeId;
}

// Shared by Toolbar and the native menu — dispatches a ProseMirror command
// against the active tab's live view and returns focus to the editor
// afterward.
export function run(command: Command): void {
  const view = tabManager.activeDocument()?.view;
  if (!view) return;
  command(view.state, view.dispatch, view);
  view.focus();
}

// For the table context menu: a right-click doesn't reliably move the text
// selection first (browser behavior here is inconsistent), but the
// prosemirror-tables row/column commands act on state.selection — so this
// deterministically places the cursor in the target cell first, then runs
// the command against the resulting fresh state, rather than trusting
// whatever the selection happened to be when the menu was opened.
export function runAtCell(cellPos: number, command: Command): void {
  const view = tabManager.activeDocument()?.view;
  if (!view) return;
  const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(cellPos)));
  view.dispatch(tr);
  command(view.state, view.dispatch, view);
  view.focus();
}
