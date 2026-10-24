import type { Attrs, Node as PMNode, NodeType, MarkType } from "prosemirror-model";
import type { Command, EditorState } from "prosemirror-state";
import { lift, setBlockType, wrapIn } from "prosemirror-commands";
import { wrapInList, liftListItem } from "prosemirror-schema-list";
import { tableNodeTypes, findTable, TableMap } from "prosemirror-tables";
import { schema, type Alignment } from "./schema";

// ProseMirror ships no "is this mark/block active" utility — these are
// faithful ports of prosemirror-example-setup's/prosemirror-menu's real
// reference implementations (confirmed by research; hand-writing these is
// the expected, idiomatic approach, not a gap).
export function markActive(state: EditorState, type: MarkType): boolean {
  const { from, $from, to, empty } = state.selection;
  if (empty) return !!type.isInSet(state.storedMarks || $from.marks());
  return state.doc.rangeHasMark(from, to, type);
}

export function blockActive(state: EditorState, nodeType: NodeType, attrs: Attrs | null = null): boolean {
  const { $from, to } = state.selection;
  return to <= $from.end() && $from.parent.hasMarkup(nodeType, attrs);
}

// blockActive only sees the immediate parent block (paragraph, heading,
// blockquote, code_block) — list membership lives further up the tree
// (paragraph -> list_item -> bullet_list/ordered_list/task_list), so list
// buttons need an ancestor walk instead.
export function listActive(state: EditorState, listType: NodeType): boolean {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type === listType) return true;
  }
  return false;
}

// Toggle-style wrappers so list/blockquote/code-block toolbar buttons turn
// themselves off when clicked again, matching the pressed-state affordance
// the mark buttons already get for free from toggleMark.
export function toggleList(listType: NodeType, itemType: NodeType): Command {
  return (state, dispatch, view) => {
    if (listActive(state, listType)) return liftListItem(itemType)(state, dispatch, view);
    return wrapInList(listType)(state, dispatch, view);
  };
}

export function toggleWrap(nodeType: NodeType): Command {
  return (state, dispatch, view) => {
    if (blockActive(state, nodeType)) return lift(state, dispatch, view);
    return wrapIn(nodeType)(state, dispatch, view);
  };
}

export function toggleBlockType(nodeType: NodeType, attrs: Attrs | null = null): Command {
  return (state, dispatch, view) => {
    const target = blockActive(state, nodeType, attrs) ? schema.nodes.paragraph : nodeType;
    const targetAttrs = target === nodeType ? attrs : null;
    return setBlockType(target, targetAttrs)(state, dispatch, view);
  };
}

export const insertHorizontalRule: Command = (state, dispatch) => {
  if (dispatch) dispatch(state.tr.replaceSelectionWith(schema.nodes.horizontal_rule.create()).scrollIntoView());
  return true;
};

// Ported from the original export's IMG_PH generator — a placeholder SVG
// figure, since no milestone builds real image asset management. `data:`
// is already allowed by the current CSP's img-src.
const IMAGE_PLACEHOLDER_SRC =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240"><defs><pattern id="s" width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#f6f4f2"/><line x1="0" y1="0" x2="0" y2="10" stroke="#e2ded9" stroke-width="4"/></pattern></defs><rect width="640" height="240" fill="url(#s)" stroke="#d8d4d1"/><text x="320" y="126" text-anchor="middle" font-family="monospace" font-size="15" fill="#8a827d">drop image here</text></svg>',
  );

export const insertImagePlaceholder: Command = (state, dispatch) => {
  if (dispatch) {
    const image = schema.nodes.image.create({ src: IMAGE_PLACEHOLDER_SRC, alt: "image" });
    dispatch(state.tr.replaceSelectionWith(image).scrollIntoView());
  }
  return true;
};

// No ready-made createTable helper ships with prosemirror-tables — this is
// the same small pattern used in the package's own demo.
function createCell(cellType: NodeType): PMNode | null {
  return cellType.createAndFill();
}

// Inserts a colsCount x rowsCount table (row 0 as header cells, the rest
// as body cells) — parameterized so the grid picker can request any size,
// not just a fixed default.
export function createTable(colsCount: number, rowsCount: number): Command {
  return (state, dispatch) => {
    const types = tableNodeTypes(schema);

    const headerCells: PMNode[] = [];
    const bodyCells: PMNode[] = [];
    for (let i = 0; i < colsCount; i++) {
      const headerCell = createCell(types.header_cell);
      if (headerCell) headerCells.push(headerCell);
      const bodyCell = createCell(types.cell);
      if (bodyCell) bodyCells.push(bodyCell);
    }

    const rows: PMNode[] = [];
    for (let i = 0; i < rowsCount; i++) {
      rows.push(types.row.createChecked(null, i === 0 ? headerCells : bodyCells));
    }
    const table = types.table.createChecked(null, rows);

    if (dispatch) dispatch(state.tr.replaceSelectionWith(table).scrollIntoView());
    return true;
  };
}

// GFM alignment is column-wide (one delimiter marker per column, and the
// markdown serializer only ever reads row 0's alignment attr for the whole
// column) — so this sets every cell in the clicked cell's column, not just
// the cell that was clicked, keeping the WYSIWYG view consistent with what
// a save+reopen round trip would actually preserve.
export function alignColumn(cellPos: number, alignment: Alignment): Command {
  return (state, dispatch) => {
    const $cell = state.doc.resolve(cellPos);
    const tableInfo = findTable($cell);
    if (!tableInfo) return false;

    const tableStart = tableInfo.pos + 1;
    const map = TableMap.get(tableInfo.node);
    const col = map.findCell(cellPos - tableStart).left;

    if (dispatch) {
      const tr = state.tr;
      for (let row = 0; row < map.height; row++) {
        const cellStart = tableStart + map.positionAt(row, col, tableInfo.node);
        const cell = tr.doc.nodeAt(cellStart);
        if (cell) tr.setNodeMarkup(cellStart, undefined, { ...cell.attrs, alignment });
      }
      dispatch(tr);
    }
    return true;
  };
}
