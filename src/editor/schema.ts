import { Schema, type NodeSpec, type MarkSpec } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import { tableNodes } from "prosemirror-tables";

export type Alignment = "left" | "center" | "right" | null;

// prosemirror-schema-basic's code_block has no attrs for the fence
// info-string (language tag). Round-trip fidelity requires preserving it
// even though nothing renders syntax highlighting yet.
const codeBlock: NodeSpec = {
  content: "text*",
  marks: "",
  group: "block",
  code: true,
  defining: true,
  attrs: { params: { default: "" } },
  parseDOM: [
    {
      tag: "pre",
      preserveWhitespace: "full",
      getAttrs: (dom) => ({ params: (dom as HTMLElement).getAttribute("data-params") || "" }),
    },
  ],
  toDOM(node) {
    return ["pre", node.attrs.params ? { "data-params": node.attrs.params } : {}, ["code", 0]];
  },
};

const taskItem: NodeSpec = {
  attrs: { checked: { default: false } },
  content: "paragraph block*",
  defining: true,
  parseDOM: [
    {
      tag: "li[data-task]",
      getAttrs: (dom) => ({ checked: (dom as HTMLElement).getAttribute("data-checked") === "true" }),
    },
  ],
  toDOM(node) {
    return ["li", { "data-task": "1", "data-checked": String(!!node.attrs.checked) }, 0];
  },
};

const taskList: NodeSpec = {
  content: "task_item+",
  group: "block",
  parseDOM: [{ tag: "ul[data-task-list]" }],
  toDOM() {
    return ["ul", { "data-task-list": "1" }, 0];
  },
};

const strikethrough: MarkSpec = {
  parseDOM: [{ tag: "s" }, { tag: "del" }, { tag: "strike" }],
  toDOM() {
    return ["s", 0];
  },
};

// GFM table cells hold inline content directly (markdown-it emits a bare
// `inline` token per cell, not a wrapped paragraph) — "inline*", not
// "block+", matching both the tokenizer's real output and strict GFM
// semantics (table cells can't contain block content).
const tableNodeSpecs = tableNodes({
  tableGroup: "block",
  cellContent: "inline*",
  cellAttributes: {
    alignment: {
      default: null,
      getFromDOM(dom) {
        const align = (dom as HTMLElement).style.textAlign;
        return align === "left" || align === "center" || align === "right" ? align : null;
      },
      setDOMAttr(value, attrs) {
        if (value) attrs.style = `${attrs.style || ""}text-align: ${value};`;
      },
    },
  },
});

let nodes = addListNodes(basicSchema.spec.nodes, "paragraph block*", "block");
nodes = nodes
  .update("code_block", codeBlock)
  .append({ task_list: taskList, task_item: taskItem })
  .append(tableNodeSpecs);

const marks = basicSchema.spec.marks.append({ strikethrough });

export const schema = new Schema({ nodes, marks });
