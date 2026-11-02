import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { validateState } from "../app/src/coach/engine";

type Row = { revision: number; state: string; previous: string | null; fingerprint: string };
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
type Account = { username: string; salt: string; verifier: string; wrapped: string; code_hash: string };
const USERNAME = /^[a-z0-9._-]{3,40}$/;
const validPassword = (value: unknown): value is string => typeof value === "string" && value.length >= 8 && value.length <= 200;
const normalizeUser = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";
// One scrypt run gives two keys: one checks the password, one unwraps the private progress code.
function deriveKeys(password: string, salt: Buffer): Promise<{ verifier: Buffer; key: Buffer }> {
  return new Promise((resolve, reject) => scrypt(password.normalize("NFKC"), salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, derived) => {
    if (error) reject(error); else resolve({ verifier: createHash("sha256").update(derived.subarray(0, 32)).digest(), key: derived.subarray(32) });
  }));
}
function wrap(code: string, key: Buffer) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}
function unwrap(wrapped: string, key: Buffer) {
  const raw = Buffer.from(wrapped, "base64"), decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

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

export function createProgressServer({ database: path, origin, maxBytes = 20_000_000, requestLimit = 400, createLimit = 100 }: { database: string; origin: string; maxBytes?: number; requestLimit?: number; createLimit?: number }) {
  const database = new DatabaseSync(path);
  database.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;");
  database.exec("CREATE TABLE IF NOT EXISTS profiles (code_hash TEXT PRIMARY KEY, revision INTEGER NOT NULL, state TEXT NOT NULL, previous TEXT, fingerprint TEXT NOT NULL, updated_at TEXT NOT NULL)");
  database.exec("CREATE TABLE IF NOT EXISTS accounts (username TEXT PRIMARY KEY, salt TEXT NOT NULL, verifier TEXT NOT NULL, wrapped TEXT NOT NULL, code_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)");
  const findAccount = database.prepare("SELECT username,salt,verifier,wrapped,code_hash FROM accounts WHERE username=?");
  const accountForCode = database.prepare("SELECT username FROM accounts WHERE code_hash=?");
  const insertAccount = database.prepare("INSERT INTO accounts VALUES (?,?,?,?,?,?,?)");
  const updateAccount = database.prepare("UPDATE accounts SET salt=?,verifier=?,wrapped=?,updated_at=? WHERE username=?");
  const failures = new Map<string, { window: number; count: number }>();
  const tooMany = (key: string, limit: number) => {
    const window = Math.floor(Date.now() / 900_000), entry = failures.get(key);
    if (failures.size > 10_000) for (const [k, v] of failures) if (v.window !== window) failures.delete(k);
    return !!entry && entry.window === window && entry.count >= limit;
  };
  const fail = (key: string) => {
    const window = Math.floor(Date.now() / 900_000), entry = failures.get(key);
    failures.set(key, entry && entry.window === window ? { window, count: entry.count + 1 } : { window, count: 1 });
  };
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
      const ip = String(request.headers["x-real-ip"] || request.socket.remoteAddress);
      if (request.url === "/api/account/login") {
        if (request.method !== "POST") throw new HttpError(405, "Método no permitido.");
        if (!request.headers["content-type"]?.startsWith("application/json")) throw new HttpError(415, "Se necesita JSON.");
        const body = await readBody(request, 4_096) as { username?: unknown; password?: unknown } | null;
        const username = normalizeUser(body?.username);
        if (tooMany(`ip:${ip}`, 30) || tooMany(`user:${username}`, 10)) throw new HttpError(429, "Demasiados intentos. Espera 15 minutos.");
        const account = USERNAME.test(username) ? findAccount.get(username) as Account | undefined : undefined;
        const password = validPassword(body?.password) ? body!.password as string : "";
        // Derive keys even for unknown users so the response time does not reveal accounts.
        const keys = await deriveKeys(password || "-", account ? Buffer.from(account.salt, "base64") : randomBytes(16));
        if (!account || !password || !timingSafeEqual(keys.verifier, Buffer.from(account.verifier, "base64"))) {
          fail(`ip:${ip}`); fail(`user:${username}`);
          throw new HttpError(401, "Usuario o contraseña incorrectos.");
        }
        reply(response, 200, { username, code: unwrap(account.wrapped, keys.key) }); return;
      }
      if (!["/api/progress", "/api/progress/previous", "/api/account", "/api/account/password"].includes(request.url || "")) throw new HttpError(404, "Ruta no disponible.");
      const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.authorization || "");
      if (!match) throw new HttpError(401, "Se necesita un código de progreso válido.");
      const digest = hash(match[1]);
      if (request.url === "/api/account" && request.method === "GET") {
        const row = accountForCode.get(digest) as { username: string } | undefined;
        reply(response, 200, { username: row?.username ?? null }); return;
      }
      if (request.url?.startsWith("/api/account")) {
        if (request.method !== "POST") throw new HttpError(405, "Método no permitido.");
        if (!request.headers["content-type"]?.startsWith("application/json")) throw new HttpError(415, "Se necesita JSON.");
        if (tooMany(`ip:${ip}`, 30)) throw new HttpError(429, "Demasiados intentos. Espera 15 minutos.");
        const body = await readBody(request, 4_096) as { username?: unknown; password?: unknown; new_password?: unknown } | null;
        const now = new Date().toISOString();
        if (request.url === "/api/account") {
          const username = normalizeUser(body?.username);
          if (!USERNAME.test(username)) throw new HttpError(422, "El usuario debe tener de 3 a 40 letras, números, puntos, guiones o guiones bajos.");
          if (!validPassword(body?.password)) throw new HttpError(422, "La contraseña debe tener al menos 8 caracteres.");
          if (accountForCode.get(digest)) throw new HttpError(409, "Este progreso ya tiene un usuario.");
          if (findAccount.get(username)) throw new HttpError(409, "Ese usuario ya existe. Elige otro.");
          const salt = randomBytes(16), keys = await deriveKeys(body!.password as string, salt);
          try { insertAccount.run(username, salt.toString("base64"), keys.verifier.toString("base64"), wrap(match[1], keys.key), digest, now, now); }
          catch { throw new HttpError(409, "Ese usuario ya existe. Elige otro."); }
          reply(response, 201, { username }); return;
        }
        const owner = accountForCode.get(digest) as { username: string } | undefined;
        const account = owner && findAccount.get(owner.username) as Account | undefined;
        if (!account) throw new HttpError(404, "Este progreso no tiene usuario.");
        if (!validPassword(body?.new_password)) throw new HttpError(422, "La contraseña nueva debe tener al menos 8 caracteres.");
        const current = await deriveKeys(validPassword(body?.password) ? body!.password as string : "-", Buffer.from(account.salt, "base64"));
        if (!timingSafeEqual(current.verifier, Buffer.from(account.verifier, "base64"))) { fail(`ip:${ip}`); throw new HttpError(401, "La contraseña actual no es correcta."); }
        const salt = randomBytes(16), keys = await deriveKeys(body!.new_password as string, salt);
        updateAccount.run(salt.toString("base64"), keys.verifier.toString("base64"), wrap(match[1], keys.key), now, account.username);
        reply(response, 200, { username: account.username }); return;
      }
      const minute = Math.floor(Date.now() / 60_000), hour = Math.floor(minute / 60);
      if (!limits.has(ip) && limits.size >= 10_000) {
        for (const [key, value] of limits) if (value.hour !== hour) limits.delete(key);
        if (limits.size >= 10_000) throw new HttpError(429, "Inténtalo más tarde.");
      }
      const limit = limits.get(ip) || { minute, requests: 0, hour, creates: 0 };
      if (limit.minute !== minute) { limit.minute = minute; limit.requests = 0; }
      if (limit.hour !== hour) { limit.hour = hour; limit.creates = 0; }
      limits.set(ip, limit);
      if (++limit.requests > requestLimit) throw new HttpError(429, "Demasiadas solicitudes. Inténtalo más tarde.");
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
        if (!row && ++limit.creates > createLimit) { database.exec("ROLLBACK"); throw new HttpError(429, "Demasiados perfiles nuevos. Inténtalo más tarde."); }
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
