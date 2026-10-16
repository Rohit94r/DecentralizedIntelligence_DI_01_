"""
Layerflow sandbox harness — runs INSIDE the sandbox (Pyodide/WebAssembly).

It never sees an expected value: the parent sends code + inputs, and this
file reports only what the learner's own code did. Layer 1 of 4:

  1. this file   — AST policy check, restricted built-ins, import allowlist with
                   proxy modules, capped stdout, quota'd in-memory "disk"
  2. Pyodide     — CPython compiled to WebAssembly: no real filesystem, no fork,
                   JS bridge modules unregistered
  3. Node        — runner started with --permission (no host fs, no child
                   processes), an empty environment, network globals removed
  4. the parent  — disposable process per submission, memory watchdog,
                   interrupt + hard terminate, wall-clock backstop
"""
import ast
import copy as _copy
import io
import json
import math
import sys
import time
import traceback
import types

LIMIT_OUTPUT = 256 * 1024
LIMIT_DISK = 1024 * 1024
LEARNER_FILE = "<learner>"
MAX_RECURSION = 1000

sys.setrecursionlimit(MAX_RECURSION + 60)

ALLOWED_MODULES = {
    "math", "cmath", "random", "itertools", "collections", "functools",
    "heapq", "bisect", "statistics", "fractions", "decimal", "re", "time", "datetime",
}
OK_DUNDERS = {"__name__", "__doc__", "__init__", "__str__", "__repr__", "__len__", "__eq__", "__lt__"}
BAD_ATTR_PREFIX = ("gi_", "cr_", "ag_", "f_", "tb_", "co_", "func_", "im_")
BAD_ATTRS = {"mro", "format_map"}


class SandboxPolicy(Exception):
    """Raised when learner code uses something Layerflow does not allow."""


class _SandboxLimit(BaseException):
    """A resource limit — a BaseException so `except Exception` can't swallow it."""


STATE = {"killed": None, "policy": None, "disk": 0, "vfs": {}}


# ─────────────────────────── policy (AST) ───────────────────────────

def _policy_check(tree):
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute):
            a = node.attr
            if a.startswith("_") and a not in OK_DUNDERS:
                raise SandboxPolicy(f"names starting with an underscore (like .{a}) aren't available in the Layerflow sandbox (line {node.lineno})")
            if a.startswith(BAD_ATTR_PREFIX) or a in BAD_ATTRS:
                raise SandboxPolicy(f".{a} isn't available in the Layerflow sandbox (line {node.lineno})")
        elif isinstance(node, ast.Name):
            if node.id.startswith("__") and node.id not in OK_DUNDERS:
                raise SandboxPolicy(f"{node.id} isn't available in the Layerflow sandbox (line {node.lineno})")
        elif isinstance(node, ast.MatchClass):
            for k in node.kwd_attrs:
                if k.startswith("_"):
                    raise SandboxPolicy(f"pattern attribute {k} isn't available in the Layerflow sandbox (line {node.lineno})")
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            if isinstance(node, ast.ImportFrom) and node.level:
                raise SandboxPolicy(f"relative imports aren't available in the Layerflow sandbox (line {node.lineno})")


# ─────────────────────────── capped I/O ───────────────────────────

class _CappedOut:
    def __init__(self):
        self.parts = []
        self.n = 0

    def write(self, s):
        s = str(s)
        self.n += len(s)
        if self.n > LIMIT_OUTPUT:
            STATE["killed"] = "output"
            raise _SandboxLimit("output limit")
        self.parts.append(s)
        return len(s)

    def flush(self):
        pass

    def text(self):
        return "".join(self.parts)


class _QuotaFile:
    def __init__(self, name, binary):
        self.name = name
        self.binary = binary
        self.buf = []
        self.closed = False

    def write(self, data):
        n = len(data)
        STATE["disk"] += n
        if STATE["disk"] > LIMIT_DISK:
            STATE["killed"] = "disk"
            raise _SandboxLimit("disk limit")
        self.buf.append(data)
        return n

    def close(self):
        if not self.closed:
            sep = b"" if self.binary else ""
            STATE["vfs"][self.name] = sep.join(self.buf)
            self.closed = True

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
        return False

    def __del__(self):
        try:
            self.close()
        except BaseException:
            pass


def _sandbox_open(file, mode="r", *args, **kwargs):
    name = str(file)
    if any(ch in mode for ch in "wax+"):
        return _QuotaFile(name, "b" in mode)
    if name in STATE["vfs"]:
        data = STATE["vfs"][name]
        return io.BytesIO(data) if isinstance(data, bytes) else io.StringIO(data)
    raise FileNotFoundError(2, "No such file in the Layerflow sandbox", name)


def _no_input(*args, **kwargs):
    raise EOFError("input() isn't available — the tests call your function directly")


# ─────────────────────────── stub os / sys ───────────────────────────

def _process_limit(*args, **kwargs):
    STATE["killed"] = "process"
    raise OSError("process limit: the Layerflow sandbox cannot start processes")


def _refuse(what):
    def f(*args, **kwargs):
        STATE["policy"] = what
        raise PermissionError(f"{what} isn't allowed in the Layerflow sandbox")
    return f


def _make_os():
    m = types.ModuleType("os")
    m.environ = {}
    m.sep = "/"
    m.linesep = "\n"
    m.name = "posix"
    m.getcwd = lambda: "/sandbox"
    m.getpid = lambda: 1
    m.listdir = lambda path=".": sorted(STATE["vfs"].keys())
    m.cpu_count = lambda: 1
    for name in ("fork", "forkpty", "system", "popen", "spawnl", "spawnv", "execv", "execl", "execvp", "posix_spawn"):
        setattr(m, name, _process_limit)
    for name in ("kill", "killpg", "abort", "remove", "unlink", "rmdir", "removedirs", "rename", "mkdir", "makedirs", "chdir", "chmod", "putenv", "unsetenv"):
        setattr(m, name, _refuse(f"os.{name}"))
    return m


def _make_sys(out):
    m = types.ModuleType("sys")
    m.argv = ["solution.py"]
    m.maxsize = 2 ** 63 - 1
    m.platform = "layerflow"
    m.version = "3 (Layerflow sandbox)"
    m.stdout = out
    m.exit = _sys_exit
    m.getrecursionlimit = lambda: MAX_RECURSION
    m.setrecursionlimit = lambda n: None
    return m


def _sys_exit(code=0):
    raise SystemExit(code)


# ─────────────────────────── import allowlist ───────────────────────────

_PROXIES = {}
_real_import = __import__


def _proxy(name):
    if name in _PROXIES:
        return _PROXIES[name]
    real = _real_import(name)
    p = types.ModuleType(name)
    for k in dir(real):
        if k.startswith("_"):
            continue
        v = getattr(real, k)
        if isinstance(v, types.ModuleType):
            continue
        setattr(p, k, v)
    _PROXIES[name] = p
    return p


def _make_import(stubs):
    def guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
        if level:
            raise ImportError("relative imports aren't available in the Layerflow sandbox")
        if name in stubs:
            return stubs[name]
        if name not in ALLOWED_MODULES:
            STATE["policy"] = f"import {name.split('.')[0]}"
            raise ImportError(f"module '{name}' isn't available in the Layerflow sandbox")
        return _proxy(name)
    return guarded_import


_SAFE_BUILTIN_NAMES = [
    "abs", "all", "any", "ascii", "bin", "bool", "bytearray", "bytes", "callable", "chr", "complex",
    "dict", "divmod", "enumerate", "filter", "float", "format", "frozenset", "hasattr", "hash", "hex",
    "id", "int", "isinstance", "issubclass", "iter", "len", "list", "map", "max", "min", "next",
    "object", "oct", "ord", "pow", "print", "range", "repr", "reversed", "round", "set", "slice",
    "sorted", "str", "sum", "tuple", "type", "zip", "super", "property", "staticmethod", "classmethod",
    "True", "False", "None", "NotImplemented", "Ellipsis", "__build_class__",
]
_EXC_NAMES = [n for n in dir(__builtins__ if isinstance(__builtins__, types.ModuleType) else sys.modules["builtins"])
              if isinstance(getattr(sys.modules["builtins"], n, None), type) and issubclass(getattr(sys.modules["builtins"], n), BaseException)]


def _fresh_namespace(out):
    b = sys.modules["builtins"]
    safe = {n: getattr(b, n) for n in _SAFE_BUILTIN_NAMES if hasattr(b, n)}
    for n in _EXC_NAMES:
        safe[n] = getattr(b, n)
    safe["open"] = _sandbox_open
    safe["input"] = _no_input
    stubs = {"os": _make_os(), "sys": _make_sys(out)}
    safe["__import__"] = _make_import(stubs)
    return {"__builtins__": safe, "__name__": "__layerflow__"}


# ─────────────────────────── value serialisation ───────────────────────────

def _ser(v, depth=0):
    if depth > 40:
        return {"$repr": "…"}
    t = type(v)
    if v is None or t is bool:
        return v
    if isinstance(v, bool):
        return bool(v)
    if isinstance(v, int):
        iv = int.__int__(v)
        return iv if abs(iv) < 2 ** 53 else {"$bigint": str(iv)}
    if isinstance(v, float):
        fv = float.__float__(v)
        return fv if math.isfinite(fv) else {"$float": repr(fv)}
    if isinstance(v, str):
        return str.__str__(v)[:20000]
    if isinstance(v, (list, tuple)):
        items = list(list.__iter__(v)) if isinstance(v, list) else list(tuple.__iter__(v))
        return [_ser(x, depth + 1) for x in items[:20000]]
    if isinstance(v, dict):
        if all(type(k) is str for k in v.keys()):
            return {k: _ser(x, depth + 1) for k, x in list(v.items())[:20000]}
        return {"$repr": _safe_repr(v)}
    if isinstance(v, (set, frozenset)):
        return {"$set": sorted(_safe_repr(x) for x in v)}
    return {"$repr": _safe_repr(v), "$type": type(v).__name__}


def _safe_repr(v, limit=300):
    try:
        r = repr(v)
    except BaseException:
        r = f"<{type(v).__name__} object>"
    return r if len(r) <= limit else r[: limit - 1] + "…"


def _exc_line(tb):
    line = None
    for frame, lineno in traceback.walk_tb(tb):
        if frame.f_code.co_filename == LEARNER_FILE:
            line = lineno
    return line


def _classify_exception(e):
    if isinstance(e, _SandboxLimit):
        return STATE["killed"] or "output"
    if isinstance(e, KeyboardInterrupt):
        return "wall_clock"
    if isinstance(e, RecursionError):
        return "recursion"
    if isinstance(e, MemoryError):
        return "memory"
    if isinstance(e, OverflowError) and ("index-sized" in str(e) or "cannot fit" in str(e) or "too large" in str(e)):
        return "memory"
    if STATE["killed"]:
        return STATE["killed"]
    if isinstance(e, SandboxPolicy):
        return "policy"
    if isinstance(e, (ImportError, PermissionError)) and STATE["policy"]:
        return "policy"
    return None


def _error_result(e, phase, t0, stdout):
    killed = _classify_exception(e)
    msg = str(e)
    if isinstance(e, SandboxPolicy):
        policy = msg
    else:
        policy = STATE["policy"]
    return {
        "status": "killed" if killed and killed not in ("policy", "recursion") else "error",
        "excType": "SandboxPolicy" if isinstance(e, SandboxPolicy) else type(e).__name__,
        "excMessage": msg[:300],
        "excLine": _exc_line(e.__traceback__) if not isinstance(e, SandboxPolicy) else None,
        "killedBy": killed,
        "policy": policy,
        "stdout": stdout.text()[:4000] if stdout else "",
        "phase": phase,
        "ms": int((time.time() - t0) * 1000),
    }


def _reset_state():
    STATE["killed"] = None
    STATE["policy"] = None
    STATE["disk"] = 0
    STATE["vfs"] = {}


def _load(code, out):
    tree = ast.parse(code, LEARNER_FILE)
    _policy_check(tree)
    ns = _fresh_namespace(out)
    compiled = compile(tree, LEARNER_FILE, "exec")
    exec(compiled, ns)
    return ns


# ─────────────────────────── ops ───────────────────────────

def op_run(job):
    """Run ONE test: load the learner's file fresh, call the function on the inputs."""
    _reset_state()
    t0 = time.time()
    out = _CappedOut()
    real_stdout = sys.stdout
    sys.stdout = out
    try:
        try:
            ns = _load(job["code"], out)
        except BaseException as e:
            if isinstance(e, SyntaxError):
                return {"status": "error", "excType": "SyntaxError", "excMessage": f"{e.msg} (line {e.lineno})",
                        "excLine": e.lineno, "stdout": "", "phase": "module", "ms": int((time.time() - t0) * 1000)}
            return _error_result(e, "module", t0, out)
        fn = ns.get(job["fn"])
        if not callable(fn):
            return {"status": "error", "excType": "NameError", "excMessage": f"{job['fn']} is not defined — keep the function name from the starter",
                    "excLine": None, "stdout": out.text()[:4000], "phase": "module", "ms": int((time.time() - t0) * 1000)}
        module_out = len(out.text())
        args = json.loads(job["args"])
        snapshot = _copy.deepcopy(args)
        call_args = _copy.deepcopy(args)
        try:
            ret = fn(*call_args)
        except BaseException as e:
            res = _error_result(e, "call", t0, out)
            res["stdout"] = out.text()[module_out:][:4000]
            return res
        call_stdout = out.text()[module_out:]
        try:
            mutated = _ser(call_args) != _ser(snapshot)
        except BaseException:
            mutated = True
        second_differs = False
        elapsed = time.time() - t0
        if elapsed < 0.15:
            try:
                ret2 = fn(*_copy.deepcopy(snapshot))
                second_differs = _ser(ret2) != _ser(ret)
            except BaseException:
                second_differs = False
        if STATE["killed"]:
            return {"status": "killed", "killedBy": STATE["killed"], "stdout": call_stdout[:4000], "phase": "call",
                    "ms": int((time.time() - t0) * 1000)}
        return {
            "status": "ok",
            "ret": _ser(ret),
            "repr": _safe_repr(ret),
            "stdout": call_stdout[:4000],
            "mutated": bool(mutated),
            "secondCallDiffers": bool(second_differs),
            "phase": "call",
            "ms": int((time.time() - t0) * 1000),
        }
    finally:
        sys.stdout = real_stdout


MUTATORS = {"pop", "remove", "append", "insert", "sort", "reverse", "clear", "extend"}


def _line_text(lines, n):
    return lines[n - 1].strip() if n and 0 < n <= len(lines) else ""


def op_analyze(job):
    """OB1 Line Map: point at the culprit line, using only the learner's own code."""
    code = job["code"]
    key = job["key"]
    exc_lines = [n for n in job.get("excLines", []) if n]
    try:
        tree = ast.parse(code, LEARNER_FILE)
    except SyntaxError as e:
        return {"culprit_line": e.lineno, "confidence": "very likely", "reason": "Python can't read this line yet — check brackets, colons and indentation."}
    fn = next((n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == job["fn"]), tree)
    params = [a.arg for a in fn.args.args] if isinstance(fn, ast.FunctionDef) else []
    nodes = list(ast.walk(fn))
    common = max(set(exc_lines), key=exc_lines.count) if exc_lines else None

    def calls(name):
        return [n for n in nodes if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == name]

    def enclosing_for(line):
        best = None
        for n in nodes:
            if isinstance(n, ast.For) and n.lineno <= line <= (n.end_lineno or n.lineno):
                if best is None or n.lineno > best.lineno:
                    best = n
        return best

    def has_sub(n):
        return any(isinstance(x, ast.BinOp) and isinstance(x.op, (ast.Sub, ast.Add)) for x in ast.walk(n))

    compares = [n for n in nodes if isinstance(n, (ast.If, ast.While)) and isinstance(n.test, ast.Compare)
                and any(isinstance(op, (ast.Lt, ast.Gt, ast.LtE, ast.GtE)) for op in n.test.ops)]
    ranges = calls("range")

    culprit, conf, reason = None, "likely", ""
    if key == "unhandled_short_input" or key == "crash":
        loop = enclosing_for(common) if common else None
        if loop and isinstance(loop.iter, ast.Call) and isinstance(loop.iter.func, ast.Name) and loop.iter.func.id == "range" and has_sub(loop.iter):
            culprit, conf = loop.lineno, "very likely"
            reason = "This range can start below zero when the input is shorter than your code expects."
        elif common:
            culprit, conf = common, "very likely"
            reason = ("This line reads a position that a short input doesn't have." if key == "unhandled_short_input"
                      else "This is the line where your code stops with an error.")
    elif key == "print_not_return":
        prints = calls("print")
        returns = [n for n in nodes if isinstance(n, ast.Return) and n.value is not None]
        if prints:
            culprit = prints[-1].lineno
            conf = "very likely" if not returns else "likely"
            reason = "This shows the value on screen, but nothing hands it back to the caller."
    elif key == "mutates_input":
        for n in nodes:
            if (isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr in MUTATORS
                    and isinstance(n.func.value, ast.Name) and n.func.value.id in params):
                culprit, conf, reason = n.lineno, "very likely", "This changes the list the caller passed in."
                break
            if isinstance(n, (ast.Assign, ast.AugAssign, ast.Delete)):
                targets = n.targets if isinstance(n, (ast.Assign, ast.Delete)) else [n.target]
                if any(isinstance(t, ast.Subscript) and isinstance(t.value, ast.Name) and t.value.id in params for t in targets):
                    culprit, conf, reason = n.lineno, "very likely", "This writes into the caller's list."
                    break
    elif key == "boundary_comparison":
        if compares:
            culprit = compares[0].lineno
            reason = "This comparison decides what happens exactly at the edge — check whether the edge value itself should count."
        elif ranges:
            culprit = ranges[0].lineno
            reason = "Check what this range does at the very edge of the input."
        elif exc_lines:
            culprit = common
            reason = "Your code goes wrong here at the edge of the input."
        else:
            lists = [n for n in nodes if isinstance(n, (ast.List, ast.Assign)) and getattr(n, "lineno", None)]
            if lists:
                culprit = lists[0].lineno
                reason = "Check what this starts with when the input is at its smallest."
    elif key == "off_by_one":
        stepped = [r for r in ranges if any(isinstance(a, ast.BinOp) for a in r.args)]
        pick = (stepped or ranges or [c.test for c in compares])
        if pick:
            culprit = pick[0].lineno
            reason = "Check where this starts and where it stops — one end is one step off."
    elif key == "wrong_index_direction":
        slices = [n for n in nodes if isinstance(n, ast.Subscript) and isinstance(n.slice, ast.Slice)]
        if slices:
            culprit, reason = slices[0].lineno, "This slice takes items from one end — check which end the task asks for."
    elif key == "timeout":
        for n in nodes:
            if isinstance(n, ast.While):
                tested = {x.id for x in ast.walk(n.test) if isinstance(x, ast.Name)}
                assigned = {t.id for s in ast.walk(n) for t in getattr(s, "targets", [getattr(s, "target", None)]) if isinstance(t, ast.Name)}
                culprit = n.lineno
                conf = "very likely" if not (tested & assigned) else "likely"
                reason = "This loop never reaches its stopping condition."
                break
        if culprit is None:
            self_calls = calls(job["fn"])
            if self_calls:
                culprit, conf, reason = self_calls[0].lineno, "likely", "This call starts the same work again, and it may never stop."
    if culprit is None and common:
        culprit, conf, reason = common, "likely", "Your code goes wrong around here."
    lines = code.splitlines()
    return {
        "culprit_line": culprit,
        "confidence": conf,
        "reason": reason,
        "lines": [{"line": culprit, "reason": reason}] if culprit else [],
        "text": _line_text(lines, culprit),
    }


def _index_names(code):
    """line → [(container, index_name)] for subscripts like marks[i]."""
    out = {}
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return out
    for n in ast.walk(tree):
        if isinstance(n, ast.Subscript) and isinstance(n.value, ast.Name) and isinstance(n.slice, ast.Name):
            out.setdefault(n.lineno, []).append((n.value.id, n.slice.id))
    return out


def op_trace(job):
    """OB2 Time-Travel Replay: the learner's own variable values, step by step, on a PUBLIC input."""
    _reset_state()
    code = job["code"]
    out = _CappedOut()
    real_stdout = sys.stdout
    sys.stdout = out
    try:
        if job.get("argsSource") is not None:
            src = job["argsSource"].strip()
            if len(src) > 500:
                return {"ok": False, "call": "", "steps": [], "error": "That input is too long for a replay.", "firstWrongStep": None, "truncated": False}
            try:
                val = ast.literal_eval("(" + src + ",)") if src else ()
            except Exception:
                return {"ok": False, "call": "", "steps": [], "error": "Type the arguments as plain Python values, e.g. [2, 5], 3", "firstWrongStep": None, "truncated": False}
            args = [_ser(v) for v in val]
        else:
            args = job["args"]
        call = f"{job['fn']}({', '.join(_safe_repr(a, 120) for a in args)})"
        try:
            ns = _load(code, out)
        except BaseException as e:
            return {"ok": False, "call": call, "steps": [], "error": f"{type(e).__name__}: {e}"[:200], "firstWrongStep": None, "truncated": False}
        fn = ns.get(job["fn"])
        if not callable(fn):
            return {"ok": False, "call": call, "steps": [], "error": f"{job['fn']} is not defined", "firstWrongStep": None, "truncated": False}
        steps = []
        idx = _index_names(code)
        culprit = job.get("culpritLine")
        state = {"truncated": False, "first": None}
        max_steps = 250

        def snapshot(frame):
            loc = {}
            for k, v in list(frame.f_locals.items())[:12]:
                if not k.startswith("__"):
                    loc[k] = _safe_repr(v, 60)
            return loc

        def tracer(frame, event, arg):
            if frame.f_code.co_filename != LEARNER_FILE:
                return None
            if event not in ("line", "return", "exception"):
                return tracer
            if len(steps) >= max_steps:
                state["truncated"] = True
                sys.settrace(None)
                raise _SandboxLimit("trace")
            step = {"step": len(steps) + 1, "line": frame.f_lineno, "event": event, "locals": snapshot(frame)}
            note = None
            if event == "line":
                for cont, name in idx.get(frame.f_lineno, []):
                    c, i = frame.f_locals.get(cont), frame.f_locals.get(name)
                    if isinstance(i, int) and not isinstance(i, bool) and isinstance(c, (list, str, tuple)):
                        if i < 0:
                            note = f"{name} is {i}, so {cont}[{name}] counts from the END of {cont}"
                        elif i >= len(c):
                            note = f"{name} is {i}, past the last position of {cont}"
            elif event == "exception":
                note = f"{arg[0].__name__} is raised here"
            elif event == "return":
                step["locals"]["↩ returns"] = _safe_repr(arg, 60)
            if note:
                step["note"] = note
                step["flag"] = True
                if state["first"] is None:
                    state["first"] = step["step"]
            steps.append(step)
            return tracer

        result, error = None, None
        sys.settrace(tracer)
        try:
            result = _safe_repr(fn(*_copy.deepcopy(args)), 200)
        except _SandboxLimit:
            pass
        except BaseException as e:
            error = f"{type(e).__name__}: {e}"[:200]
        finally:
            sys.settrace(None)
        first = state["first"]
        if first is None and culprit:
            first = next((s["step"] for s in steps if s["line"] == culprit), None)
        return {"ok": error is None and not state["truncated"], "call": call, "steps": steps, "result": result, "error": error,
                "firstWrongStep": first, "truncated": state["truncated"]}
    finally:
        sys.stdout = real_stdout


OPS = {"run": op_run, "analyze": op_analyze, "trace": op_trace}


def layerflow_dispatch(job_json):
    job = json.loads(job_json)
    try:
        res = OPS[job["op"]](job)
    except KeyboardInterrupt:
        res = {"status": "killed", "killedBy": "wall_clock", "stdout": "", "ms": 0}
    except BaseException as e:
        res = {"status": "error", "excType": type(e).__name__, "excMessage": str(e)[:200], "killedBy": _classify_exception(e) or "crash", "stdout": "", "ms": 0}
    return json.dumps(res)
