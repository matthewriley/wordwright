import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openFileByPath } from "./file-operations";

// Paths queued Rust-side (lib.rs's PendingOpens) before the frontend had a
// listener attached — this instance's own launch argv (Windows/Linux) or
// the first RunEvent::Opened (macOS), both of which can fire before React
// has mounted. Called once on startup, before deciding whether to seed the
// sample document, so a real launch file always wins that race.
export async function checkLaunchFiles(): Promise<boolean> {
  const paths = await invoke<string[]>("take_pending_files");
  for (const path of paths) await openFileByPath(path);
  return paths.length > 0;
}

// Catches anything that arrives *after* startup — a later "Open With" (or
// double-click) while Wordwright is already running, which lib.rs's
// queue_open also best-effort emits as a live event once the window has
// already been brought to front.
export function installOsFileOpenListener(): () => void {
  const unlistenPromise = listen<string>("open-file", (event) => {
    void openFileByPath(event.payload);
  });
  return () => {
    void unlistenPromise.then((unlisten) => unlisten());
  };
}
