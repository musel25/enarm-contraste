import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createProgressServer } from "../../server/api";
import { backupDatabase } from "../../server/backup";
import { emptyState } from "../../app/src/coach/engine";

const code = () => randomBytes(32).toString("base64url");
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "enarm-api-test-"));
  const path = join(dir, "progress.sqlite");
  let app = createProgressServer({ database: path, origin: "https://enarm.musel.dev", maxBytes: 20_000 });
  async function start() { await new Promise<void>(resolve => app.server.listen(0, "127.0.0.1", resolve)); }
  async function stop() { app.server.closeAllConnections(); await new Promise<void>(resolve => app.server.close(() => resolve())); app.database.close(); }
  await start();
  return {
    path,
    async request(token: string, method = "GET", body?: unknown, suffix = "", origin?: string) {
      const address = app.server.address();
      assert.ok(address && typeof address === "object");
      return fetch(`http://127.0.0.1:${address.port}/api/progress${suffix}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    },
    async restart() { await stop(); app = createProgressServer({ database: path, origin: "https://enarm.musel.dev", maxBytes: 20_000 }); await start(); },
    async close() { await stop(); await rm(dir, { recursive: true, force: true }); },
  };
}

test("progress is private, durable and migrates the complete local snapshot", async () => {
  const api = await fixture();
  try {
    const token = code();
    assert.equal((await api.request("")).status, 401);
    assert.equal((await api.request("short")).status, 401);
    assert.equal((await api.request(token)).status, 404);
    assert.equal((await api.request(token, "GET", undefined, "", "https://other.example")).status, 403);
    const initial = { ...emptyState(), revision: 12 };
    const result = await api.request(token, "PUT", { expected_revision: 0, state: initial, preserve: false });
    assert.equal(result.status, 200);
    const { state } = await result.json();
    assert.equal(state.revision, 13);
    assert.equal(result.headers.get("cache-control"), "no-store");
    await api.restart();
    assert.deepEqual((await (await api.request(token)).json()).state, state);
    assert.equal((await api.request(code())).status, 404);
  } finally { await api.close(); }
});

test("an online backup contains committed progress while the service database stays open", async () => {
  const api = await fixture();
  try {
    const token = code();
    const initial = await (await api.request(token, "PUT", { expected_revision: 0, state: emptyState(), preserve: false })).json();
    const path = await backupDatabase(api.path, join(api.path, "..", "backups"));
    assert.ok(path);
    const copy = createProgressServer({ database: path, origin: "https://enarm.musel.dev" });
    try { assert.equal(copy.database.prepare("SELECT state FROM profiles").get()!.state, JSON.stringify(initial.state)); }
    finally { copy.database.close(); }
  } finally { await api.close(); }
});

test("CAS protects concurrent devices and identical retries are idempotent", async () => {
  const api = await fixture();
  try {
    const token = code();
    const create = { expected_revision: 0, state: emptyState(), preserve: false };
    const first = await (await api.request(token, "PUT", create)).json();
    assert.deepEqual(await (await api.request(token, "PUT", create)).json(), first);
    const next = { ...first.state, preferences: { sound: true, low_motion: false } };
    const update = { expected_revision: 1, state: next, preserve: false };
    const [a, b] = await Promise.all([api.request(token, "PUT", update), api.request(token, "PUT", { ...update, state: { ...next, preferences: { sound: false, low_motion: true } } })]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    const saved = await (a.status === 200 ? a : b).json();
    assert.equal(saved.state.revision, 2);
    const stale = await api.request(token, "PUT", create);
    assert.equal(stale.status, 409);
    assert.deepEqual((await stale.json()).state, saved.state);
  } finally { await api.close(); }
});

test("server import recovery is atomic and a retry preserves its original snapshot", async () => {
  const api = await fixture();
  try {
    const token = code();
    const initial = await (await api.request(token, "PUT", { expected_revision: 0, state: emptyState(), preserve: false })).json();
    const imported = { expected_revision: 1, state: { ...initial.state, preferences: { sound: true, low_motion: true } }, preserve: true };
    const saved = await (await api.request(token, "PUT", imported)).json();
    await api.restart();
    assert.deepEqual(await (await api.request(token, "PUT", imported)).json(), saved);
    assert.deepEqual((await (await api.request(token, "GET", undefined, "/previous")).json()).state, initial.state);
    const conflict = await api.request(token, "PUT", { ...imported, state: initial.state });
    assert.equal(conflict.status, 409);
    assert.deepEqual((await (await api.request(token, "GET", undefined, "/previous")).json()).state, initial.state);
  } finally { await api.close(); }
});

test("invalid states and oversized bodies cannot replace saved progress", async () => {
  const api = await fixture();
  try {
    const token = code();
    assert.equal((await api.request(token, "PUT", { expected_revision: 0, state: {}, preserve: false })).status, 422);
    assert.equal((await api.request(token, "PUT", { expected_revision: -1, state: emptyState(), preserve: false })).status, 422);
    assert.equal((await api.request(token, "PUT", { padding: "x".repeat(21_000) })).status, 413);
    assert.equal((await api.request(token)).status, 404);
  } finally { await api.close(); }
});
