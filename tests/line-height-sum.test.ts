import { expect, test } from "vitest";
import postcss from "postcss";
import lineHeightSum from "../rules/line-height-sum";

async function warnings(css: string): Promise<string[]> {
  const result = await postcss([lineHeightSum()]).process(css, { from: undefined });
  return result.warnings().map((warning) => warning.text);
}

test("line-height custom property is rejected as a calc addend", async () => {
  const found = await warnings(".a { width: calc(var(--sjs2-line-height-x300) + var(--sjs2-spacing-x600)); }");
  expect(found).toHaveLength(1);
  expect(found[0]).toContain(".a { width }");
  expect(found[0]).toContain("--sjs2-line-height-x300");
});

test("line-height custom property is rejected as a subtrahend inside parentheses", async () => {
  const found = await warnings(".a { margin-top: calc(var(--sjs2-spacing-x050) + (var(--sjs2-typography-line-height-medium) - var(--sjs2-size-x300)) / 2); }");
  expect(found).toHaveLength(1);
  expect(found[0]).toContain("--sjs2-typography-line-height-medium");
});

test("line-height custom property with a length fallback is still rejected", async () => {
  const found = await warnings(".a { padding-bottom: calc(var(--sjs2-spacing-x500, 40px) + var(--sjs2-typography-line-height-component-action-large-content, 24px)); }");
  expect(found).toHaveLength(1);
  expect(found[0]).toContain("--sjs2-typography-line-height-component-action-large-content");
});

test("multiplying a line-height custom property is allowed", async () => {
  const found = await warnings(".a { max-height: calc(3 * var(--sjs2-typography-line-height-medium)); height: calc(var(--sjs2-base-unit-line-height) * 17); }");
  expect(found).toHaveLength(0);
});

test("a product that contains a line-height custom property can be an addend", async () => {
  const found = await warnings(".a { width: calc(var(--sjs2-spacing-x200) + 3 * var(--sjs2-line-height-x300)); }");
  expect(found).toHaveLength(0);
});

test("1lh added to a length is allowed", async () => {
  const found = await warnings(".a { min-height: calc(1lh + var(--sjs2-spacing-x500)); }");
  expect(found).toHaveLength(0);
});

test("using a line-height custom property as line-height is allowed", async () => {
  const found = await warnings(".a { line-height: var(--sjs2-line-height-x300); min-height: var(--sjs2-line-height-x600); }");
  expect(found).toHaveLength(0);
});

test("adding a length custom property is allowed", async () => {
  const found = await warnings(".a { width: calc(var(--sjs2-spacing-x200) + var(--sjs2-size-x300)); }");
  expect(found).toHaveLength(0);
});

test("min, max, and clamp reject a line-height addend", async () => {
  const found = await warnings(".a { width: min(100%, var(--sjs2-line-height-x300) + 4px); height: clamp(10px, var(--sjs2-line-height-x300) + 4px, 40px); }");
  expect(found).toHaveLength(2);
});
