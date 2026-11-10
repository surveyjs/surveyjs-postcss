import { expect, test } from "vitest";
import postcss from "postcss";
import surveyjs from "../index";

async function warnings(css: string): Promise<string[]> {
  const result = await postcss([surveyjs()]).process(css, { from: undefined });
  return result.warnings().map((warning) => warning.text);
}

test("the combined plugin runs the line-height-sum rule", async () => {
  const found = await warnings(".a { height: calc(var(--sjs2-line-height-x300) + var(--sjs2-spacing-x500)); }");
  expect(found).toHaveLength(1);
  expect(found[0]).toContain("--sjs2-line-height-x300");
});

test("the combined plugin runs the missed-semicolon rule", async () => {
  const found = await warnings(".a {\n  --a: 0\n  --b: 1px;\n}");
  expect(found).toHaveLength(1);
  expect(found[0]).toContain("\"--b\"");
});

test("the combined plugin accepts valid CSS", async () => {
  const found = await warnings(".a { line-height: var(--sjs2-line-height-x300); height: calc(1lh + var(--sjs2-spacing-x500)); }");
  expect(found).toHaveLength(0);
});

test("the combined plugin exposes its rules by name", () => {
  expect(Object.keys(surveyjs.rules)).toEqual(["line-height-sum", "missed-semicolon"]);
});
