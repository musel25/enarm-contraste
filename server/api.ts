import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { validateState } from "../app/src/coach/engine";

type Row = { revision: number; state: string; previous: string | null; fingerprint: string };
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function readBody(request: IncomingMessage, maxBytes: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0, failed = false;
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) { if (!failed) reject(new HttpError(413, "El progreso supera el límite de tamaño.")); failed = true; chunks.length = 0; }
      else if (!failed) chunks.push(chunk);
    });
    request.on("error", () => reject(new HttpError(400, "Solicitud incompleta.")));
    request.on("end", () => {
      if (failed) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new HttpError(400, "JSON no válido.")); }
    });
  });
}

export function createProgressServer({ database: path, origin, maxBytes = 20_000_000 }: { database: string; origin: string; maxBytes?: number }) {
  const database = new DatabaseSync(path);
  database.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;");
  database.exec("CREATE TABLE IF NOT EXISTS profiles (code_hash TEXT PRIMARY KEY, revision INTEGER NOT NULL, state TEXT NOT NULL, previous TEXT, fingerprint TEXT NOT NULL, updated_at TEXT NOT NULL)");
  const find = database.prepare("SELECT revision,state,previous,fingerprint FROM profiles WHERE code_hash=?");
  const insert = database.prepare("INSERT INTO profiles VALUES (?,?,?,?,?,?)");
  const update = database.prepare("UPDATE profiles SET revision=?,state=?,previous=?,fingerprint=?,updated_at=? WHERE code_hash=?");
  const limits = new Map<string, { minute: number; requests: number; hour: number; creates: number }>();
  const reply = (response: ServerResponse, status: number, value: unknown) => {
    response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end(JSON.stringify(value));
  };
  const server = createServer(async (request, response) => {
    try {
      if (request.headers.origin && request.headers.origin !== origin) throw new HttpError(403, "Origen no permitido.");
      if (request.url === "/api/health" && request.method === "GET") { reply(response, 200, { ok: true }); return; }
      if (!["/api/progress", "/api/progress/previous"].includes(request.url || "")) throw new HttpError(404, "Ruta no disponible.");
      const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.authorization || "");
      if (!match) throw new HttpError(401, "Se necesita un código de progreso válido.");
      const digest = hash(match[1]);
      const ip = String(request.headers["x-real-ip"] || request.socket.remoteAddress);
      const minute = Math.floor(Date.now() / 60_000), hour = Math.floor(minute / 60);
      if (!limits.has(ip) && limits.size >= 10_000) {
        for (const [key, value] of limits) if (value.hour !== hour) limits.delete(key);
        if (limits.size >= 10_000) throw new HttpError(429, "Inténtalo más tarde.");
      }
      const limit = limits.get(ip) || { minute, requests: 0, hour, creates: 0 };
      if (limit.minute !== minute) { limit.minute = minute; limit.requests = 0; }
      if (limit.hour !== hour) { limit.hour = hour; limit.creates = 0; }
      limits.set(ip, limit);
      if (++limit.requests > 400) throw new HttpError(429, "Demasiadas solicitudes. Inténtalo más tarde.");
      if (request.method === "GET") {
        const row = find.get(digest) as Row | undefined;
        if (!row) throw new HttpError(404, "No encontramos progreso con este código.");
        reply(response, 200, { state: request.url!.endsWith("/previous") ? row.previous ? JSON.parse(row.previous) : null : JSON.parse(row.state) }); return;
      }
      if (request.method !== "PUT" || request.url !== "/api/progress") throw new HttpError(405, "Método no permitido.");
      if (!request.headers["content-type"]?.startsWith("application/json")) throw new HttpError(415, "Se necesita JSON.");
      if (Number(request.headers["content-length"]) > maxBytes) { request.resume(); throw new HttpError(413, "El progreso supera el límite de tamaño."); }
      const body = await readBody(request, maxBytes) as { expected_revision?: unknown; state?: unknown; preserve?: unknown } | null;
      if (!body || !Number.isSafeInteger(body.expected_revision) || Number(body.expected_revision) < 0 || typeof body.preserve !== "boolean" || !validateState(body.state)) throw new HttpError(422, "El progreso no pasó la comprobación.");
      const expected = Number(body.expected_revision);
      const fingerprint = hash(JSON.stringify(body));
      database.exec("BEGIN IMMEDIATE");
      try {
        const row = find.get(digest) as Row | undefined;
        if (row?.fingerprint === fingerprint) { database.exec("COMMIT"); reply(response, 200, { state: JSON.parse(row.state) }); return; }
        if ((row && row.revision !== expected) || (!row && expected !== 0)) {
          database.exec("COMMIT"); reply(response, 409, { error: "Otro dispositivo guardó progreso nuevo.", state: row ? JSON.parse(row.state) : null }); return;
        }
        if (!row && ++limit.creates > 100) { database.exec("ROLLBACK"); throw new HttpError(429, "Demasiados perfiles nuevos. Inténtalo más tarde."); }
        const revision = row ? row.revision + 1 : Math.max(1, body.state.revision + 1);
        if (!Number.isSafeInteger(revision)) { database.exec("ROLLBACK"); throw new HttpError(422, "Revisión no válida."); }
        const saved = { ...body.state, revision };
        const encoded = JSON.stringify(saved);
        const previous = body.preserve && row ? row.state : row?.previous || null;
        const now = new Date().toISOString();
        if (row) update.run(revision, encoded, previous, fingerprint, now, digest);
        else insert.run(digest, revision, encoded, previous, fingerprint, now);
        database.exec("COMMIT"); reply(response, 200, { state: saved });
      } catch (failure) { if (database.isTransaction) database.exec("ROLLBACK"); throw failure; }
    } catch (failure) {
      const error = failure instanceof HttpError ? failure : new HttpError(503, "No se pudo guardar en el VPS. Reintenta sin cerrar la página.");
      reply(response, error.status, { error: error.message });
    }
  });
  server.requestTimeout = 30_000; server.headersTimeout = 15_000;
  return { server, database };
}
