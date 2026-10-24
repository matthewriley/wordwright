import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";

export interface Match {
  from: number;
  to: number;
}

interface FindState {
  query: string;
  matchCase: boolean;
  matches: Match[];
  activeMatch: number;
  decorations: DecorationSet;
}

interface FindMeta {
  query?: string;
  matchCase?: boolean;
  activeMatch?: number;
}

export const findReplaceKey = new PluginKey<FindState>("find-replace");

// Walks the doc once building a flat text string plus a position map,
// rather than searching each text node in isolation — a per-node
// String.indexOf would miss a match spanning a mark boundary (e.g. "hello"
// bold immediately followed by " world" plain is one continuous piece of
// visible text, split across two text nodes). A non-matching separator
// between blocks keeps a match from spanning a block boundary, which
// wouldn't make sense to highlight/replace as one span anyway.
export function findMatches(doc: PMNode, query: string, matchCase: boolean): Match[] {
  if (!query) return [];

  let text = "";
  const posMap: number[] = [];
  doc.descendants((node, pos) => {
    if (node.isText) {
      const nodeText = node.text!;
      for (let i = 0; i < nodeText.length; i++) posMap.push(pos + i);
      text += nodeText;
    } else if (node.isBlock && text.length > 0 && text[text.length - 1] !== "\n") {
      posMap.push(-1);
      text += "\n";
    }
  });

  const haystack = matchCase ? text : text.toLowerCase();
  const needle = matchCase ? query : query.toLowerCase();
  const matches: Match[] = [];
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    const from = posMap[idx];
    const to = posMap[idx + needle.length - 1] + 1;
    if (from !== undefined && from !== -1) matches.push({ from, to });
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return matches;
}

function buildDecorations(doc: PMNode, matches: Match[], activeMatch: number): DecorationSet {
  const decorations = matches.map((match, i) =>
    Decoration.inline(match.from, match.to, { class: i === activeMatch ? "find-match find-match-active" : "find-match" }),
  );
  return DecorationSet.create(doc, decorations);
}

export function findReplacePlugin(): Plugin<FindState> {
  return new Plugin<FindState>({
    key: findReplaceKey,
    state: {
      init: () => ({ query: "", matchCase: false, matches: [], activeMatch: -1, decorations: DecorationSet.empty }),
      apply(tr, prev) {
        const meta = tr.getMeta(findReplaceKey) as FindMeta | undefined;
        let { query, matchCase, activeMatch } = prev;
        let queryChanged = false;
        let activeMatchChanged = false;

        if (meta) {
          if (meta.query !== undefined && meta.query !== query) {
            query = meta.query;
            queryChanged = true;
          }
          if (meta.matchCase !== undefined && meta.matchCase !== matchCase) {
            matchCase = meta.matchCase;
            queryChanged = true;
          }
          if (meta.activeMatch !== undefined && meta.activeMatch !== activeMatch) {
            activeMatch = meta.activeMatch;
            activeMatchChanged = true;
          }
        }

        // Navigating next/prev dispatches a transaction carrying only an
        // activeMatch meta update — no doc change, no query change. The
        // original guard here only checked docChanged/queryChanged, so it
        // discarded that meta and returned `prev` unchanged: the active
        // highlight and match count never moved (confirmed live).
        if (!tr.docChanged && !queryChanged && !activeMatchChanged) return prev;

        // Reuse the previous match list when neither the document nor the
        // search itself changed (a pure navigation step) — recomputing
        // would just reproduce the same positions.
        const matches = tr.docChanged || queryChanged ? findMatches(tr.doc, query, matchCase) : prev.matches;
        if (activeMatch >= matches.length) activeMatch = matches.length ? 0 : -1;
        if (activeMatch < 0 && matches.length) activeMatch = 0;

        return { query, matchCase, matches, activeMatch, decorations: buildDecorations(tr.doc, matches, activeMatch) };
      },
    },
    props: {
      decorations(state) {
        return findReplaceKey.getState(state)?.decorations ?? DecorationSet.empty;
      },
    },
  });
}
