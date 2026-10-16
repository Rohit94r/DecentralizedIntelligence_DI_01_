/** Loads the repo-root .env (if there is one) — keys there are optional extras, never required. */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function loadEnv(): void {
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../.env");
  if (!existsSync(file)) return;
  try {
    // existing environment variables win over the file
    process.loadEnvFile(file);
  } catch {
    /* unreadable .env — ignore, every key is optional */
  }
}
