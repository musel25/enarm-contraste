import type { DatabaseSync } from "node:sqlite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { deriveKeys, hash, unwrap, wrap } from "./crypto";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { HttpError, progressCode, readBody, reply } from "./http";
import type { createRateLimits } from "./rate-limit";

type Account = {
  username: string;
  salt: string;
  verifier: string;
  wrapped: string;
  code_hash: string;
};
const USERNAME = /^[a-z0-9._-]{3,40}$/;
const validPassword = (value: unknown): value is string =>
  typeof value === "string" && value.length >= 8 && value.length <= 200;
const normalizeUser = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export function createAccountRoutes(
  database: DatabaseSync,
  limits: ReturnType<typeof createRateLimits>,
) {
  database.exec(
    "CREATE TABLE IF NOT EXISTS accounts (username TEXT PRIMARY KEY, salt TEXT NOT NULL, verifier TEXT NOT NULL, wrapped TEXT NOT NULL, code_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  );
  const findAccount = database.prepare(
    "SELECT username,salt,verifier,wrapped,code_hash FROM accounts WHERE username=?",
  );
  const accountForCode = database.prepare("SELECT username FROM accounts WHERE code_hash=?");
  const insertAccount = database.prepare("INSERT INTO accounts VALUES (?,?,?,?,?,?,?)");
  const updateAccount = database.prepare(
    "UPDATE accounts SET salt=?,verifier=?,wrapped=?,updated_at=? WHERE username=?",
  );
  const failures = new Map<string, { window: number; count: number }>();
  const inFlight = new Map<string, number>();
  const tooMany = (key: string, limit: number) => {
    const window = Math.floor(Date.now() / 900_000),
      entry = failures.get(key);
    if (failures.size > 10_000)
      for (const [k, v] of failures) if (v.window !== window) failures.delete(k);
    const failed = entry?.window === window ? entry.count : 0;
    return failed + (inFlight.get(key) ?? 0) >= limit;
  };
  const fail = (key: string) => {
    const window = Math.floor(Date.now() / 900_000),
      entry = failures.get(key);
    failures.set(
      key,
      entry && entry.window === window ? { window, count: entry.count + 1 } : { window, count: 1 },
    );
  };

  return async function handleAccount(
    request: IncomingMessage,
    response: ServerResponse,
    ip: string,
  ): Promise<boolean> {
    if (
      !["/api/account", "/api/account/login", "/api/account/password"].includes(request.url || "")
    )
      return false;
    if (request.url === "/api/account/login") {
      if (request.method !== "POST") throw new HttpError(405, "Método no permitido.");
      if (!request.headers["content-type"]?.startsWith("application/json"))
        throw new HttpError(415, "Se necesita JSON.");
      const body = (await readBody(request, 4_096)) as {
        username?: unknown;
        password?: unknown;
      } | null;
      const username = normalizeUser(body?.username);
      if (tooMany(`ip:${ip}`, 30) || tooMany(`user:${username}`, 10))
        throw new HttpError(429, "Demasiados intentos. Espera 15 minutos.");
      const attemptKeys = [`ip:${ip}`, `user:${username}`];
      for (const key of attemptKeys) inFlight.set(key, (inFlight.get(key) ?? 0) + 1);
      try {
        const account = USERNAME.test(username)
          ? (findAccount.get(username) as Account | undefined)
          : undefined;
        const password = validPassword(body?.password) ? (body!.password as string) : "";
        // Derive keys even for unknown users so the response time does not reveal accounts.
        const keys = await deriveKeys(
          password || "-",
          account ? Buffer.from(account.salt, "base64") : randomBytes(16),
        );
        if (
          !account ||
          !password ||
          !timingSafeEqual(keys.verifier, Buffer.from(account.verifier, "base64"))
        ) {
          fail(`ip:${ip}`);
          fail(`user:${username}`);
          throw new HttpError(401, "Usuario o contraseña incorrectos.");
        }
        reply(response, 200, { username, code: unwrap(account.wrapped, keys.key) });
        return true;
      } finally {
        for (const key of attemptKeys) {
          const remaining = (inFlight.get(key) ?? 1) - 1;
          if (remaining) inFlight.set(key, remaining);
          else inFlight.delete(key);
        }
      }
    }
    const code = progressCode(request);
    const digest = hash(code);
    if (request.url === "/api/account" && request.method === "GET") {
      const row = accountForCode.get(digest) as { username: string } | undefined;
      reply(response, 200, { username: row?.username ?? null });
      return true;
    }
    if (request.url?.startsWith("/api/account")) {
      if (request.method !== "POST") throw new HttpError(405, "Método no permitido.");
      if (!request.headers["content-type"]?.startsWith("application/json"))
        throw new HttpError(415, "Se necesita JSON.");
      if (tooMany(`ip:${ip}`, 30))
        throw new HttpError(429, "Demasiados intentos. Espera 15 minutos.");
      const body = (await readBody(request, 4_096)) as {
        username?: unknown;
        password?: unknown;
        new_password?: unknown;
      } | null;
      const now = new Date().toISOString();
      if (request.url === "/api/account") {
        const username = normalizeUser(body?.username);
        if (!USERNAME.test(username))
          throw new HttpError(
            422,
            "El usuario debe tener de 3 a 40 letras, números, puntos, guiones o guiones bajos.",
          );
        if (!validPassword(body?.password))
          throw new HttpError(422, "La contraseña debe tener al menos 8 caracteres.");
        if (accountForCode.get(digest))
          throw new HttpError(409, "Este progreso ya tiene un usuario.");
        if (findAccount.get(username))
          throw new HttpError(409, "Ese usuario ya existe. Elige otro.");
        limits.createAccount(ip);
        const salt = randomBytes(16),
          keys = await deriveKeys(body!.password as string, salt);
        try {
          insertAccount.run(
            username,
            salt.toString("base64"),
            keys.verifier.toString("base64"),
            wrap(code, keys.key),
            digest,
            now,
            now,
          );
        } catch {
          throw new HttpError(409, "Ese usuario ya existe. Elige otro.");
        }
        reply(response, 201, { username });
        return true;
      }
      const owner = accountForCode.get(digest) as { username: string } | undefined;
      const account = owner && (findAccount.get(owner.username) as Account | undefined);
      if (!account) throw new HttpError(404, "Este progreso no tiene usuario.");
      if (!validPassword(body?.new_password))
        throw new HttpError(422, "La contraseña nueva debe tener al menos 8 caracteres.");
      const current = await deriveKeys(
        validPassword(body?.password) ? (body!.password as string) : "-",
        Buffer.from(account.salt, "base64"),
      );
      if (!timingSafeEqual(current.verifier, Buffer.from(account.verifier, "base64"))) {
        fail(`ip:${ip}`);
        throw new HttpError(401, "La contraseña actual no es correcta.");
      }
      const salt = randomBytes(16),
        keys = await deriveKeys(body!.new_password as string, salt);
      updateAccount.run(
        salt.toString("base64"),
        keys.verifier.toString("base64"),
        wrap(code, keys.key),
        now,
        account.username,
      );
      reply(response, 200, { username: account.username });
      return true;
    }

    return true;
  };
}
