/**
 * Worker thread: hosts Pyodide (CPython → WebAssembly) and the harness.
 * Learner Python runs HERE, on this thread, inside WebAssembly — never on the
 * host and never in the API process. The supervisor thread watches us from
 * outside and can interrupt or terminate us at any moment.
 */
import { parentPort, workerData } from "node:worker_threads";
import { constants as fsConstants, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

// Pyodide's NODEFS reads fs constants through process.binding(), which Node's
// --permission model forbids. Hand it the constants and nothing else.
process.binding = (name) => {
  if (name === "constants") return { fs: fsConstants };
  throw new Error("process.binding is not available in the dojo runner");
};

const { indexURL, sab, harnessPath } = workerData;
const { loadPyodide } = await import(pathToFileURL(path.join(indexURL, "pyodide.mjs")).href);

const py = await loadPyodide({
  indexURL: indexURL.endsWith(path.sep) ? indexURL : indexURL + path.sep,
  stdout: () => {},
  stderr: () => {},
  env: { HOME: "/home/dojo", USER: "dojo" },
});

py.setInterruptBuffer(new Int32Array(sab));

// Cut the bridge from Python to JavaScript. With `js` gone, Python code cannot
// reach `process`, `fetch` or anything else on the JS side.
for (const name of ["js", "pyodide_js"]) {
  try {
    py.unregisterJsModule(name);
  } catch {
    /* not registered */
  }
}
py.runPython(`
import sys
for _k in [k for k in list(sys.modules) if k in ("js", "pyodide_js") or k.startswith("pyodide_js.")]:
    del sys.modules[_k]
`);

py.runPython(readFileSync(harnessPath, "utf8"));
const dispatch = py.globals.get("dojo_dispatch");

// Defence in depth: even if Python somehow regained a JS handle, these are gone.
const refuse = () => {
  throw new Error("not available in the dojo runner");
};
for (const key of ["fetch", "WebSocket", "EventSource", "XMLHttpRequest", "Request", "BroadcastChannel"]) {
  try {
    Object.defineProperty(globalThis, key, { value: undefined, configurable: false, writable: false });
  } catch {
    /* ignore */
  }
}
for (const key of ["kill", "dlopen", "getBuiltinModule", "binding", "chdir", "abort", "setuid", "setgid", "umask"]) {
  try {
    process[key] = refuse;
  } catch {
    /* ignore */
  }
}

parentPort.on("message", (msg) => {
  let out;
  try {
    out = dispatch(JSON.stringify(msg.job));
  } catch (e) {
    parentPort.postMessage({ id: msg.id, fatal: true, error: String(e && e.message ? e.message : e).slice(0, 300) });
    return;
  }
  parentPort.postMessage({ id: msg.id, out });
});

parentPort.postMessage({ type: "ready" });
