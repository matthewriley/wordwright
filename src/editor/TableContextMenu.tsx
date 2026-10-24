import { useRef } from "react";
import { addRowBefore, addRowAfter, addColumnBefore, addColumnAfter, deleteRow, deleteColumn, deleteTable } from "prosemirror-tables";
import { alignColumn } from "./commands";
import { run, runAtCell } from "./store";
import { useDismissPopover } from "./use-dismiss-popover";
import { useClampedPosition } from "./use-clamped-position";
import "../styles/table-popovers.css";

export interface TableContextMenuProps {
  top: number;
  left: number;
  cellPos: number;
  onClose: () => void;
}

interface MenuItem {
  label: string;
  action: () => void;
  danger?: boolean;
}

export function TableContextMenu({ top, left, cellPos, onClose }: TableContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  useDismissPopover(true, menuRef, onClose);
  const position = useClampedPosition(menuRef, { top, left });

  function act(fn: () => void) {
    fn();
    onClose();
  }

  // Insert/delete are prosemirror-tables commands that act on
  // state.selection, so they go through runAtCell (moves the cursor into
  // the target cell first, deterministically, rather than trusting
  // wherever the selection happened to be when the menu opened).
  // alignColumn takes cellPos directly and doesn't need that.
  const items: MenuItem[] = [
    { label: "Insert row above", action: () => act(() => runAtCell(cellPos, addRowBefore)) },
    { label: "Insert row below", action: () => act(() => runAtCell(cellPos, addRowAfter)) },
    { label: "Insert column left", action: () => act(() => runAtCell(cellPos, addColumnBefore)) },
    { label: "Insert column right", action: () => act(() => runAtCell(cellPos, addColumnAfter)) },
    { label: "Align left", action: () => act(() => run(alignColumn(cellPos, "left"))) },
    { label: "Align center", action: () => act(() => run(alignColumn(cellPos, "center"))) },
    { label: "Align right", action: () => act(() => run(alignColumn(cellPos, "right"))) },
    { label: "Delete row", action: () => act(() => runAtCell(cellPos, deleteRow)), danger: true },
    { label: "Delete column", action: () => act(() => runAtCell(cellPos, deleteColumn)), danger: true },
    { label: "Delete table", action: () => act(() => runAtCell(cellPos, deleteTable)), danger: true },
  ];

  return (
    <div ref={menuRef} className="table-popover table-context-menu" style={{ top: position.top, left: position.left }}>
      {items.map((item, i) => (
        <div key={item.label}>
          {(i === 4 || i === 7) && <div className="table-menu-divider" />}
          <button type="button" className="table-menu-item" data-danger={item.danger ? "true" : undefined} onClick={item.action}>
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}
