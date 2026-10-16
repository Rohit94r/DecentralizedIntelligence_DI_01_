/**
 * The red-team corpus: the statement's ~15 hostile programs, plus extra
 * sandbox-escape attempts we throw at ourselves. Public on purpose — the
 * judges' "Break it" button submits these through the normal /api/submit.
 *
 * `expect` lists the acceptable `detail` values for the WORST test of the
 * program (any is fine); every program must be contained: never `passed`,
 * no secret in any response, the server still up, the next good submit passes.
 */
export interface HostileProgram {
  id: number;
  name: string;
  category: "secrets" | "test theft" | "network" | "infinite loop" | "recursion" | "memory" | "output flood" | "disk flood" | "processes" | "destructive" | "harness trick" | "process trick" | "escape";
  challenge: string;
  code: string;
  /** acceptable outcomes for the failing tests */
  outcomes: ("runtime_error" | "timeout" | "wrong_output")[];
  /** acceptable details (undefined = no detail required) */
  details?: string[];
  why: string;
}

const F = "def last_k_total(marks, k):\n";

export const HOSTILE_PROGRAMS: HostileProgram[] = [
  {
    id: 1,
    name: "Read /etc/passwd",
    category: "secrets",
    challenge: "last-k-total",
    code: F + "    return open('/etc/passwd').read()\n",
    outcomes: ["runtime_error"],
    why: "The sandbox has no real filesystem; open() can only see files the program itself wrote.",
  },
  {
    id: 2,
    name: "Dump the environment",
    category: "secrets",
    challenge: "last-k-total",
    code: "import os\n" + F + "    print(os.environ)\n    return dict(os.environ)\n",
    outcomes: ["wrong_output", "runtime_error"],
    why: "The runner process is spawned with an EMPTY environment, and the sandbox's os.environ is an empty stub.",
  },
  {
    id: 3,
    name: "Steal the test file",
    category: "test theft",
    challenge: "last-k-total",
    code: F + "    return open('../../challenge.json').read()\n",
    outcomes: ["runtime_error"],
    why: "There is no test file anywhere the child can see — hidden tests exist only in the API process's memory.",
  },
  {
    id: 4,
    name: "Open a socket",
    category: "network",
    challenge: "last-k-total",
    code: "import socket\n" + F + "    socket.create_connection(('1.1.1.1', 80))\n    return 0\n",
    outcomes: ["runtime_error"],
    details: ["sandbox policy"],
    why: "socket is not importable in the dojo, and the runner's JS network globals are removed.",
  },
  {
    id: 5,
    name: "HTTP request",
    category: "network",
    challenge: "last-k-total",
    code: "import urllib.request\n" + F + "    return urllib.request.urlopen('http://example.com').read()\n",
    outcomes: ["runtime_error"],
    details: ["sandbox policy"],
    why: "urllib is not importable in the dojo.",
  },
  {
    id: 6,
    name: "Infinite loop",
    category: "infinite loop",
    challenge: "last-k-total",
    code: F + "    while True:\n        pass\n",
    outcomes: ["timeout"],
    why: "Each test has a wall-clock budget; Python is interrupted, and the worker is hard-terminated if it ignores that.",
  },
  {
    id: 7,
    name: "Infinite recursion",
    category: "recursion",
    challenge: "last-k-total",
    code: F + "    return last_k_total(marks, k)\n",
    outcomes: ["runtime_error", "timeout"],
    details: ["recursion limit"],
    why: "A low recursion limit turns runaway recursion into RecursionError instead of a crash.",
  },
  {
    id: 8,
    name: "Memory bomb",
    category: "memory",
    challenge: "last-k-total",
    code: F + "    x = bytearray(10**10)\n    return 0\n",
    outcomes: ["runtime_error"],
    details: ["memory limit"],
    why: "WebAssembly memory is capped, and a watchdog kills the runner when its memory jumps past the budget.",
  },
  {
    id: 9,
    name: "Output flood",
    category: "output flood",
    challenge: "last-k-total",
    code: F + "    print('A' * 10**7)\n    return 0\n",
    outcomes: ["runtime_error"],
    details: ["output limit"],
    why: "stdout is captured into a buffer with a hard 256 KB cap.",
  },
  {
    id: 10,
    name: "Disk flood",
    category: "disk flood",
    challenge: "last-k-total",
    code: F + "    open('big', 'w').write('x' * 10**9)\n    return 0\n",
    outcomes: ["runtime_error"],
    details: ["disk limit", "memory limit"],
    why: "Writes go to an in-memory scratch area with a 1 MB quota; building the 1 GB string may hit the memory limit first.",
  },
  {
    id: 11,
    name: "Fork bomb",
    category: "processes",
    challenge: "last-k-total",
    code: "import os\n" + F + "    [os.fork() for _ in range(99999)]\n    return 0\n",
    outcomes: ["runtime_error"],
    details: ["process limit"],
    why: "WebAssembly cannot fork; the sandbox's os.fork reports the process limit.",
  },
  {
    id: 12,
    name: "Delete /tmp",
    category: "destructive",
    challenge: "last-k-total",
    code: "import shutil\n" + F + "    shutil.rmtree('/tmp')\n    return 0\n",
    outcomes: ["runtime_error"],
    details: ["sandbox policy"],
    why: "shutil is not importable, and the runner process has no write access to the host at all.",
  },
  {
    id: 13,
    name: "Read the harness source",
    category: "harness trick",
    challenge: "last-k-total",
    code: "import sys\n" + F + "    print(sys.argv, open(__file__).read())\n    return 0\n",
    outcomes: ["runtime_error"],
    details: ["sandbox policy"],
    why: "Dunder names like __file__ are rejected before the code runs; sys is a stub with a fake argv.",
  },
  {
    id: 14,
    name: "Hijack print()",
    category: "harness trick",
    challenge: "last-k-total",
    code: "import builtins, os\nbuiltins.print = lambda *a: os._exit(1)\n" + F + "    print('hi')\n    return 0\n",
    outcomes: ["runtime_error"],
    details: ["sandbox policy"],
    why: "builtins is not importable; each test gets a fresh, restricted set of built-ins.",
  },
  {
    id: 15,
    name: "Kill own process",
    category: "process trick",
    challenge: "last-k-total",
    code: "import os\n" + F + "    os.kill(os.getpid(), 9)\n    return 0\n",
    outcomes: ["runtime_error"],
    details: ["sandbox policy"],
    why: "The sandbox's os.kill refuses; even a real kill would only end a disposable runner, never the API.",
  },
];

/** Extra escape attempts — not in the statement's list, but we run them on ourselves anyway. */
export const ESCAPE_ATTEMPTS: HostileProgram[] = [
  {
    id: 101,
    name: "Reach JavaScript (js module)",
    category: "escape",
    challenge: "last-k-total",
    code: "import js\n" + F + "    return js.process.env\n",
    outcomes: ["runtime_error"],
    details: ["sandbox policy"],
    why: "Pyodide's js bridge is unregistered and blocked.",
  },
  {
    id: 102,
    name: "Subclass walk",
    category: "escape",
    challenge: "last-k-total",
    code: F + "    return [c.__name__ for c in ().__class__.__base__.__subclasses__()]\n",
    outcomes: ["runtime_error"],
    details: ["sandbox policy"],
    why: "Dunder attribute access is rejected by the AST check before execution.",
  },
  {
    id: 103,
    name: "Frame walk via generator",
    category: "escape",
    challenge: "last-k-total",
    code: F + "    g = (x for x in [1])\n    return g.gi_frame.f_back.f_globals\n",
    outcomes: ["runtime_error"],
    details: ["sandbox policy"],
    why: "Frame/code attributes (gi_frame, f_back, f_globals …) are rejected by the AST check.",
  },
  {
    id: 104,
    name: "Module private attribute",
    category: "escape",
    challenge: "last-k-total",
    code: "import random\n" + F + "    return random._os.listdir('/')\n",
    outcomes: ["runtime_error"],
    details: ["sandbox policy"],
    why: "Underscore attributes are rejected, and allowed modules are proxies holding public functions only.",
  },
  {
    id: 105,
    name: "eval / exec",
    category: "escape",
    challenge: "last-k-total",
    code: F + "    return eval(\"__import__('os').listdir('/')\")\n",
    outcomes: ["runtime_error"],
    why: "eval, exec and compile are not in the sandbox's built-ins.",
  },
  {
    id: 106,
    name: "getattr with a string",
    category: "escape",
    challenge: "last-k-total",
    code: F + "    return getattr((), '__cla' + 'ss__')\n",
    outcomes: ["runtime_error"],
    why: "getattr / setattr / vars / globals are not in the sandbox's built-ins.",
  },
  {
    id: 107,
    name: "Always-equal object",
    category: "escape",
    challenge: "last-k-total",
    code: "class Eq:\n    def __eq__(self, other):\n        return True\n" + F + "    return Eq()\n",
    outcomes: ["wrong_output"],
    why: "Results are compared in the parent on plain JSON data, so a custom __eq__ never runs.",
  },
  {
    id: 108,
    name: "Swallow the timeout",
    category: "escape",
    challenge: "last-k-total",
    code: F + "    while True:\n        try:\n            while True:\n                pass\n        except BaseException:\n            pass\n",
    outcomes: ["timeout"],
    why: "If Python ignores the interrupt, the worker thread is terminated from outside.",
  },
  {
    id: 109,
    name: "Import pyodide internals",
    category: "escape",
    challenge: "last-k-total",
    code: "from pyodide.code import run_js\n" + F + "    return run_js('process.exit(1)')\n",
    outcomes: ["runtime_error"],
    details: ["sandbox policy"],
    why: "pyodide, _pyodide and pyodide_js are blocked by the import allowlist.",
  },
];

/** A known-good program used after every hostile one: must still pass. */
export const KNOWN_GOOD = {
  challenge: "last-k-total",
  code: "def last_k_total(marks, k):\n    if k >= len(marks):\n        return sum(marks)\n    return sum(marks[len(marks) - k:])\n",
};
