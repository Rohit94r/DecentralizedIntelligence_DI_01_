/** Wires the real dependencies together: SQLite store, Pyodide sandbox pool, optional LLM. */
import { LayerflowStore, defaultDbFile } from "@layerflow/db";
import { createAi, type Ai } from "./lib/ai.ts";
import { createRewriter } from "./lib/llm.ts";
import { PyodideSandbox, RunnerPool } from "./sandbox/sandbox.ts";
import type { Ctx } from "./service.ts";

export interface Runtime extends Ctx {
  pool: RunnerPool;
  ai: Ai | null;
  close(): void;
}

export function createRuntime(opts: { dbFile?: string; warm?: number; llm?: boolean; log?: (s: string) => void } = {}): Runtime {
  const store = new LayerflowStore(opts.dbFile ?? defaultDbFile());
  const pool = new RunnerPool(opts.warm);
  pool.start();
  const sandbox = new PyodideSandbox(pool);
  const rewriter = opts.llm === false ? null : createRewriter(opts.log);
  const ai = opts.llm === false ? null : createAi(opts.log);
  return {
    store,
    sandbox,
    rewriter,
    ai,
    pool,
    close() {
      pool.stop();
      store.close();
    },
  };
}
