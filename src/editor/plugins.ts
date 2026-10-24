import { keymap } from "prosemirror-keymap";
import { baseKeymap, chainCommands, toggleMark } from "prosemirror-commands";
import { history, undo, redo } from "prosemirror-history";
import { inputRules, wrappingInputRule, textblockTypeInputRule, InputRule } from "prosemirror-inputrules";
import { splitListItem, liftListItem, sinkListItem } from "prosemirror-schema-list";
import type { NodeType, MarkType } from "prosemirror-model";
import { tableEditing, columnResizing } from "prosemirror-tables";
import type { Plugin } from "prosemirror-state";
import { schema } from "./schema";
import { findReplacePlugin } from "./find-replace-plugin";

function markInputRule(regexp: RegExp, markType: MarkType): InputRule {
  return new InputRule(regexp, (state, match, start, end) => {
    const { tr } = state;
    if (match[1]) {
      const textStart = start + match[0].indexOf(match[1]);
      const textEnd = textStart + match[1].length;
      if (textEnd < end) tr.delete(textEnd, end);
      if (textStart > start) tr.delete(start, textStart);
      end = start + match[1].length;
    }
    tr.addMark(start, end, markType.create());
    tr.removeStoredMark(markType);
    return tr;
  });
}

function headingRule(nodeType: NodeType, maxLevel: number) {
  return textblockTypeInputRule(new RegExp(`^(#{1,${maxLevel}})\\s$`), nodeType, (match) => ({
    level: match[1].length,
  }));
}

function orderedListRule(nodeType: NodeType) {
  return wrappingInputRule(
    /^(\d+)\.\s$/,
    nodeType,
    (match) => ({ order: +match[1] }),
    (match, node) => node.childCount + (node.attrs.order as number) === +match[1],
  );
}

// Input rules test their regex after every keystroke, not "wait to see if
// a longer pattern completes" — since "- " (bulletListRule) is a strict
// prefix of "- [ ] " (this pattern) and completes first, bulletListRule
// always wins the race during normal character-by-character typing, no
// matter the array order. This rule still matters for input delivered as
// one multi-character chunk (IME composition, programmatic insertion),
// where both patterns are tested against the same text simultaneously.
// The realistic path — converting the plain bullet item bulletListRule
// already created — is handled separately by taskItemFromListItemRule.
function taskListRule(nodeType: NodeType) {
  return wrappingInputRule(/^\s*[-+*]\s\[[ xX]\]\s$/, nodeType);
}

function bulletListRule(nodeType: NodeType) {
  return wrappingInputRule(/^\s*[-+*]\s$/, nodeType);
}

// Handles the realistic typing flow: "- " already converted to a plain
// bullet_list > list_item (see above), then "[ ] "/"[x] " is typed as the
// first content of that item. Retypes list_item -> task_item and (since
// task_list requires task_item+ children) bullet_list -> task_list.
// Limited to single-item lists — converting one item of an existing
// multi-item bullet list isn't supported, since bullet_list/task_list
// can't mix item types; this is a live-typing convenience, not something
// that affects real-file round-tripping (task-list-rule.ts handles that
// unconditionally, for any list length).
function taskItemFromListItemRule(): InputRule {
  return new InputRule(/^\[([ xX])\]\s$/, (state, match, start, end) => {
    const $from = state.doc.resolve(start);
    if ($from.parent.type !== schema.nodes.paragraph || $from.parentOffset !== 0) return null;

    const listItemDepth = $from.depth - 1;
    if (listItemDepth < 1) return null;
    const listItem = $from.node(listItemDepth);
    if (listItem.type !== schema.nodes.list_item) return null;

    const bulletList = $from.node(listItemDepth - 1);
    if (!bulletList || bulletList.type !== schema.nodes.bullet_list || bulletList.childCount !== 1) return null;

    const bulletListPos = $from.before(listItemDepth - 1);
    const checked = match[1].toLowerCase() === "x";

    // setNodeMarkup validates each step against its *current* context —
    // retyping list_item -> task_item while still nested inside a
    // bullet_list (content "list_item+") is invalid the moment that step
    // runs, and the reverse order fails the same way for task_list. The
    // parent and child must change together in one atomic replacement.
    const tr = state.tr.delete(start, end);
    const strippedBulletList = tr.doc.nodeAt(bulletListPos);
    const strippedListItem = strippedBulletList?.firstChild;
    if (!strippedBulletList || !strippedListItem) return null;

    const newTaskList = schema.nodes.task_list.create(
      null,
      schema.nodes.task_item.create({ checked }, strippedListItem.content),
    );
    return tr.replaceWith(bulletListPos, bulletListPos + strippedBulletList.nodeSize, newTaskList);
  });
}

function blockquoteRule(nodeType: NodeType) {
  return wrappingInputRule(/^\s*>\s$/, nodeType);
}

function codeBlockRule(nodeType: NodeType) {
  return textblockTypeInputRule(/^```$/, nodeType);
}

function horizontalRuleRule(nodeType: NodeType) {
  return new InputRule(/^(?:---|___|\*\*\*)$/, (state, _match, start, end) =>
    state.tr.replaceWith(start, end, nodeType.create()),
  );
}

export function buildInputRules(): Plugin {
  return inputRules({
    rules: [
      headingRule(schema.nodes.heading, 6),
      blockquoteRule(schema.nodes.blockquote),
      taskListRule(schema.nodes.task_list),
      taskItemFromListItemRule(),
      bulletListRule(schema.nodes.bullet_list),
      orderedListRule(schema.nodes.ordered_list),
      codeBlockRule(schema.nodes.code_block),
      horizontalRuleRule(schema.nodes.horizontal_rule),
      markInputRule(/(?:\*\*|__)([^*_]+)(?:\*\*|__)$/, schema.marks.strong),
      markInputRule(/(?:^|[^*_])(?:\*|_)([^*_]+)(?:\*|_)$/, schema.marks.em),
      markInputRule(/~~([^~]+)~~$/, schema.marks.strikethrough),
      markInputRule(/`([^`]+)`$/, schema.marks.code),
    ],
  });
}

export function buildKeymap(): Plugin {
  // Mod-k (link) is deliberately not wired here — the original export used
  // window.prompt(), which Task 3 replaces with an in-app modal that
  // doesn't exist until Milestone 3's toolbar work.
  //
  // baseKeymap has no notion of custom list node types, so Enter/Backspace/
  // Tab must be explicitly chained: try the list_item/task_item-specific
  // command first (continue/lift/indent within a list), falling through to
  // baseKeymap's default behavior everywhere else. Without this, Enter
  // inside a list item just splits it into two paragraphs of the *same*
  // item instead of creating a new sibling item.
  return keymap({
    ...baseKeymap,
    "Mod-z": undo,
    "Shift-Mod-z": redo,
    "Mod-y": redo,
    "Mod-b": toggleMark(schema.marks.strong),
    "Mod-i": toggleMark(schema.marks.em),
    Enter: chainCommands(
      splitListItem(schema.nodes.task_item, { checked: false }),
      splitListItem(schema.nodes.list_item),
      baseKeymap.Enter,
    ),
    // Not Backspace: liftListItem matches based on selection ancestry, not
    // cursor position within the item's text — binding it there would lift
    // the whole item on every backspace anywhere in a list, not just at
    // the start. Tab/Shift-Tab are safe since they aren't used for typing.
    Tab: chainCommands(sinkListItem(schema.nodes.task_item), sinkListItem(schema.nodes.list_item)),
    "Shift-Tab": chainCommands(liftListItem(schema.nodes.task_item), liftListItem(schema.nodes.list_item)),
  });
}

export function buildPlugins(): Plugin[] {
  return [buildInputRules(), buildKeymap(), history(), columnResizing(), tableEditing(), findReplacePlugin()];
}
