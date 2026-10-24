import { useEffect, useRef, useSyncExternalStore, type MouseEvent } from "react";
import { Check } from "lucide-react";
import { usePreferences, type AccentId, type ThemeMode } from "../preferences";
import "../styles/preferences.css";

// Same imperative-controller shape as ConfirmDiscardModal — this needs to
// be triggerable from menu.ts (native "Preferences…" item) and
// keyboard-shortcuts.ts (Windows Ctrl+, fallback), neither of which is a
// React context. Unlike ConfirmDiscardModal this doesn't block on a
// choice: changes in the panel apply live via usePreferences()'s setters,
// so open()/close() take no payload and return nothing.
class PreferencesModalController {
  private open = false;
  private listeners = new Set<() => void>();

  show(): void {
    this.open = true;
    this.notify();
  }

  hide(): void {
    this.open = false;
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): boolean => this.open;
}

const controller = new PreferencesModalController();

export function openPreferences(): void {
  controller.show();
}

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const ACCENT_OPTIONS: { value: AccentId; label: string }[] = [
  { value: "orange", label: "Orange" },
  { value: "teal", label: "Teal" },
  { value: "graphite", label: "Graphite" },
  { value: "blue", label: "Blue" },
];

export function PreferencesModal() {
  const open = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const { themeMode, accent, setThemeMode, setAccent } = usePreferences();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) controller.hide();
  }

  return (
    <dialog ref={dialogRef} className="link-modal preferences-modal" onCancel={() => controller.hide()} onClick={handleBackdropClick}>
      <h2>Preferences</h2>

      <div className="preferences-section">
        <span className="preferences-label">Appearance</span>
        <div className="preferences-theme-options" role="radiogroup" aria-label="Appearance">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={themeMode === option.value}
              className="preferences-theme-option"
              data-on={themeMode === option.value ? "true" : undefined}
              onClick={() => setThemeMode(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="preferences-section">
        <span className="preferences-label">Accent color</span>
        <div className="preferences-accent-swatches" role="radiogroup" aria-label="Accent color">
          {ACCENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={accent === option.value}
              className="preferences-accent-swatch"
              data-accent-swatch={option.value}
              title={option.label}
              onClick={() => setAccent(option.value)}
            >
              {accent === option.value && <Check size={14} strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      </div>

      <div className="link-modal-actions">
        <button type="button" onClick={() => controller.hide()}>
          Done
        </button>
      </div>
    </dialog>
  );
}
