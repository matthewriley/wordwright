import { describe, expect, it } from "vitest";
import {
  acceleratorLabel,
  FORMAT_SHORTCUTS,
  formatShortcutTitle,
  matchFormatShortcut,
  WINDOWS_FALLBACK_SHORTCUTS,
  type FormatActionId,
} from "./format-shortcuts";

// spec 008 keeps two representations of every chord: the string handed to
// Tauri/muda for the native menu, and the KeyboardEvent.code the Windows
// listener compares against. They cannot be checked against each other
// automatically (one is parsed by Rust, the other by the DOM), so this
// table pins the mapping by hand — a typo in either column fails here
// instead of silently leaving one platform without a working shortcut.
const CODE_FOR_ACCELERATOR_KEY: Record<string, string> = {
  B: "KeyB",
  I: "KeyI",
  E: "KeyE",
  K: "KeyK",
  X: "KeyX",
  1: "Digit1",
  2: "Digit2",
  3: "Digit3",
  7: "Digit7",
  8: "Digit8",
  9: "Digit9",
  ".": "Period",
};

describe("format shortcut table", () => {
  it("has one entry per formatting action", () => {
    expect(FORMAT_SHORTCUTS).toHaveLength(13);
    expect(new Set(FORMAT_SHORTCUTS.map((shortcut) => shortcut.id)).size).toBe(13);
  });

  it("binds a unique chord to every action", () => {
    const chords = FORMAT_SHORTCUTS.map((shortcut) => `${shortcut.code}${shortcut.shift ? "+shift" : ""}`);
    expect(new Set(chords).size).toBe(chords.length);
  });

  it("keeps the menu accelerator and the DOM code in agreement", () => {
    for (const shortcut of FORMAT_SHORTCUTS) {
      const [modifier, ...rest] = shortcut.accelerator.split("+");
      expect(modifier).toBe("CmdOrCtrl");

      const shiftInAccelerator = rest.includes("Shift");
      const key = rest.filter((part) => part !== "Shift").join("+");

      expect(shiftInAccelerator).toBe(!!shortcut.shift);
      expect(shortcut.code).toBe(CODE_FOR_ACCELERATOR_KEY[key]);
    }
  });

  it("leaves the editor-owned chords to ProseMirror and Editor.tsx", () => {
    // Binding any of these in the Windows fallback would run the command
    // twice per keystroke: the editor already handles them there.
    const editorOwned = FORMAT_SHORTCUTS.filter((shortcut) => shortcut.routed === "editor").map((shortcut) => shortcut.id);
    expect(editorOwned).toEqual(["bold", "italic", "link"]);
    expect(WINDOWS_FALLBACK_SHORTCUTS).toHaveLength(10);
    expect(WINDOWS_FALLBACK_SHORTCUTS.some((shortcut) => editorOwned.includes(shortcut.id))).toBe(false);
  });
});

describe("matchFormatShortcut", () => {
  function match(id: FormatActionId, event: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean } = {}) {
    const shortcut = FORMAT_SHORTCUTS.find((candidate) => candidate.id === id)!;
    // Default to the action's own modifiers; `event` overrides them, so a
    // test can ask "what does Shift+E match?" by changing only shiftKey.
    return matchFormatShortcut({ code: shortcut.code, ctrlKey: true, shiftKey: !!shortcut.shift, ...event });
  }

  it("matches every fallback action with its own chord", () => {
    for (const shortcut of WINDOWS_FALLBACK_SHORTCUTS) {
      const result = matchFormatShortcut({ code: shortcut.code, ctrlKey: true, shiftKey: !!shortcut.shift });
      expect(result).toBe(shortcut.id);
    }
  });

  it("distinguishes chords that share a key", () => {
    // E is inline code, Shift+E is a code block.
    expect(match("inline-code")).toBe("inline-code");
    expect(match("code-block")).toBe("code-block");
  });

  it("requires the exact shift state", () => {
    // Shift turns inline code into a code block; the unbound Shift variant
    // of a heading must not fall through to the unshifted heading.
    expect(match("code-block", { shiftKey: true })).toBe("code-block");
    expect(match("inline-code", { shiftKey: false })).toBe("inline-code");
    expect(match("heading-1", { shiftKey: true })).toBeNull();
  });

  it("ignores plain typing and AltGr-style chords", () => {
    expect(match("bold", { ctrlKey: false })).toBeNull();
    expect(match("bold", { altKey: true })).toBeNull();
    // Ctrl+Shift+B is not bound to anything (bold is Ctrl+B only).
    expect(match("bold", { shiftKey: true })).toBeNull();
    // A bare key with no modifier is typing, not a shortcut.
    expect(matchFormatShortcut({ code: "KeyB" })).toBeNull();
  });

  it("does not claim the editor-owned chords", () => {
    for (const id of ["bold", "italic", "link"] as const) {
      expect(match(id)).toBeNull();
    }
  });

  it("accepts Cmd instead of Ctrl, so the same matcher works when simulated", () => {
    expect(matchFormatShortcut({ code: "KeyX", metaKey: true, shiftKey: true })).toBe("strikethrough");
  });
});

describe("acceleratorLabel", () => {
  it("prints macOS modifiers in Apple's order", () => {
    expect(acceleratorLabel("CmdOrCtrl+E", true)).toBe("⌘E");
    expect(acceleratorLabel("CmdOrCtrl+Shift+E", true)).toBe("⇧⌘E");
    expect(acceleratorLabel("CmdOrCtrl+Shift+.", true)).toBe("⇧⌘.");
  });

  it("prints Windows chords plainly", () => {
    expect(acceleratorLabel("CmdOrCtrl+E", false)).toBe("Ctrl+E");
    expect(acceleratorLabel("CmdOrCtrl+Shift+8", false)).toBe("Ctrl+Shift+8");
  });

  it("labels each action for the toolbar tooltip", () => {
    expect(formatShortcutTitle("bold", true)).toBe("Bold (⌘B)");
    expect(formatShortcutTitle("code-block", false)).toBe("Code Block (Ctrl+Shift+E)");
  });
});
