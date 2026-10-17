/**
 * Syntax doctor — names the exact mistake when Python can't even read the code.
 *
 * A SyntaxError stops every test before it starts, so "check brackets, colons
 * and indentation" isn't good enough: the learner (or a judge who just broke a
 * line on purpose) should hear WHAT is wrong on WHICH line. This reads the line
 * Python pointed at — plus Python's own message when we have it — and returns
 * a plain-words diagnosis and fix. Prose only (it feeds hints), never code.
 */

export type SyntaxKind =
  | "unclosed_bracket"
  | "extra_bracket"
  | "unclosed_quote"
  | "unexpected_indent"
  | "indent_needed"
  | "inconsistent_indent"
  | "typo"
  | "else_if"
  | "print"
  | "single_equals"
  | "semicolon"
  | "missing_colon"
  | "unknown";

export interface SyntaxDiagnosis {
  kind: SyntaxKind;
  /** for typos: the keyword it should be */
  word?: string;
  /** the line the mistake is on (may differ from the line Python reported) */
  line: number;
  /** "line 4 ends with a semicolon" */
  what: string;
  /** "A line that starts a block … must end with a colon, not a semicolon." */
  fix: string;
}

const BLOCK = /^\s*(if|elif|else|for|while|def|class|try|except|finally|with)\b/;
const TYPOS: Record<string, string> = {
  retrun: "return",
  reutrn: "return",
  retun: "return",
  rturn: "return",
  esle: "else",
  eles: "else",
  elsif: "elif",
  elseif: "elif",
  fro: "for",
  whiel: "while",
  wihle: "while",
  dfe: "def",
  pritn: "print",
  lenght: "len",
};

function stripComment(line: string): string {
  let q: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === "\\") i++;
      else if (ch === q) q = null;
    } else if (ch === "'" || ch === '"') q = ch;
    else if (ch === "#") return line.slice(0, i);
  }
  return line;
}

function unclosedQuote(line: string): boolean {
  let q: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === "\\") i++;
      else if (ch === q) q = null;
    } else if (ch === "#") return false;
    else if (ch === "'" || ch === '"') q = ch;
  }
  return q !== null;
}

/** +n = n more brackets opened than closed on this line (quotes and comments ignored). */
function bracketBalance(line: string): number {
  let n = 0;
  let q: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === "\\") i++;
      else if (ch === q) q = null;
      continue;
    }
    if (ch === "#") break;
    if (ch === "'" || ch === '"') q = ch;
    else if ("([{".includes(ch)) n++;
    else if (")]}".includes(ch)) n--;
  }
  return n;
}

const indentOf = (l: string) => (l.match(/^[ \t]*/)?.[0] ?? "").replace(/\t/g, "    ").length;

export function syntaxDiagnosis(code: string, reportedLine: number | null, pythonMessage = ""): SyntaxDiagnosis | null {
  const lines = code.replace(/\r\n/g, "\n").split("\n");
  if (!lines.length) return null;
  const L = Math.min(Math.max(1, reportedLine ?? 1), lines.length);
  const msg = pythonMessage.toLowerCase();
  const at = (n: number) => lines[n - 1] ?? "";

  // 1 · Python told us exactly what kind of problem it is
  if (/was never closed|unexpected eof|unmatched|does not match opening/.test(msg)) {
    for (let n = L; n >= Math.max(1, L - 4); n--) {
      if (bracketBalance(at(n)) > 0) return { kind: "unclosed_bracket", line: n, what: `line ${n} opens a bracket that is never closed`, fix: "Every opening bracket needs a matching closing bracket — count them on that line and add the missing one." };
      if (bracketBalance(at(n)) < 0) return { kind: "extra_bracket", line: n, what: `line ${n} closes a bracket that was never opened`, fix: "Every closing bracket needs a matching opening bracket — remove the extra one or add the missing opener." };
    }
  }
  if (unclosedQuote(at(L))) {
    return { kind: "unclosed_quote", line: L, what: `line ${L} starts a piece of text with a quote mark but never closes it`, fix: "Text in Python needs a quote mark at the start and the same quote mark at the end." };
  }
  if (/unexpected indent/.test(msg)) return { kind: "unexpected_indent", line: L, what: `line ${L} is indented further than it should be`, fix: "Only the lines inside a block (after a line ending in a colon) move in. Line it up with the line above it." };
  if (/expected an indented block/.test(msg)) {
    const opener = L > 1 ? L - 1 : L;
    return { kind: "indent_needed", line: L, what: `the line after line ${opener} should be indented`, fix: "After a line that ends with a colon, the next line must move in by four spaces — that's how Python knows it belongs to the block." };
  }
  if (/unindent does not match|inconsistent use of tabs/.test(msg)) return { kind: "inconsistent_indent", line: L, what: `line ${L} doesn't line up with the lines around it`, fix: "Use the same number of spaces for every line in a block (four spaces is the usual step), and don't mix tabs with spaces." };

  // 2 · read the line(s) ourselves
  for (const n of [L, L - 1].filter((x) => x >= 1)) {
    const raw = stripComment(at(n));
    const t = raw.trim();
    if (!t) continue;
    const word = t.match(/^[A-Za-z_]+/)?.[0]?.toLowerCase() ?? "";
    if (TYPOS[word]) return { kind: "typo", word: TYPOS[word], line: n, what: `line ${n} starts with "${word}", which Python doesn't know`, fix: `It looks like a typo for the keyword "${TYPOS[word]}".` };
    if (/^else\s+if\b/.test(t)) return { kind: "else_if", line: n, what: `line ${n} says "else if"`, fix: 'Python joins these into one keyword: "elif".' };
    if (/^print\s+[^\s(=]/.test(t)) return { kind: "print", line: n, what: `line ${n} uses print without brackets`, fix: "In Python 3, what you print goes inside round brackets right after the word print." };
    const block = t.match(BLOCK);
    if (block) {
      const kw = block[1];
      if (/^(if|elif|while)\b/.test(t) && /[^=!<>]=[^=]/.test(t.replace(/^(if|elif|while)\s*/, " "))) {
        return { kind: "single_equals", line: n, what: `line ${n} uses a single equals sign inside the ${kw} condition`, fix: "A single equals sign stores a value. To compare two values, use a double equals sign." };
      }
      if (t.endsWith(";")) return { kind: "semicolon", line: n, what: `line ${n} ends with a semicolon`, fix: `A line that starts a block — like this ${kw} line — must end with a colon, not a semicolon.` };
      if (!t.endsWith(":") && bracketBalance(raw) === 0) return { kind: "missing_colon", line: n, what: `line ${n} starts ${kw === "else" ? "an else" : `a ${kw}`} block but doesn't end with a colon`, fix: `Lines that start a block — if, elif, else, for, while, def — must end with a colon.` };
    }
  }

  // 3 · indentation that doesn't fit the line above
  if (L > 1) {
    const prev = stripComment(at(L - 1)).trimEnd();
    const cur = at(L);
    if (prev.trim() && cur.trim()) {
      if (prev.endsWith(":") && indentOf(cur) <= indentOf(prev)) return { kind: "indent_needed", line: L, what: `the line after line ${L - 1} should be indented`, fix: "After a line that ends with a colon, the next line must move in by four spaces." };
      if (!prev.endsWith(":") && indentOf(cur) > indentOf(prev) && bracketBalance(prev) <= 0) return { kind: "unexpected_indent", line: L, what: `line ${L} is indented further than the line above it`, fix: "Only lines inside a block move in. Line it up with the line above." };
    }
  }

  // 4 · an unclosed bracket further up
  let open = 0;
  let start = 0;
  for (let n = 1; n <= L; n++) {
    const b = bracketBalance(at(n));
    if (open === 0 && b > 0) start = n;
    open += b;
  }
  if (open > 0 && start) return { kind: "unclosed_bracket", line: start, what: `line ${start} opens a bracket that is never closed`, fix: "Every opening bracket needs a matching closing bracket — count them and add the missing one." };

  return { kind: "unknown", line: L, what: `Python can't read line ${L}`, fix: "Check the end of the line for a missing colon, and make sure every bracket and quote mark is closed." };
}

/** Three prose hints for a syntax error, built from the diagnosis. */
export function syntaxLadder(d: SyntaxDiagnosis): string[] {
  const what = d.what.charAt(0).toUpperCase() + d.what.slice(1);
  return [
    `Python couldn't read your code, so not a single test could run. The error points at line ${d.line} — read that line slowly, character by character.`,
    `Look closely at line ${d.line}: ${d.what.replace(new RegExp(`^line ${d.line} `), "it ")}.`,
    `${what}. ${d.fix}`,
  ];
}

/**
 * The smallest edit that fixes a mechanical syntax mistake on the diagnosed line
 * (a semicolon for a colon, a missing colon, = for ==, a misspelt keyword, a
 * missing bracket or quote, one line's indentation). Returns null when the fix
 * isn't mechanical. The caller still runs the result against every test.
 */
export function syntaxFix(code: string, d: SyntaxDiagnosis): { code: string; change: string } | null {
  const lines = code.replace(/\r\n/g, "\n").split("\n");
  const i = d.line - 1;
  const line = lines[i];
  if (line === undefined) return null;
  const comment = stripComment(line);
  const tail = line.slice(comment.length);
  const body = comment.replace(/\s+$/, "");
  const indent = (s: string) => s.match(/^[ \t]*/)?.[0] ?? "";
  let next: string | null = null;
  let change = "";
  switch (d.kind) {
    case "semicolon":
      next = body.replace(/;\s*$/, ":") + tail;
      change = `Changed the semicolon at the end of line ${d.line} to a colon.`;
      break;
    case "missing_colon":
      next = body + ":" + tail;
      change = `Added the missing colon at the end of line ${d.line}.`;
      break;
    case "single_equals": {
      const m = body.match(/^(\s*(?:if|elif|while)\b.*?[^=!<>])=([^=].*)$/);
      if (!m) return null;
      next = `${m[1]}==${m[2]}` + tail;
      change = `Changed the single equals sign on line ${d.line} to a double one, so it compares instead of storing.`;
      break;
    }
    case "typo": {
      if (!d.word) return null;
      next = line.replace(/^(\s*)[A-Za-z_]+/, `$1${d.word}`);
      change = `Fixed the spelling of "${d.word}" on line ${d.line}.`;
      break;
    }
    case "else_if":
      next = line.replace(/^(\s*)else\s+if\b/, "$1elif");
      change = `Changed "else if" on line ${d.line} to "elif".`;
      break;
    case "print": {
      const m = body.match(/^(\s*)print\s+(.+)$/);
      if (!m) return null;
      next = `${m[1]}print(${m[2]})` + tail;
      change = `Put what's printed on line ${d.line} inside round brackets.`;
      break;
    }
    case "unclosed_bracket": {
      const stack: string[] = [];
      let q: string | null = null;
      for (let k = 0; k < body.length; k++) {
        const ch = body[k];
        if (q) {
          if (ch === "\\") k++;
          else if (ch === q) q = null;
          continue;
        }
        if (ch === "'" || ch === '"') q = ch;
        else if ("([{".includes(ch)) stack.push(ch);
        else if (")]}".includes(ch)) stack.pop();
      }
      if (!stack.length) return null;
      const closers = stack.reverse().map((ch) => ({ "(": ")", "[": "]", "{": "}" })[ch as "(" | "[" | "{"]).join("");
      next = body.endsWith(":") ? body.slice(0, -1) + closers + ":" + tail : body + closers + tail;
      change = `Added the missing closing bracket on line ${d.line}.`;
      break;
    }
    case "unclosed_quote": {
      const m = body.match(/['"]/g);
      if (!m) return null;
      const quote = body.includes("'") && (!body.includes('"') || body.indexOf("'") < body.indexOf('"')) ? "'" : '"';
      next = body.endsWith(":") ? body.slice(0, -1) + quote + ":" + tail : body + quote + tail;
      change = `Closed the quote mark on line ${d.line}.`;
      break;
    }
    case "indent_needed": {
      let k = i - 1;
      while (k >= 0 && !lines[k].trim()) k--;
      if (k < 0) return null;
      next = indent(lines[k]) + "    " + line.trimStart();
      change = `Indented line ${d.line} so it sits inside the block above it.`;
      break;
    }
    case "unexpected_indent": {
      let k = i - 1;
      while (k >= 0 && !lines[k].trim()) k--;
      if (k < 0) return null;
      next = indent(lines[k]) + line.trimStart();
      change = `Lined line ${d.line} up with the line above it.`;
      break;
    }
    default:
      return null;
  }
  if (next === null || next === line) return null;
  const out = [...lines];
  out[i] = next;
  return { code: out.join("\n"), change };
}
