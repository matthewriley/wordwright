import { useRef, useState, type MouseEvent } from "react";
import { Table } from "lucide-react";
import { run } from "./store";
import { createTable } from "./commands";
import { useDismissPopover } from "./use-dismiss-popover";
import { useClampedPosition } from "./use-clamped-position";
import "../styles/table-popovers.css";

const GRID_SIZE = 8;

export interface TableGridPickerProps {
  disabled?: boolean;
}

// Self-contained: owns the trigger button and the popover together, so
// Toolbar just renders this in place of a plain ToolbarButton — no shared
// state needed elsewhere.
export function TableGridPicker({ disabled }: TableGridPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const [hover, setHover] = useState({ cols: 0, rows: 0 });

  const open = anchor !== null;
  useDismissPopover(open, containerRef, () => setAnchor(null));
  const position = useClampedPosition(popoverRef, anchor ?? { top: 0, left: 0 });

  function handleTriggerClick(event: MouseEvent<HTMLButtonElement>) {
    if (open) {
      setAnchor(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setAnchor({ top: rect.bottom + 6, left: Math.max(8, rect.left - 40) });
    setHover({ cols: 0, rows: 0 });
  }

  function handleInsert(cols: number, rows: number) {
    run(createTable(cols, rows));
    setAnchor(null);
  }

  const label = hover.cols ? `${hover.cols} × ${hover.rows}  table` : "Drag to size";

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        title="Table"
        className="toolbar-button"
        data-on={open ? "true" : undefined}
        disabled={disabled}
        onClick={handleTriggerClick}
      >
        <Table size={16} strokeWidth={1.75} />
      </button>
      {anchor && (
        <div
          ref={popoverRef}
          className="table-popover"
          style={{ top: position.top, left: position.left }}
          onMouseLeave={() => setHover({ cols: 0, rows: 0 })}
        >
          <div className="table-grid-picker">
            {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
              const col = (i % GRID_SIZE) + 1;
              const row = Math.floor(i / GRID_SIZE) + 1;
              const selected = col <= hover.cols && row <= hover.rows;
              return (
                <button
                  key={i}
                  type="button"
                  className="table-grid-cell"
                  data-sel={selected ? "true" : undefined}
                  onMouseEnter={() => setHover({ cols: col, rows: row })}
                  onClick={() => handleInsert(col, row)}
                />
              );
            })}
          </div>
          <div className="table-grid-label">{label}</div>
        </div>
      )}
    </div>
  );
}
