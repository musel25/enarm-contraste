import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createProgressServer } from "./api";

const database = process.env.ENARM_DATABASE || "tmp/progress.sqlite";
mkdirSync(dirname(database), { recursive: true, mode: 0o700 });
const app = createProgressServer({ database, origin: process.env.ENARM_ORIGIN || "http://127.0.0.1:4178" });
app.server.listen(Number(process.env.ENARM_PORT || 4187), "127.0.0.1", () => console.log("ENARM progress service ready"));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => {
  app.server.close(() => { app.database.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
});
