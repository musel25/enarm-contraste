import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt } from "node:crypto";

export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
// One scrypt run gives two keys: one checks the password, one unwraps the private progress code.
export function deriveKeys(
  password: string,
  salt: Buffer,
): Promise<{ verifier: Buffer; key: Buffer }> {
  return new Promise((resolve, reject) =>
    scrypt(
      password.normalize("NFKC"),
      salt,
      64,
      { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, derived) => {
        if (error) reject(error);
        else
          resolve({
            verifier: createHash("sha256").update(derived.subarray(0, 32)).digest(),
            key: derived.subarray(32),
          });
      },
    ),
  );
}
export function wrap(code: string, key: Buffer) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}
export function unwrap(wrapped: string, key: Buffer) {
  const raw = Buffer.from(wrapped, "base64"),
    decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
