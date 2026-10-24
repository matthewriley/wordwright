import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { schema } from "./schema";
import { tabManager } from "./store";
import "../styles/toolbar.css";

export interface LinkModalProps {
  open: boolean;
  onClose: () => void;
}

export function LinkModal({ open, onClose }: LinkModalProps) {
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
    onClose();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) onClose();
  }

  return (
    <dialog ref={dialogRef} className="link-modal" onClose={onClose} onCancel={onClose} onClick={handleBackdropClick}>
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
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit">Insert</button>
        </div>
      </form>
    </dialog>
  );
}
