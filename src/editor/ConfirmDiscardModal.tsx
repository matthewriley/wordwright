import { useEffect, useRef, useSyncExternalStore, type MouseEvent } from "react";
import "../styles/toolbar.css";

export type DiscardChoice = "save" | "dontSave" | "cancel";

// A small imperative controller, not props from a parent — this needs to
// be triggerable from plain async functions with no React context of
// their own (file-operations.ts, the native menu's action callbacks, the
// window close-request handler), the same reason tabManager (store.ts)
// is a singleton rather than lifted React state.
class ConfirmDiscardController {
  private open = false;
  private resolve: ((choice: DiscardChoice) => void) | null = null;
  private listeners = new Set<() => void>();

  show(): Promise<DiscardChoice> {
    this.open = true;
    this.notify();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  choose(choice: DiscardChoice): void {
    this.open = false;
    this.resolve?.(choice);
    this.resolve = null;
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

const controller = new ConfirmDiscardController();

export function confirmDiscardChanges(): Promise<DiscardChoice> {
  return controller.show();
}

export function ConfirmDiscardModal() {
  const open = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) controller.choose("cancel");
  }

  return (
    <dialog
      ref={dialogRef}
      className="link-modal"
      onCancel={(e) => {
        e.preventDefault();
        controller.choose("cancel");
      }}
      onClick={handleBackdropClick}
    >
      <h2>Unsaved changes</h2>
      <p className="confirm-discard-body">Do you want to save the changes you made before closing?</p>
      <div className="link-modal-actions">
        <button type="button" onClick={() => controller.choose("cancel")}>
          Cancel
        </button>
        <button type="button" onClick={() => controller.choose("dontSave")}>
          Don't Save
        </button>
        <button type="button" className="confirm-discard-save" onClick={() => controller.choose("save")}>
          Save
        </button>
      </div>
    </dialog>
  );
}
