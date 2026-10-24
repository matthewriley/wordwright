import { MarkdownSerializer, type MarkdownSerializerState } from "prosemirror-markdown";
import type { Node as PMNode, Mark } from "prosemirror-model";
import type { Alignment } from "./schema";

// `out` and `inAutolink` are real fields on MarkdownSerializerState at
// runtime (used internally by prosemirror-markdown's own default
// serializer, e.g. for the `link` mark's autolink detection) but are marked
// `@internal` and omitted from the package's public .d.ts.
type InternalState = MarkdownSerializerState & { out: string; inAutolink: boolean | undefined };
const internal = (state: MarkdownSerializerState) => state as unknown as InternalState;

// backticksFor/isPlainURL are faithful ports of the same-named internal
// helpers in prosemirror-markdown's own defaultMarkdownSerializer (not
// exported by the package) — reused here since the `code` and `link` mark
// serializers below are otherwise identical to the defaults.
function backticksFor(node: PMNode, side: number): string {
  const ticks = /`+/g;
  let match: RegExpExecArray | null;
  let len = 0;
  if (node.isText) {
    while ((match = ticks.exec(node.text || ""))) len = Math.max(len, match[0].length);
  }
  let result = len > 0 && side > 0 ? " `" : "`";
  for (let i = 0; i < len; i++) result += "`";
  if (len > 0 && side < 0) result += " ";
  return result;
}

function isPlainURL(link: Mark, parent: PMNode, index: number): boolean {
  if (link.attrs.title || !/^\w+:/.test(link.attrs.href)) return false;
  const content = parent.child(index);
  if (!content.isText || content.text !== link.attrs.href || content.marks[content.marks.length - 1] !== link) {
    return false;
  }
  return index === parent.childCount - 1 || !link.isInSet(parent.child(index + 1).marks);
}

function renderTable(state: MarkdownSerializerState, node: PMNode): void {
  // MarkdownSerializerState has no public "render inline content to a
  // string" method — renderInline only appends to the state's internal
  // output buffer, so capture-and-roll-back is the standard technique for
  // building a custom multi-line block (a table) out of otherwise-normal
  // inline rendering.
  const raw = internal(state);
  const rows: string[][] = [];
  const alignments: Alignment[] = [];

  // Flush any pending block-separation (from flushClose, e.g. the blank
  // line after a preceding code block) up front — otherwise the first
  // cell's capture-and-rollback below would erase that separator, since
  // renderInline's first write is what triggers it.
  state.write();

  node.forEach((row, _o, rowIndex) => {
    const cells: string[] = [];
    row.forEach((cell, __o, colIndex) => {
      if (rowIndex === 0) alignments[colIndex] = (cell.attrs.alignment as Alignment) ?? null;
      const start = raw.out.length;
      state.renderInline(cell, true);
      const rendered = raw.out.slice(start);
      raw.out = raw.out.slice(0, start);
      const cellText = rendered.replace(/\|/g, "\\|").replace(/\r?\n+/g, " ").trim();
      cells.push(cellText.length ? cellText : " ");
    });
    rows.push(cells);
  });
  if (rows.length === 0) return;

  const delimiterFor = (align: Alignment) =>
    align === "center" ? ":---:" : align === "right" ? "---:" : align === "left" ? ":---" : "---";
  const writeRow = (cells: string[]) => `| ${cells.join(" | ")} |`;

  state.write(writeRow(rows[0]));
  state.ensureNewLine();
  state.write(writeRow(alignments.map(delimiterFor)));
  for (let i = 1; i < rows.length; i++) {
    state.ensureNewLine();
    state.write(writeRow(rows[i]));
  }
  state.closeBlock(node);
}

export const markdownSerializer = new MarkdownSerializer(
  {
    blockquote(state, node) {
      state.wrapBlock("> ", null, node, () => state.renderContent(node));
    },
    code_block(state, node) {
      const backtickRuns = node.textContent.match(/`{3,}/gm);
      const fence = backtickRuns ? `${backtickRuns.sort().slice(-1)[0]}\`` : "```";
      state.write(fence + (node.attrs.params || "") + "\n");
      state.text(node.textContent, false);
      state.write("\n");
      state.write(fence);
      state.closeBlock(node);
    },
    heading(state, node) {
      state.write(`${state.repeat("#", node.attrs.level)} `);
      state.renderInline(node, false);
      state.closeBlock(node);
    },
    horizontal_rule(state, node) {
      state.write("---");
      state.closeBlock(node);
    },
    bullet_list(state, node) {
      state.renderList(node, "  ", () => "- ");
    },
    ordered_list(state, node) {
      const start = node.attrs.order ?? 1;
      const maxWidth = String(start + node.childCount - 1).length;
      const space = state.repeat(" ", maxWidth + 2);
      state.renderList(node, space, (i) => {
        const numberString = String(start + i);
        return state.repeat(" ", maxWidth - numberString.length) + numberString + ". ";
      });
    },
    list_item(state, node) {
      state.renderContent(node);
    },
    task_list(state, node) {
      state.renderList(node, "  ", () => "- ");
    },
    task_item(state, node) {
      state.write(node.attrs.checked ? "[x] " : "[ ] ");
      state.renderContent(node);
    },
    paragraph(state, node) {
      state.renderInline(node);
      state.closeBlock(node);
    },
    image(state, node) {
      state.write(
        `![${state.esc(node.attrs.alt || "")}](${node.attrs.src.replace(/[()]/g, "\\$&")}${
          node.attrs.title ? ` "${node.attrs.title.replace(/"/g, '\\"')}"` : ""
        })`,
      );
    },
    hard_break(state, node, parent, index) {
      for (let i = index + 1; i < parent.childCount; i++) {
        if (parent.child(i).type !== node.type) {
          state.write("\\\n");
          return;
        }
      }
    },
    text(state, node) {
      state.text(node.text || "", !internal(state).inAutolink);
    },
    table: renderTable,
  },
  {
    em: { open: "*", close: "*", mixable: true, expelEnclosingWhitespace: true },
    strong: { open: "**", close: "**", mixable: true, expelEnclosingWhitespace: true },
    strikethrough: { open: "~~", close: "~~", mixable: true, expelEnclosingWhitespace: true },
    link: {
      open(state, mark, parent, index) {
        const s = internal(state);
        s.inAutolink = isPlainURL(mark, parent, index);
        return s.inAutolink ? "<" : "[";
      },
      close(state, mark, _parent, _index) {
        const s = internal(state);
        const wasAutolink = s.inAutolink;
        s.inAutolink = undefined;
        return wasAutolink
          ? ">"
          : `](${mark.attrs.href.replace(/[()"]/g, "\\$&")}${
              mark.attrs.title ? ` "${mark.attrs.title.replace(/"/g, '\\"')}"` : ""
            })`;
      },
      mixable: true,
    },
    code: {
      open: (_state, _mark, parent, index) => backticksFor(parent.child(index), -1),
      close: (_state, _mark, parent, index) => backticksFor(parent.child(index - 1), 1),
      escape: false,
    },
  },
);
