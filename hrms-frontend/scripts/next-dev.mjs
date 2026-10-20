/**
 * Start Next without the Cursor signals that make `next dev` rewrite
 * AGENTS.md and CLAUDE.md. See node_modules/next/dist/server/lib/app-info-log.js.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };

for (const key of [
  "AI_AGENT",
  "CURSOR_TRACE_ID",
  "CURSOR_AGENT",
  "CURSOR_EXTENSION_HOST_ROLE",
]) {
  delete env[key];
}

const child = spawn(
  path.join(root, "node_modules/next/dist/bin/next"),
  ["dev", "--port", "3000", ...process.argv.slice(2)],
  { stdio: "inherit", env, cwd: root },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
