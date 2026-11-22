import type { ComponentType } from "react";
import {
  Bold,
  Code,
  CodeXml,
  FilePlus,
  FolderOpen,
  Image,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Save,
  Search,
  SquareCode,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { setBlockType, toggleMark } from "prosemirror-commands";
import { undo, redo } from "prosemirror-history";
import { platform } from "@tauri-apps/plugin-os";
import { schema } from "./schema";
import { run, tabManager, useEditorState, useSourceMode } from "./store";
import { blockActive, insertHorizontalRule, insertImagePlaceholder, listActive, markActive, toggleBlockType, toggleList, toggleWrap } from "./commands";
import { formatShortcutTitle } from "./format-shortcuts";
import { openLinkModal } from "./LinkModal";
import { TableGridPicker } from "./TableGridPicker";
import { openFindBar } from "./FindBar";
import { newTab, openFile, saveFile } from "../file-operations";
import "../styles/toolbar.css";

// Spec 008: tooltips name the chord the same way the Format menu does, so
// the toolbar can teach the shortcut without a separate cheat sheet.
const isMacOS = platform() === "macos";

interface ToolbarButtonProps {
  title: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

function ToolbarButton({ title, icon: Icon, onClick, active, disabled }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      className="toolbar-button"
      data-on={active ? "true" : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={16} strokeWidth={1.75} />
    </button>
  );
}

function Divider() {
  return <div className="toolbar-divider" />;
}

function currentBlockValue(state: ReturnType<typeof useEditorState>): string {
  if (!state) return "p";
  const parent = state.selection.$from.parent;
  return parent.type === schema.nodes.heading ? `h${parent.attrs.level}` : "p";
}

export function Toolbar() {
  const state = useEditorState();
  const sourceMode = useSourceMode();

  function setBlock(value: string) {
    // Always land on the selected value (not a toggle, unlike the
    // blockquote/code-block buttons — a <select> has no "off" state).
    const attrs = value === "p" ? null : { level: Number(value.slice(1)) };
    const target = value === "p" ? schema.nodes.paragraph : schema.nodes.heading;
    run(setBlockType(target, attrs));
  }

  return (
    <div className="toolbar">
      <ToolbarButton title="New" icon={FilePlus} onClick={() => newTab()} />
      <ToolbarButton title="Open" icon={FolderOpen} onClick={() => void openFile()} />
      <ToolbarButton title="Save" icon={Save} onClick={() => void saveFile(tabManager.activeDocument()!)} />

      <Divider />

      <ToolbarButton title="Undo" icon={Undo2} disabled={sourceMode} onClick={() => run(undo)} />
      <ToolbarButton title="Redo" icon={Redo2} disabled={sourceMode} onClick={() => run(redo)} />

      <Divider />

      <select
        className="toolbar-select"
        title={`Block style (${isMacOS ? "⌘1–⌘3 are headings 1–3" : "Ctrl+1–Ctrl+3 are headings 1–3"})`}
        value={currentBlockValue(state)}
        disabled={sourceMode}
        onChange={(e) => setBlock(e.target.value)}
      >
        <option value="p">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="h4">Heading 4</option>
        <option value="h5">Heading 5</option>
        <option value="h6">Heading 6</option>
      </select>

      <Divider />

      <ToolbarButton
        title={formatShortcutTitle("bold", isMacOS)}
        icon={Bold}
        active={!!state && markActive(state, schema.marks.strong)}
        disabled={sourceMode}
        onClick={() => run(toggleMark(schema.marks.strong))}
      />
      <ToolbarButton
        title={formatShortcutTitle("italic", isMacOS)}
        icon={Italic}
        active={!!state && markActive(state, schema.marks.em)}
        disabled={sourceMode}
        onClick={() => run(toggleMark(schema.marks.em))}
      />
      <ToolbarButton
        title={formatShortcutTitle("strikethrough", isMacOS)}
        icon={Strikethrough}
        active={!!state && markActive(state, schema.marks.strikethrough)}
        disabled={sourceMode}
        onClick={() => run(toggleMark(schema.marks.strikethrough))}
      />
      <ToolbarButton
        title={formatShortcutTitle("inline-code", isMacOS)}
        icon={Code}
        active={!!state && markActive(state, schema.marks.code)}
        disabled={sourceMode}
        onClick={() => run(toggleMark(schema.marks.code))}
      />

      <Divider />

      <ToolbarButton
        title={formatShortcutTitle("bullet-list", isMacOS)}
        icon={List}
        active={!!state && listActive(state, schema.nodes.bullet_list)}
        disabled={sourceMode}
        onClick={() => run(toggleList(schema.nodes.bullet_list, schema.nodes.list_item))}
      />
      <ToolbarButton
        title={formatShortcutTitle("ordered-list", isMacOS)}
        icon={ListOrdered}
        active={!!state && listActive(state, schema.nodes.ordered_list)}
        disabled={sourceMode}
        onClick={() => run(toggleList(schema.nodes.ordered_list, schema.nodes.list_item))}
      />
      <ToolbarButton
        title={formatShortcutTitle("task-list", isMacOS)}
        icon={ListChecks}
        active={!!state && listActive(state, schema.nodes.task_list)}
        disabled={sourceMode}
        onClick={() => run(toggleList(schema.nodes.task_list, schema.nodes.task_item))}
      />

      <Divider />

      <ToolbarButton
        title={formatShortcutTitle("blockquote", isMacOS)}
        icon={Quote}
        active={!!state && blockActive(state, schema.nodes.blockquote)}
        disabled={sourceMode}
        onClick={() => run(toggleWrap(schema.nodes.blockquote))}
      />
      <ToolbarButton
        title={formatShortcutTitle("code-block", isMacOS)}
        icon={SquareCode}
        active={!!state && blockActive(state, schema.nodes.code_block)}
        disabled={sourceMode}
        onClick={() => run(toggleBlockType(schema.nodes.code_block))}
      />

      <Divider />

      <ToolbarButton title={formatShortcutTitle("link", isMacOS)} icon={Link} disabled={sourceMode} onClick={() => openLinkModal()} />
      <ToolbarButton title="Image" icon={Image} disabled={sourceMode} onClick={() => run(insertImagePlaceholder)} />
      <TableGridPicker disabled={sourceMode} />
      <ToolbarButton title="Horizontal rule" icon={Minus} disabled={sourceMode} onClick={() => run(insertHorizontalRule)} />

      <Divider />

      <ToolbarButton title="Find" icon={Search} disabled={sourceMode} onClick={() => openFindBar()} />

      <div className="toolbar-spacer" />

      <button
        type="button"
        className="toolbar-text-button"
        data-on={sourceMode ? "true" : undefined}
        onClick={() => tabManager.activeDocument()?.toggleSourceMode()}
      >
        <CodeXml size={16} strokeWidth={1.75} />
        <span>Source</span>
      </button>
    </div>
  );
}
