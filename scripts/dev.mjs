import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const preview = process.argv.includes("--preview");
const testing = process.argv.includes("--test");
const directory = testing ? mkdtempSync(join(tmpdir(), "enarm-browser-")) : null;
const webPort = process.env.ENARM_WEB_PORT || (testing ? "4278" : "4178");
const apiPort = process.env.ENARM_PORT || (testing ? "4287" : "4187");
const env = {
  ...process.env,
  ENARM_WEB_PORT: webPort,
  ENARM_PORT: apiPort,
  ...(testing ? {
    ENARM_TEST_MODE: "1",
    ENARM_DATABASE: join(directory, "progress.sqlite"),
    ENARM_ORIGIN: `http://127.0.0.1:${webPort}`,
    ENARM_REQUEST_LIMIT: "100000",
    ENARM_CREATE_LIMIT: "100000",
  } : {}),
};
if (testing) console.log(`ENARM test database: ${env.ENARM_DATABASE}`);
const children = [
  spawn(process.execPath, preview ? ["dist-server/server.mjs"] : ["--import", "tsx", "server/main.ts"], { stdio: "inherit", env }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js", ...(preview ? ["preview"] : []), "--config", "app/vite.config.ts"], { stdio: "inherit", env }),
];
let stopping = false;
let remaining = children.length;
let deadline;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
  deadline = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, 5000).unref();
}
for (const child of children) {
  child.on("error", error => { console.error(error); stop(1); });
  child.on("exit", code => stop(code ?? 1));
  child.on("close", () => {
    if (--remaining !== 0) return;
    clearTimeout(deadline);
    if (directory) rmSync(directory, { recursive: true, force: true });
  });
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
