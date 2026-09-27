import assert from "node:assert/strict";
import { test } from "node:test";
import { createDevelopmentDatabase } from "./dev.js";

test("development startup falls back to embedded Postgres when the configured database is unavailable", async () => {
  const { database, usesPostgres } = await createDevelopmentDatabase("postgresql://pricewise:local-only-password@localhost:5432/pricewise");
  assert.equal(usesPostgres, false);
  const result = await database.query("SELECT 1 AS ok");
  assert.deepEqual(result.rows[0], { ok: 1 });
  await database.close();
});
