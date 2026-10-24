import { Table2 } from "lucide-react";
import "../styles/table-popovers.css";

export interface TableHoverChipProps {
  top: number;
  left: number;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

// One chip per table, pinned near its top-right corner while hovered —
// not a per-row/column insert affordance. Clicking it opens the same
// context menu a right-click on a cell would. onMouseEnter/onMouseLeave
// let Editor.tsx bridge the gap between the table and this chip (a
// position:fixed sibling of #doc, not a descendant) without the chip
// vanishing the instant the pointer leaves #doc's own box en route to it.
export function TableHoverChip({ top, left, onClick, onMouseEnter, onMouseLeave }: TableHoverChipProps) {
  return (
    <button
      type="button"
      className="table-hover-chip"
      style={{ top, left }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <Table2 size={13} strokeWidth={1.75} />
      <span>Table</span>
    </button>
  );
}
