import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const migrationsDirectory = fileURLToPath(new URL("./migrations/", import.meta.url));

export async function applyMigrations(client) {
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();
  const appliedMigrations = [];

  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock($1)", [318042026]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version integer PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

    for (const file of migrationFiles) {
      const version = Number.parseInt(file, 10);
      const applied = await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [version]);
      if (applied.rowCount) continue;
      const migration = await readFile(new URL(`./migrations/${file}`, import.meta.url), "utf8");
      if (typeof client.exec === "function") await client.exec(migration);
      else await client.query(migration);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      appliedMigrations.push(file);
    }

    await client.query("COMMIT");
    return appliedMigrations;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}