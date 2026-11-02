import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createProgressServer } from "./api";
import { backupDatabase } from "./backup";

const database = process.env.ENARM_DATABASE || "tmp/progress.sqlite";
mkdirSync(dirname(database), { recursive: true, mode: 0o700 });
if (process.argv.includes("--backup")) {
  await backupDatabase(database, `${dirname(database)}/backups`);
  console.log("ENARM progress backup complete");
} else {
  // Per-IP limits protect production. The local runner raises them for the browser test suite.
  const limit = (name: string, fallback: number) => Number.isSafeInteger(Number(process.env[name])) && Number(process.env[name]) > 0 ? Number(process.env[name]) : fallback;
  const app = createProgressServer({ database, origin: process.env.ENARM_ORIGIN || "http://127.0.0.1:4178",
    requestLimit: limit("ENARM_REQUEST_LIMIT", 400), createLimit: limit("ENARM_CREATE_LIMIT", 100) });
  app.server.listen(Number(process.env.ENARM_PORT || 4187), "127.0.0.1", () => console.log("ENARM progress service ready"));
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => {
    app.server.close(() => { app.database.close(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
