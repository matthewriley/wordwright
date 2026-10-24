import type { Node as PMNode } from "prosemirror-model";
import { markdownParser } from "./markdown-parser";
import { schema } from "./schema";
import { useEditorState, useSourceDraft, useSourceMode } from "./store";
import "../styles/status-bar.css";

function plainText(doc: PMNode): string {
  return doc.textBetween(0, doc.content.size, "\n\n", "");
}

export function StatusBar() {
  const state = useEditorState();
  const sourceMode = useSourceMode();
  const draft = useSourceDraft();

  // Both modes count the same way — the doc's plain text, marks and
  // markdown syntax stripped — so the numbers never disagree depending on
  // which view happens to be open. In source mode that means re-parsing
  // the draft on every keystroke, which is cheap at this app's document
  // sizes and is the same parse that committing the draft already does.
  const text = sourceMode
    ? plainText(markdownParser.parse(draft) ?? schema.topNodeType.createAndFill()!)
    : state
      ? plainText(state.doc)
      : "";
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const chars = text.length;

  return (
    <div className="status-bar">
      {sourceMode && <span>Markdown source</span>}
      <div className="status-bar-spacer" />
      <span>
        {words} {words === 1 ? "word" : "words"}
      </span>
      <span className="status-bar-divider">|</span>
      <span>{chars} characters</span>
    </div>
  );
}
