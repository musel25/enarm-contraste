import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
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
