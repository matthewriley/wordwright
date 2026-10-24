import { useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type AccentId = "orange" | "teal" | "graphite" | "blue";

interface Preferences {
  themeMode: ThemeMode;
  accent: AccentId;
}

const STORAGE_KEY = "wordwright.preferences";
const THEME_MODES: ThemeMode[] = ["light", "dark", "system"];
const ACCENTS: AccentId[] = ["orange", "teal", "graphite", "blue"];
const DEFAULTS: Preferences = { themeMode: "system", accent: "orange" };

function load(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      themeMode: THEME_MODES.includes(parsed.themeMode as ThemeMode) ? (parsed.themeMode as ThemeMode) : DEFAULTS.themeMode,
      accent: ACCENTS.includes(parsed.accent as AccentId) ? (parsed.accent as AccentId) : DEFAULTS.accent,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

// A singleton controller, not React state lifted in App.tsx — menu.ts
// (Preferences…) and keyboard-shortcuts.ts (Windows Ctrl+, fallback) need
// to read/change these from outside any React context, same reason
// tabManager and ConfirmDiscardModal's controller are singletons.
class PreferencesStore {
  private prefs: Preferences = load();
  private readonly media = window.matchMedia("(prefers-color-scheme: dark)");
  private listeners = new Set<() => void>();

  constructor() {
    this.applyToDocument();
    // Only matters while themeMode is "system" — applyToDocument() is a
    // no-op read of this same media query either way, so no need to
    // guard the listener itself on the current mode.
    this.media.addEventListener("change", () => this.applyToDocument());
  }

  get themeMode(): ThemeMode {
    return this.prefs.themeMode;
  }

  get accent(): AccentId {
    return this.prefs.accent;
  }

  setThemeMode(mode: ThemeMode): void {
    this.prefs = { ...this.prefs, themeMode: mode };
    this.persistAndApply();
  }

  setAccent(accent: AccentId): void {
    this.prefs = { ...this.prefs, accent };
    this.persistAndApply();
  }

  private persistAndApply(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs));
    this.applyToDocument();
    this.listeners.forEach((listener) => listener());
  }

  private applyToDocument(): void {
    const effectiveTheme = this.prefs.themeMode === "system" ? (this.media.matches ? "dark" : "light") : this.prefs.themeMode;
    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.dataset.accent = this.prefs.accent;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): string => `${this.prefs.themeMode}:${this.prefs.accent}`;
}

// Constructed at import time (imported first thing in main.tsx, ahead of
// the render call) so the theme is applied to <html> before React's first
// paint — avoids a flash of the wrong theme on startup.
const store = new PreferencesStore();

// "Subscribe for change-detection, then re-derive the real return value
// fresh" — the same pattern useTabs()/useDocumentMeta() already use in
// editor/store.ts, reused here for the same reason: useSyncExternalStore
// needs a referentially-stable snapshot, and a cheap string sentinel is
// simpler than memoizing the returned object.
export function usePreferences() {
  useSyncExternalStore(store.subscribe, store.getSnapshot);
  return {
    themeMode: store.themeMode,
    accent: store.accent,
    setThemeMode: (mode: ThemeMode) => store.setThemeMode(mode),
    setAccent: (accent: AccentId) => store.setAccent(accent),
  };
}

