// Single source of truth for spec 008's formatting shortcuts. Three
// consumers read this table instead of carrying their own copies:
//
//   menu.ts                builds the native Format menu (labels +
//                          accelerators) from it,
//   keyboard-shortcuts.ts  matches the Windows fallback against `code`,
//   Toolbar.tsx            shows the chord in its button tooltips.
//
// Deliberately dependency-free (no ProseMirror, no Tauri, no React) so it
// can be unit-tested in this project's Node test environment — see
// format-shortcuts.test.ts, which checks the two representations of each
// chord (`accelerator` for the menu, `code` for the DOM listener) agree.

export type FormatActionId =
  | "bold"
  | "italic"
  | "strikethrough"
  | "inline-code"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "bullet-list"
  | "ordered-list"
  | "task-list"
  | "blockquote"
  | "code-block"
  | "link";

// Menu order, and the order separators fall between in the Format menu.
export type FormatGroup = "marks" | "headings" | "lists" | "blocks" | "insert";

export interface FormatShortcut {
  id: FormatActionId;
  /** Menu item text, also used (plus the chord) for the toolbar tooltip. */
  label: string;
  group: FormatGroup;
  /** Tauri/muda accelerator syntax, e.g. "CmdOrCtrl+Shift+E". */
  accelerator: string;
  /**
   * `KeyboardEvent.code` — the PHYSICAL key, not `.key`. The Windows
   * fallback must match on this: with Ctrl+Shift held, `.key` reports the
   * shifted character ("*" for Shift+8, ">" for Shift+.), which no longer
   * corresponds to the key we bound. `.code` is stable across layouts and
   * modifier state.
   */
  code: string;
  /** Whether Shift is part of the chord. Everything here is Ctrl/Cmd-based. */
  shift?: boolean;
  /**
   * How the Windows path fires. "editor" is handled inside the editor
   * already — ProseMirror's own keymap plugin (bold/italic) or
   * Editor.tsx's keydown intercept (link) — and needs nothing from spec
   * 008; "fallback" needs a window-level listener because Tauri's native
   * accelerator dispatch never matches on Windows. Never "fallback" for
   * something the editor also handles — that would run the command twice
   * for one keystroke.
   */
  routed: "editor" | "fallback";
}

export const FORMAT_SHORTCUTS: readonly FormatShortcut[] = [
  { id: "bold", label: "Bold", group: "marks", accelerator: "CmdOrCtrl+B", code: "KeyB", routed: "editor" },
  { id: "italic", label: "Italic", group: "marks", accelerator: "CmdOrCtrl+I", code: "KeyI", routed: "editor" },
  {
    id: "strikethrough",
    label: "Strikethrough",
    group: "marks",
    accelerator: "CmdOrCtrl+Shift+X",
    code: "KeyX",
    shift: true,
    routed: "fallback",
  },
  { id: "inline-code", label: "Inline Code", group: "marks", accelerator: "CmdOrCtrl+E", code: "KeyE", routed: "fallback" },
  { id: "heading-1", label: "Heading 1", group: "headings", accelerator: "CmdOrCtrl+1", code: "Digit1", routed: "fallback" },
  { id: "heading-2", label: "Heading 2", group: "headings", accelerator: "CmdOrCtrl+2", code: "Digit2", routed: "fallback" },
  { id: "heading-3", label: "Heading 3", group: "headings", accelerator: "CmdOrCtrl+3", code: "Digit3", routed: "fallback" },
  {
    id: "bullet-list",
    label: "Bullet List",
    group: "lists",
    accelerator: "CmdOrCtrl+Shift+8",
    code: "Digit8",
    shift: true,
    routed: "fallback",
  },
  {
    id: "ordered-list",
    label: "Numbered List",
    group: "lists",
    accelerator: "CmdOrCtrl+Shift+7",
    code: "Digit7",
    shift: true,
    routed: "fallback",
  },
  {
    id: "task-list",
    label: "Task List",
    group: "lists",
    accelerator: "CmdOrCtrl+Shift+9",
    code: "Digit9",
    shift: true,
    routed: "fallback",
  },
  {
    id: "blockquote",
    label: "Blockquote",
    group: "blocks",
    accelerator: "CmdOrCtrl+Shift+.",
    code: "Period",
    shift: true,
    routed: "fallback",
  },
  {
    id: "code-block",
    label: "Code Block",
    group: "blocks",
    accelerator: "CmdOrCtrl+Shift+E",
    code: "KeyE",
    shift: true,
    routed: "fallback",
  },
  { id: "link", label: "Link…", group: "insert", accelerator: "CmdOrCtrl+K", code: "KeyK", routed: "editor" },
];

/** The subset keyboard-shortcuts.ts owns on Windows. */
export const WINDOWS_FALLBACK_SHORTCUTS = FORMAT_SHORTCUTS.filter((shortcut) => shortcut.routed === "fallback");

export function findFormatShortcut(id: FormatActionId): FormatShortcut {
  const shortcut = FORMAT_SHORTCUTS.find((candidate) => candidate.id === id);
  if (!shortcut) throw new Error(`unknown format action: ${id}`);
  return shortcut;
}

export interface ShortcutEvent {
  code: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

/**
 * Matches a keydown against the fallback subset. Returns null when nothing
 * matches, and also when a modifier we never bind is present — Ctrl+Alt+E
 * is not Ctrl+E, and on Windows Ctrl+Alt is AltGr (used for typing real
 * characters on some layouts), so it must not be treated as a shortcut.
 */
export function matchFormatShortcut(event: ShortcutEvent): FormatActionId | null {
  if (event.altKey) return null;
  // Both are accepted rather than platform-gated: on Windows the DOM only
  // reports ctrlKey for these chords, on macOS metaKey. Requiring exactly
  // one would make the matcher untestable on the other platform for no
  // security benefit.
  if (!event.ctrlKey && !event.metaKey) return null;

  for (const shortcut of WINDOWS_FALLBACK_SHORTCUTS) {
    if (shortcut.code !== event.code) continue;
    if (!!shortcut.shift !== !!event.shiftKey) continue;
    return shortcut.id;
  }
  return null;
}

/**
 * Human-readable chord for tooltips: "⇧⌘E" on macOS, "Ctrl+Shift+E" on
 * Windows. macOS modifier order is Control, Option, Shift, Command, which
 * is the order Apple's own menus print them in.
 */
export function acceleratorLabel(accelerator: string, isMacOS: boolean): string {
  const parts = accelerator.split("+");
  const key = parts.pop() ?? "";
  // "CmdOrCtrl" is Command on macOS and Control everywhere else — it is one
  // token, so it can't be looked up as either modifier name directly.
  const has = (modifier: string) => parts.includes(modifier);
  const primary = parts.includes("CmdOrCtrl");

  if (isMacOS) {
    let label = "";
    if (has("Ctrl")) label += "⌃";
    if (has("Alt")) label += "⌥";
    if (has("Shift")) label += "⇧";
    if (primary) label += "⌘";
    return label + key;
  }

  const modifiers = [...(primary ? ["Ctrl"] : []), ...["Alt", "Shift"].filter(has)];
  return [...modifiers, key].join("+");
}

/** Toolbar tooltip: "Bold (⇧⌘B)" / "Bold (Ctrl+Shift+B)". */
export function formatShortcutTitle(id: FormatActionId, isMacOS: boolean): string {
  const shortcut = findFormatShortcut(id);
  return `${shortcut.label} (${acceleratorLabel(shortcut.accelerator, isMacOS)})`;
}
