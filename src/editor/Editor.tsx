import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";
import { schema } from "./schema";
import { buildPlugins } from "./plugins";
import { TaskItemView } from "./task-item-view";
import { type Document, useSourceMode } from "./store";
import { TableHoverChip } from "./TableHoverChip";
import { TableContextMenu } from "./TableContextMenu";
import "../styles/editor.css";
import "prosemirror-tables/style/tables.css";

interface TableChipState {
  top: number;
  left: number;
  cellPos: number;
}

interface TableMenuState {
  top: number;
  left: number;
  cellPos: number;
}

export interface EditorProps {
  tab: Document;
  initialDoc: PMNode;
  active: boolean;
  onRequestLink: () => void;
}

// Rendered once per open tab (key={tab.id} at the call site), so each gets
// its own mount-once effect and its own EditorView — all mounted
// simultaneously, hidden via CSS when not the active tab (see `active`
// below), the same pattern already used for source-mode hiding. This
// preserves each tab's live undo history/selection/scroll for free across
// switches, and avoids having to coherently swap node views/plugins on
// every switch. Named `tab`, not `document` — the latter would shadow the
// global `window.document`.
export function Editor({ tab, initialDoc, active, onRequestLink }: EditorProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sourceMode = useSourceMode();
  const [chip, setChip] = useState<TableChipState | null>(null);
  const [menu, setMenu] = useState<TableMenuState | null>(null);
  const hideChipTimeoutRef = useRef<number | null>(null);

  // The chip is a position:fixed DOM sibling of #doc, not a descendant, so
  // moving the mouse from the table onto the chip crosses out of #doc's
  // box first — an immediate hide-on-mouseleave would clear the chip
  // before the pointer ever reaches it. A short delay the chip itself can
  // cancel (by catching its own mouseenter) bridges that gap, the same
  // pattern tooltips/dropdown menus use.
  function cancelHideChip() {
    if (hideChipTimeoutRef.current !== null) {
      window.clearTimeout(hideChipTimeoutRef.current);
      hideChipTimeoutRef.current = null;
    }
  }
  function scheduleHideChip() {
    cancelHideChip();
    hideChipTimeoutRef.current = window.setTimeout(() => {
      setChip(null);
      hideChipTimeoutRef.current = null;
    }, 150);
  }

  useEffect(() => {
    if (!mountRef.current) return;

    const view = new EditorView(
      { mount: mountRef.current },
      {
        state: EditorState.create({ doc: initialDoc, schema, plugins: buildPlugins() }),
        nodeViews: {
          task_item: (node, editorView, getPos) => new TaskItemView(node, editorView, getPos),
        },
        // A raw keydown intercept, not a keymap command: opening the link
        // modal is a React-side effect, not a document transaction, so it
        // doesn't belong in plugins.ts's ProseMirror keymap.
        handleKeyDown(_view, event) {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
            onRequestLink();
            return true;
          }
          return false;
        },
        dispatchTransaction(tr) {
          view.updateState(view.state.apply(tr));
          tab.notify();
        },
      },
    );
    tab.setView(view);

    return () => {
      tab.setView(null);
      view.destroy();
      if (hideChipTimeoutRef.current !== null) window.clearTimeout(hideChipTimeoutRef.current);
    };
    // Mount once per Editor instance — a fresh instance (and thus a fresh
    // effect run) is guaranteed per open tab via key={tab.id} at the
    // call site, so this never needs to react to prop changes.
  }, []);

  // Tracks the nearest hovered <table> ancestor, matching the design
  // export's approach exactly. Only updates state when the table's
  // position actually moved, so a chip re-render doesn't fire on every
  // pixel of mouse movement within the same table.
  function handleMouseMove(event: ReactMouseEvent<HTMLDivElement>) {
    const view = tab.view;
    if (!view) return;
    const table = (event.target as HTMLElement).closest("table");
    if (!table) {
      if (chip) scheduleHideChip();
      return;
    }
    cancelHideChip();
    const cell = table.querySelector("td, th");
    if (!cell) return;
    const rect = table.getBoundingClientRect();
    const top = rect.top - 28;
    const left = rect.right - 70;
    if (chip && Math.abs(chip.top - top) <= 1 && Math.abs(chip.left - left) <= 1) return;
    setChip({ top, left, cellPos: view.posAtDOM(cell, 0) });
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    const view = tab.view;
    if (!view) return;
    const cell = (event.target as HTMLElement).closest("td, th");
    if (!cell) return;
    event.preventDefault();
    cancelHideChip();
    setChip(null);
    setMenu({ top: event.clientY, left: event.clientX, cellPos: view.posAtDOM(cell, 0) });
  }

  function openMenuFromChip() {
    if (!chip) return;
    cancelHideChip();
    setMenu({ top: chip.top + 28, left: chip.left, cellPos: chip.cellPos });
    setChip(null);
  }

  const hidden = !active || sourceMode;

  return (
    <>
      <div
        id="doc"
        ref={mountRef}
        style={hidden ? { display: "none" } : undefined}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { if (chip) scheduleHideChip(); }}
        onContextMenu={handleContextMenu}
      />
      {!hidden && chip && !menu && (
        <TableHoverChip top={chip.top} left={chip.left} onClick={openMenuFromChip} onMouseEnter={cancelHideChip} onMouseLeave={scheduleHideChip} />
      )}
      {!hidden && menu && (
        <TableContextMenu top={menu.top} left={menu.left} cellPos={menu.cellPos} onClose={() => setMenu(null)} />
      )}
    </>
  );
}
