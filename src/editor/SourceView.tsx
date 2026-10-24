import { useEffect, useRef } from "react";
import { tabManager, useSourceDraft, useSourceMode } from "./store";
import "../styles/source-view.css";

// Sits alongside Editor's ProseMirror mount inside .app-page, mutually
// exclusive with it. A controlled textarea (not an uncontrolled ref) so
// the status bar's live word count can read the same store field.
export function SourceView() {
  const sourceMode = useSourceMode();
  const draft = useSourceDraft();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // A <textarea> scrolls internally by default, which — unlike #doc, a
  // plain block that grows with its content — puts its scrollbar on the
  // textarea's own (900px-wide, centered) box instead of the page-wide
  // .app-scroll region. Growing the textarea to fit its content lets
  // .app-scroll handle all scrolling in both modes, keeping the scrollbar
  // flush with the window edge either way.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, sourceMode]);

  if (!sourceMode) return null;

  return (
    <textarea
      ref={textareaRef}
      className="source-view"
      spellCheck={false}
      autoFocus
      value={draft}
      onChange={(e) => tabManager.activeDocument()?.setSourceDraft(e.target.value)}
    />
  );
}
