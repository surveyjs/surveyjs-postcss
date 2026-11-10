import { expect, test } from "vitest";
import postcss from "postcss";
import missedSemicolon from "../rules/missed-semicolon";

async function warnings(css: string): Promise<string[]> {
  const result = await postcss([missedSemicolon()]).process(css, { from: undefined });
  return result.warnings().map((warning) => warning.text);
}

test("a custom property that swallows the next custom property is rejected", async () => {
  const found = await warnings(".a {\n  --a: 0\n    --b: var(--c);\n}");
  expect(found).toHaveLength(1);
  expect(found[0]).toContain(".a { --a }");
  expect(found[0]).toContain("\"--b\"");
});

test("a swallowed custom property is found in minified css", async () => {
  const found = await warnings(".a{--a:0 --b:var(--c)}");
  expect(found).toHaveLength(1);
  expect(found[0]).toContain("\"--b\"");
});

test("a custom property that swallows a regular property on the next line is rejected", async () => {
  const found = await warnings(".a {\n  --a: 0\n  padding: 4px;\n}");
  expect(found).toHaveLength(1);
  expect(found[0]).toContain("\"padding\"");
});

test("every swallowed declaration is reported", async () => {
  const found = await warnings(".a {\n  --a: 0\n  --b: 1\n  --c: 2;\n}");
  expect(found).toHaveLength(2);
});

test("multi-line custom property values are allowed", async () => {
  const found = await warnings(".a {\n  --a: var(--x)\n    var(--y);\n  --b: calc(\n    var(--x) + 4px\n  );\n}");
  expect(found).toHaveLength(0);
});

test("colons inside strings, url(), comments, and functions are allowed", async () => {
  const found = await warnings([
    ".a {",
    "  --a: \"--b: 1\";",
    "  --c: url(data:image/svg+xml;utf8,<svg/>);",
    "  --d: 0 /* --e: 1 */;",
    "  --f: if(style(--g: big): 10px; else: 5px);",
    "  --h: url(https://example.com/a.png);",
    "}",
  ].join("\n"));
  expect(found).toHaveLength(0);
});

test("a colon on the same line after a regular word is allowed", async () => {
  const found = await warnings(".a { --a: a:hover; --b: 12:30; }");
  expect(found).toHaveLength(0);
});

test("regular properties are left to postcss", async () => {
  const found = await warnings(".a { padding: var(--x); }");
  expect(found).toHaveLength(0);
});
