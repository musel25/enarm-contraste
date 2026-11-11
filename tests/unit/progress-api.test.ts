import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createProgressServer } from "../../server/api";
import { backupDatabase } from "../../server/backup";
import { emptyState } from "../../app/src/coach/engine";
import { migrateProfile } from "../../app/src/coach/profile";

test("profile migration preserves the old snapshot and rejects a legacy client downgrade", async () => {
  const api = await fixture();
  try {
    const token = code();
    const first = await (
      await api.request(token, "PUT", {
        expected_revision: 0,
        state: emptyState(),
        preserve: false,
      })
    ).json();
    const body = {
      expected_revision: first.state.revision,
      state: migrateProfile(first.state),
      preserve: false,
    };
    const response = await api.request(token, "PUT", body);
    assert.equal(response.status, 200);
    const saved = await response.json();
    assert.equal(saved.state.version, 2);
    assert.deepEqual(await (await api.request(token, "PUT", body)).json(), saved);
    assert.deepEqual(await (await api.request(token, "GET", undefined, "/previous")).json(), first);
    const downgrade = await api.request(token, "PUT", {
      expected_revision: saved.state.revision,
      state: emptyState(),
      preserve: false,
    });
    assert.equal(downgrade.status, 409);
    assert.match((await downgrade.json()).error, /actualiza/i);
    assert.deepEqual(await (await api.request(token)).json(), saved);
  } finally {
    await api.close();
  }
});

const code = () => randomBytes(32).toString("base64url");

test("private card payloads reject malformed data and persist through retries and recovery", async () => {
  const api = await fixture();
  try {
    const token = code();
    const invalid = await api.request(token, "PUT", {
      expected_revision: 0,
      state: { ...emptyState(), created_cards: { x: { front: 1 } } },
      preserve: false,
    });
    assert.equal(invalid.status, 422);
    const id = "created/6a9121c5-fc78-453b-90a7-d265eed8a90e";
    const state = {
      ...emptyState(),
      created_cards: {
        [id]: {
          id,
          section_id: "01",
          source_card_id: "eje/01.01",
          source_block_id: "01.01",
          front: "Question",
          back: "Answer",
          created_at: "2026-11-04T12:00:00.000Z",
        },
      },
      suspended_cards: [id],
    };
    const body = { expected_revision: 0, state, preserve: false };
    const first = await api.request(token, "PUT", body);
    assert.equal(first.status, 200);
    const saved = await first.json();
    assert.deepEqual(await (await api.request(token, "PUT", body)).json(), saved);
    const edit = (front: unknown, section = "01") => ({
      expected_revision: saved.state.revision,
      state: {
        ...state,
        created_cards: { [id]: { ...state.created_cards[id], front, section_id: section } },
      },
      preserve: false,
    });
    for (const bad of [edit(5), edit(" "), edit("Pregunta", "2")]) {
      const rejected = await api.request(token, "PUT", bad);
      assert.equal(rejected.status, 422);
    }
    const edited = await api.request(token, "PUT", edit("Pregunta editada", "02"));
    assert.equal(edited.status, 200);
    const editedBody = await edited.json();
    assert.equal(editedBody.state.created_cards[id].front, "Pregunta editada");
    assert.equal(editedBody.state.created_cards[id].section_id, "02");
    assert.deepEqual(
      await (await api.request(token, "PUT", edit("Pregunta editada", "02"))).json(),
      editedBody,
    );
    const restore = await api.request(token, "PUT", {
      expected_revision: editedBody.state.revision,
      state,
      preserve: false,
    });
    assert.equal(restore.status, 200);
    saved.state.revision = (await restore.json()).state.revision;
    assert.equal((await api.request(code())).status, 404);
    await api.restart();
    assert.deepEqual(await (await api.request(token)).json(), saved);
    const replace = await api.request(token, "PUT", {
      expected_revision: saved.state.revision,
      state: emptyState(),
      preserve: true,
    });
    assert.equal(replace.status, 200);
    assert.deepEqual(await (await api.request(token, "GET", undefined, "/previous")).json(), saved);
  } finally {
    await api.close();
  }
});
async function fixture(limits: { requestLimit?: number; createLimit?: number } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "enarm-api-test-"));
  const path = join(dir, "progress.sqlite");
  let app = createProgressServer({
    database: path,
    origin: "https://enarm.musel.dev",
    maxBytes: 20_000,
    ...limits,
  });
  async function start() {
    await new Promise<void>((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  }
  async function stop() {
    app.server.closeAllConnections();
    await new Promise<void>((resolve) => app.server.close(() => resolve()));
    app.database.close();
  }
  await start();
  return {
    path,
    async request(token: string, method = "GET", body?: unknown, suffix = "", origin?: string) {
      const address = app.server.address();
      assert.ok(address && typeof address === "object");
      return fetch(`http://127.0.0.1:${address.port}/api/progress${suffix}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(origin ? { Origin: origin } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    },
    server: () => app.server,
    async restart() {
      await stop();
      app = createProgressServer({
        database: path,
        origin: "https://enarm.musel.dev",
        maxBytes: 20_000,
      });
      await start();
    },
    async close() {
      await stop();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

test("progress is private, durable and migrates the complete local snapshot", async () => {
  const api = await fixture();
  try {
    const token = code();
    assert.equal((await api.request("")).status, 401);
    assert.equal((await api.request("short")).status, 401);
    assert.equal((await api.request(token)).status, 404);
    assert.equal(
      (await api.request(token, "GET", undefined, "", "https://other.example")).status,
      403,
    );
    const initial = { ...emptyState(), revision: 12 };
    const result = await api.request(token, "PUT", {
      expected_revision: 0,
      state: initial,
      preserve: false,
    });
    assert.equal(result.status, 200);
    const { state } = await result.json();
    assert.equal(state.revision, 13);
    assert.equal(result.headers.get("cache-control"), "no-store");
    await api.restart();
    assert.deepEqual((await (await api.request(token)).json()).state, state);
    assert.equal((await api.request(code())).status, 404);
  } finally {
    await api.close();
  }
});

test("an online backup contains committed progress while the service database stays open", async () => {
  const api = await fixture();
  try {
    const token = code();
    const initial = await (
      await api.request(token, "PUT", {
        expected_revision: 0,
        state: emptyState(),
        preserve: false,
      })
    ).json();
    const path = await backupDatabase(api.path, join(api.path, "..", "backups"));
    assert.ok(path);
    const copy = createProgressServer({ database: path, origin: "https://enarm.musel.dev" });
    try {
      assert.equal(
        copy.database.prepare("SELECT state FROM profiles").get()!.state,
        JSON.stringify(initial.state),
      );
    } finally {
      copy.database.close();
    }
  } finally {
    await api.close();
  }
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
  } finally {
    await api.close();
  }
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
    const [a, b] = await Promise.all([
      api.request(token, "PUT", update),
      api.request(token, "PUT", {
        ...update,
        state: { ...next, preferences: { sound: false, low_motion: true } },
      }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    const saved = await (a.status === 200 ? a : b).json();
    assert.equal(saved.state.revision, 2);
    const stale = await api.request(token, "PUT", create);
    assert.equal(stale.status, 409);
    assert.deepEqual((await stale.json()).state, saved.state);
  } finally {
    await api.close();
  }
});

test("server import recovery is atomic and a retry preserves its original snapshot", async () => {
  const api = await fixture();
  try {
    const token = code();
    const initial = await (
      await api.request(token, "PUT", {
        expected_revision: 0,
        state: emptyState(),
        preserve: false,
      })
    ).json();
    const imported = {
      expected_revision: 1,
      state: { ...initial.state, preferences: { sound: true, low_motion: true } },
      preserve: true,
    };
    const saved = await (await api.request(token, "PUT", imported)).json();
    await api.restart();
    assert.deepEqual(await (await api.request(token, "PUT", imported)).json(), saved);
    assert.deepEqual(
      (await (await api.request(token, "GET", undefined, "/previous")).json()).state,
      initial.state,
    );
    const conflict = await api.request(token, "PUT", { ...imported, state: initial.state });
    assert.equal(conflict.status, 409);
    assert.deepEqual(
      (await (await api.request(token, "GET", undefined, "/previous")).json()).state,
      initial.state,
    );
  } finally {
    await api.close();
  }
});

test("invalid states and oversized bodies cannot replace saved progress", async () => {
  const api = await fixture();
  try {
    const token = code();
    assert.equal(
      (await api.request(token, "PUT", { expected_revision: 0, state: {}, preserve: false }))
        .status,
      422,
    );
    assert.equal(
      (
        await api.request(token, "PUT", {
          expected_revision: -1,
          state: emptyState(),
          preserve: false,
        })
      ).status,
      422,
    );
    assert.equal((await api.request(token, "PUT", { padding: "x".repeat(21_000) })).status, 413);
    assert.equal((await api.request(token)).status, 404);
  } finally {
    await api.close();
  }
});

test("an account links a username and password to the same private progress", async () => {
  const api = await fixture();
  try {
    const token = code(),
      other = code();
    const call = (path: string, body: unknown, bearer?: string) => {
      const address = api.server().address();
      assert.ok(address && typeof address === "object");
      return fetch(`http://127.0.0.1:${address.port}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify(body),
      });
    };
    assert.equal(
      (
        await api.request(token, "PUT", {
          expected_revision: 0,
          state: { ...emptyState(), revision: 3 },
          preserve: false,
        })
      ).status,
      200,
    );
    assert.equal(
      (await call("/api/account", { username: "x", password: "longenough" }, token)).status,
      422,
    );
    assert.equal(
      (await call("/api/account", { username: "alessa", password: "short" }, token)).status,
      422,
    );
    assert.equal(
      (await call("/api/account", { username: "Alessa", password: "secreto-largo" }, token)).status,
      201,
    );
    assert.equal(
      (await call("/api/account", { username: "otra", password: "secreto-largo" }, token)).status,
      409,
    );
    assert.equal(
      (await call("/api/account", { username: "alessa", password: "secreto-largo" }, other)).status,
      409,
    );
    const status = await fetch(
      `http://127.0.0.1:${(api.server().address() as { port: number }).port}/api/account`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.deepEqual(await status.json(), { username: "alessa" });
    assert.equal(
      (await call("/api/account/login", { username: "alessa", password: "incorrecta" })).status,
      401,
    );
    assert.equal(
      (await call("/api/account/login", { username: "nadie", password: "secreto-largo" })).status,
      401,
    );
    const login = await call("/api/account/login", {
      username: " ALESSA ",
      password: "secreto-largo",
    });
    assert.equal(login.status, 200);
    assert.deepEqual(await login.json(), { username: "alessa", code: token });
    assert.equal(
      (
        await call(
          "/api/account/password",
          { password: "incorrecta", new_password: "nueva-clave-1" },
          token,
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await call(
          "/api/account/password",
          { password: "secreto-largo", new_password: "nueva-clave-1" },
          token,
        )
      ).status,
      200,
    );
    assert.equal(
      (await call("/api/account/login", { username: "alessa", password: "secreto-largo" })).status,
      401,
    );
    await api.restart();
    const again = await call("/api/account/login", {
      username: "alessa",
      password: "nueva-clave-1",
    });
    assert.deepEqual(await again.json(), { username: "alessa", code: token });
    const raw = new (await import("node:sqlite")).DatabaseSync(api.path);
    const stored = JSON.stringify(raw.prepare("SELECT * FROM accounts").all());
    raw.close();
    assert.ok(
      !stored.includes(token) && !stored.includes("nueva-clave-1"),
      "the code and the password are never stored in clear text",
    );
  } finally {
    await api.close();
  }
});

test("login attempts are limited per username", async () => {
  const api = await fixture();
  try {
    const port = (api.server().address() as { port: number }).port;
    const login = (password: string) =>
      fetch(`http://127.0.0.1:${port}/api/account/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alguien", password }),
      });
    for (let n = 0; n < 10; n++) assert.equal((await login("incorrecta")).status, 401);
    assert.equal((await login("incorrecta")).status, 429);
  } finally {
    await api.close();
  }
});

test("concurrent login failures cannot bypass the username limit", async () => {
  const api = await fixture();
  try {
    const port = (api.server().address() as { port: number }).port;
    const responses = await Promise.all(
      Array.from({ length: 12 }, () =>
        fetch(`http://127.0.0.1:${port}/api/account/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "unknown_student", password: "wrong-password" }),
        }),
      ),
    );
    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [401, 401, 401, 401, 401, 401, 401, 401, 401, 401, 429, 429],
    );
  } finally {
    await api.close();
  }
});

test("account routes share the IP request budget", async () => {
  const api = await fixture({ requestLimit: 2 });
  try {
    const port = (api.server().address() as { port: number }).port;
    const headers = { Authorization: `Bearer ${code()}` };
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/account`, { headers })).status, 200);
    assert.equal((await api.request(code())).status, 404);
    const response = await fetch(`http://127.0.0.1:${port}/api/account/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "unknown", password: "long-password" }),
    });
    assert.equal(response.status, 429);
  } finally {
    await api.close();
  }
});

test("registration reserves creation capacity before concurrent password work", async () => {
  const api = await fixture({ createLimit: 2 });
  try {
    const port = (api.server().address() as { port: number }).port;
    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        fetch(`http://127.0.0.1:${port}/api/account`, {
          method: "POST",
          headers: { Authorization: `Bearer ${code()}`, "Content-Type": "application/json" },
          body: JSON.stringify({ username: `new_student_${i}`, password: "long-password" }),
        }),
      ),
    );
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 201, 429, 429, 429]);
    // Registration and initial progress use separate budgets, so onboarding still works.
    assert.equal(
      (
        await api.request(code(), "PUT", {
          expected_revision: 0,
          state: emptyState(),
          preserve: false,
        })
      ).status,
      200,
    );
  } finally {
    await api.close();
  }
});

test("the per-IP request limit is configurable and defaults stay strict", async () => {
  const dir = await mkdtemp(join(tmpdir(), "enarm-limit-test-"));
  const app = createProgressServer({
    database: join(dir, "p.sqlite"),
    origin: "https://enarm.musel.dev",
    requestLimit: 3,
  });
  await new Promise<void>((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (app.server.address() as { port: number }).port,
      token = code();
    const statuses = [];
    for (let n = 0; n < 4; n++)
      statuses.push(
        (
          await fetch(`http://127.0.0.1:${port}/api/progress`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        ).status,
      );
    assert.deepEqual(statuses, [404, 404, 404, 429]);
  } finally {
    app.server.closeAllConnections();
    await new Promise<void>((resolve) => app.server.close(() => resolve()));
    app.database.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("malformed enum types cannot replace saved progress", async () => {
  const api = await fixture();
  try {
    const token = code();
    const saved = await (
      await api.request(token, "PUT", {
        expected_revision: 0,
        state: emptyState(),
        preserve: false,
      })
    ).json();
    const malformed = {
      ...saved.state,
      plan: {
        id: "plan",
        revision: 1,
        mode: ["deadline"],
        start_day: "2026-11-04",
        deadline_day: null,
        minutes_per_day: 5,
        section_ids: ["01"],
        families: ["eje"],
        timezone: "UTC",
      },
    };
    assert.equal(
      (await api.request(token, "PUT", { expected_revision: 1, state: malformed, preserve: false }))
        .status,
      422,
    );
    assert.deepEqual(await (await api.request(token)).json(), saved);
  } finally {
    await api.close();
  }
});
