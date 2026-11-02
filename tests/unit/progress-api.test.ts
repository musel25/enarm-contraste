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
    server: () => app.server,
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

test("a later same-day backup does not overwrite the pre-deployment snapshot", async () => {
  const api = await fixture();
  try {
    const token = code();
    await api.request(token, "PUT", { expected_revision: 0, state: emptyState(), preserve: false });
    const directory = join(api.path, "..", "backups");
    const before = await backupDatabase(api.path, directory, new Date("2026-10-29T12:00:00Z"));
    const after = await backupDatabase(api.path, directory, new Date("2026-10-29T13:00:00Z"));
    assert.notEqual(before, after);
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

test("an account links a username and password to the same private progress", async () => {
  const api = await fixture();
  try {
    const token = code(), other = code();
    const call = (path: string, body: unknown, bearer?: string) => {
      const address = api.server().address();
      assert.ok(address && typeof address === "object");
      return fetch(`http://127.0.0.1:${address.port}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, body: JSON.stringify(body) });
    };
    assert.equal((await api.request(token, "PUT", { expected_revision: 0, state: { ...emptyState(), revision: 3 }, preserve: false })).status, 200);
    assert.equal((await call("/api/account", { username: "x", password: "longenough" }, token)).status, 422);
    assert.equal((await call("/api/account", { username: "alessa", password: "short" }, token)).status, 422);
    assert.equal((await call("/api/account", { username: "Alessa", password: "secreto-largo" }, token)).status, 201);
    assert.equal((await call("/api/account", { username: "otra", password: "secreto-largo" }, token)).status, 409);
    assert.equal((await call("/api/account", { username: "alessa", password: "secreto-largo" }, other)).status, 409);
    const status = await fetch(`http://127.0.0.1:${(api.server().address() as { port: number }).port}/api/account`, { headers: { Authorization: `Bearer ${token}` } });
    assert.deepEqual(await status.json(), { username: "alessa" });
    assert.equal((await call("/api/account/login", { username: "alessa", password: "incorrecta" })).status, 401);
    assert.equal((await call("/api/account/login", { username: "nadie", password: "secreto-largo" })).status, 401);
    const login = await call("/api/account/login", { username: " ALESSA ", password: "secreto-largo" });
    assert.equal(login.status, 200);
    assert.deepEqual(await login.json(), { username: "alessa", code: token });
    assert.equal((await call("/api/account/password", { password: "incorrecta", new_password: "nueva-clave-1" }, token)).status, 401);
    assert.equal((await call("/api/account/password", { password: "secreto-largo", new_password: "nueva-clave-1" }, token)).status, 200);
    assert.equal((await call("/api/account/login", { username: "alessa", password: "secreto-largo" })).status, 401);
    await api.restart();
    const again = await call("/api/account/login", { username: "alessa", password: "nueva-clave-1" });
    assert.deepEqual(await again.json(), { username: "alessa", code: token });
    const raw = new (await import("node:sqlite")).DatabaseSync(api.path);
    const stored = JSON.stringify(raw.prepare("SELECT * FROM accounts").all());
    raw.close();
    assert.ok(!stored.includes(token) && !stored.includes("nueva-clave-1"), "the code and the password are never stored in clear text");
  } finally { await api.close(); }
});

test("login attempts are limited per username", async () => {
  const api = await fixture();
  try {
    const port = (api.server().address() as { port: number }).port;
    const login = (password: string) => fetch(`http://127.0.0.1:${port}/api/account/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "alguien", password }) });
    for (let n = 0; n < 10; n++) assert.equal((await login("incorrecta")).status, 401);
    assert.equal((await login("incorrecta")).status, 429);
  } finally { await api.close(); }
});
