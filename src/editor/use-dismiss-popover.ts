import { useEffect, type RefObject } from "react";

// Shared by the table grid picker, hover chip's context menu, and any
// future floating popover: closes on a click outside the popover's own DOM
// (captured via ref) or on Escape, mirroring the design export's single
// document-level "click outside any [data-pop] closes it" behavior.
export function useDismissPopover(open: boolean, ref: RefObject<HTMLElement | null>, onDismiss: () => void): void {
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, ref, onDismiss]);
}
