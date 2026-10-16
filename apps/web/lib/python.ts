/** A tiny, dependency-free Python highlighter for the editor overlay (display only). */
const KEYWORDS = new Set([
  "def", "return", "if", "elif", "else", "for", "while", "in", "not", "and", "or", "is", "None", "True", "False",
  "break", "continue", "pass", "import", "from", "as", "class", "try", "except", "finally", "raise", "with", "lambda",
  "yield", "global", "nonlocal", "del", "assert",
]);
const BUILTINS = new Set(["len", "range", "print", "sum", "max", "min", "sorted", "list", "dict", "set", "str", "int", "float", "abs", "enumerate", "zip", "reversed", "any", "all", "map", "filter", "round", "tuple", "bool"]);

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const TOKEN = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|([^\sA-Za-z_\d]+)|(\s+)/g;

export function highlightLine(line: string, nextIsCall = false): string {
  let out = "";
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  let prevDef = false;
  while ((m = TOKEN.exec(line)) !== null) {
    const [tok, com, str, num, word, op, ws] = m;
    if (com) out += `<span class="tok-com">${esc(com)}</span>`;
    else if (str) out += `<span class="tok-str">${esc(str)}</span>`;
    else if (num) out += `<span class="tok-num">${esc(num)}</span>`;
    else if (word) {
      const after = line.slice(TOKEN.lastIndex);
      if (KEYWORDS.has(word)) out += `<span class="tok-kw">${word}</span>`;
      else if (prevDef || /^\s*\(/.test(after)) out += `<span class="${BUILTINS.has(word) ? "tok-bi" : "tok-fn"}">${word}</span>`;
      else out += esc(word);
      prevDef = word === "def";
      continue;
    } else if (op) out += `<span class="tok-op">${esc(op)}</span>`;
    else if (ws) out += ws;
    else out += esc(tok);
    if (!ws) prevDef = false;
  }
  void nextIsCall;
  return out || "&#8203;";
}
