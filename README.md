# postcss-surveyjs

A PostCSS plugin that checks SurveyJS CSS for patterns that break when a theme overrides design tokens. It does not change the CSS. It only reports warnings.

## Usage

```sh
npm install --save-dev postcss postcss-surveyjs
```

To fail a build on any warning, pair it with [postcss-fail-on-warn](https://www.npmjs.com/package/postcss-fail-on-warn), the same way the `test:postcss` scripts in survey-library and survey-creator do:

```sh
postcss build/survey-core.css -u postcss-surveyjs -u postcss-fail-on-warn -o survey-core.postcss.css
```

From JavaScript:

```js
const postcss = require("postcss");
const surveyjs = require("postcss-surveyjs");

const result = await postcss([surveyjs()]).process(css, { from: "survey-core.css" });
result.warnings().forEach((warning) => console.log(warning.toString()));
```

`postcss-surveyjs` runs every rule. To run a single rule, use `require("postcss-surveyjs/rules/<rule-name>")` or `surveyjs.rules["<rule-name>"]`.

## Rules

### line-height-sum

A line-height token is a number when a theme sets a unitless line-height. If you add or subtract it inside `calc()`, `min()`, `max()` or `clamp()`, the expression becomes invalid. For example, `calc(3 + 40px)` resolves to `unset`.

Incorrect:

```css
.cls {
  height: calc(var(--sjs2-line-height-x300) + var(--sjs2-spacing-x500));
}
```

Correct: set the token as `line-height` and use `1lh` in the sum:

```css
.cls {
  line-height: var(--sjs2-line-height-x300);
  height: calc(1lh + var(--sjs2-spacing-x500));
}
```

The rule checks any custom property whose name contains `line-height`. Multiplying such a property is allowed, for example `calc(3 * var(--sjs2-line-height-x300))`. A product that contains one can also be an addend.

### missed-semicolon

postcss reports a missing `;` after a regular property, but not after a custom property, because a custom property value can hold almost anything. Without the `;`, the custom property swallows the next declaration: both variables break, and stricter parsers such as postcss 7 (cssnano@4, css-minimizer-webpack-plugin@1) fail with `Missed semicolon`.

Incorrect:

```css
.cls {
  --sd-padding-inline: 0
    --sd-row-gap: var(--sjs2-spacing-x200);
}
```

Correct:

```css
.cls {
  --sd-padding-inline: 0;
  --sd-row-gap: var(--sjs2-spacing-x200);
}
```

The rule reports a custom property value that contains `--name:` anywhere, or `name:` at the beginning of a line. Colons inside parentheses, strings, `url()` and comments are allowed, so values such as `if(style(--size: big): 10px; else: 5px)` stay valid.

## Adding a rule

1. Create `rules/<rule-name>.js`. Export a PostCSS plugin that reports problems with `decl.warn(result, message)` and does not modify the CSS.
2. Register it in the `rules` map in `index.js`.
3. Add `tests/<rule-name>.test.ts` and a section to this README.

```sh
npm test
```
