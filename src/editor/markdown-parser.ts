import { MarkdownParser, type ParseSpec } from "prosemirror-markdown";
import type Token from "markdown-it/lib/token.mjs";
import { schema } from "./schema";
import { createTokenizer } from "./markdown-it";
import type { Alignment } from "./schema";

function alignmentFromToken(tok: Token): Alignment {
  const style = tok.attrGet("style");
  const match = style?.match(/text-align:\s*(left|center|right)/);
  return (match?.[1] as Alignment) ?? null;
}

// Base entries mirror prosemirror-markdown's own `defaultMarkdownParser`
// (see its doc comment: "can be useful to copy and modify to base other
// parsers on") — that default has no table/task-list/strikethrough support,
// so this map is built from scratch rather than extending it directly.
const tokens: { [name: string]: ParseSpec } = {
  blockquote: { block: "blockquote" },
  paragraph: { block: "paragraph" },
  list_item: { block: "list_item" },
  bullet_list: { block: "bullet_list" },
  ordered_list: {
    block: "ordered_list",
    getAttrs: (tok) => ({ order: +(tok.attrGet("start") ?? 1) }),
  },
  heading: { block: "heading", getAttrs: (tok) => ({ level: +tok.tag.slice(1) }) },
  code_block: { block: "code_block", noCloseToken: true },
  fence: {
    block: "code_block",
    getAttrs: (tok) => ({ params: tok.info || "" }),
    noCloseToken: true,
  },
  hr: { node: "horizontal_rule" },
  image: {
    node: "image",
    getAttrs: (tok) => ({
      src: tok.attrGet("src"),
      title: tok.attrGet("title") || null,
      alt: (tok.children?.[0] && tok.children[0].content) || null,
    }),
  },
  hardbreak: { node: "hard_break" },

  em: { mark: "em" },
  strong: { mark: "strong" },
  link: {
    mark: "link",
    getAttrs: (tok) => ({
      href: tok.attrGet("href"),
      title: tok.attrGet("title") || null,
    }),
  },
  code_inline: { mark: "code", noCloseToken: true },
  s: { mark: "strikethrough" },

  task_list: { block: "task_list" },
  task_item: {
    block: "task_item",
    getAttrs: (tok) => ({ checked: tok.attrGet("checked") === "true" }),
  },

  table: { block: "table" },
  thead: { ignore: true },
  tbody: { ignore: true },
  tr: { block: "table_row" },
  th: { block: "table_header", getAttrs: (tok) => ({ alignment: alignmentFromToken(tok) }) },
  td: { block: "table_cell", getAttrs: (tok) => ({ alignment: alignmentFromToken(tok) }) },
};

export const markdownParser = new MarkdownParser(schema, createTokenizer(), tokens);
