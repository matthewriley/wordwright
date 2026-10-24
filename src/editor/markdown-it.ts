import MarkdownIt from "markdown-it";
import { taskListPlugin } from "./task-list-rule";

// The "commonmark" preset excludes both `table` and `strikethrough` even
// though they're real core markdown-it rules (not plugins) — they just need
// enabling. Task lists have no maintained plugin worth depending on (see
// task-list-rule.ts), so they're handled by a hand-rolled core rule instead.
export function createTokenizer(): MarkdownIt {
  return new MarkdownIt("commonmark", { html: false })
    .enable(["table", "strikethrough"])
    .use(taskListPlugin);
}
