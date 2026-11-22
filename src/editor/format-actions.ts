import type { Command } from "prosemirror-state";
import { toggleMark } from "prosemirror-commands";
import { schema } from "./schema";
import { run, tabManager } from "./store";
import { toggleBlockType, toggleList, toggleWrap } from "./commands";
import { openLinkModal } from "./LinkModal";
import type { FormatActionId } from "./format-shortcuts";

// Each formatting action as the very same command the toolbar button runs
// (spec 008's "command mapping" item) — this file adds triggers, never
// behavior. `link` is the one exception: it opens a modal, which is UI
// state rather than a document transaction, so it has no Command.
//
// Heading shortcuts are toggles, matching the code-block and blockquote
// buttons: Mod-1 on an existing H1 returns it to a paragraph. The toolbar's
// block dropdown can't toggle (a <select> has no "off"), but a key that
// only ever applies would leave no keyboard way back.
function heading(level: number): Command {
  return toggleBlockType(schema.nodes.heading, { level });
}

const COMMANDS: Record<FormatActionId, Command | null> = {
  bold: toggleMark(schema.marks.strong),
  italic: toggleMark(schema.marks.em),
  strikethrough: toggleMark(schema.marks.strikethrough),
  "inline-code": toggleMark(schema.marks.code),
  "heading-1": heading(1),
  "heading-2": heading(2),
  "heading-3": heading(3),
  "bullet-list": toggleList(schema.nodes.bullet_list, schema.nodes.list_item),
  "ordered-list": toggleList(schema.nodes.ordered_list, schema.nodes.list_item),
  "task-list": toggleList(schema.nodes.task_list, schema.nodes.task_item),
  blockquote: toggleWrap(schema.nodes.blockquote),
  "code-block": toggleBlockType(schema.nodes.code_block),
  link: null,
};

// Shared by the native Format menu (both platforms) and the Windows
// keydown fallback, so the two can't drift apart.
//
// Both guards live here rather than in the callers, because the menu path
// bypasses the Windows listener's own checks: a native menu accelerator is
// handled by AppKit before the webview sees the keydown, so Cmd+B with the
// Link dialog open still reaches this function. Confirmed live on macOS —
// with a document selection and the link modal open, Cmd+B bolded the text
// behind the dialog.
//
//   - Source mode: the toolbar disables these same buttons while source
//     mode is active (the ProseMirror view behind the textarea is hidden,
//     and its content is replaced wholesale by commitDraftToDoc() on the
//     way back out), so a formatting transaction issued in that state would
//     be silently thrown away.
//   - An open <dialog>: formatting would land on the document behind the
//     modal (Link…, Preferences, update, discard prompt) instead of the
//     field the user is typing in.
export function runFormatAction(id: FormatActionId): void {
  const activeDocument = tabManager.activeDocument();
  if (!activeDocument || activeDocument.sourceMode) return;
  if (document.querySelector("dialog[open]")) return;

  if (id === "link") {
    openLinkModal();
    return;
  }

  const command = COMMANDS[id];
  if (command) run(command);
}
