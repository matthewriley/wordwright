import { useEffect, useRef, useSyncExternalStore, type MouseEvent } from "react";
import { platform } from "@tauri-apps/plugin-os";
import {
  dismissUpdateDialog,
  downloadAndInstallUpdate,
  getUpdateDialogSnapshot,
  relaunchToApplyUpdate,
  useUpdateDialogSubscribe,
} from "../updater";
import "../styles/update-dialog.css";

// The update flow's only UI. Reuses .link-modal's chrome like
// PreferencesModal does; .update-dialog adds just the progress bar and
// body layout. Per-platform split in the "ready" state: on macOS the
// update is already swapped in and only needs a relaunch, while on
// Windows downloadAndInstall() hands off to the NSIS installer and exits
// the app itself, so there's nothing left to ask (or click).
export function UpdateDialog() {
  const state = useSyncExternalStore(useUpdateDialogSubscribe, getUpdateDialogSnapshot);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = state.kind !== "hidden";
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) dismissUpdateDialog();
  }

  // Escape/backdrop dismissal is suspended mid-check and mid-download —
  // closing then would strand an in-flight operation with no visible
  // outcome. Every other state dismisses freely.
  const dismissable = state.kind !== "checking" && state.kind !== "downloading";

  return (
    <dialog
      ref={dialogRef}
      className="link-modal update-dialog"
      onCancel={(event) => {
        if (!dismissable) event.preventDefault();
        else dismissUpdateDialog();
      }}
      onClick={dismissable ? handleBackdropClick : undefined}
    >
      <h2>{titleFor(state)}</h2>
      <div className="update-dialog-body">{bodyFor(state)}</div>
      <div className="link-modal-actions">{actionsFor(state)}</div>
    </dialog>
  );
}

function titleFor(state: ReturnType<typeof getUpdateDialogSnapshot>): string {
  switch (state.kind) {
    case "checking":
      return "Check for Updates";
    case "available":
      return "Update Available";
    case "downloading":
      return "Downloading Update";
    case "ready":
      return "Update Ready";
    case "up-to-date":
      return "Up to Date";
    case "error":
      return "Update Failed";
    default:
      return "Check for Updates";
  }
}

function bodyFor(state: ReturnType<typeof getUpdateDialogSnapshot>) {
  switch (state.kind) {
    case "checking":
      return <p>Checking for updates…</p>;
    case "available":
      return (
        <p>
          Wordwright {state.version} is available — you have {state.currentVersion}.
        </p>
      );
    case "downloading": {
      const percent = state.total ? Math.min(100, Math.round((state.downloaded / state.total) * 100)) : undefined;
      return (
        <>
          <div className="update-dialog-progress">
            <div className="update-dialog-progress-fill" style={{ width: percent !== undefined ? `${percent}%` : "100%" }} data-indeterminate={percent === undefined ? "true" : undefined} />
          </div>
          <p>{percent !== undefined ? `${percent}%` : "Downloading…"}</p>
        </>
      );
    }
    case "ready":
      return platform() === "macos" ? (
        <p>Wordwright {state.version} is installed. Restart to apply it.</p>
      ) : (
        <p>Wordwright will now close so the installer can finish updating it, then reopen.</p>
      );
    case "up-to-date":
      return <p>Wordwright {state.version} is up to date.</p>;
    case "error":
      return <p>Couldn’t check for updates. {state.message}</p>;
    default:
      return null;
  }
}

function actionsFor(state: ReturnType<typeof getUpdateDialogSnapshot>) {
  switch (state.kind) {
    case "available":
      return (
        <>
          <button type="button" onClick={() => dismissUpdateDialog()}>
            Later
          </button>
          <button type="submit" autoFocus onClick={() => void downloadAndInstallUpdate()}>
            Download and Install
          </button>
        </>
      );
    case "ready":
      // Windows exits on its own once the installer takes over — nothing
      // to click; macOS waits for an explicit restart (or the next
      // natural relaunch if the user picks Later).
      return platform() === "macos" ? (
        <>
          <button type="button" onClick={() => dismissUpdateDialog()}>
            Later
          </button>
          <button type="submit" autoFocus onClick={() => void relaunchToApplyUpdate()}>
            Restart Now
          </button>
        </>
      ) : null;
    case "up-to-date":
    case "error":
      return (
        <button type="button" onClick={() => dismissUpdateDialog()}>
          Done
        </button>
      );
    default:
      return null;
  }
}

