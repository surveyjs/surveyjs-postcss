// postcss reports "Missed semicolon" for regular properties, but not for custom properties:
// their value may hold almost anything, so `--a: 0` without ";" silently swallows the next
// declaration (`--a: 0 --b: 1px`). Both variables break, and stricter parsers (postcss 7)
// reject the file. This rule looks for a declaration start inside a custom property value:
// a `--name:` anywhere, or a `name:` at the beginning of a line. Nested parentheses, strings,
// url() and comments are skipped, so values such as `if(style(--x: 1): ...)` stay valid.
function isSpace(ch) {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f";
}

function isNameChar(ch) {
  return !!ch && /[\w-]/.test(ch);
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

function findSwallowed(value) {
  const names = [];
  let depth = 0;
  // The first word belongs to the property's own value, so only later lines can start a declaration.
  let lineStart = false;
  let i = 0;
  while(i < value.length) {
    const ch = value[i];
    if (ch === "\n" || ch === "\r" || ch === "\f") {
      lineStart = true;
      i++;
      continue;
    }
    if (isSpace(ch)) {
      i++;
      continue;
    }
    if (ch === "/" && value[i + 1] === "*") {
      const end = value.indexOf("*/", i + 2);
      i = end === -1 ? value.length : end + 2;
      continue;
    }
    if (ch === "'" || ch === "\"") {
      i = skipString(value, i);
      lineStart = false;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (!isNameChar(ch)) {
      i++;
      lineStart = false;
      continue;
    }
    const start = i;
    while(i < value.length && isNameChar(value[i])) i++;
    const name = value.slice(start, i);
    if (value[i] === "(" && name.toLowerCase() === "url") {
      i = value.indexOf(")", i);
      i = i === -1 ? value.length : i + 1;
      lineStart = false;
      continue;
    }
    let next = i;
    while(next < value.length && (value[next] === " " || value[next] === "\t")) next++;
    const isDeclStart = value[next] === ":" && depth === 0 && (name.startsWith("--") || lineStart);
    if (isDeclStart && !isNameChar(value[start - 1])) names.push(name);
    lineStart = false;
  }
  return names;
}

function plugin() {
  return {
    postcssPlugin: "postcss-missed-semicolon",
    Declaration(decl, { result }) {
      if (!decl.prop.startsWith("--") || !decl.value) return;
      const names = findSwallowed(decl.value);
      if (!names.length) return;
      const parent = decl.parent;
      const place = parent && parent.selector ? parent.selector + " { " + decl.prop + " }" : decl.prop;
      for (let i = 0; i < names.length; i++) {
        decl.warn(
          result,
          place + ": missed semicolon, the value swallows the \"" + names[i] + "\" declaration.",
          { word: names[i] }
        );
      }
    },
  };
}

plugin.postcss = true;

module.exports = plugin;
