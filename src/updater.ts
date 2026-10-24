import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

// Update-flow state machine + plumbing, kept out of the component so both
// the native menu ("Check for Updates…", menu.ts) and the startup effect
// (App.tsx) can drive it — same imperative-controller shape as
// PreferencesModal/ConfirmDiscardModal. The pending `Update` is a Rust-side
// Resource, so it lives here on the controller rather than in the React
// snapshot, and must be closed if the user declines the install.
export type UpdateDialogState =
  | { kind: "hidden" }
  | { kind: "checking" }
  | { kind: "available"; version: string; currentVersion: string }
  | { kind: "downloading"; downloaded: number; total: number | undefined }
  | { kind: "ready"; version: string }
  | { kind: "up-to-date"; version: string }
  | { kind: "error"; message: string };

class UpdateController {
  private state: UpdateDialogState = { kind: "hidden" };
  private listeners = new Set<() => void>();
  private pending: Update | null = null;
  // Guards against overlapping runs — a manual check during the silent
  // startup check (or a double-clicked menu item) must not start a second
  // download on top of one in flight.
  private busy = false;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): UpdateDialogState => this.state;

  private set(state: UpdateDialogState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  // manual=true comes from the menu item and always shows an outcome
  // (up-to-date / error included); manual=false is the silent startup
  // check, which only surfaces when there is actually an update to offer.
  async check(manual: boolean): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    if (manual) this.set({ kind: "checking" });
    try {
      const update = await check();
      if (update) {
        this.pending = update;
        this.set({ kind: "available", version: update.version, currentVersion: update.currentVersion });
      } else if (manual) {
        this.set({ kind: "up-to-date", version: await getVersion() });
      }
    } catch (error) {
      // Offline, no release published yet, dev build outside a bundle —
      // all routine for the startup check, so it stays silent.
      if (manual) this.set({ kind: "error", message: String(error) });
      else console.warn("update check failed:", error);
    } finally {
      this.busy = false;
    }
  }

  async downloadAndInstall(): Promise<void> {
    const update = this.pending;
    if (!update || this.busy) return;
    this.busy = true;
    let downloaded = 0;
    let total: number | undefined;
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength;
          this.set({ kind: "downloading", downloaded: 0, total });
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          this.set({ kind: "downloading", downloaded, total });
        }
        // "Finished" is followed by the install, so the state only
        // advances once downloadAndInstall()'s promise resolves below.
      });
      this.pending = null;
      this.set({ kind: "ready", version: update.version });
    } catch (error) {
      this.pending = null;
      void update.close();
      this.set({ kind: "error", message: String(error) });
    } finally {
      this.busy = false;
    }
  }

  async relaunch(): Promise<void> {
    await relaunch();
  }

  dismiss(): void {
    if (this.pending) {
      void this.pending.close();
      this.pending = null;
    }
    this.set({ kind: "hidden" });
  }
}

const controller = new UpdateController();

export const useUpdateDialogSubscribe = controller.subscribe;
export const getUpdateDialogSnapshot = controller.getSnapshot;
export const checkForUpdates = (manual: boolean): Promise<void> => controller.check(manual);
export const downloadAndInstallUpdate = (): Promise<void> => controller.downloadAndInstall();
export const relaunchToApplyUpdate = (): Promise<void> => controller.relaunch();
export const dismissUpdateDialog = (): void => controller.dismiss();
