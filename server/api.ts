import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { validateState } from "../app/src/coach/engine";
import { HttpError, progressCode, readBody, reply } from "./http";
import { hash } from "./crypto";
import { createAccountRoutes } from "./accounts";
import { createRateLimits } from "./rate-limit";

type Row = { revision: number; state: string; previous: string | null; fingerprint: string };
export function createProgressServer({
  database: path,
  origin,
  maxBytes = 20_000_000,
  requestLimit = 400,
  createLimit = 100,
}: {
  database: string;
  origin: string;
  maxBytes?: number;
  requestLimit?: number;
  createLimit?: number;
}) {
  const database = new DatabaseSync(path);
  database.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;");
  database.exec(
    "CREATE TABLE IF NOT EXISTS profiles (code_hash TEXT PRIMARY KEY, revision INTEGER NOT NULL, state TEXT NOT NULL, previous TEXT, fingerprint TEXT NOT NULL, updated_at TEXT NOT NULL)",
  );
  const find = database.prepare(
    "SELECT revision,state,previous,fingerprint FROM profiles WHERE code_hash=?",
  );
  const insert = database.prepare("INSERT INTO profiles VALUES (?,?,?,?,?,?)");
  const update = database.prepare(
    "UPDATE profiles SET revision=?,state=?,previous=?,fingerprint=?,updated_at=? WHERE code_hash=?",
  );
  const limits = createRateLimits(requestLimit, createLimit);
  const accounts = createAccountRoutes(database, limits);
  const server = createServer(async (request, response) => {
    try {
      if (request.headers.origin && request.headers.origin !== origin)
        throw new HttpError(403, "Origen no permitido.");
      if (request.url === "/api/health" && request.method === "GET") {
        reply(response, 200, { ok: true });
        return;
      }
      const ip = String(request.headers["x-real-ip"] || request.socket.remoteAddress);
      limits.request(ip);
      if (await accounts(request, response, ip)) return;
      if (!["/api/progress", "/api/progress/previous"].includes(request.url || ""))
        throw new HttpError(404, "Ruta no disponible.");
      const digest = hash(progressCode(request));
      if (request.method === "GET") {
        const row = find.get(digest) as Row | undefined;
        if (!row) throw new HttpError(404, "No encontramos progreso con este código.");
        reply(response, 200, {
          state: request.url!.endsWith("/previous")
            ? row.previous
              ? JSON.parse(row.previous)
              : null
            : JSON.parse(row.state),
        });
        return;
      }
      if (request.method !== "PUT" || request.url !== "/api/progress")
        throw new HttpError(405, "Método no permitido.");
      if (!request.headers["content-type"]?.startsWith("application/json"))
        throw new HttpError(415, "Se necesita JSON.");
      if (Number(request.headers["content-length"]) > maxBytes) {
        request.resume();
        throw new HttpError(413, "El progreso supera el límite de tamaño.");
      }
      const body = (await readBody(request, maxBytes)) as {
        expected_revision?: unknown;
        state?: unknown;
        preserve?: unknown;
      } | null;
      if (
        !body ||
        !Number.isSafeInteger(body.expected_revision) ||
        Number(body.expected_revision) < 0 ||
        typeof body.preserve !== "boolean" ||
        !validateState(body.state)
      )
        throw new HttpError(422, "El progreso no pasó la comprobación.");
      const expected = Number(body.expected_revision);
      const fingerprint = hash(JSON.stringify(body));
      database.exec("BEGIN IMMEDIATE");
      try {
        const row = find.get(digest) as Row | undefined;
        if (row?.fingerprint === fingerprint) {
          database.exec("COMMIT");
          reply(response, 200, { state: JSON.parse(row.state) });
          return;
        }
        if ((row && row.revision !== expected) || (!row && expected !== 0)) {
          database.exec("COMMIT");
          reply(response, 409, {
            error: "Otro dispositivo guardó progreso nuevo.",
            state: row ? JSON.parse(row.state) : null,
          });
          return;
        }
        if (!row) limits.createProfile(ip);
        const revision = row ? row.revision + 1 : Math.max(1, body.state.revision + 1);
        if (!Number.isSafeInteger(revision)) {
          database.exec("ROLLBACK");
          throw new HttpError(422, "Revisión no válida.");
        }
        const saved = { ...body.state, revision };
        const encoded = JSON.stringify(saved);
        const previous = body.preserve && row ? row.state : row?.previous || null;
        const now = new Date().toISOString();
        if (row) update.run(revision, encoded, previous, fingerprint, now, digest);
        else insert.run(digest, revision, encoded, previous, fingerprint, now);
        database.exec("COMMIT");
        reply(response, 200, { state: saved });
      } catch (failure) {
        if (database.isTransaction) database.exec("ROLLBACK");
        throw failure;
      }
    } catch (failure) {
      const error =
        failure instanceof HttpError
          ? failure
          : new HttpError(503, "No se pudo guardar en el VPS. Reintenta sin cerrar la página.");
      reply(response, error.status, { error: error.message });
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  return { server, database };
}
