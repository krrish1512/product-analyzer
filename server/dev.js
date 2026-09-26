import "dotenv/config";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "./app.js";
import { applyMigrations } from "./migration-runner.js";
import { seedCatalog } from "./seed-catalog.js";

const database = process.env.DATABASE_URL
  ? (await import("./db.js")).pool
  : new PGlite();

await applyMigrations(database);
await seedCatalog(database);

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const server = createApp(database).listen(port, "0.0.0.0", () => {
  const databaseMode = process.env.DATABASE_URL ? "PostgreSQL" : "in-memory PostgreSQL";
  console.log(`Pricewise development API listening on port ${port} (${databaseMode})`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);
  server.close(async () => {
    if (process.env.DATABASE_URL) await database.end();
    else await database.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));