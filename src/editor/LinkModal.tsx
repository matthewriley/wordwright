import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type MouseEvent } from "react";
import { schema } from "./schema";
import { tabManager } from "./store";
import "../styles/toolbar.css";

// Same imperative-controller shape as FindBar/PreferencesModal — this needs
// to be openable from menu.ts (the Format menu's Link… item) and from
// keyboard-shortcuts.ts, neither of which is a React context. It used to be
// prop-driven from App.tsx, which worked only because the toolbar and the
// editor were the only triggers; spec 008 adds two more call sites outside
// React.
class LinkModalController {
  private open = false;
  private listeners = new Set<() => void>();

  show(): void {
    this.open = true;
    this.notify();
  }

  hide(): void {
    this.open = false;
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): boolean => this.open;
}

const controller = new LinkModalController();

export function openLinkModal(): void {
  const activeDocument = tabManager.activeDocument();
  // A collapsed caret at a word boundary is fine — handleSubmit inserts the
  // URL text when the selection is empty — but with no editor, or in source
  // mode where the toolbar also disables the Link button, there is nothing
  // to insert into and the modal would collect input for nothing.
  if (!activeDocument?.view || activeDocument.sourceMode) return;
  controller.show();
}

export function closeLinkModal(): void {
  controller.hide();
}

export function LinkModal() {
  const open = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState("https://");
  const [title, setTitle] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setUrl("https://");
      setTitle("");
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const view = tabManager.activeDocument()?.view;
    const href = url.trim();
    if (view && href) {
      const link = schema.marks.link.create({ href, title: title.trim() || null });
      const { state } = view;
      const { from, to, empty } = state.selection;
      const tr = empty
        ? state.tr.insertText(href, from).addMark(from, from + href.length, link)
        : state.tr.addMark(from, to, link);
      view.dispatch(tr);
      view.focus();
    }
    controller.hide();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) controller.hide();
  }

  return (
    <dialog ref={dialogRef} className="link-modal" onCancel={() => controller.hide()} onClick={handleBackdropClick}>
      <form className="link-modal-form" onSubmit={handleSubmit}>
        <h2>Insert link</h2>
        <label>
          URL
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus required />
        </label>
        <label>
          Title (optional)
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="link-modal-actions">
          <button type="button" onClick={() => controller.hide()}>
            Cancel
          </button>
          <button type="submit">Insert</button>
        </div>
      </form>
    </dialog>
  );
}
