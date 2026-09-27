import "dotenv/config";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "./app.js";
import { applyMigrations } from "./migration-runner.js";
import { seedCatalog } from "./seed-catalog.js";

export async function createDevelopmentDatabase(databaseUrl = process.env.DATABASE_URL) {
  const configuredUrl = databaseUrl?.trim();
  if (!configuredUrl) {
    const database = new PGlite();
    const setupClient = database;
    await applyMigrations(setupClient);
    await seedCatalog(setupClient);
    return { database, setupClient, usesPostgres: false };
  }

  try {
    const importPath = "./db.js";
    const { pool } = await import(importPath);
    const setupClient = await pool.connect();
    await applyMigrations(setupClient);
    await seedCatalog(setupClient);
    setupClient.release();
    return { database: pool, setupClient, usesPostgres: true };
  } catch (error) {
    console.warn(`PostgreSQL connection failed for ${configuredUrl}; falling back to the embedded local database. ${error.message}`);
    const database = new PGlite();
    const setupClient = database;
    await applyMigrations(setupClient);
    await seedCatalog(setupClient);
    return { database, setupClient, usesPostgres: false };
  }
}

const { database, usesPostgres } = await createDevelopmentDatabase();
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const server = createApp(database).listen(port, "0.0.0.0", () => {
  const databaseMode = usesPostgres ? "PostgreSQL" : "in-memory PostgreSQL";
  console.log(`Pricewise development API listening on port ${port} (${databaseMode})`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);
  server.close(async () => {
    if (usesPostgres) await database.end();
    else await database.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));