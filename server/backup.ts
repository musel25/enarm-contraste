import { existsSync } from "node:fs";
import { chmod, mkdir, readdir, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { backup, DatabaseSync } from "node:sqlite";

export async function backupDatabase(source: string, directory: string, now = new Date()): Promise<string | null> {
  if (!existsSync(source)) return null;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const destination = join(directory, `progress-${now.toISOString().replace(/[:.]/g, "-")}.sqlite`);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  const database = new DatabaseSync(source, { readOnly: true });
  try {
    await backup(database, temporary); await chmod(temporary, 0o600); await rename(temporary, destination);
    const files = (await readdir(directory)).filter(name => /^progress-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.sqlite$/.test(name)).sort();
    for (const file of files.slice(0, Math.max(0, files.length - 14))) await unlink(join(directory, file));
    return destination;
  } finally { database.close(); await unlink(temporary).catch(() => {}); }
}
