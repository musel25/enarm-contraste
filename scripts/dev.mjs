import { spawn } from "node:child_process";

const preview = process.argv.includes("--preview");
const children = [
  spawn(process.execPath, preview ? ["dist-server/server.mjs"] : ["node_modules/tsx/dist/cli.mjs", "server/main.ts"], { stdio: "inherit" }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js", ...(preview ? ["preview"] : []), "--config", "app/vite.config.ts"], { stdio: "inherit" }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 500).unref();
}
for (const child of children) child.on("exit", code => stop(code || 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
