// A unitless line-height is a number, not a length. Adding or subtracting it
// inside calc() makes the whole expression invalid once a theme sets the token
// to a number such as 1.5. Multiplication is allowed: calc(3 * var(--token)).
const MATH_FUNCTIONS = {
  "calc": true,
  "min": true,
  "max": true,
  "clamp": true,
};

function isSpace(ch) {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f";
}

function skipString(input, start) {
  const quote = input[start];
  let i = start + 1;
  while(i < input.length) {
    if (input[i] === "\\") {
      i += 2;
      continue;
    }
    if (input[i] === quote) return i + 1;
    i++;
  }
  return input.length;
}

function hasWhitespaceAfter(input, index) {
  const next = input[index + 1];
  if (!next) return true;
  if (isSpace(next)) return true;
  return next === "/" && input[index + 2] === "*";
}

function skipUrl(input, openIndex) {
  let i = openIndex + 1;
  while(i < input.length) {
    const ch = input[i];
    if (ch === "'" || ch === "\"") {
      i = skipString(input, i);
      continue;
    }
    if (ch === ")") return i + 1;
    i++;
  }
  return input.length;
}

function isWordStop(input, index) {
  const ch = input[index];
  if (!ch || isSpace(ch)) return true;
  if (ch === "/" && input[index + 1] === "*") return true;
  return ch === "'" || ch === "\"" || ch === "*" || ch === "/" || ch === "," || ch === "(" || ch === ")";
}

function tokenize(input) {
  const tokens = [];
  let i = 0;
  let separated = true;
  while(i < input.length) {
    const ch = input[i];
    if (isSpace(ch)) {
      separated = true;
      i++;
      continue;
    }
    if (ch === "/" && input[i + 1] === "*") {
      const end = input.indexOf("*/", i + 2);
      i = end === -1 ? input.length : end + 2;
      separated = true;
      continue;
    }
    if (ch === "'" || ch === "\"") {
      i = skipString(input, i);
      tokens.push({ type: "atom" });
      separated = false;
      continue;
    }
    // calc() requires whitespace around + and -. A hyphen inside --token stays part of the name.
    if ((ch === "+" || ch === "-") && separated && hasWhitespaceAfter(input, i)) {
      tokens.push({ type: ch });
      i++;
      separated = false;
      continue;
    }
    if (ch === "*" || ch === "/" || ch === "," || ch === "(" || ch === ")") {
      tokens.push({ type: ch });
      i++;
      separated = false;
      continue;
    }
    const start = i;
    while(i < input.length && !isWordStop(input, i)) i++;
    const value = input.slice(start, i);
    if (input[i] === "(" && value.toLowerCase() === "url") {
      i = skipUrl(input, i);
      tokens.push({ type: "atom" });
    } else if (input[i] === "(") {
      tokens.push({ type: "func", value: value });
      tokens.push({ type: "(" });
      i++;
    } else {
      tokens.push({ type: "atom", value: value });
    }
    separated = false;
  }
  return tokens;
}

function matchingParen(tokens, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < tokens.length; i++) {
    if (tokens[i].type === "(") depth++;
    else if (tokens[i].type === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function isUnary(tokens, index, partStart) {
  if (index <= partStart) return true;
  const prev = tokens[index - 1].type;
  return prev === "+" || prev === "-" || prev === "*" || prev === "/" || prev === "," || prev === "(" || prev === "func";
}

function splitBy(tokens, start, end, separator) {
  const parts = [];
  let partStart = start;
  let depth = 0;
  for (let i = start; i < end; i++) {
    const type = tokens[i].type;
    if (type === "(") depth++;
    else if (type === ")") depth--;
    else if (depth === 0 && separator(tokens, i, partStart)) {
      parts.push([partStart, i]);
      partStart = i + 1;
    }
  }
  parts.push([partStart, end]);
  return parts;
}

function lineHeightName(tokens, start, end) {
  let i = start;
  while(i < end && (tokens[i].type === "+" || tokens[i].type === "-")) i++;
  const fn = tokens[i];
  if (!fn || fn.type !== "func" || fn.value.toLowerCase() !== "var") return "";
  if (!tokens[i + 1] || tokens[i + 1].type !== "(") return "";
  const close = matchingParen(tokens, i + 1);
  if (close !== end - 1) return "";
  const name = tokens[i + 2];
  if (!name || name.type !== "atom" || !name.value || name.value.toLowerCase().indexOf("line-height") === -1) return "";
  return name.value;
}

function collect(tokens, start, end, names) {
  for (let i = start; i < end; i++) {
    if (tokens[i].type !== "(") continue;
    const close = matchingParen(tokens, i);
    if (close < 0) return;
    const prev = tokens[i - 1];
    const fn = prev && prev.type === "func" ? prev.value.toLowerCase() : "";
    if (fn === "var") {
      const args = splitBy(tokens, i + 1, close, (list, index) => list[index].type === ",");
      for (let a = 1; a < args.length; a++) {
        collect(tokens, args[a][0], args[a][1], names);
      }
    } else if (MATH_FUNCTIONS[fn] || fn === "") {
      const args = fn === "" ? [[i + 1, close]] : splitBy(tokens, i + 1, close, (list, index) => list[index].type === ",");
      for (let a = 0; a < args.length; a++) {
        const from = args[a][0];
        const to = args[a][1];
        const terms = splitBy(tokens, from, to, (list, index, partStart) => {
          const type = list[index].type;
          return (type === "+" || type === "-") && !isUnary(list, index, partStart);
        });
        if (terms.length > 1) {
          for (let t = 0; t < terms.length; t++) {
            const name = lineHeightName(tokens, terms[t][0], terms[t][1]);
            if (name) names.push(name);
          }
        }
        collect(tokens, from, to, names);
      }
    } else {
      collect(tokens, i + 1, close, names);
    }
    i = close;
  }
}

function plugin() {
  return {
    postcssPlugin: "postcss-line-height-sum",
    Declaration(decl, { result }) {
      const value = decl.value;
      if (!value || value.toLowerCase().indexOf("line-height") === -1) return;
      const tokens = tokenize(value);
      const names = [];
      collect(tokens, 0, tokens.length, names);
      if (!names.length) return;
      const parent = decl.parent;
      const place = parent && parent.selector ? parent.selector + " { " + decl.prop + " }" : decl.prop;
      for (let i = 0; i < names.length; i++) {
        decl.warn(
          result,
          place + ": line-height custom property \"" + names[i] + "\" cannot be an addend inside calc(), min(), max(), or clamp(). A unitless line-height is not a length.",
          { word: names[i] }
        );
      }
    },
  };
}

plugin.postcss = true;

module.exports = plugin;
