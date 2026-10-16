/**
 * A tiny highlighter for the bug-bounty code viewer: Python, TypeScript / TSX
 * and Markdown, display only. Reuses the editor's tok-* colours.
 */
const PY_KW = new Set(["def", "return", "if", "elif", "else", "for", "while", "in", "not", "and", "or", "is", "None", "True", "False", "break", "continue", "pass", "import", "from", "as", "class", "try", "except", "finally", "raise", "with", "lambda", "yield", "async", "await", "global", "del", "assert"]);
const TS_KW = new Set([
  "import", "from", "export", "const", "let", "var", "function", "return", "if", "else", "for", "while", "of", "in", "new", "await", "async", "type", "interface", "extends",
  "implements", "class", "try", "catch", "finally", "throw", "null", "undefined", "true", "false", "as", "typeof", "void", "this", "default",
]);

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const PY = /(#[^\n]*)|([rbf]?"""[\s\S]*?"""|[rbf]?"(?:\\.|[^"\\\n])*"?|[rbf]?'(?:\\.|[^'\\\n])*'?)|(\b\d+(?:\.\d+)?\b)|(@?[A-Za-z_]\w*)|([^\sA-Za-z_\d]+)|(\s+)/g;
const TS = /(\/\/[^\n]*)|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\.|[^`\\])*`?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([^\sA-Za-z_$\d]+)|(\s+)/g;

export function highlight(line: string, language: string): string {
  if (language === "markdown") {
    if (/^\s*#/.test(line)) return `<span class="tok-kw">${esc(line)}</span>`;
    if (/^\s*\|/.test(line)) return `<span class="tok-op">${esc(line)}</span>`;
    return esc(line) || "&#8203;";
  }
  const py = language === "python";
  const re = new RegExp((py ? PY : TS).source, "g");
  const kw = py ? PY_KW : TS_KW;
  let out = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const [tok, com, str, num, word, op, ws] = m;
    if (com) out += `<span class="tok-com">${esc(com)}</span>`;
    else if (str) out += `<span class="tok-str">${esc(str)}</span>`;
    else if (num) out += `<span class="tok-num">${esc(num)}</span>`;
    else if (word) {
      const after = line.slice(re.lastIndex);
      if (kw.has(word)) out += `<span class="tok-kw">${word}</span>`;
      else if (word.startsWith("@") || /^\s*\(/.test(after)) out += `<span class="tok-fn">${esc(word)}</span>`;
      else out += esc(word);
    } else if (op) out += `<span class="tok-op">${esc(op)}</span>`;
    else if (ws) out += ws;
    else out += esc(tok);
  }
  return out || "&#8203;";
}
