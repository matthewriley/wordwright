import { describe, it, expect } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import type { Command } from "prosemirror-state";
import type { Node as PMNode } from "prosemirror-model";
import { schema } from "./schema";
import { toggleBlockType, toggleList, toggleWrap } from "./commands";

// Toggle semantics of the block-level toolbar buttons — and, since spec 008
// routes the block shortcuts at the same commands, Shift/Ctrl+1-3,
// Ctrl+Shift+7/8/9, Ctrl+Shift+. and Ctrl+Shift+E. A second application must
// reverse the first, which is the promise the pressed-state affordance on
// those buttons makes.

const paragraph = (text: string) => schema.nodes.paragraph.create(null, text ? schema.text(text) : null);

function doc(...children: PMNode[]): PMNode {
  return schema.nodes.doc.create(null, children);
}

/** Cursor at the start of the first block's text, inside every wrapper. */
function cursorIn(node: PMNode, position: number): EditorState {
  return EditorState.create({ doc: node, selection: TextSelection.create(node, position) });
}

function apply(state: EditorState, command: Command): EditorState {
  let next = state;
  command(state, (transaction) => {
    next = state.apply(transaction);
  });
  return next;
}

const heading = (level: number, text: string) =>
  schema.nodes.heading.create({ level }, schema.text(text));

describe("toggleBlockType", () => {
  it("turns a paragraph into a heading and back", () => {
    const on = apply(cursorIn(doc(paragraph("text")), 2), toggleBlockType(schema.nodes.heading, { level: 1 }));
    expect(on.doc.firstChild!.type.name).toBe("heading");

    const off = apply(on, toggleBlockType(schema.nodes.heading, { level: 1 }));
    expect(off.doc.firstChild!.type.name).toBe("paragraph");
  });

  it("keeps the level when switching heading levels", () => {
    const state = cursorIn(doc(heading(1, "text")), 2);
    const next = apply(state, toggleBlockType(schema.nodes.heading, { level: 2 }));
    expect(next.doc.firstChild!.type.name).toBe("heading");
    expect(next.doc.firstChild!.attrs.level).toBe(2);
  });

  it("turns a paragraph into a code block and back", () => {
    const on = apply(cursorIn(doc(paragraph("text")), 2), toggleBlockType(schema.nodes.code_block));
    expect(on.doc.firstChild!.type.name).toBe("code_block");

    const off = apply(on, toggleBlockType(schema.nodes.code_block));
    expect(off.doc.firstChild!.type.name).toBe("paragraph");
  });
});

describe("toggleList", () => {
  // task lists contain task_item, not list_item — passing the wrong type
  // makes liftListItem a no-op rather than unwrapping.
  const listTypes = [
    ["bullet_list", "list_item"],
    ["ordered_list", "list_item"],
    ["task_list", "task_item"],
  ] as const;

  it.each(listTypes)("wraps and unwraps a %s", (listType, itemType) => {
    const command = () => toggleList(schema.nodes[listType], schema.nodes[itemType]);

    const on = apply(cursorIn(doc(paragraph("text")), 2), command());
    expect(on.doc.firstChild!.type.name).toBe(listType);

    const off = apply(on, command());
    expect(off.doc.firstChild!.type.name).toBe("paragraph");
  });
});

describe("toggleWrap", () => {
  it("wraps a paragraph in a blockquote and unwraps it again", () => {
    const on = apply(cursorIn(doc(paragraph("text")), 2), toggleWrap(schema.nodes.blockquote));
    expect(on.doc.firstChild!.type.name).toBe("blockquote");

    const off = apply(on, toggleWrap(schema.nodes.blockquote));
    expect(off.doc.firstChild!.type.name).toBe("paragraph");
  });

  it("wraps once instead of nesting (#regression)", () => {
    // blockActive only inspects the immediate parent, which for a blockquote
    // is the paragraph inside it — so the old immediate-parent check never
    // saw an existing blockquote and wrapped again on every press.
    const on = apply(cursorIn(doc(paragraph("text")), 2), toggleWrap(schema.nodes.blockquote));
    expect(on.doc.firstChild!.type.name).toBe("blockquote");
    expect(on.doc.firstChild!.firstChild!.type.name).toBe("paragraph");
  });
});
