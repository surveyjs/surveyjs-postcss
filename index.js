const lineHeightSum = require("./rules/line-height-sum");

const rules = {
  "line-height-sum": lineHeightSum,
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
