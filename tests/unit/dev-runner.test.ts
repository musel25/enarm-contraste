import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm, readFile, writeFile, access } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("the development runner returns an error when the web port is occupied", async () => {
  const reserved = createServer();
  await new Promise<void>(resolve => reserved.listen(0, "127.0.0.1", resolve));
  const address = reserved.address(); assert.ok(address && typeof address === "object");
  const directory = await mkdtemp(join(tmpdir(), "enarm-runner-"));
  try {
    const result = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(process.execPath, ["scripts/dev.mjs"], { env: { ...process.env, ENARM_WEB_PORT: String(address.port), ENARM_PORT: "0", ENARM_DATABASE: join(directory, "progress.sqlite") }, stdio: "ignore" });
      child.on("exit", resolve); child.on("error", reject);
    });
    assert.equal(result, 1);
  } finally { reserved.close(); await rm(directory, { recursive: true, force: true }); }
});

test("test mode uses a disposable database and removes it after shutdown", { timeout: 15000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "enarm-runner-isolation-"));
  const sentinel = join(directory, "development.sqlite");
  await writeFile(sentinel, "existing development progress");
  const child = spawn(process.execPath, ["scripts/dev.mjs", "--test"], {
    env: { ...process.env, ENARM_WEB_PORT: "0", ENARM_PORT: "0", ENARM_DATABASE: sentinel },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const exited = once(child, "exit");
  try {
    const database = await new Promise<string>((resolve, reject) => {
      child.stdout.on("data", chunk => {
        output += chunk;
        const path = /ENARM test database: (.+)/.exec(output)?.[1];
        if (path && output.includes("ENARM progress service ready")) resolve(path);
      });
      child.on("error", reject);
      child.on("exit", code => reject(new Error(`Runner exited with ${code}: ${output}`)));
    });
    assert.notEqual(database, sentinel);
    await access(database);
    child.kill("SIGTERM");
    assert.equal((await exited)[0], 0);
    await assert.rejects(access(database));
    assert.equal(await readFile(sentinel, "utf8"), "existing development progress");
  } finally {
    child.kill("SIGTERM");
    await exited;
    await rm(directory, { recursive: true, force: true });
  }
});
