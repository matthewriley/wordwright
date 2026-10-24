import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { tabManager, useEditorState } from "./store";
import { findMatches, findReplaceKey } from "./find-replace-plugin";
import "../styles/find-bar.css";

// ProseMirror's own tr.scrollIntoView() goes through EditorView's
// scrollToSelection(), which reads the browser's actual DOM selection and
// bails out ("ignore selections outside the editor") whenever that
// selection isn't inside the editor's own DOM — which is always true here,
// since the find bar deliberately keeps focus in its own <input> (see
// goTo() below). Confirmed live: tr.scrollIntoView() silently did nothing
// while the bar had focus. Scrolling the active match's own decoration
// element directly sidesteps ProseMirror's selection/focus requirement
// entirely.
function scrollActiveMatchIntoView(view: EditorView) {
  view.dom.querySelector(".find-match-active")?.scrollIntoView({ block: "center", inline: "nearest" });
}

interface FindBarState {
  open: boolean;
  focusToken: number;
  prefill: string | null;
}

// Same imperative-controller shape as ConfirmDiscardModal/PreferencesModal
// — menu.ts ("Find…") and keyboard-shortcuts.ts (Windows Ctrl+F fallback)
// need to open this from outside any React context. focusToken exists so
// re-requesting focus (Ctrl+F while already open, on Windows) still does
// something even though `open` itself doesn't change — a plain boolean
// wouldn't produce a new snapshot for useSyncExternalStore to react to.
class FindBarController {
  private state: FindBarState = { open: false, focusToken: 0, prefill: null };
  private listeners = new Set<() => void>();

  show(prefill: string | null): void {
    this.state = { open: true, focusToken: this.state.focusToken + 1, prefill };
    this.notify();
  }

  hide(): void {
    this.state = { ...this.state, open: false };
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): FindBarState => this.state;
}

const controller = new FindBarController();

export function openFindBar(): void {
  // Pre-populates the query with the current editor selection, if any —
  // matches Cmd+F in most editors/browsers. Read here, at the moment of
  // opening, since this is called from non-React contexts (menu.ts,
  // keyboard-shortcuts.ts) that have no component state of their own.
  const view = tabManager.activeDocument()?.view;
  const selection = view?.state.selection;
  const prefill = selection && !selection.empty ? view!.state.doc.textBetween(selection.from, selection.to, " ") : null;
  controller.show(prefill);
}

export function closeFindBar(): void {
  controller.hide();
}

export function FindBar() {
  const { open, focusToken, prefill } = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const editorState = useEditorState();
  const [query, setQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const queryInputRef = useRef<HTMLInputElement>(null);
  // setQuery(prefill) below only takes effect on the *next* render — the
  // input's DOM value isn't updated yet in this same effect pass, so
  // calling .select() immediately here would select the stale prior
  // value. This flag defers the actual focus+select to the effect below,
  // which reacts to `query` and therefore runs after that render commits.
  const pendingPrefillSelect = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (prefill) {
      setQuery(prefill);
      pendingPrefillSelect.current = true;
    } else {
      queryInputRef.current?.focus();
    }
  }, [open, focusToken, prefill]);

  useEffect(() => {
    if (!pendingPrefillSelect.current) return;
    pendingPrefillSelect.current = false;
    queryInputRef.current?.focus();
    // select(), not just focus() — typing should immediately replace the
    // prefilled text, matching Cmd+F in most editors/browsers.
    queryInputRef.current?.select();
  }, [query]);

  // Pushes query/matchCase into the active tab's plugin state, always
  // jumping to the first match on a fresh search (any change to what
  // we're searching for restarts navigation, rather than pointing at a
  // stale index into the new match list) — and, in that same transaction,
  // moves the selection there and scrolls it into view, exactly like
  // goTo() below. Originally this was two separate dispatches (one for
  // the meta, a second reading the resulting plugin state back out to
  // scroll); that never actually scrolled on the first search (confirmed
  // live). Computing the match here and folding everything into one
  // transaction matches the pattern that does work.
  useEffect(() => {
    if (!open) return;
    const view = tabManager.activeDocument()?.view;
    if (!view) return;
    const found = findMatches(view.state.doc, query, matchCase);
    let tr = view.state.tr.setMeta(findReplaceKey, { query, matchCase, activeMatch: found.length ? 0 : -1 });
    if (found.length > 0) tr = tr.setSelection(TextSelection.create(view.state.doc, found[0].from, found[0].to));
    view.dispatch(tr);
    if (found.length > 0) scrollActiveMatchIntoView(view);
  }, [open, query, matchCase]);

  if (!open) return null;

  const findState = editorState ? findReplaceKey.getState(editorState) : undefined;
  const matches = findState?.matches ?? [];
  const activeMatch = findState?.activeMatch ?? -1;

  function goTo(direction: 1 | -1) {
    const view = tabManager.activeDocument()?.view;
    if (!view || matches.length === 0) return;
    const nextIndex = (activeMatch + direction + matches.length) % matches.length;
    const match = matches[nextIndex];
    const selection = TextSelection.create(view.state.doc, match.from, match.to);
    view.dispatch(view.state.tr.setSelection(selection).setMeta(findReplaceKey, { activeMatch: nextIndex }));
    scrollActiveMatchIntoView(view);
    // Deliberately no view.focus() here — this runs from the query
    // input's own Enter handler, and stealing focus into the editor mid-
    // cycle meant a second Enter landed in ProseMirror instead of the
    // find bar, splitting a paragraph at the just-selected match
    // (confirmed live). Leaving focus alone keeps repeated Enter cycling
    // through matches, matching Cmd+F in every other editor.
  }

  function replaceCurrent() {
    const view = tabManager.activeDocument()?.view;
    if (!view || activeMatch < 0) return;
    const match = matches[activeMatch];
    view.dispatch(view.state.tr.insertText(replaceText, match.from, match.to));
  }

  function replaceAll() {
    const view = tabManager.activeDocument()?.view;
    if (!view || matches.length === 0) return;
    let tr = view.state.tr;
    for (const match of [...matches].reverse()) tr = tr.insertText(replaceText, match.from, match.to);
    view.dispatch(tr);
  }

  function close() {
    // Clears the plugin's query directly, rather than via setQuery("")
    // relying on the effect above — that effect bails out as soon as
    // `open` becomes false, so it would never fire the clearing dispatch
    // (confirmed live: Esc closed the bar but left every match
    // highlighted). Clearing here removes the decorations immediately,
    // regardless of render order.
    const view = tabManager.activeDocument()?.view;
    if (view) view.dispatch(view.state.tr.setMeta(findReplaceKey, { query: "", activeMatch: -1 }));
    setQuery("");
    closeFindBar();
    view?.focus();
  }

  function handleQueryKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      goTo(event.shiftKey ? -1 : 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  return (
    <div className="find-bar">
      <div className="find-bar-row">
        <input
          ref={queryInputRef}
          type="text"
          className="find-bar-input"
          placeholder="Find"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleQueryKeyDown}
        />
        <span className="find-bar-count">{matches.length ? `${activeMatch + 1} of ${matches.length}` : query ? "No results" : ""}</span>
        <button type="button" className="find-bar-icon-button" title="Previous match" disabled={!matches.length} onClick={() => goTo(-1)}>
          <ChevronUp size={14} strokeWidth={2} />
        </button>
        <button type="button" className="find-bar-icon-button" title="Next match" disabled={!matches.length} onClick={() => goTo(1)}>
          <ChevronDown size={14} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="find-bar-case-toggle"
          data-on={matchCase ? "true" : undefined}
          title="Match case"
          onClick={() => setMatchCase((v) => !v)}
        >
          Aa
        </button>
        <button type="button" className="find-bar-icon-button" title="Close" onClick={close}>
          <X size={14} strokeWidth={2} />
        </button>
      </div>
      <div className="find-bar-row">
        <input
          type="text"
          className="find-bar-input"
          placeholder="Replace"
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            }
          }}
        />
        <button type="button" className="find-bar-text-button" disabled={activeMatch < 0} onClick={replaceCurrent}>
          Replace
        </button>
        <button type="button" className="find-bar-text-button" disabled={!matches.length} onClick={replaceAll}>
          Replace All
        </button>
      </div>
    </div>
  );
}
