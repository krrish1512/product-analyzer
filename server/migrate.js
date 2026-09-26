import "dotenv/config";
import { pool } from "./db.js";
import { applyMigrations } from "./migration-runner.js";
const client = await pool.connect();

try {
  const applied = await applyMigrations(client);
  for (const file of applied) console.log(`Applied migration ${file}`);
} catch (error) {
  console.error("Database migration failed:", error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}