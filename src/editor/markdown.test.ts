import { describe, expect, it } from "vitest";
import { markdownParser } from "./markdown-parser";
import { markdownSerializer } from "./markdown-serializer";

function roundTrip(markdown: string): string {
  return markdownSerializer.serialize(markdownParser.parse(markdown)!);
}

// Round-trip fidelity is semantic/idempotent, not byte-identical (#003):
// no content loss, and stable after the first save. So each case asserts
// idempotence (serialize(parse(md)) is a fixed point under a second
// parse/serialize pass) rather than exact equality with the input string.
function expectIdempotent(markdown: string) {
  const once = roundTrip(markdown);
  const twice = roundTrip(once);
  expect(twice).toBe(once);
  return once;
}

describe("markdown round-trip", () => {
  it("headings h1-h6", () => {
    const out = expectIdempotent("# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six\n");
    for (const text of ["One", "Two", "Three", "Four", "Five", "Six"]) {
      expect(out).toContain(text);
    }
  });

  it("bold, italic, strikethrough, and code marks", () => {
    const out = expectIdempotent("**bold** *italic* ~~strike~~ `code`\n");
    expect(out).toContain("**bold**");
    expect(out).toContain("*italic*");
    expect(out).toContain("~~strike~~");
    expect(out).toContain("`code`");
  });

  it("links", () => {
    const out = expectIdempotent("[Wordwright](https://example.com \"title\")\n");
    expect(out).toContain("https://example.com");
    expect(out).toContain("Wordwright");
  });

  it("images", () => {
    const out = expectIdempotent("![alt text](image.png)\n");
    expect(out).toContain("image.png");
    expect(out).toContain("alt text");
  });

  it("nested unordered and ordered lists", () => {
    const md = "- one\n  1. nested a\n  2. nested b\n- two\n";
    const out = expectIdempotent(md);
    expect(out).toContain("one");
    expect(out).toContain("nested a");
    expect(out).toContain("nested b");
    expect(out).toContain("two");
  });

  it("task lists, checked and unchecked", () => {
    const doc = markdownParser.parse("- [x] done\n- [ ] not done\n")!;
    let sawChecked = false;
    let sawUnchecked = false;
    doc.descendants((node) => {
      if (node.type.name === "task_item") {
        if (node.attrs.checked) sawChecked = true;
        else sawUnchecked = true;
      }
    });
    expect(sawChecked).toBe(true);
    expect(sawUnchecked).toBe(true);

    const out = expectIdempotent("- [x] done\n- [ ] not done\n");
    expect(out).toContain("[x] done");
    expect(out).toContain("[ ] not done");
  });

  it("blockquotes", () => {
    const out = expectIdempotent("> quoted text\n");
    expect(out).toContain("> quoted text");
  });

  it("fenced code blocks preserve the language info string", () => {
    const doc = markdownParser.parse("```ts\nconst x = 1;\n```\n")!;
    let params: string | undefined;
    doc.descendants((node) => {
      if (node.type.name === "code_block") params = node.attrs.params;
    });
    expect(params).toBe("ts");

    const out = expectIdempotent("```ts\nconst x = 1;\n```\n");
    expect(out).toContain("```ts");
    expect(out).toContain("const x = 1;");
  });

  it("horizontal rules", () => {
    const out = expectIdempotent("above\n\n---\n\nbelow\n");
    expect(out).toContain("---");
    expect(out).toContain("above");
    expect(out).toContain("below");
  });

  it("GFM tables with mixed column alignment", () => {
    const md = "| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |\n";
    const doc = markdownParser.parse(md)!;
    const alignments: (string | null)[] = [];
    doc.descendants((node) => {
      if (node.type.name === "table_header") alignments.push(node.attrs.alignment);
    });
    expect(alignments).toEqual(["left", "center", "right"]);

    const out = expectIdempotent(md);
    expect(out).toContain(":---");
    expect(out).toContain(":---:");
    expect(out).toContain("---:");
    expect(out).toContain("a");
    expect(out).toContain("b");
    expect(out).toContain("c");
  });

  it("hard breaks", () => {
    const out = expectIdempotent("line one  \nline two\n");
    expect(out).toContain("line one");
    expect(out).toContain("line two");
  });

  it("loses no top-level content across a mixed document", () => {
    const md = [
      "# Title",
      "",
      "Some **bold** and *italic* text with a [link](https://example.com).",
      "",
      "- item one",
      "- item two",
      "",
      "- [x] done task",
      "- [ ] open task",
      "",
      "> a quote",
      "",
      "```js",
      "console.log('hi')",
      "```",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
    ].join("\n");

    const out = expectIdempotent(md);
    for (const text of ["Title", "bold", "italic", "link", "item one", "item two", "done task", "open task", "a quote", "console.log", "1", "2"]) {
      expect(out).toContain(text);
    }
  });
});
