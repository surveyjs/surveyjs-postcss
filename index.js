const lineHeightSum = require("./rules/line-height-sum");
const missedSemicolon = require("./rules/missed-semicolon");

const rules = {
  "line-height-sum": lineHeightSum,
  "missed-semicolon": missedSemicolon,
};

function plugin() {
  return {
    postcssPlugin: "postcss-surveyjs",
    plugins: Object.keys(rules).map((name) => rules[name]()),
  };
}

plugin.postcss = true;
plugin.rules = rules;

module.exports = plugin;
