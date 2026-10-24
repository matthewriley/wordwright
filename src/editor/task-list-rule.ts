import type MarkdownIt from "markdown-it";
import type StateCore from "markdown-it/lib/rules_core/state_core.mjs";
import type Token from "markdown-it/lib/token.mjs";

// markdown-it's own GFM-adjacent task-list plugins (markdown-it-task-lists
// and its forks) inject a raw `<input type="checkbox">` HTML string into
// the inline token stream instead of producing a real token type. That's
// fragile to dispatch on from prosemirror-markdown's parser and risks
// non-idempotent round-tripping. This rule instead rewrites the existing
// bullet_list/list_item tokens in place into real task_list/task_item
// tokens (with a genuine `checked` attr) whenever every item in a list
// matches the `[ ] `/`[x] ` marker — no HTML injection involved.
const TASK_MARKER = /^\[([ xX])\]\s+/;

function findMatchingClose(tokens: Token[], openIdx: number, openType: string, closeType: string): number {
  let depth = 1;
  for (let i = openIdx + 1; i < tokens.length; i++) {
    if (tokens[i].type === openType) depth++;
    else if (tokens[i].type === closeType) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function taskListRule(state: StateCore): void {
  const tokens = state.tokens;

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== "bullet_list_open") continue;

    const listCloseIdx = findMatchingClose(tokens, i, "bullet_list_open", "bullet_list_close");
    if (listCloseIdx === -1) continue;

    const items: { openIdx: number; closeIdx: number }[] = [];
    for (let j = i + 1; j < listCloseIdx; j++) {
      if (tokens[j].type !== "list_item_open") continue;
      const closeIdx = findMatchingClose(tokens, j, "list_item_open", "list_item_close");
      if (closeIdx === -1) break;
      items.push({ openIdx: j, closeIdx });
      j = closeIdx;
    }
    if (items.length === 0) continue;

    const matches: RegExpMatchArray[] = [];
    let allMatch = true;
    for (const item of items) {
      const paragraphOpen = tokens[item.openIdx + 1];
      const inline = tokens[item.openIdx + 2];
      const match = paragraphOpen?.type === "paragraph_open" && inline?.type === "inline"
        ? inline.content.match(TASK_MARKER)
        : null;
      if (!match) {
        allMatch = false;
        break;
      }
      matches.push(match);
    }
    if (!allMatch) continue;

    tokens[i].type = "task_list_open";
    tokens[listCloseIdx].type = "task_list_close";

    items.forEach((item, idx) => {
      tokens[item.openIdx].type = "task_item_open";
      tokens[item.closeIdx].type = "task_item_close";
      const checked = matches[idx][1].toLowerCase() === "x";
      tokens[item.openIdx].attrSet("checked", checked ? "true" : "false");

      const inline = tokens[item.openIdx + 2];
      const markerLength = matches[idx][0].length;
      inline.content = inline.content.slice(markerLength);
      const firstChild = inline.children?.[0];
      if (firstChild?.type === "text") {
        firstChild.content = firstChild.content.slice(markerLength);
        if (firstChild.content.length === 0) inline.children!.shift();
      }
    });
  }
}

export function taskListPlugin(md: MarkdownIt): void {
  md.core.ruler.after("inline", "task_list", taskListRule);
}
